<?php

/*
|--------------------------------------------------------------------------
| Printera application settings
|--------------------------------------------------------------------------
| Every project-specific env read lives here. Calling env() outside a config
| file returns the default once `php artisan config:cache` has run, because the
| cached-config path never loads .env — which silently reverted the idle-session
| window to its default and made AdminSeeder abort on correctly-configured
| production boxes. See PHASE-0-1-AUDIT.md F2.
|--------------------------------------------------------------------------
*/

return [

    /*
    | Sessions inactive beyond this window are deleted before the device count is
    | taken on login / force-login. Mirrors IDLE_SESSION_HOURS in the current
    | edge function (supabase/functions/manage-users/index.ts:90). See BE-016.
    */
    'idle_session_hours' => (int) env('IDLE_SESSION_HOURS', 72),

    /*
    | Bootstrap admin, consumed ONLY by database/seeders/AdminSeeder.php. The
    | seeder aborts when either is missing — there is no fallback and no legacy
    | demo password (see 02-DATABASE-SCHEMA.md §2.1).
    */
    'admin_username' => env('ADMIN_USERNAME'),
    'admin_password' => env('ADMIN_PASSWORD'),

    /*
    | Voice AI provider backing POST /voice/parse — the port of the
    | parse-voice-input edge function. Server-side only; the key is never
    | exposed to the SPA. Wired up in Phase 5 (BE-051).
    */
    'voice' => [
        'base_url' => env('VOICE_AI_BASE_URL', 'https://ai-gateway.lovable.dev/v1/chat/completions'),
        'model' => env('VOICE_AI_MODEL', 'google/gemini-2.5-flash'),
        'api_key' => env('VOICE_AI_API_KEY'),
    ],

];
