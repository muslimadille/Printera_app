<?php

namespace App\Console\Commands;

use App\Models\ActivityEvent;
use App\Models\SessionEvent;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;

/**
 * BE-026 — retention for the two append-only audit tables.
 *
 * Replaces the Supabase AFTER-INSERT triggers cleanup_old_activity_events /
 * cleanup_old_session_events (supabase/migrations/20260502083814_*.sql), which deleted
 * rows older than 30 days on ~1% of inserts. A scheduled command is both more predictable
 * and cheaper than probabilistically taxing a write path — see 02-DATABASE-SCHEMA.md §4.
 *
 * Deletes are chunked so a first run against a large backlog cannot hold one enormous
 * transaction or blow up the statement timeout.
 */
class PruneEvents extends Command
{
    protected $signature = 'app:prune-events
                            {--days= : Override the retention window (defaults to printera.event_retention_days)}
                            {--dry-run : Report what would be deleted without deleting it}';

    protected $description = 'Delete activity_events and session_events older than the retention window (default 30 days)';

    private const CHUNK = 1000;

    public function handle(): int
    {
        // Presence, not truthiness: `?:` would treat an explicit --days=0 as absent and
        // silently fall back to the configured window instead of rejecting it.
        $option = $this->option('days');
        $days = ($option !== null && $option !== '')
            ? (int) $option
            : (int) config('printera.event_retention_days');

        if ($days < 1) {
            $this->error('Retention window must be at least 1 day.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays($days);
        $dryRun = (bool) $this->option('dry-run');

        $this->info(sprintf(
            '%s events older than %s (%d day%s).',
            $dryRun ? 'Would prune' : 'Pruning',
            $cutoff->toDateTimeString(),
            $days,
            $days === 1 ? '' : 's'
        ));

        $total = 0;

        foreach ([
            'activity_events' => ActivityEvent::class,
            'session_events' => SessionEvent::class,
        ] as $label => $model) {
            $deleted = $dryRun
                ? $model::query()->where('occurred_at', '<', $cutoff)->count()
                : $this->pruneInChunks($model, $cutoff);

            $this->line(sprintf('  %-17s %d', $label, $deleted));
            $total += $deleted;
        }

        $this->info(sprintf('%s %d row%s.', $dryRun ? 'Would delete' : 'Deleted', $total, $total === 1 ? '' : 's'));

        return self::SUCCESS;
    }

    /** @param  class-string<Model>  $model */
    private function pruneInChunks(string $model, \DateTimeInterface $cutoff): int
    {
        $deleted = 0;

        do {
            $ids = $model::query()
                ->where('occurred_at', '<', $cutoff)
                ->limit(self::CHUNK)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += $model::query()->whereIn('id', $ids)->delete();
        } while ($ids->count() === self::CHUNK);

        return $deleted;
    }
}
