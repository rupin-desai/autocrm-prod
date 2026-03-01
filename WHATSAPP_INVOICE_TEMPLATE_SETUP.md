# WhatsApp Invoice Template Setup Guide

## Overview
This guide explains how to set up a WhatsApp message template to automatically send invoice PDFs to customers when an invoice is approved in your Mauli Car World system.

## How It Works

### The Key Concept
When creating a WhatsApp template with a **Document** header:
- The PDF you upload during template creation is **ONLY A SAMPLE** for approval purposes
- The **actual invoice PDF** sent to customers is provided dynamically by the system
- Each customer receives their own unique invoice PDF automatically

### The Flow
1. Invoice is approved in your system
2. System generates a unique PDF for that specific invoice
3. PDF is automatically sent to customer's WhatsApp with personalized details
4. Customer receives the PDF instantly on WhatsApp

---

## Step-by-Step Template Creation

### Step 1: Access Your WhatsApp Dashboard
Go to: `https://superfast.akst.in/` (or your WhatsApp provider's dashboard)

### Step 2: Create New Template

Click on **"Message Templates"** → **"Create Template"**

### Step 3: Fill in Template Details

#### 1. **Template Name**
```
invoicetest
```
(You can use a different name, but update the environment variable `WHATSAPP_INVOICE_TEMPLATE` to match)

#### 2. **Language**
```
English
```

#### 3. **Template Category**
```
Utility
```
**Important:** Use "Utility" category for invoices, receipts, and billing documents.

---

### Step 4: Configure Template Header

#### Select Header Type
- ✅ Select: **"Document"**
- ❌ NOT: Image, Video, Text, or Location

#### Upload Sample PDF
Click **"Choose File"** and upload **ANY sample invoice PDF**

**Important Notes:**
- This PDF is **ONLY for WhatsApp approval** - it's not the actual PDF customers will receive
- You can use any invoice PDF from your system
- The actual PDFs sent to customers are generated dynamically for each invoice
- Max file size: 100MB
- Format: PDF only

---

### Step 5: Configure Template Body

In the **"Template Format"** field, enter:

```
Hello {{1}},

Your invoice #{{2}} for {{3}} has been generated.

Total Amount: {{4}}

Thank you for your business!
```

**Variable Breakdown:**
- `{{1}}` = Customer Name (e.g., "Ramesh Kumar")
- `{{2}}` = Invoice Number (e.g., "INV/2025/001")
- `{{3}}` = Service Description (e.g., "Car Servicing +2 more")
- `{{4}}` = Total Amount (e.g., "₹15,500")

---

### Step 6: Configure Template Footer (Optional)

Add this footer for branding:

```
Mauli Car World - Contact: 7507219775
```

Max characters: 60

---

### Step 7: Submit for Approval

1. Click **"Submit"** or **"Create Template"**
2. WhatsApp will review your template
3. **Approval Time:** Usually within 1-24 hours
4. You'll receive a notification once approved

---

## Complete Template Structure

Here's how your final template should look:

```
┌─────────────────────────────────────┐
│  HEADER (Document - Dynamic)        │
│  📄 Invoice_INV_2025_001.pdf        │
└─────────────────────────────────────┘

BODY:
Hello Ramesh Kumar,

Your invoice #INV/2025/001 for Car Servicing +2 more has been generated.

Total Amount: ₹15,500

Thank you for your business!

┌─────────────────────────────────────┐
│  FOOTER                             │
│  Mauli Car World - Contact:         │
│  7507219775                         │
└─────────────────────────────────────┘
```

---

## Environment Configuration

If you used a different template name, update your environment variables:

1. Go to your Replit project
2. Add environment variable:
   ```
   WHATSAPP_INVOICE_TEMPLATE=your_template_name
   ```

If not set, the system defaults to `invoicetest`

---

## How the System Uses This Template

When an invoice is approved:

1. **PDF Generation**: System generates a unique PDF for the specific invoice
2. **Public URL**: PDF is made accessible via a public URL
3. **WhatsApp API Call**: System calls WhatsApp API with:
   - **Header Parameter**: The unique PDF URL (not the sample you uploaded!)
   - **Body Parameters**: Customer name, invoice number, service, amount
4. **Delivery**: Customer receives their specific invoice PDF on WhatsApp

### Example API Payload
```json
{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "invoicetest",
    "language": {"code": "en"},
    "components": [
      {
        "type": "header",
        "parameters": [{
          "type": "document",
          "document": {
            "link": "https://your-domain.repl.co/api/invoices/123/pdf",
            "filename": "Invoice_INV_2025_001.pdf"
          }
        }]
      },
      {
        "type": "body",
        "parameters": [
          {"type": "text", "text": "Ramesh Kumar"},
          {"type": "text", "text": "INV/2025/001"},
          {"type": "text", "text": "Car Servicing +2 more"},
          {"type": "text", "text": "₹15,500"}
        ]
      }
    ]
  }
}
```

Notice: The PDF link is dynamically generated for each invoice!

---

## Testing the Integration

### Step 1: Wait for Template Approval
Check your WhatsApp dashboard for approval status

### Step 2: Create a Test Invoice
1. Log into your system as Admin
2. Create a service visit
3. Complete the service visit
4. Generate an invoice
5. **Approve the invoice**

### Step 3: Check Logs
The system will log the WhatsApp sending process:
```
📱 Sending WhatsApp Invoice Template with PDF
================================
Template Name: invoicetest
To: 919876543210
Customer Name: Ramesh Kumar
Invoice Number: INV/2025/001
Service: Car Servicing +2 more
Total Amount: ₹15,500
PDF URL: https://your-domain.repl.co/api/invoices/123/pdf
✅ WhatsApp Invoice Response (250ms)
Status: 200
Response: {"success":true}
```

### Step 4: Verify on Customer's WhatsApp
The customer should receive:
- ✅ PDF document attachment
- ✅ Personalized message with their details
- ✅ Correct invoice number and amount

---

## Troubleshooting

### Template Not Approved
**Issue:** Template stuck in review
**Solution:**
- Check that Category is "Utility" (not Marketing)
- Ensure sample PDF is appropriate business document
- Verify no promotional language in body text
- Contact WhatsApp support if delayed > 24 hours

### Template Rejected
**Common Reasons:**
- Wrong category selected
- Promotional language in utility template
- Sample PDF contains inappropriate content
- Too many variables (max 10 per component)

### WhatsApp Not Sending
**Check:**
1. Template is approved (status = "Approved")
2. Template name in code matches dashboard
3. Customer has valid WhatsApp number
4. WhatsApp API credentials are correct
5. PDF URL is publicly accessible (HTTPS required)

### PDF URL Not Accessible
**Issue:** WhatsApp cannot download PDF
**Solution:**
- Verify your Replit domain is public
- Test PDF URL in browser directly
- Check PDF endpoint returns correct Content-Type: application/pdf
- Ensure no authentication required for PDF download

---

## Common Questions

### Q: Can I use different template names?
**A:** Yes! Just update the `WHATSAPP_INVOICE_TEMPLATE` environment variable to match your template name.

### Q: Can I customize the message text?
**A:** Yes, but you'll need to:
1. Update the template in WhatsApp dashboard
2. Wait for re-approval
3. The variables {{1}}, {{2}}, {{3}}, {{4}} must match what the code sends

### Q: Can I send invoices without a template?
**A:** No. WhatsApp Business API requires pre-approved templates for business-initiated messages outside the 24-hour window.

### Q: How much does it cost per message?
**A:** Check with your WhatsApp provider (cloudapi.akst.in). Typically:
- Utility conversations: ~₹0.25 - ₹0.50 per message (India)
- Pricing varies by country

### Q: Can I add buttons to the template?
**A:** Yes! You can add:
- Quick Reply buttons (up to 3)
- Call-to-Action buttons (Call Phone, Visit Website)
- Add these in the template creation form

### Q: What if customer doesn't have WhatsApp?
**A:** The message will fail silently. The system logs the error but continues processing. Consider implementing email notifications as a fallback.

---

## Summary Checklist

- [ ] Created template named "invoicetest" (or custom name)
- [ ] Selected "Utility" category
- [ ] Selected "Document" header type
- [ ] Uploaded sample PDF (any invoice)
- [ ] Added body text with 4 variables: {{1}} {{2}} {{3}} {{4}}
- [ ] Added optional footer
- [ ] Submitted template for approval
- [ ] Template approved by WhatsApp
- [ ] Tested by approving an invoice
- [ ] Verified customer received PDF on WhatsApp

---

## Support

If you encounter issues:
1. Check the server logs in your Replit console
2. Verify template status in WhatsApp dashboard
3. Test PDF URL accessibility
4. Contact cloudapi.akst.in support for API issues

---

**Remember:** The PDF you upload during template creation is ONLY for approval. Each customer will automatically receive their own unique invoice PDF when you approve their invoice!
