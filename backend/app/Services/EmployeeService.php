<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Services\Concerns\RejectsDuplicateUsernames;
use App\Support\Messages;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Account-owner employee management. Ports handleCreateEmployee / handleListEmployees /
 * handleUpdateEmployee / handleDeleteEmployee / handleCheckEmployeeQuotes
 * (manage-users/index.ts:543-665).
 *
 * There is deliberately NO role middleware in front of these routes. The reference blocks
 * non-owners structurally and we keep that: an employee is created with max_employees = 0,
 * so the cap check rejects it with the employee-limit message, and every {id} lookup is
 * scoped to `parent_user_id = caller.id`, which an employee can never satisfy (it has no
 * children). Adding a role guard would swap those Arabic strings for a different one.
 */
class EmployeeService
{
    use RejectsDuplicateUsernames;

    public function __construct(private readonly TabPermissionService $tabs) {}

    // ── ownership ────────────────────────────────────────────────────────────

    /**
     * Resolve a target that must be the caller's own employee — index.ts:591, 611, 650,
     * 671, 683 all run the same `.eq("id", …).eq("parent_user_id", user.id).single()`.
     *
     * Note this collapses "no such user" and "someone else's user" into one 403, which is
     * what the reference does and is also the safer answer: it does not confirm whether an
     * id exists in another tenant.
     */
    public function findOwnEmployee(AppUser $owner, string $employeeId): AppUser
    {
        $employee = AppUser::query()
            ->where('id', $employeeId)
            ->where('parent_user_id', $owner->id)
            ->first();

        if ($employee === null) {
            throw ApiException::forbidden(Messages::NOT_AUTHORIZED);
        }

        return $employee;
    }

    // ── BE-031 · list ────────────────────────────────────────────────────────

    /**
     * The caller's own employees, oldest first — index.ts:580-583. Ordering is part of the
     * contract: the SPA's employee table renders the array as-is.
     *
     * @return Collection<int,AppUser>
     */
    public function listFor(AppUser $owner): Collection
    {
        return $owner->employees()->orderBy('created_at')->get();
    }

    // ── BE-030 · create ──────────────────────────────────────────────────────

    /**
     * Cap first, then insert, then inherit — index.ts:546-570. The count is of existing
     * children, so an owner with max_employees = N ends up with at most N employees.
     */
    private function assertUnderEmployeeCap(AppUser $owner): void
    {
        $cap = (int) $owner->max_employees;

        if ($owner->employees()->count() >= $cap) {
            throw ApiException::badRequest(Messages::maxEmployees($cap));
        }
    }

    public function create(AppUser $owner, string $username, string $password, int $maxDevices): AppUser
    {
        $this->assertUnderEmployeeCap($owner);

        // The reference is not transactional: a failure while copying tab permissions
        // leaves an employee with none. Grouping both writes keeps that atomic without
        // changing anything observable on the success path.
        return $this->rejectingDuplicateUsername(function () use ($owner, $username, $password, $maxDevices) {
            $employee = AppUser::query()->create([
                'username' => $username,
                'password_hash' => Hash::make($password),
                'is_active' => true,
                'is_admin' => false,
                'parent_user_id' => $owner->id,
                'max_devices' => $maxDevices,
                'max_employees' => 0,
            ]);

            $this->tabs->copy($owner, $employee);

            return $employee;
        });
    }

    // ── BE-032 · update ──────────────────────────────────────────────────────

    /**
     * Apply only the keys the request actually carried — index.ts:594-601. The caller has
     * already been through findOwnEmployee(), so ownership is settled before we get here.
     *
     * @param  array<string,mixed>  $changes  may contain a raw `password`, hashed here
     */
    public function update(AppUser $employee, array $changes): AppUser
    {
        if (array_key_exists('password', $changes)) {
            $changes['password_hash'] = Hash::make((string) $changes['password']);
            unset($changes['password']);
        }

        $this->rejectingDuplicateUsername(fn () => $employee->fill($changes)->save());

        return $employee->refresh();
    }

