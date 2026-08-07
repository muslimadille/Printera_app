<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AppUser;
use App\Support\Messages;

/**
 * Cloud settings, self-scoped. Ports handleLoadSettings / handleSaveSettings
 * (manage-users/index.ts:480-513).
 *
 * `setting_value` is OPAQUE: paperTypes, priceSettings, finishingItems and profitMargins
 * are owned by the frontend. Store and return them byte-for-byte; never reshape.
 */
class SettingService
{
    /**
     * The reference compares `params.user_id !== user.id` and 403s on any mismatch. Here
     * the caller comes from the JWT, so a `user_id` in the request is only ever a legacy
     * echo — honoured when it matches, rejected when it does not, ignored when absent
     * (03-API-SPECIFICATION.md §5).
     */
    public function assertSelf(?string $requestedUserId, AppUser $caller): void
    {
        if ($requestedUserId !== null && $requestedUserId !== $caller->id) {
            throw ApiException::forbidden(Messages::NOT_AUTHORIZED);
        }
    }

    /** @return array<string,mixed> map of setting_key => setting_value */
    public function all(AppUser $user): array
    {
        $map = [];

        foreach ($user->settings()->get(['setting_key', 'setting_value']) as $setting) {
            $map[$setting->setting_key] = $setting->setting_value;
        }

        return $map;
    }

    /**
     * Upsert each entry on (user_id, setting_key) — the unique constraint from
     * 02-DATABASE-SCHEMA.md §2.7. Entries without a usable key are skipped rather than
     * failing the batch, matching the reference's lack of validation.
     *
     * @param  array<int,mixed>  $settings
     * @return int number of entries written
     */
    public function upsertMany(AppUser $user, array $settings): int
    {
        $written = 0;

        foreach ($settings as $setting) {
            if (! is_array($setting) || ! isset($setting['key']) || ! is_string($setting['key']) || $setting['key'] === '') {
                continue;
            }

            $user->settings()->updateOrCreate(
                ['setting_key' => $setting['key']],
                ['setting_value' => $setting['value'] ?? []],
            );

            $written++;
        }

        return $written;
    }
}
