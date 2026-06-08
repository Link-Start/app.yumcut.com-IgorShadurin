# Zero-downtime PM2 deploy

This deploy keeps the current app running while a new release is cloned, installed, built, and migrated. Only after that it switches `/var/www/app.yumcut.com/current`, reloads PM2, checks the local app, and rolls back automatically if the healthcheck fails.

Default production path:

```bash
/var/www/app.yumcut.com
```

## Server layout

The script creates this layout:

```text
/var/www/app.yumcut.com/
  current -> /var/www/app.yumcut.com/releases/20260513120000
  releases/
  shared/
    .env
```

Put the production `.env` here:

```bash
/var/www/app.yumcut.com/shared/.env
```

If `/var/www/app.yumcut.com/.env` already exists, the first deploy copies it to `shared/.env`.

## First run

Run as the `deploy` user, not as `root`.

```bash
cd /var/www/app.yumcut.com
chmod +x docs/deploy/deploy-app-yumcut.sh
docs/deploy/deploy-app-yumcut.sh
pm2 logs -f app.yumcut.com
```

After the first run, check that PM2 shows at least two clustered instances:

```bash
pm2 list
```

The defaults are:

```bash
APP_NAME=app.yumcut.com
DEPLOY_ROOT=/var/www/app.yumcut.com
REPO_URL=git@github.com:IgorShadurin/app.yumcut.com.git
BRANCH=main
PORT=3111
PM2_INSTANCES=2
HEALTH_URL=http://127.0.0.1:3111/
```

Nginx should proxy `app.yumcut.com` to `127.0.0.1:3111`.

## Normal deploy

```bash
/var/www/app.yumcut.com/current/docs/deploy/deploy-app-yumcut.sh
```

Common overrides:

```bash
BRANCH=main docs/deploy/deploy-app-yumcut.sh
PM2_INSTANCES=4 docs/deploy/deploy-app-yumcut.sh
RUN_MIGRATIONS=0 docs/deploy/deploy-app-yumcut.sh
HEALTH_URL=http://127.0.0.1:3111/api/health docs/deploy/deploy-app-yumcut.sh
```

## Rollback behavior

Rollback is automatic if the new release does not return `2xx` or `3xx` from `HEALTH_URL`.

Manual rollback:

```bash
ls -1 /var/www/app.yumcut.com/releases
ln -sfn /var/www/app.yumcut.com/releases/<release-id> /var/www/app.yumcut.com/current
pm2 startOrReload /var/www/app.yumcut.com/current/.deploy/ecosystem.config.cjs --only app.yumcut.com --update-env
pm2 save
```

## Notes

PM2 reload without downtime requires cluster mode with at least two instances. The generated PM2 config uses `exec_mode: cluster` and `PM2_INSTANCES=2` by default.

If the app was originally started with `pm2 start "npm run start -- -p 3111" --name app.yumcut.com`, the first run moves it to the generated PM2 config. Future deploys use PM2 reload against that config.

Prisma migrations run by default before the symlink switch. Keep production migrations backward compatible because database migrations cannot be undone by a symlink rollback.
