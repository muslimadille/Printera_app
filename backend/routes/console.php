<?php

use Illuminate\Support\Facades\Schedule;

// Retention: prune activity_events and session_events older than 30 days.
// Replaces the Supabase AFTER-INSERT cleanup triggers, which fired on ~1% of inserts.
// See 02-DATABASE-SCHEMA.md §4 and the app:prune-events command (BE-026).
//
// Re-enabled here now that the command exists — it was commented out under F12 because
// scheduling a non-existent command breaks `schedule:list` and `schedule:run`.
Schedule::command('app:prune-events')
    ->daily()
    ->withoutOverlapping()
    ->runInBackground();
