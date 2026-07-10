# Forge maintenance uploads

Large maintenance backups can be rejected by Nginx before Laravel sees the
request. In the browser this appears as:

```text
POST /api/admin/maintenance/imports/upload 413 (Content Too Large)
```

Laravel allows maintenance imports up to `MAINTENANCE_IMPORT_MAX_MB`, which
defaults to `1024` MB. Production must allow at least the same size in Nginx
and PHP-FPM.

## Forge Nginx

In Forge, open the site, go to **Files > Edit Nginx Configuration**, and add
this inside the `server { ... }` block:

```nginx
client_max_body_size 1024M;
```

Save and restart/reload Nginx from Forge.

## PHP-FPM

The repository includes `public/.user.ini` with:

```ini
upload_max_filesize = 1024M
post_max_size = 1024M
max_input_time = 300
max_execution_time = 300
memory_limit = 512M
```

If Forge does not apply `.user.ini` on the server, set the same values in the
PHP-FPM pool or PHP configuration used by the site, then restart PHP-FPM.

## App limit

If a different limit is needed, set this in `.env`:

```dotenv
MAINTENANCE_IMPORT_MAX_MB=1024
```

Then clear cached config:

```bash
php artisan config:clear
```
