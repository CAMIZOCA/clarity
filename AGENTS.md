# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# Full development environment (Laravel server + Vite + queue listener + log viewer)
composer dev

# Run all tests
composer test

# Run a single test or filter by name
php artisan test --filter TestName

# Format code
./vendor/bin/pint

# Build frontend assets for production
npm run build

# Initial project setup (install deps, generate key, migrate, build assets)
composer setup
```

## Architecture

**Stack:** Laravel 13 / PHP 8.3+, SQLite (default), Vite 8 + Tailwind CSS 4.0

**Key directories:**
- `routes/web.php` — web routes
- `app/Http/Controllers/` — HTTP controllers
- `app/Models/` — Eloquent models
- `resources/views/` — Blade templates
- `database/migrations/` — schema migrations

**Database:** SQLite by default (`database/database.sqlite`). Sessions, cache, and queues all use the database driver — no Redis required for local dev.

**Frontend:** Tailwind CSS 4.0 uses `@tailwindcss/vite` — there is no separate PostCSS config. CSS is in `resources/css/app.css` using `@import "tailwindcss"`.

**Test seeder:** `DatabaseSeeder` creates a default user `test@example.com` / `password`.
