# Deploy to Production Server (PM2)

## Current Status
✅ Code has been fixed to match your WhatsApp template structure
✅ Template `invoicetest1` verified (header with document only, no body parameters)

## Steps to Deploy the Fix

### 1. Connect to Your Server
```bash
ssh root@66.116.196.192
cd /var/www/AutoCarV8
```

### 2. Pull Latest Changes
```bash
# If using git
git pull origin main

# OR manually copy the updated file:
# Copy server/services/whatsapp.ts from Replit to your server
```

### 3. Rebuild the Application
```bash
# Install dependencies (if needed)
npm install

# Build the application
npm run build
```

### 4. Restart PM2
```bash
# Restart the application
pm2 restart autocarv7

# Verify it's running
pm2 status

# Watch the logs in real-time
pm2 logs autocarv7 --lines 50
```

### 5. Test Invoice Approval

1. Log into your CRM at https://crm.maulicardecor.com
2. Create or find a pending invoice
3. Approve the invoice
4. Watch the PM2 logs to see the WhatsApp message being sent

**Expected Log Output:**
```
📱 Sending WhatsApp Invoice Template with PDF
================================
API URL: https://cloudapi.akst.in/api/v1.0/messages/send-template/919970127778
Template Name: invoicetest1
To (Formatted): 917507219775
PDF URL: https://crm.maulicardecor.com/api/public/invoices/...
================================

Request Payload: {
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "917507219775",
  "type": "template",
  "template": {
    "name": "invoicetest1",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "document",
            "document": {
              "link": "https://crm.maulicardecor.com/api/public/invoices/...",
              "caption": "",
              "filename": "Invoice_INV_2025_0005.pdf"
            }
          }
        ]
      }
    ]
  }
}

✅ WhatsApp API reported SUCCESS
   Status Description: Message Sent Successfully.
✅ WhatsApp invoice sent successfully
```

## What Changed

**Before (Incorrect):**
```javascript
components: [
  {
    type: 'header',
    parameters: [/* PDF document */]
  },
  {
    type: 'body',  // ❌ This was causing the issue!
    parameters: [
      { type: 'text', text: customerName },
      { type: 'text', text: invoiceNumber },
      // ... etc
    ]
  }
]
```

**After (Correct - Matches Your Template):**
```javascript
components: [
  {
    type: 'header',
    parameters: [
      {
        type: 'document',
        document: {
          link: pdfUrl,
          caption: '',
          filename: 'Invoice_XXX.pdf'
        }
      }
    ]
  }
  // ✅ No body parameters - template only has static text
]
```

## Why It Wasn't Working

Your WhatsApp template `invoicetest1` has:
- ✅ **Header:** Document type (PDF)
- ✅ **Body:** Static text "This is your invoice." (no variables)
- ❌ **NO body parameters**

The previous code was trying to send body parameters that don't exist in your template, causing WhatsApp to reject the message silently (API returned success, but message wasn't delivered).

## Verification Checklist

After deployment, verify:

- [ ] PM2 shows application is running: `pm2 status`
- [ ] MongoDB connection successful in logs
- [ ] Server listening on port 5000
- [ ] Approve a test invoice
- [ ] Check PM2 logs for "WhatsApp API reported SUCCESS"
- [ ] Verify customer receives WhatsApp message with PDF
- [ ] PDF link opens correctly from WhatsApp

## Troubleshooting

### If invoice still doesn't arrive:

1. **Check Template Status in WhatsApp Business Manager:**
   - Template must be **APPROVED** (not PENDING or REJECTED)
   - Visit: https://business.facebook.com → Message Templates → invoicetest1

2. **Verify PDF URL is accessible:**
   ```bash
   # Test from server
   curl -I "https://crm.maulicardecor.com/api/public/invoices/XXX/pdf?token=YYY"
   
   # Should return: HTTP/2 200
   ```

3. **Check 24-hour session window:**
   - Has the customer messaged your business WhatsApp in the last 24 hours?
   - If not, they need to initiate a conversation first

4. **Contact WhatsApp API Provider:**
   - Provider: cloudapi.akst.in
   - Ask for delivery report for specific message ID
   - Provide timestamp and recipient number

### If PM2 fails to start:

```bash
# Check for errors
pm2 logs autocarv7 --err

# Check build output
npm run build

# Verify Node.js version
node --version  # Should be v18 or higher

# Check for port conflicts
lsof -i :5000
```

## Quick Commands Reference

```bash
# Check PM2 status
pm2 status

# Restart application
pm2 restart autocarv7

# Watch logs
pm2 logs autocarv7 --lines 0

# Stop watching logs
Ctrl+C

# Save PM2 configuration
pm2 save

# Check which files changed
git status

# View recent commits
git log --oneline -5

# Rebuild application
npm run build

# Check disk space
df -h

# Check memory usage
free -h
```

## Security Reminder

⚠️ **Your `ecosystem.config.cjs` has hardcoded credentials!**

Move them to a `.env` file:

1. Create `.env`:
```bash
nano /var/www/AutoCarV8/.env
```

2. Add credentials:
```env
MONGODB_URI=mongodb+srv://raneaniket23_db_user:c51rYLvbIEDGX1qc@autocrm.fuz97x1.mongodb.net/?retryWrites=true&w=majority&appName=AUTOCRM
WHATSAPP_API_KEY=7RlFwj57xE6wHngTfSmNHA
WHATSAPP_PHONE_NUMBER_ID=919970127778
SESSION_SECRET=8pSnCe9YF1FehlBI1YcX1Z2Z6r90x7zRd0yBM+CPTZaGwkurNBDzybjgretUTO4l9LT7wRLZln1jqnpqjtKECw==
APP_URL=https://crm.maulicardecor.com
PORT=5000
```

3. Update `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: 'autocarv7',
    script: './dist/index.js',
    env_file: '.env',  // Load from .env
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

4. Secure the file:
```bash
chmod 600 .env
```

5. Add to .gitignore:
```bash
echo ".env" >> .gitignore
```

6. Restart PM2:
```bash
pm2 restart autocarv7
```

This keeps your credentials secure and out of version control!
