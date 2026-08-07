<?php

namespace Database\Seeders;

use App\Models\AppUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Bootstraps exactly one platform admin from env. Legacy demo passwords
 * (1234 / M123123 / the old "owner" seed) are intentionally NOT used.
 */
class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $username = (string) config('printera.admin_username', '');
        $password = (string) config('printera.admin_password', '');

        if ($username === '' || $password === '') {
            throw new RuntimeException(
                'AdminSeeder requires ADMIN_USERNAME and ADMIN_PASSWORD in the environment.'
            );
        }

        AppUser::query()->updateOrCreate(
            ['username' => $username],
            [
                'password_hash' => Hash::make($password), // bcrypt
                'is_admin' => true,
                'is_active' => true,
                'max_devices' => 2,
                'max_employees' => 0,
            ]
        );
    }
}