    // ── BE-036 · employees-can-view-quotes toggle ────────────────────────────

    /**
     * Owner-only — index.ts:819-831. This is the ONE place in Phase 3 with an explicit
     * role check rather than an ownership-scoped lookup, because the target is the
     * caller's own row: there is nothing to scope, so `parent_user_id` is tested directly
     * and employees get a distinct message ("غير مصرح - فقط المستخدم الرئيسي").
     *
     * The flag governs only whether employees see the OWNER's quotes. Sibling quotes are
     * mutually visible regardless — see QuoteService::listFor.
     */
    public function setEmployeesCanViewQuotes(AppUser $caller, bool $enabled): bool
    {
        if ($caller->parent_user_id !== null) {
            throw ApiException::forbidden(Messages::ONLY_MAIN_USER);
        }

        $caller->forceFill(['employees_can_view_quotes' => $enabled])->save();

        return (bool) $caller->refresh()->employees_can_view_quotes;
    }

    // ── BE-035 · tab permissions ─────────────────────────────────────────────

    /**
     * The employee's feature flags — index.ts:667-677. Identical reads and writes to the
     * admin endpoints (BE-043), so both go through TabPermissionService; only the
     * authorization in front of them differs.
     *
     * @return array<int,array{tab_key:string,is_enabled:bool}>
     */
    public function tabPermissions(AppUser $employee): array
    {
        return $this->tabs->listFor($employee);
    }

    /**
     * Upsert each entry on (user_id, tab_key) — index.ts:679-691.
     *
     * @param  array<int,mixed>  $permissions
     * @return int number of entries written
     */
    public function upsertTabPermissions(AppUser $employee, array $permissions): int
    {
        return $this->tabs->upsertMany($employee, $permissions);
    }

    // ── BE-034 · quote count ─────────────────────────────────────────────────

    /**
     * How many saved quotes the employee owns — index.ts:607-616. The SPA calls this
     * before offering the delete dialog, to decide whether to ask about a handover.
     */
    public function quoteCount(AppUser $employee): int
    {
        return $employee->quotes()->count();
    }

    // ── BE-033 · delete (+ optional quote transfer) ──────────────────────────

    /**
     * Delete one of the caller's employees — index.ts:646-665.
     *
     * With `transfer_to`, the employee's saved quotes are reassigned FIRST and therefore
     * survive; without it the `saved_quotes.user_id` foreign key cascades and they go with
     * the employee, along with its sessions, settings and tab permissions.
     *
     * The transfer target must be the caller itself or another employee of the caller,
     * else 400 "المستخدم المستهدف غير موجود". Note the reference does NOT exclude the
     * employee being deleted from that set: transfer_to = the target's own id passes the
     * check, moves the rows to themselves, and the cascade then deletes them anyway. That
     * quirk is ported as-is rather than "fixed", since the SPA never offers it.
     */
    public function delete(AppUser $owner, AppUser $employee, ?string $transferTo): void
    {
        if ($transferTo !== null) {
            $this->assertTransferTarget($owner, $transferTo);
        }

        // The reference runs the transfer and the delete as two unguarded statements; a
        // failure between them would orphan the quotes on a user that still exists.
        DB::transaction(function () use ($employee, $transferTo) {
            if ($transferTo !== null) {
                SavedQuote::query()
                    ->where('user_id', $employee->id)
                    ->update(['user_id' => $transferTo, 'updated_at' => now()]);
            }

            $employee->delete();
        });
    }

    private function assertTransferTarget(AppUser $owner, string $transferTo): void
    {
        if ($transferTo === $owner->id) {
            return;
        }

        $isOwnEmployee = AppUser::query()
            ->where('id', $transferTo)
            ->where('parent_user_id', $owner->id)
            ->exists();

        if (! $isOwnEmployee) {
            throw ApiException::badRequest(Messages::TARGET_USER_NOT_FOUND);
        }
    }
}
