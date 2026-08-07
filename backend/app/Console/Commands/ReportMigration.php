<?php

namespace App\Console\Commands;

use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Models\UserSession;
use App\Services\StorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * OPS-073 — the parity check that decides whether the cutover is signed off.
 *
 * Compares this database against Supabase table by table and re-checks the invariants the
 * migration is supposed to guarantee, then writes a report to archive next to the ticket.
 * Read-only: it never modifies either side.
 *
 * It deliberately does NOT flag `user_sessions` as a mismatch — that table is empty by
 * design, and a check that "failed" on it every time would train the operator to ignore a
 * red line.
 */
class ReportMigration extends Command
{
    protected $signature = 'app:report-migration
                            {--out= : Write the report to this file as well as stdout}
                            {--skip-storage : Do not count objects on the montage disk}';

    protected $description = 'Compare this database against Supabase and report migration parity (Phase 7, OPS-073)';

    /** @var array<int,string> */
    private array $lines = [];

    private bool $ok = true;

    public function handle(): int
    {
        $this->say('Printera — Supabase → Laravel migration report');
        $this->say('Generated: '.now()->toDateTimeString().' UTC');
        $this->say(str_repeat('=', 72));

        $this->rowCounts();
        $this->sessionsRule();
        $this->referentialIntegrity();
        $this->passwordFormats();
        $this->attachments();

        if (! $this->option('skip-storage')) {
            $this->storage();
        }

        $this->say('');
        $this->say(str_repeat('=', 72));
        $this->say($this->ok
            ? 'RESULT: parity checks passed. Proceed to the manual spot-checks.'
            : 'RESULT: DISCREPANCIES FOUND — do not sign off. See the lines marked FAIL.');

        $this->say('');
        $this->say('Manual steps this command cannot do for you:');
        $this->say('  1. Log in as 3-5 users across roles (admin / owner / employee) and confirm');
        $this->say('     identical settings, own + related quotes, and that an attachment opens.');
        $this->say('  2. Flip the production frontend to VITE_API_BASE_URL and run the FE-064 checklist.');
        $this->say('  3. Keep Supabase live (read-only if possible) until the Phase 8 safety window ends.');

        $out = (string) $this->option('out');
        if ($out !== '') {
            file_put_contents($out, implode(PHP_EOL, $this->lines).PHP_EOL);
            $this->info("Report written to {$out}");
        }

        return $this->ok ? self::SUCCESS : self::FAILURE;
    }

    // ── checks ───────────────────────────────────────────────────────────────

    private function rowCounts(): void
    {
        $this->section('Row counts (Supabase → here)');

        try {
            DB::connection('supabase')->getPdo();
        } catch (\Throwable $e) {
            $this->flagFailure('Cannot reach the `supabase` connection — row counts skipped.');
            $this->say('  '.$e->getMessage());

            return;
        }

        foreach (MigrateFromSupabase::TABLES as $table) {
            $source = (int) DB::connection('supabase')->table($table)->count();
            $target = (int) DB::table($table)->count();

            // The target may legitimately hold MORE rows than the source: the admin seeder
            // creates a bootstrap account, and any activity after the copy started lands
            // here only. Short is the failure; over is worth showing.
            $verdict = match (true) {
                $target === $source => 'ok',
                $target > $source => 'ok (+'.($target - $source).' local)',
                default => 'FAIL (missing '.($source - $target).')',
            };

            if (str_starts_with($verdict, 'FAIL')) {
                $this->ok = false;
            }

            $this->say(sprintf('  %-22s %8d → %8d   %s', $table, $source, $target, $verdict));
        }
    }

    private function sessionsRule(): void
    {
        $this->section('user_sessions (must NOT be migrated)');

        $live = UserSession::query()->count();
        $sourceSessions = 0;

        try {
            $sourceSessions = (int) DB::connection('supabase')->table('user_sessions')->count();
        } catch (\Throwable) {
            // Source unreachable; the local side is what matters here.
        }

        $this->say("  Supabase had {$sourceSessions}; here there are {$live}.");
        $this->say('  Those tokens are opaque Supabase strings, not JWTs — every user re-logs in once.');
        $this->say($live === 0
            ? '  ok — table is empty, as intended.'
            : "  note — {$live} session(s) exist, created by logins against THIS API (expected after go-live).");
    }

