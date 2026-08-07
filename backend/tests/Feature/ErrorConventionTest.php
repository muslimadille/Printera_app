<?php

namespace Tests\Feature;

use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-003: the error convention itself (03-API-SPECIFICATION.md §1).
 * Business → 200, validation → 200 (not 422), auth → 401, uncaught → 500 Arabic.
 */
class ErrorConventionTest extends TestCase
{
    use RefreshDatabase;

    public function test_validation_failure_uses_the_200_error_shape(): void
    {
        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'x',
            'password' => 'y',
            'terminate_session_ids' => 'not-an-array',
        ])
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors']);
    }

    public function test_business_error_is_http_200(): void
    {
        $this->postJson('/api/v1/auth/login', ['username' => 'nobody', 'password' => 'x'])
            ->assertOk()
            ->assertJson(['error' => Messages::BAD_CREDENTIALS]);
    }

    public function test_missing_token_is_401_session_expired(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_unknown_route_keeps_its_own_status(): void
    {
        $this->getJson('/api/v1/does-not-exist')->assertStatus(404);
    }
}
