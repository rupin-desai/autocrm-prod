# AutoCRM

## Deploying a production build

### 1. Local terminal (your Mac)

Open a terminal in the repository root. Do not SSH yet. Build the client and
server bundle:

```bash
npm run build
```

From that same local terminal, upload the assets first, then the HTML entry
point and server bundle. Replace `<SSH_USER>` and `<SERVER_HOST>` with the
deployment SSH credentials.

```bash
scp -r ./dist/public/assets <SSH_USER>@<SERVER_HOST>:/var/www/AutoCarV12/dist/public/
scp ./dist/public/index.html <SSH_USER>@<SERVER_HOST>:/var/www/AutoCarV12/dist/public/index.html
scp ./dist/index.js <SSH_USER>@<SERVER_HOST>:/var/www/AutoCarV12/dist/index.js
```

### 2. Server terminal (SSH session)

After the uploads finish, SSH into the server from the local terminal:

```bash
ssh <SSH_USER>@<SERVER_HOST>
```

Once the prompt changes to the server (for example, `[root@server ~]#`), run:

```bash
pm2 restart autocarv7
```

### 3. Local terminal (your Mac)

Back in a local terminal, verify that the live domain returns the current
bundle name:

```bash
grep -o 'index-[^"]*\.js' dist/public/index.html
curl -sL https://crm.maulicardecor.com | grep -o 'index-[^"]*\.js'
```
