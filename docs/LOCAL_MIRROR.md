# Local Production Mirror

This workflow copies production MongoDB data into local MongoDB on demand, then runs the app against the restored local database in read-only mirror mode.

## Setup

1. Create a read-only MongoDB user on the production cluster.
2. Copy `.env.local-mirror.example` to `.env.local-mirror`.
3. Set `PROD_MIRROR_URI` to the read-only production URI. The URI must include the source database name.
4. Keep `LOCAL_MONGO_URI=mongodb://127.0.0.1:27017/mauli-car-world`.

Do not commit `.env.local-mirror`. It is ignored by git.

## Commands

```powershell
docker compose -f docker/docker-compose.db.yml up -d
npm run mirror:pull
npm run mirror:restore
npm run local:mirror
```

Or refresh in one step:

```powershell
npm run mirror:refresh
npm run local:mirror
```

## What Each Script Does

- `mirror:pull`: runs `mongodump` against `PROD_MIRROR_URI` and saves `.mirror/prod-latest.archive.gz`.
- `mirror:restore`: runs `mongorestore --drop` into `LOCAL_MONGO_URI`.
- `mirror:refresh`: runs pull then restore.
- `local:mirror`: starts local MongoDB and launches the app with `LOCAL_MIRROR_MODE=true`.

## Safety Guard

When `LOCAL_MIRROR_MODE=true` and `NODE_ENV` is not `production`, the server blocks `POST`, `PUT`, `PATCH`, and `DELETE` requests under `/api`.

Allowed mutating endpoints:

- `/api/auth/login`
- `/api/auth/logout`

The response for blocked writes is:

```json
{
  "error": "Local mirror is read-only.",
  "message": "Mutating API requests are blocked while LOCAL_MIRROR_MODE=true."
}
```

Mirror mode also forces the app to use `LOCAL_MONGO_URI`, rejects remote Mongo hosts for that value, skips startup data migrations, skips activity logging, and bypasses WhatsApp OTP for local login.

## Troubleshooting

Auth/login session behavior:

- Use an existing mirrored user account.
- `LOCAL_DISABLE_WHATSAPP_OTP=true` is forced by `local:mirror`, so login should complete after email/password.
- If `/api/auth/me` returns `401`, log in again; sessions are stored in memory and reset when the server restarts.

Stale mirror data:

- Run `npm run mirror:refresh` again.
- Check `.mirror/latest.json` for the `pulledAt` timestamp.

Restore failures or collection conflicts:

- `mirror:restore` uses `--drop`, so normal collection conflicts should be replaced.
- Confirm Docker MongoDB is running with `docker compose -f docker/docker-compose.db.yml ps`.
- Confirm MongoDB Database Tools are on PATH: `mongodump --version` and `mongorestore --version`.
- Ensure both `PROD_MIRROR_URI` and `LOCAL_MONGO_URI` include database names.

Verify writes are blocked:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/products -ContentType application/json -Body '{}'
```

Expected result: HTTP `403` with `Local mirror is read-only.`

Production regression check:

- With `NODE_ENV=production` and no `LOCAL_MIRROR_MODE`, the read-only guard is disabled.
- Production startup does not require `PROD_MIRROR_URI`, `LOCAL_MONGO_URI`, or `.env.local-mirror`.
