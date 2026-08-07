<?php

namespace App\Console\Commands;

use App\Services\Storage\DiskObjectSource;
use App\Services\Storage\ObjectSource;
use App\Services\Storage\SupabaseApiObjectSource;
use App\Services\StorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * OPS-071 — copy the Supabase `montage-files` bucket onto the `montage` disk.
 *
 * **Keys are preserved exactly** — `{user_id}/{timestamp}-{sanitized_name}`. That is the
 * whole trick that keeps `saved_quotes.quote_data.attachmentUrl` valid without rewriting a
 * single row: the app resolves an attachment by key, so an identical key on the new disk
 * resolves to the same object. It also means the per-user prefix rule in StorageService
 * (03 §8) keeps working, because ownership is encoded in the key itself.
 *
 * Works against whatever `MONTAGE_DISK` points at — local in development, S3 in
 * production — because everything goes through the disk abstraction.
 *
 * The SOURCE is abstracted too (ObjectSource): the live Supabase API by default, or a
 * local folder with `--from-disk` when the bucket has been exported first. The second
 * route needs no service-role key.
 *
 * Resumable: an object already present on the target is skipped, so a re-run after a
 * network failure only transfers what is missing. `--overwrite` forces the copy, and
 * `--verify` re-reads each written object and compares checksums.
 */
class MigrateSupabaseStorage extends Command
{
    protected $signature = 'app:migrate-supabase-storage
                            {--from-disk= : Copy from this local folder instead of the Supabase API}
                            {--prefix= : Only copy keys under this prefix (e.g. one user id)}
                            {--overwrite : Re-copy objects that already exist on the target}
                            {--verify : Re-read each copied object and compare checksums}
                            {--dry-run : List what would be copied, transfer nothing}';

    protected $description = 'Copy Supabase montage-files objects onto the montage disk (Phase 7, OPS-071)';

    private bool $dryRun = false;

    private int $copied = 0;

    private int $skipped = 0;

    private int $failed = 0;

    private int $bytes = 0;

    public function handle(): int
    {
        $this->dryRun = (bool) $this->option('dry-run');

        $source = $this->resolveSource();

        if ($source === null) {
            return self::FAILURE;
        }

        $disk = StorageService::DISK;

        $this->newLine();
        $this->info($this->dryRun
            ? "DRY RUN — enumerating {$source->describe()}, transferring nothing."
            : "Copying {$source->describe()} → `{$disk}` disk, keys unchanged.");
        $this->newLine();

        try {
            $keys = $source->keys((string) $this->option('prefix'));
        } catch (\Throwable $e) {
            $this->error('Could not list the source: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->line(sprintf('Found %d object(s).', count($keys)));
        $this->newLine();

        foreach ($keys as $key) {
            $this->copyObject($source, $key);
        }

        $this->newLine();
        $this->table(['found', 'copied', 'skipped (already present)', 'failed', 'bytes'], [[
            count($keys), $this->copied, $this->skipped, $this->failed, number_format($this->bytes),
        ]]);

        if ($this->failed > 0) {
            $this->error("{$this->failed} object(s) failed. Re-run to retry just those — copied objects are skipped.");

            return self::FAILURE;
        }

        $this->info($this->dryRun ? 'Dry run complete.' : 'Storage copy complete. Keys are unchanged.');

        return self::SUCCESS;
    }

    // ── where the objects come from ──────────────────────────────────────────

    /**
     * A container binding wins, so a test can substitute a fake disk without going
     * anywhere near the command's options. Otherwise --from-disk, otherwise the API.
     */
    private function resolveSource(): ?ObjectSource
    {
        if (app()->bound(ObjectSource::class)) {
            return app(ObjectSource::class);
        }

        $from = (string) $this->option('from-disk');

        if ($from !== '') {
            if (! is_dir($from)) {
                $this->error("--from-disk: {$from} is not a directory.");

                return null;
            }

            return new DiskObjectSource(
                Storage::build(['driver' => 'local', 'root' => $from]),
                "folder {$from}",
            );
        }

        return $this->apiSource();
    }

    private function apiSource(): ?SupabaseApiObjectSource
    {
        foreach (['url' => 'SUPABASE_URL', 'service_role_key' => 'SUPABASE_SERVICE_ROLE_KEY'] as $key => $env) {
            if ((string) config("printera.supabase_storage.{$key}") === '') {
                $this->error("Missing {$env} in .env — required to read the source bucket.");
                $this->line('The service-role key is a secret: use it only for this migration, then rotate it.');
                $this->line('Alternatively export the bucket first and pass --from-disk=<folder>, which needs no key.');

                return null;
            }
        }

        return new SupabaseApiObjectSource(
            (string) config('printera.supabase_storage.url'),
            (string) config('printera.supabase_storage.service_role_key'),
            (string) config('printera.supabase_storage.bucket'),
        );
    }

    // ── transfer ─────────────────────────────────────────────────────────────

    private function copyObject(ObjectSource $source, string $key): void
    {
        $disk = Storage::disk(StorageService::DISK);

        if (! $this->option('overwrite') && $disk->exists($key)) {
            $this->skipped++;
            $this->output->write('·');

            return;
        }

        if ($this->dryRun) {
            $this->copied++;
            $this->line("  would copy {$key}");

            return;
        }

        try {
            $body = $source->get($key);
            $disk->put($key, $body);

            if ($this->option('verify')) {
                $written = (string) $disk->get($key);

                if (hash('sha256', $written) !== hash('sha256', $body)) {
                    throw new \RuntimeException('checksum mismatch after write');
                }
            }

            $this->copied++;
            $this->bytes += strlen($body);
            $this->output->write('.');
        } catch (\Throwable $e) {
            $this->failed++;
            $this->newLine();
            $this->error("  {$key}: ".$e->getMessage());
        }
    }
}
