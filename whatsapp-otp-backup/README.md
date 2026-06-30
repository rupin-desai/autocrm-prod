# WhatsApp OTP Backup

This folder records the previous OTP provider setup before the OTP flow moved to the Onboarding WhatsApp API.

## Previous OTP Provider

- Provider base URL: `https://cloudapi.akst.in/api/v1.0/messages`
- OTP endpoint shape: `POST /send-template/{WHATSAPP_PHONE_NUMBER_ID}`
- Login/forgot-password OTP used `sendRoleOTP`.
- Employee/customer-registration OTP used `sendWhatsAppOTP`.
- Both OTP functions sent a template payload with:
  - `messaging_product: "whatsapp"`
  - `recipient_type: "individual"`
  - `type: "template"`
  - body parameter containing the generated OTP
  - URL button parameter containing the generated OTP

## Previous Env Names

- `WHATSAPP_API_KEY`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_OTP_BRAND_NAME`
- `WHATSAPP_OTP_TEMPLATE_NAME`
- `WHATSAPP_ROLE_OTP_TEMPLATE_NAME`

Live tokens are intentionally not stored here.

## Restore Notes

To restore the old OTP provider, copy the old OTP sender shape from `old-cloudapi-otp-snapshot.md` back into `server/services/whatsapp.ts`, then set the previous provider env vars on the server. Invoice and welcome sends still use the old CloudAPI provider, so only the OTP functions need to be restored.
