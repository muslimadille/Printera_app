<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AppUser;
use App\Services\Concerns\RejectsDuplicateUsernames;
use App\Support\Messages;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;

/**
 * Platform-operator account CRUD. Ports handleList / handleCreate / handleUpdate /
 * handleDelete (manage-users/index.ts:378-458).
 *
 * Unscoped by design — an admin sees and edits every account, including other admins and
 * other tenants' employees. The only gate is the role.admin middleware (BE-040).
 */
class AdminUserService
{
    use RejectsDuplicateUsernames;

    public function __construct(private readonly TabPermissionService $tabs) {}

    /**
     * Resolve any account by id. The reference has no existence check: `.update().eq(...)
     * .single()` on a missing row surfaces PostgREST's English "JSON object requested,
     * multiple (or no) rows returned" at 400, and the tab-permission handlers silently
     * return `[]` / `{success:true}` having done nothing. Both are unhelpful to an admin
     * panel, so a missing id answers the existing Arabic constant instead.
     */
    public function findOrFail(string $userId): AppUser
    {
        $user = AppUser::query()->find($userId);

        if ($user === null) {
            throw ApiException::badRequest(Messages::TARGET_USER_NOT_FOUND);
        }

        return $user;
    }

    // ── BE-041 · list ────────────────────────────────────────────────────────

    /** @return Collection<int,AppUser> every account, oldest first — index.ts:379-383 */
    public function all(): Collection
    {
        return AppUser::query()->orderBy('created_at')->get();
    }

    // ── BE-041 · create ──────────────────────────────────────────────────────

    /**
     * Create an account and seed its default tab permissions — index.ts:395-428.
     *
     * `parent_user_id` is never set here: admin-created accounts are top-level (admins or
     * account owners). Employees are created by their owner through POST /employees.
     *
     * @param  array{username:string,password:string,is_admin:bool,expires_at:?string,max_devices:int,max_employees:int}  $params
     */
    public function create(array $params): AppUser
    {
        // The reference is not transactional: a failure while seeding permissions leaves
        // an account with none. Grouping both writes keeps that atomic without changing
        // anything observable on the success path.
        return $this->rejectingDuplicateUsername(function () use ($params) {
            $user = AppUser::query()->create([
                'username' => $params['username'],
                'password_hash' => Hash::make($params['password']),
                'is_active' => true,
                'is_admin' => $params['is_admin'],
                'expires_at' => $params['expires_at'],
                'max_devices' => $params['max_devices'],
                'max_employees' => $params['max_employees'],
            ]);

            $this->tabs->seedDefaults($user);

            return $user;
        });
    }

    // ── BE-042 · update / delete ─────────────────────────────────────────────

    /**
     * Apply only the keys the request carried — index.ts:432-444.
     *
     * @param  array<string,mixed>  $changes  may contain a raw `password`, hashed here
     */
    public function update(AppUser $user, array $changes): AppUser
    {
        if (array_key_exists('password', $changes)) {
            $changes['password_hash'] = Hash::make((string) $changes['password']);
            unset($changes['password']);
        }

        $this->rejectingDuplicateUsername(fn () => $user->fill($changes)->save());

        return $user->refresh();
    }

    /**
     * Delete an account — index.ts:452-458. The foreign keys cascade: sessions, quotes,
     * settings, tab permissions, and (through `app_users.parent_user_id`) the account's
     * employees together with everything THEY own.
     *
     * Idempotent, like the reference: `delete().eq("id", …)` on a missing row is not an
     * error, so the endpoint reports success either way. That is also the honest answer —
     * the postcondition "this id does not exist" holds regardless.
     */
    public function delete(string $userId): void
    {
        AppUser::query()->where('id', $userId)->delete();
    }
}
