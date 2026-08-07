<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-034 — GET /employees/{id}/quotes-count.
 * Ports handleCheckEmployeeQuotes (manage-users/index.ts:607-616).
 */
class EmployeeQuotesCountTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'owner', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function seedQuotes(AppUser $user, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $user->quotes()->create([
                'title' => "q{$i}",
                'customer_name' => '',
                'quote_number' => '',
                'source_type' => 'calculator',
                'quote_data' => [],
            ]);
        }
    }

    public function test_counts_the_employees_quotes(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->seedQuotes($employee, 3);

        $this->getJson("/api/v1/employees/{$employee->id}/quotes-count", $this->authAs())
            ->assertOk()
            ->assertExactJson(['count' => 3]);
    }

    public function test_an_employee_with_no_quotes_counts_zero(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->getJson("/api/v1/employees/{$employee->id}/quotes-count", $this->authAs())
            ->assertOk()
            ->assertExactJson(['count' => 0]);
    }

    public function test_only_the_named_employees_quotes_are_counted(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $sibling = $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);

        $this->seedQuotes($employee, 2);
        $this->seedQuotes($sibling, 5);
        $this->seedQuotes($owner, 4);

        $this->getJson("/api/v1/employees/{$employee->id}/quotes-count", $this->authAs())
            ->assertOk()
            ->assertExactJson(['count' => 2]);
    }

    public function test_another_owners_employee_cannot_be_counted(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $theirs = $this->makeUser(['username' => 'theirs', 'parent_user_id' => $stranger->id]);
        $this->seedQuotes($theirs, 7);

        $this->getJson("/api/v1/employees/{$theirs->id}/quotes-count", $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_an_owner_cannot_count_its_own_quotes_here(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->seedQuotes($owner, 2);

        $this->getJson("/api/v1/employees/{$owner->id}/quotes-count", $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_an_unknown_id_is_forbidden_not_zero(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->getJson('/api/v1/employees/'.fake()->uuid().'/quotes-count', $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_counting_requires_authentication(): void
    {
        $this->getJson('/api/v1/employees/'.fake()->uuid().'/quotes-count')
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
