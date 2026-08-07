<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Services\StorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ComparesJson;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * OPS-072 — attachment references inside `saved_quotes.quote_data`.
 *
 * The investigation the ticket asks for, encoded as tests. `attachmentUrl` is the only
 * attachment reference persisted server-side, and it has carried two shapes over the app's
 * life: the current `storage:{key}` and a legacy full URL from when the bucket was public.
 */
class QuoteAttachmentMigrationTest extends TestCase
{
    use ComparesJson, MakesUsers, RefreshDatabase;

    private AppUser $owner;

    protected function setUp(): void
    {
        parent::setUp();

        config(['printera.supabase_storage.bucket' => 'montage-files']);
        Storage::fake(StorageService::DISK);

        $this->owner = $this->makeUser(['username' => 'owner']);
    }

    private function quoteWith(mixed $attachment, array $extra = []): SavedQuote
    {
        return $this->owner->quotes()->create([
            'title' => 'عرض',
            'customer_name' => '',
            'quote_number' => '',
            'source_type' => 'calculator',
            'quote_data' => array_merge(
                $attachment === null ? [] : ['attachmentUrl' => $attachment, 'attachmentName' => 'ملف.pdf'],
                $extra,
            ),
        ]);
    }

    private function backupPath(): string
    {
        return storage_path('framework/testing/attachments-before.json');
    }

    // ── the report ───────────────────────────────────────────────────────────

    public function test_it_reports_without_changing_anything(): void
    {
        $legacy = $this->quoteWith('https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-a.pdf');
        $current = $this->quoteWith('storage:u1/2-b.pdf');

        $this->artisan('app:inspect-quote-attachments')->assertSuccessful();

        $this->assertStringStartsWith('https://', $legacy->refresh()->quote_data['attachmentUrl']);
        $this->assertSame('storage:u1/2-b.pdf', $current->refresh()->quote_data['attachmentUrl']);
    }

    public function test_a_corpus_of_only_storage_keys_needs_no_rewrite(): void
    {
        $this->quoteWith('storage:u1/1-a.pdf');
        $this->quoteWith('storage:u1/2-b.pdf');

        $this->artisan('app:inspect-quote-attachments')
            ->expectsOutputToContain('No legacy URLs')
            ->assertSuccessful();
    }

    public function test_quotes_without_an_attachment_are_ignored(): void
    {
        $this->quoteWith(null, ['grandTotal' => 100]);

        $this->artisan('app:inspect-quote-attachments')->assertSuccessful();

        $this->assertSame(1, SavedQuote::query()->count());
    }

    // ── the rewrite ──────────────────────────────────────────────────────────

    public function test_it_converts_a_public_url_to_a_storage_key(): void
    {
        $quote = $this->quoteWith('https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1700000000000-a.pdf');

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $this->assertSame('storage:u1/1700000000000-a.pdf', $quote->refresh()->quote_data['attachmentUrl']);
    }

    public function test_it_converts_a_signed_url_and_drops_its_expired_token(): void
    {
        $quote = $this->quoteWith(
            'https://proj.supabase.co/storage/v1/object/sign/montage-files/u1/1-a.pdf?token=eyJhbGciOi.expired',
        );

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $value = $quote->refresh()->quote_data['attachmentUrl'];
        $this->assertSame('storage:u1/1-a.pdf', $value);
        $this->assertStringNotContainsString('token', $value);
    }

    public function test_it_decodes_percent_escapes_back_into_the_key(): void
    {
        // A URL carries the key percent-encoded; the stored key must be the raw one, or it
        // will not match the object the storage copy wrote.
        $quote = $this->quoteWith(
            'https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-my%20file.pdf',
        );

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $this->assertSame('storage:u1/1-my file.pdf', $quote->refresh()->quote_data['attachmentUrl']);
    }

    public function test_the_rest_of_the_opaque_blob_is_untouched(): void
    {
        $rest = [
            'grandTotal' => 1234.5,
            'nested' => ['a' => [1, 2], 'ب' => 'قيمة'],
            'zero' => 0,
            'false' => false,
            'attachmentName' => 'ملف.pdf',
        ];
        $quote = $this->quoteWith(
            'https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-a.pdf',
            $rest,
        );

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $after = $quote->refresh()->quote_data;
        unset($after['attachmentUrl']);
        $this->assertSameJson($rest, $after);
    }

    public function test_an_already_migrated_row_is_left_alone_and_the_run_is_idempotent(): void
    {
        $current = $this->quoteWith('storage:u1/2-b.pdf');
        $legacy = $this->quoteWith('https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-a.pdf');

        foreach ([1, 2] as $_) {
            $this->artisan('app:inspect-quote-attachments', [
                '--rewrite' => true, '--backup' => $this->backupPath(),
            ])->assertSuccessful();
        }

        $this->assertSame('storage:u1/2-b.pdf', $current->refresh()->quote_data['attachmentUrl']);
        $this->assertSame('storage:u1/1-a.pdf', $legacy->refresh()->quote_data['attachmentUrl']);
    }

    public function test_a_url_with_no_recoverable_key_is_left_untouched(): void
    {
        // Never guess. An unrelated host means the operator has to look at it.
        $quote = $this->quoteWith('https://example.com/some/other/file.pdf');

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $this->assertSame('https://example.com/some/other/file.pdf', $quote->refresh()->quote_data['attachmentUrl']);
    }

    // ── the safety net ───────────────────────────────────────────────────────

    public function test_rewrite_without_a_backup_is_refused(): void
    {
        $quote = $this->quoteWith('https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-a.pdf');

        $this->artisan('app:inspect-quote-attachments', ['--rewrite' => true])->assertFailed();

        $this->assertStringStartsWith('https://', $quote->refresh()->quote_data['attachmentUrl']);
    }

    public function test_the_backup_captures_the_pre_rewrite_blob(): void
    {
        @unlink($this->backupPath());
        $quote = $this->quoteWith('https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-a.pdf');

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $backup = json_decode((string) file_get_contents($this->backupPath()), true);

        $this->assertCount(1, $backup);
        $this->assertSame($quote->id, $backup[0]['id']);
        $this->assertStringStartsWith('https://', $backup[0]['quote_data']['attachmentUrl']);
        @unlink($this->backupPath());
    }

    // ── end to end ───────────────────────────────────────────────────────────

    public function test_a_rewritten_attachment_opens_through_the_signed_url_flow(): void
    {
        // The acceptance criterion: a pre-existing quote's attachment opens on Laravel.
        $key = "{$this->owner->id}/1700000000000-montage.pdf";
        Storage::disk(StorageService::DISK)->put($key, 'THE-ARTWORK');

        $quote = $this->quoteWith("https://proj.supabase.co/storage/v1/object/public/montage-files/{$key}");

        $this->artisan('app:inspect-quote-attachments', [
            '--rewrite' => true, '--backup' => $this->backupPath(),
        ])->assertSuccessful();

        $token = $this->login(['username' => 'owner'])->assertOk()->json('session_token');
        $auth = $this->bearer($token);

        // Exactly what the SPA does: strip the prefix, mint a signed URL, open it.
        $storedKey = str_replace('storage:', '', $quote->refresh()->quote_data['attachmentUrl']);
        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $storedKey], $auth)
            ->assertOk()->json('signed_url');

        $response = $this->get($signed);
        $response->assertOk();
        $this->assertSame('THE-ARTWORK', $response->streamedContent());
    }
}
