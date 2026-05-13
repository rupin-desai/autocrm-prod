# Production Deployment Guide

## Setting Up Environment Variables for Your Putty Server

When deploying this application to your production server (https://crm.maulicardecor.com/), you need to set the `APP_URL` environment variable so that WhatsApp invoices contain the correct PDF URLs.

### Required Environment Variable

Add this to your `.env` file or PM2 ecosystem config on your Putty server:

```bash
APP_URL=https://crm.maulicardecor.com
```

### How It Works

The application uses the following priority to determine the base URL for invoice PDFs:

1. **`APP_URL`** - Production environment (highest priority)
2. **`REPLIT_DEV_DOMAIN`** - Replit development environment
3. **`localhost:5000`** - Local development fallback

### Setting Up with PM2

If you're using PM2 to run the application, you have two options:

#### Option 1: Using .env file

1. Create or edit `.env` file in your project root on the Putty server:
   ```bash
   nano .env
   ```

2. Add the following line:
   ```
   APP_URL=https://crm.maulicardecor.com
   MONGODB_URI=your_mongodb_connection_string
   WHATSAPP_API_KEY=your_whatsapp_api_key
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   ```

3. Save and exit (Ctrl+X, then Y, then Enter)

4. Restart PM2:
   ```bash
   pm2 restart all
   ```

#### Option 2: Using PM2 Ecosystem File

1. Create or edit `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'crm-app',
       script: 'npm',
       args: 'start',
       env: {
         NODE_ENV: 'production',
         APP_URL: 'https://crm.maulicardecor.com',
         MONGODB_URI: 'your_mongodb_connection_string',
         WHATSAPP_API_KEY: 'your_whatsapp_api_key',
         WHATSAPP_PHONE_NUMBER_ID: 'your_phone_number_id'
       }
     }]
   }
   ```

2. Start/restart with the ecosystem file:
   ```bash
   pm2 start ecosystem.config.js
   # or
   pm2 restart ecosystem.config.js
   ```

### Verifying the Setup

After setting the environment variable and restarting PM2:

1. Approve an invoice in the application
2. Check the PM2 logs for detailed output:
   ```bash
   pm2 logs
   ```

3. Look for these lines in the logs:
   ```
   📄 Generating invoice PDF...
      Using APP_URL: https://crm.maulicardecor.com
      Public URL: https://crm.maulicardecor.com/api/public/invoices/{id}/pdf?token={token}
   ```

4. The WhatsApp message should now contain the correct URL pointing to your production domain

### Detailed Logging

The application now includes comprehensive logging during the invoice approval process. You'll see:

- ✅ Invoice approval start with full details
- 🔐 PDF access token generation
- 📄 PDF generation with URL construction
- 📱 WhatsApp notification sending
- ✅ Final success confirmation

This helps you debug any issues that may occur during invoice approval.

### Common Issues

**Issue:** WhatsApp invoice not received on production
**Solution:** Make sure `APP_URL` is set correctly and PM2 has been restarted

**Issue:** Invoice PDF URL points to localhost
**Solution:** The `APP_URL` environment variable is not set. Add it to your .env file or PM2 config

**Issue:** Token expired error
**Solution:** Tokens are valid for 7 days. If you're testing with old invoices, re-approve them to generate new tokens

### Security Notes

- The PDF access token is randomly generated and expires after 7 days
- Keep your `.env` file secure and never commit it to version control
- Use environment variables for all sensitive credentials (MongoDB, WhatsApp API keys)
