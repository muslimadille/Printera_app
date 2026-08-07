<?php

namespace App\Services\Concerns;

use App\Exceptions\ApiException;
use App\Support\Messages;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Shared by EmployeeService and AdminUserService: `app_users.username` is globally unique
 * and every create/rename path has to answer the same Arabic 400. index.ts:565 and 447
 * sniff the driver message for "unique"; Laravel already classifies the violation, so the
 * sniff is unnecessary and the string is identical.
 */
trait RejectsDuplicateUsernames
{
    /**
     * The transaction is not about atomicity — it is what makes the catch safe on
     * PostgreSQL. A failed statement aborts the enclosing transaction ("current
     * transaction is aborted, commands ignored until end of transaction block"), so
     * without a savepoint to roll back to, every later query on that connection fails as
     * well and the caught 400 never gets a chance to be returned cleanly. SQLite has no
     * such rule, which is why this is invisible on the default suite. See
     * PHASE-0-1-AUDIT.md §7b.
     *
     * @template T
     *
     * @param  callable():T  $write
     * @return T
     */
    protected function rejectingDuplicateUsername(callable $write): mixed
    {
        try {
            return DB::transaction($write);
        } catch (UniqueConstraintViolationException) {
            throw ApiException::badRequest(Messages::USERNAME_EXISTS);
        }
    }
}
