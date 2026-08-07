<?php

namespace App\Services;

use App\Models\AppUser;
use App\Models\UserTabPermission;
use Illuminate\Support\Str;

/**
 * Per-user feature flags. Shared by the account-owner endpoints (BE-035, via
 * EmployeeService) and the admin endpoints (BE-041 seeding, BE-043), which perform the
 * same reads and writes behind different authorization.
 *
 * `tab_key` is OPAQUE throughout. It carries both tab ids from src/lib/tabRegistry.ts and
 * the special `default_tab:<key>` marker the SPA uses for a user's landing tab; nothing
 * here parses, validates or rewrites it.
 */
class TabPermissionService
{
    /**
     * Seeded ON for a newly created account — handleCreate (index.ts:418).
     * Primary tabs; everything else is either seeded off or resolved by the client's
     * DEFAULT_ON_KEYS rule at read time (04-ADMIN-CONTROL-PANEL-SPEC.md §5).
     */
    public const DEFAULT_ENABLED = ['costcalc', 'savedquotes', 'settings', 'papertypes'];

    /** Seeded OFF for a newly created account — handleCreate (index.ts:419). */
    public const DEFAULT_DISABLED = [
        'calculator', 'employee', 'quote', 'finishing', 'magazine',
        'manual', 'boxpricing', 'guide', 'bulkimport',
    ];

    /**
     * The reference issues an unordered select, so no order was ever guaranteed. Sorting
     * by tab_key makes the response deterministic across drivers.
     *
     * @return array<int,array{tab_key:string,is_enabled:bool}>
     */
    public function listFor(AppUser $user): array
    {
        return $user->tabPermissions()
            ->orderBy('tab_key')
            ->get(['tab_key', 'is_enabled'])
            ->map(fn (UserTabPermission $permission): array => [
                'tab_key' => $permission->tab_key,
                'is_enabled' => (bool) $permission->is_enabled,
            ])
            ->all();
    }

    /**
     * Upsert each entry on (user_id, tab_key) — index.ts:471-475 and 681-687, both of
     * which loop one upsert per entry rather than sending a batch. Additive: a key that is
     * not mentioned is left alone, never deleted.
     *
     * A missing `is_enabled` becomes true: the reference passes `undefined`, which
     * supabase-js strips, leaving the column's `DEFAULT true` to apply. Entries without a
     * usable `tab_key` are skipped rather than failing the batch.
     *
     * @param  array<int,mixed>  $permissions
     * @return int number of entries written
     */
    public function upsertMany(AppUser $user, array $permissions): int
    {
        $written = 0;

        foreach ($permissions as $permission) {
            if (! is_array($permission)
                || ! isset($permission['tab_key'])
                || ! is_string($permission['tab_key'])
                || $permission['tab_key'] === '') {
                continue;
            }

            $user->tabPermissions()->updateOrCreate(
                ['tab_key' => $permission['tab_key']],
                ['is_enabled' => (bool) ($permission['is_enabled'] ?? true)],
            );

            $written++;
        }

        return $written;
    }

    /**
     * Copy every one of `$from`'s rows to `$to` — the employee-creation path
     * (index.ts:572-576). A straight copy, including `default_tab:<key>`.
     */
    public function copy(AppUser $from, AppUser $to): void
    {
        $rows = $from->tabPermissions()
            ->get(['tab_key', 'is_enabled'])
            ->mapWithKeys(fn (UserTabPermission $p): array => [$p->tab_key => (bool) $p->is_enabled])
            ->all();

        $this->insert($to, $rows);
    }

    /**
     * Seed a newly created account with the default ON/OFF sets — handleCreate
     * (index.ts:417-424).
     */
    public function seedDefaults(AppUser $user): void
    {
        $rows = array_merge(
            array_fill_keys(self::DEFAULT_ENABLED, true),
            array_fill_keys(self::DEFAULT_DISABLED, false),
        );

        $this->insert($user, $rows);
    }

    /**
     * Bulk insert. `created_at` is set explicitly rather than left to the column default
     * so the value does not depend on driver clock semantics.
     *
     * @param  array<string,bool>  $rows  tab_key => is_enabled
     */
    private function insert(AppUser $user, array $rows): void
    {
        if ($rows === []) {
            return;
        }

        UserTabPermission::query()->insert(array_map(
            fn (string $tabKey, bool $isEnabled): array => [
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'tab_key' => $tabKey,
                'is_enabled' => $isEnabled,
                'created_at' => now(),
            ],
            array_keys($rows),
            array_values($rows),
        ));
    }
}
