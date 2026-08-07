<?php

namespace App\Console\Commands;

use App\Models\SavedQuote;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * OPS-072 — report (and optionally normalise) the attachment references inside
 * `saved_quotes.quote_data`.
 *
 * **Investigate before rewriting.** The SPA has written two different shapes over its
 * lifetime and only production data says which are actually present:
 *
 *   storage:{key}   the current shape (PriceQuote.tsx:114). The key is exactly what
 *                   OPS-071 preserves, so these need NO rewrite.
 *   https://…       a legacy full URL from when `montage-files` was a PUBLIC bucket
 *                   (supabase/migrations/20260405141129_*.sql created it with public=true).
 *                   MontageUpload.tsx still carries a "Legacy public URL" branch, which is
 *                   the evidence these exist. They break the moment Supabase is switched
 *                   off, so they must become keys.
 *
 * Run without --rewrite first: it prints a census and touches nothing. `attachmentUrl` is
 * the only attachment reference persisted server-side — `montageUrl` lives in the store's
 * draft `quoteInfo` in localStorage and never reaches `quote_data`.
 */
class InspectQuoteAttachments extends Command
{
    protected $signature = 'app:inspect-quote-attachments
                            {--rewrite : Convert legacy full URLs to storage:{key}}
                            {--backup= : Before rewriting, dump the affected rows to this JSON file}
                            {--chunk=200 : Rows per batch}';

    protected $description = 'Report/normalise attachment references in saved_quotes.quote_data (Phase 7, OPS-072)';

    /** The key the SPA reads and writes. */
    private const FIELD = 'attachmentUrl';

    private const PREFIX = 'storage:';

    public function handle(): int
    {
        $rewrite = (bool) $this->option('rewrite');

        /** @var array<string,int> $census */
        $census = ['storage_key' => 0, 'legacy_url' => 0, 'unrecognised' => 0];
        $samples = [];
        $changes = [];

        SavedQuote::query()
            ->orderBy('id')
            ->chunk((int) $this->option('chunk'), function ($quotes) use (&$census, &$samples, &$changes) {
                foreach ($quotes as $quote) {
                    $data = $quote->quote_data;

                    if (! is_array($data) || ! isset($data[self::FIELD]) || ! is_string($data[self::FIELD])) {
                        continue;
                    }

                    $value = $data[self::FIELD];
                    $shape = $this->classify($value);
                    $census[$shape]++;

                    if (count($samples[$shape] ?? []) < 3) {
                        $samples[$shape][] = $this->redact($value);
                    }

                    if ($shape === 'legacy_url') {
                        $key = $this->keyFromUrl($value);

                        if ($key !== null) {
                            $changes[] = ['quote' => $quote, 'from' => $value, 'to' => self::PREFIX.$key];
                        }
                    }
                }
            });

        $total = array_sum($census);
        $this->newLine();
        $this->line(sprintf('Quotes carrying an `%s`: %d', self::FIELD, $total));
        $this->newLine();

        $this->table(['shape', 'count', 'action', 'examples'], [
            ['storage:{key}', $census['storage_key'], 'none needed', implode("\n", $samples['storage_key'] ?? [])],
            ['legacy full URL', $census['legacy_url'], 'rewrite to key', implode("\n", $samples['legacy_url'] ?? [])],
            ['unrecognised', $census['unrecognised'], 'MANUAL REVIEW', implode("\n", $samples['unrecognised'] ?? [])],
        ]);

        if ($census['unrecognised'] > 0) {
            $this->warn('Some values match neither shape. Inspect them before rewriting — do not guess.');
        }

        if ($census['legacy_url'] === 0) {
            $this->info('No legacy URLs. OPS-071 preserves keys, so no rewrite is required.');

            return self::SUCCESS;
        }

        $convertible = count($changes);
        $this->newLine();
        $this->line("Convertible legacy URLs: {$convertible} of {$census['legacy_url']}");

        if ($convertible < $census['legacy_url']) {
            $this->warn('Some legacy URLs do not contain a recoverable bucket key; they are left untouched.');
        }

        if (! $rewrite) {
            $this->newLine();
            $this->info('Report only. Re-run with --rewrite --backup=path/to/before.json to apply.');

            return self::SUCCESS;
        }

        return $this->apply($changes);
    }

    // ── classification ───────────────────────────────────────────────────────

    private function classify(string $value): string
    {
        if (str_starts_with($value, self::PREFIX)) {
            return 'storage_key';
        }

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return 'legacy_url';
        }

        return 'unrecognised';
    }

    /**
     * Recover the bucket key from a Supabase storage URL. Both forms it has used:
     *
     *   /storage/v1/object/public/montage-files/{key}
     *   /storage/v1/object/sign/montage-files/{key}?token=…
     *
     * The query string is dropped — a stored signed URL's token is long expired anyway,
     * which is precisely why these rows need converting.
     */
    private function keyFromUrl(string $url): ?string
    {
        $bucket = (string) config('printera.supabase_storage.bucket');
        $path = parse_url($url, PHP_URL_PATH);

        if (! is_string($path)) {
            return null;
        }

        $marker = "/{$bucket}/";
        $at = strpos($path, $marker);

        if ($at === false) {
            return null;
        }

        $key = ltrim(substr($path, $at + strlen($marker)), '/');

        return $key === '' ? null : rawurldecode($key);
    }

    /** Signed URLs carry a token; never print it. */
    private function redact(string $value): string
    {
        $clean = strtok($value, '?');

        return strlen($clean) > 96 ? substr($clean, 0, 93).'…' : $clean;
    }

    // ── rewrite ──────────────────────────────────────────────────────────────

    /** @param array<int,array{quote:SavedQuote,from:string,to:string}> $changes */
    private function apply(array $changes): int
    {
        $backup = (string) $this->option('backup');

        if ($backup === '') {
            $this->error('--backup=<file> is required with --rewrite. quote_data is user data; keep an undo.');

            return self::FAILURE;
        }

        $snapshot = array_map(fn (array $c): array => [
            'id' => $c['quote']->id,
            'user_id' => $c['quote']->user_id,
            'quote_data' => $c['quote']->quote_data,
        ], $changes);

        if (file_put_contents($backup, json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            $this->error("Could not write the backup to {$backup}. Nothing was changed.");

            return self::FAILURE;
        }

        $this->info(sprintf('Backed up %d row(s) to %s', count($snapshot), $backup));

        DB::transaction(function () use ($changes) {
            foreach ($changes as $change) {
                /** @var SavedQuote $quote */
                $quote = $change['quote'];

                // Replace the one field; everything else in this opaque blob is untouched.
                $data = $quote->quote_data;
                $data[self::FIELD] = $change['to'];

                $quote->quote_data = $data;
                $quote->save();

                $this->output->write('.');
            }
        });

        $this->newLine();
        $this->info(sprintf('Rewrote %d attachment reference(s) to storage keys.', count($changes)));

        return self::SUCCESS;
    }
}