    private function referentialIntegrity(): void
    {
        $this->section('Referential integrity');

        $orphans = [
            'app_users.parent_user_id' => AppUser::query()->whereNotNull('parent_user_id')
                ->whereNotIn('parent_user_id', AppUser::query()->select('id'))->count(),
            'saved_quotes.user_id' => DB::table('saved_quotes')
                ->whereNotIn('user_id', AppUser::query()->select('id'))->count(),
            'user_settings.user_id' => DB::table('user_settings')
                ->whereNotIn('user_id', AppUser::query()->select('id'))->count(),
            'user_tab_permissions.user_id' => DB::table('user_tab_permissions')
                ->whereNotIn('user_id', AppUser::query()->select('id'))->count(),
        ];

        foreach ($orphans as $fk => $count) {
            if ($count > 0) {
                $this->ok = false;
            }
            $this->say(sprintf('  %-32s %s', $fk, $count === 0 ? 'ok' : "FAIL ({$count} orphan(s))"));
        }
    }

    private function passwordFormats(): void
    {
        $this->section('Password hashes (must be copied verbatim, never re-hashed)');

        $total = AppUser::query()->count();
        $bcrypt = AppUser::query()->where('password_hash', 'like', '$2%')->count();
        $legacy = AppUser::query()->whereRaw('length(password_hash) = 64')
            ->where('password_hash', 'not like', '$2%')->count();
        $other = $total - $bcrypt - $legacy;

        $this->say("  accounts: {$total}   bcrypt: {$bcrypt}   legacy SHA-256: {$legacy}   other: {$other}");
        $this->say('  Legacy hashes are upgraded to bcrypt on each user\'s next successful login.');

        if ($other > 0) {
            $this->ok = false;
            $this->say("  FAIL — {$other} hash(es) match neither format; those users cannot log in.");
        }
    }

    private function attachments(): void
    {
        $this->section('Quote attachments');

        $storageKeys = 0;
        $legacyUrls = 0;
        $missingObjects = [];
        $disk = Storage::disk(StorageService::DISK);

        SavedQuote::query()->orderBy('id')->chunk(200, function ($quotes) use (&$storageKeys, &$legacyUrls, &$missingObjects, $disk) {
            foreach ($quotes as $quote) {
                $value = is_array($quote->quote_data) ? ($quote->quote_data['attachmentUrl'] ?? null) : null;

                if (! is_string($value) || $value === '') {
                    continue;
                }

                if (str_starts_with($value, 'storage:')) {
                    $storageKeys++;
                    $key = substr($value, strlen('storage:'));

                    if (count($missingObjects) < 10 && ! $disk->exists($key)) {
                        $missingObjects[] = $key;
                    }

                    continue;
                }

                $legacyUrls++;
            }
        });

        $this->say("  storage:{key} references: {$storageKeys}   legacy full URLs: {$legacyUrls}");

        if ($legacyUrls > 0) {
            $this->ok = false;
            $this->say("  FAIL — {$legacyUrls} row(s) still point at Supabase and will break at decommission.");
            $this->say('         Run: php artisan app:inspect-quote-attachments --rewrite --backup=…');
        }

        if ($missingObjects !== []) {
            $this->ok = false;
            $this->say('  FAIL — referenced objects missing from the montage disk (first 10):');
            foreach ($missingObjects as $key) {
                $this->say("           {$key}");
            }
            $this->say('         Run: php artisan app:migrate-supabase-storage');
        }

        if ($legacyUrls === 0 && $missingObjects === [] && $storageKeys > 0) {
            $this->say('  ok — every referenced object is present on the montage disk.');
        }
    }

    private function storage(): void
    {
        $this->section('Montage disk');

        $disk = Storage::disk(StorageService::DISK);
        $files = $disk->allFiles();

        $this->say(sprintf('  disk: %s   objects: %d', config('filesystems.disks.'.StorageService::DISK.'.driver'), count($files)));
        $this->say('  Compare against the Supabase bucket count reported by app:migrate-supabase-storage.');
    }

    // ── output ───────────────────────────────────────────────────────────────

    private function section(string $title): void
    {
        $this->say('');
        $this->say($title);
        $this->say(str_repeat('-', strlen($title)));
    }

    private function say(string $line): void
    {
        $this->lines[] = $line;
        $this->line($line);
    }

    private function flagFailure(string $line): void
    {
        $this->ok = false;
        $this->say('  FAIL — '.$line);
    }
}
