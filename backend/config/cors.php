<?php

// Allowed origins come from FRONTEND_URLS (comma-separated) so the SPA and the
// mobile web client can call the API. Native mobile apps send no Origin header
// and are unaffected by CORS.
$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('FRONTEND_URLS', ''))
)));

return [
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins ?: ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // JWT is sent as a bearer header, not a cookie, so credentials are not required.
    'supports_credentials' => false,
];
