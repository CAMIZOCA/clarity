<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Maintenance import upload limit
    |--------------------------------------------------------------------------
    |
    | Laravel validates maintenance uploads in kilobytes. The web server and
    | PHP-FPM must allow at least the same size or large uploads will be
    | rejected before the request reaches the application.
    |
    */
    'import_max_megabytes' => (int) env('MAINTENANCE_IMPORT_MAX_MB', 1024),
];
