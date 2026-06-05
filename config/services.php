<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'anthropic' => [
        'api_key' => env('ANTHROPIC_API_KEY'),
    ],

    'ai' => [
        'enabled' => env('AI_FEATURES_ENABLED', false),
    ],

    'sri' => [
        'environment' => env('SRI_ENVIRONMENT', '1'),
        'ruc'         => env('SRI_RUC'),
        'cert_path'   => env('SRI_CERT_PATH'),
        'cert_pass'   => env('SRI_CERT_PASS'),
    ],

    'whatsapp' => [
        'provider' => env('WHATSAPP_PROVIDER', 'log'),
    ],

    'twilio' => [
        'sid'           => env('TWILIO_ACCOUNT_SID'),
        'token'         => env('TWILIO_AUTH_TOKEN'),
        'whatsapp_from' => env('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886'),
    ],

];
