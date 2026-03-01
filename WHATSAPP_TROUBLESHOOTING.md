# WhatsApp Invoice Delivery Troubleshooting Guide

## Current Situation

✅ **What's Working:**
- WhatsApp API returns success (HTTP 200)
- Message ID received: `lNuw7jElh0i7rwbZHKYFBQ`
- PDF generated successfully
- PDF is publicly accessible (WhatsApp bot accessed it)
- Phone number format is correct
- All credentials are configured

❌ **Problem:** Invoice message not delivered to customer's WhatsApp

## Most Likely Causes

### 1. **WhatsApp Template Configuration Issue (90% probability)**

Your template `invoicetest1` might not be fully configured or approved.

**How to fix:**
1. Log into your WhatsApp Business Manager at https://business.facebook.com
2. Go to "Message Templates" section
3. Find template `invoicetest1`
4. Check its status:
   - ✅ **APPROVED** = Good, template is active
   - ⏳ **PENDING** = Template awaiting approval, messages won't deliver
   - ❌ **REJECTED** = Template rejected, need to fix and resubmit
   
5. **Verify template structure matches your code:**
   
   Your current code sends:
   ```json
   {
     "header": {
       "type": "document",
       "document": {
         "link": "PDF_URL",
         "filename": "Invoice_XXX.pdf"
       }
     }
   }
   ```
   
   But your template might require BODY parameters like:
   - {{1}} = Customer Name
   - {{2}} = Invoice Number
   - {{3}} = Service Description
   - {{4}} = Total Amount

### 2. **Missing Body Parameters**

Compare these two approaches:

**Current Code (Header Only):**
```javascript
components: [
  {
    type: 'header',
    parameters: [/* PDF document */]
  }
  // ❌ Missing body parameters
]
```

**OTP Template (Working - has body):**
```javascript
components: [
  {
    type: 'body',
    parameters: [
      { type: 'text', text: otp }
    ]
  }
]
```

**Recommended Fix:**
Your invoice template likely needs both header AND body:
```javascript
components: [
  {
    type: 'header',
    parameters: [/* PDF */]
  },
  {
    type: 'body',
    parameters: [
      { type: 'text', text: customerName },
      { type: 'text', text: invoiceNumber },
      { type: 'text', text: service },
      { type: 'text', text: totalAmount }
    ]
  }
]
```

### 3. **24-Hour Session Window**

WhatsApp requires either:
- An active 24-hour conversation window (customer messaged you recently)
- OR an approved template message

**Check:** Has the customer `917507219775` messaged your business WhatsApp in the last 24 hours?

## Immediate Action Steps

### Step 1: Check Template Status
```bash
# Log into WhatsApp Business Manager
# Navigate to: Message Templates → Find "invoicetest1"
# Verify: Status = APPROVED
```

### Step 2: Get Template Structure
In WhatsApp Business Manager, copy the EXACT template structure including:
- Header type (document/image/text)
- Body parameters (how many {{}} placeholders)
- Button parameters (if any)

### Step 3: Update Code to Match Template

Based on what you find, you might need to update the code in `server/services/whatsapp.ts` around line 458-473.

**Example Fix (if template has 4 body parameters):**
```typescript
components: [
  {
    type: 'header',
    parameters: [
      {
        type: 'document',
        document: {
          link: pdfUrl,
          caption: '',
          filename: `Invoice_${invoiceNumber.replace(/\//g, '_')}.pdf`
        }
      }
    ]
  },
  {
    type: 'body',
    parameters: [
      { type: 'text', text: customerName },
      { type: 'text', text: invoiceNumber },
      { type: 'text', text: service },
      { type: 'text', text: totalAmount }
    ]
  }
]
```

### Step 4: Test with a Working Template

Try using the `roleotp` template which we know works (from your logs):
```bash
# Temporarily change the template name to test
WHATSAPP_INVOICE_TEMPLATE=roleotp
```

If this works, you know the issue is with the `invoicetest1` template configuration.

## Alternative: Use WhatsApp API Logs

Contact your WhatsApp API provider (cloudapi.akst.in) and ask them to:
1. Check delivery status for message ID: `lNuw7jElh0i7rwbZHKYFBQ`
2. Provide delivery report
3. Check if template `invoicetest1` is properly approved and configured

## Quick Test Commands

### Test 1: Check if template exists
```bash
# Ask your API provider if template "invoicetest1" exists and is approved
```

### Test 2: Send test message
```bash
# Try approving another invoice to test again
# Watch the logs: pm2 logs autocarv7 --lines 0
```

### Test 3: Verify PDF accessibility
```bash
# Test if PDF URL is accessible from external servers
curl -I "https://crm.maulicardecor.com/api/public/invoices/69063f4ef7e52f6d42c7849d/pdf?token=..."
```

## Contact Support

If none of this works, contact your WhatsApp API provider (cloudapi.akst.in) with:
- Message ID: `lNuw7jElh0i7rwbZHKYFBQ`
- Timestamp: November 1, 2025 11:12 AM
- Recipient: 917507219775
- Template: invoicetest1
- Request: Delivery status report

## Security Note ⚠️

Your `ecosystem.config.cjs` file contains **hardcoded credentials**. This is a **security risk**!

**Recommended Fix:**
1. Create a `.env` file (add to .gitignore):
```env
MONGODB_URI=mongodb+srv://raneaniket23_db_user:c51rYLvbIEDGX1qc@autocrm.fuz97x1.mongodb.net/?retryWrites=true&w=majority&appName=AUTOCRM
WHATSAPP_API_KEY=7RlFwj57xE6wHngTfSmNHA
WHATSAPP_PHONE_NUMBER_ID=919970127778
SESSION_SECRET=8pSnCe9YF1FehlBI1YcX1Z2Z6r90x7zRd0yBM+CPTZaGwkurNBDzybjgretUTO4l9LT7wRLZln1jqnpqjtKECw==
APP_URL=https://crm.maulicardecor.com
```

2. Update `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: 'autocarv7',
    script: './dist/index.js',
    env_file: '.env',  // Load from .env file
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

3. Restart PM2:
```bash
pm2 restart autocarv7
```

This keeps your credentials secure and out of version control!
