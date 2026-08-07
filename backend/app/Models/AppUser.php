<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

/**
 * Identity + tenancy. Custom auth (NOT Laravel's users table). Password lives in
 * `password_hash`. Roles are derived from columns (see role()).
 *
 * @property string $id
 * @property string $username
 * @property string $password_hash
 * @property bool $is_active
 * @property bool $is_admin
 * @property Carbon|null $expires_at
 * @property int $max_devices
 * @property int $max_employees
 * @property string|null $parent_user_id
 * @property bool $employees_can_view_quotes
 */
class AppUser extends Authenticatable implements JWTSubject
{
    use HasUuids;

    protected $table = 'app_users';

    protected $fillable = [
        'username', 'password_hash', 'is_active', 'is_admin', 'expires_at',
        'max_devices', 'max_employees', 'parent_user_id', 'employees_can_view_quotes',
    ];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_admin' => 'boolean',
            'employees_can_view_quotes' => 'boolean',
            'expires_at' => 'datetime',
            'max_devices' => 'integer',
            'max_employees' => 'integer',
        ];
    }

    // ── Roles ──────────────────────────────────────────────────────────────
    public function role(): string
    {
        return $this->is_admin
            ? 'admin'
            : ($this->parent_user_id === null ? 'account_owner' : 'employee');
    }

    public function isAdmin(): bool
    {
        return (bool) $this->is_admin;
    }

    public function isAccountOwner(): bool
    {
        return ! $this->is_admin && $this->parent_user_id === null;
    }

    public function isEmployee(): bool
    {
        return $this->parent_user_id !== null;
    }

    /** Owner id for the tenant "family" this user belongs to. */
    public function ownerId(): string
    {
        return $this->parent_user_id ?? $this->id;
    }

    /** All user ids in the same family (owner + its employees). */
    public function familyIds(): array
    {
        $ownerId = $this->ownerId();
        $ids = [$ownerId];
        $ids = array_merge(
            $ids,
            static::query()->where('parent_user_id', $ownerId)->pluck('id')->all()
        );

        return array_values(array_unique($ids));
    }

    // ── Auth plumbing ──────────────────────────────────────────────────────
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    // ── JWT ────────────────────────────────────────────────────────────────
    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /** @return array<string,mixed> */
    public function getJWTCustomClaims(): array
    {
        return ['role' => $this->role()];
    }

    // ── Relationships ──────────────────────────────────────────────────────
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_user_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(self::class, 'parent_user_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(UserSession::class, 'user_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(SavedQuote::class, 'user_id');
    }

    public function settings(): HasMany
    {
        return $this->hasMany(UserSetting::class, 'user_id');
    }

    public function tabPermissions(): HasMany
    {
        return $this->hasMany(UserTabPermission::class, 'user_id');
    }
}
