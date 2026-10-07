# AutoCRM

## Deploying a production build

Build the client and server bundle from the repository root:

```bash
npm run build
```

Upload the assets first, then the HTML entry point and server bundle. Replace
`<SSH_USER>` and `<SERVER_HOST>` with the deployment SSH credentials.

```bash
scp -r ./dist/public/assets <SSH_USER>@<SERVER_HOST>:/var/www/AutoCarV12/dist/public/
scp ./dist/public/index.html <SSH_USER>@<SERVER_HOST>:/var/www/AutoCarV12/dist/public/index.html
scp ./dist/index.js <SSH_USER>@<SERVER_HOST>:/var/www/AutoCarV12/dist/index.js
```

Connect to the server and restart the PM2 process:

```bash
ssh <SSH_USER>@<SERVER_HOST>
pm2 restart autocarv7
```

Verify that the live domain returns the current bundle name:

```bash
grep -o 'index-[^"]*\.js' dist/public/index.html
curl -sL https://crm.maulicardecor.com | grep -o 'index-[^"]*\.js'
```
