<?php

namespace App\Exceptions;

use App\Support\Messages;
use RuntimeException;

/**
 * Carries the project's error convention:
 *  - business errors  → HTTP 200 with { error, ...extra }
 *  - session/auth      → HTTP 401 with { error, session_expired: true }
 *  - forbidden         → HTTP 403 with { error }
 *
 * Rendered by bootstrap/app.php `withExceptions`.
 */
class ApiException extends RuntimeException
{
    /** @var array<string,mixed> */
    protected array $extra;

    protected int $statusCode;

    /**
     * @param  array<string,mixed>  $extra
     */
    public function __construct(string $message, int $statusCode = 200, array $extra = [])
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->extra = $extra;
    }

    /**
     * Business error: HTTP 200 with an error body (the current edge-function
     * convention the SPA depends on).
     *
     * @param  array<string,mixed>  $extra
     */
    public static function business(string $message, array $extra = []): self
    {
        return new self($message, 200, $extra);
    }

    /**
     * Session/authentication failure: HTTP 401 + session_expired flag so the SPA
     * force-logs-out (dispatches printCalc:sessionExpired).
     */
    public static function sessionExpired(string $message = Messages::SESSION_INVALID): self
    {
        return new self($message, 401, ['session_expired' => true]);
    }

    /**
     * Authorization failure: HTTP 403.
     */
    public static function forbidden(string $message = Messages::NOT_AUTHORIZED): self
    {
        return new self($message, 403);
    }

    /**
     * HTTP 400. Used only where the reference itself answers 400 rather than the usual
     * 200-with-error-body — the employee cap, a duplicate username and a bad
     * `transfer_to` target (index.ts:548, 566, 655). The SPA handles both the same way
     * (`parseApiResponse` throws on `!res.ok` as well as on a body carrying `error`), so
     * this is kept for parity rather than because the status matters to the client.
     *
     * @param  array<string,mixed>  $extra
     */
    public static function badRequest(string $message, array $extra = []): self
    {
        return new self($message, 400, $extra);
    }

    /**
     * Device-limit business payload (HTTP 200).
     *
     * @param  array<int,array<string,mixed>>  $activeSessions
     */
    public static function deviceLimit(array $activeSessions, int $maxDevices): self
    {
        return new self(Messages::DEVICE_LIMIT_REACHED, 200, [
            'success' => false,
            'device_limit_reached' => true,
            'active_sessions' => $activeSessions,
            'max_devices' => $maxDevices,
        ]);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * @return array<string,mixed>
     */
    public function payload(): array
    {
        return array_merge(['error' => $this->getMessage()], $this->extra);
    }
}
