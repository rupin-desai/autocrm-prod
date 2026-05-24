# VPS MongoDB Backup Runbook (Production)

Last verified: 2026-05-24

## Purpose

This runbook defines the official production backup process for MongoDB on VPS, including:

- one-command manual backup
- daily automated backup via cron
- retention policy
- restore procedure
- troubleshooting checks

## Production Scope

- Server: `66.116.196.192`
- App root: `/var/www/AutoCarV12`
- MongoDB database: `autocrm`
- MongoDB URI (local): `mongodb://127.0.0.1:27017/autocrm?directConnection=true`

## Installed Backup Setup

- Backup directory: `/var/backups/autocrm`
- Backup script: `/usr/local/bin/autocrm-mongo-backup.sh`
- Backup log: `/var/log/autocrm-backup.log`
- Latest symlink: `/var/backups/autocrm/latest.archive.gz`
- Retention: `14 days`
- Cron schedule (root): `30 2 * * * /usr/local/bin/autocrm-mongo-backup.sh`

## Manual Backup

Run:

```bash
/usr/local/bin/autocrm-mongo-backup.sh
```

Expected:

- new file at `/var/backups/autocrm/autocrm-YYYYmmdd-HHMMSS.archive.gz`
- `latest.archive.gz` points to newest file
- success lines in `/var/log/autocrm-backup.log`

## Backup Validation

```bash
LATEST_REAL="$(readlink -f /var/backups/autocrm/latest.archive.gz)"
ls -lh "$LATEST_REAL" /var/backups/autocrm/latest.archive.gz
gzip -t "$LATEST_REAL" && echo "gzip integrity ok"
tail -n 20 /var/log/autocrm-backup.log
```

## Daily Cron Verification

```bash
systemctl is-active cron || systemctl is-active crond
crontab -l
```

Expected crontab line:

```bash
30 2 * * * /usr/local/bin/autocrm-mongo-backup.sh
```

Cron-style execution test:

```bash
/bin/sh -c 'env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin HOME=/root SHELL=/bin/sh /usr/local/bin/autocrm-mongo-backup.sh'
```

## Restore Procedure (Full Replace)

Warning: this drops and rebuilds collections in target DB.

```bash
mongorestore \
  --uri="mongodb://127.0.0.1:27017/autocrm?directConnection=true" \
  --archive=/var/backups/autocrm/<file>.archive.gz \
  --gzip \
  --drop
```

## Retention Policy

- Keep rolling backups for 14 days.
- Cleanup is automatic in script via:
  - `find /var/backups/autocrm -name 'autocrm-*.archive.gz' -mtime +14 -delete`

## Troubleshooting

1. Backup script fails
- Check log: `tail -n 100 /var/log/autocrm-backup.log`
- Check MongoDB: `systemctl status mongod --no-pager`
- Check tools: `which mongodump mongorestore gzip`

2. Cron not running
- Verify service: `systemctl status cron --no-pager` (or `crond`)
- Re-check crontab: `crontab -l`

3. Disk space concern
- Check usage: `df -h / /var/backups`
- Remove only very old archives if needed.

4. Timezone mismatch concern
- Check server timezone: `timedatectl`
- Cron executes in server local timezone.

