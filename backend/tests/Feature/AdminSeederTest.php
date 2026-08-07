<?php

namespace Tests\Feature;

use App\Models\AppUser;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

/**
 * BE-003 — the admin bootstrap seeder. It must create exactly one admin from config and
 * fail loudly when the credentials are absent (02-DATABASE-SCHEMA.md §2.1).
 *
 * These tests are only possible because AdminSeeder reads config() rather than env() (F2):
 * env() cannot be overridden per-test after boot.
 */
class AdminSeederTest extends TestCase
{
    use RefreshDatabase;

    private function withAdminConfig(?string $username, ?string $password): void
    {
        config(['printera.admin_username' => $username, 'printera.admin_password' => $password]);
    }

    public function test_creates_exactly_one_admin_from_config(): void
    {
        $this->withAdminConfig('platform-admin', 'a-strong-bootstrap-secret');

        $this->seed(AdminSeeder::class);

        $this->assertSame(1, AppUser::query()->count());
        $admin = AppUser::query()->firstOrFail();
        $this->assertSame('platform-admin', $admin->username);
        $this->assertTrue($admin->is_admin);
        $this->assertTrue($admin->is_active);
        $this->assertNull($admin->parent_user_id);
        $this->assertSame('admin', $admin->role());
    }

    public function test_password_is_bcrypt_hashed_never_stored_plainly(): void
    {
        $this->withAdminConfig('platform-admin', 'a-strong-bootstrap-secret');

        $this->seed(AdminSeeder::class);

        $admin = AppUser::query()->firstOrFail();
        $this->assertNotSame('a-strong-bootstrap-secret', $admin->password_hash);
        $this->assertTrue(Hash::check('a-strong-bootstrap-secret', $admin->password_hash));
        $this->assertStringStartsWith('$2y$', $admin->password_hash);
    }

    public function test_running_twice_does_not_create_a_second_admin(): void
    {
        $this->withAdminConfig('platform-admin', 'a-strong-bootstrap-secret');

        $this->seed(AdminSeeder::class);
        $this->seed(AdminSeeder::class);

        $this->assertSame(1, AppUser::query()->count());
    }

    public function test_aborts_loudly_when_the_username_is_missing(): void
    {
        $this->withAdminConfig(null, 'a-strong-bootstrap-secret');

        $this->expectException(RuntimeException::class);
        $this->seed(AdminSeeder::class);
    }

    public function test_aborts_loudly_when_the_password_is_missing(): void
    {
        $this->withAdminConfig('platform-admin', null);

        $this->expectException(RuntimeException::class);
        $this->seed(AdminSeeder::class);
    }

    public function test_no_admin_row_is_created_when_it_aborts(): void
    {
        $this->withAdminConfig('platform-admin', '');

        try {
            $this->seed(AdminSeeder::class);
            $this->fail('AdminSeeder should have thrown');
        } catch (RuntimeException) {
            // expected
        }

        $this->assertSame(0, AppUser::query()->count());
    }
}
