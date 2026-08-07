<?php

// Retention: prune activity_events and session_events older than 30 days
// (replaces the Supabase AFTER-INSERT cleanup triggers). See 02-DATABASE-SCHEMA.md §4.
//
// The schedule is commented out until `app:prune-events` exists (Phase 2). Registering a
// schedule for a non-existent command makes `php artisan schedule:list` and
// `schedule:run` fail outright. Re-enable this line in the same commit that adds the
// command. See PHASE-0-1-AUDIT.md F12.
//
// use Illuminate\Support\Facades\Schedule;
// Schedule::command('app:prune-events')->daily();
