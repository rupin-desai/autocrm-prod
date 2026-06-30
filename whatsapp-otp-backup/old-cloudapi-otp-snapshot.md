# Old CloudAPI OTP Sender Snapshot

This is a redacted behavioral snapshot of the previous OTP code.

```ts
const WHATSAPP_BASE_URL = 'https://cloudapi.akst.in/api/v1.0/messages';
const WHATSAPP_OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || 'otptest';
const WHATSAPP_ROLE_OTP_TEMPLATE_NAME = process.env.WHATSAPP_ROLE_OTP_TEMPLATE_NAME?.trim() || 'roleotp';

const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;

const payload = {
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: formattedPhone,
  type: 'template',
  template: {
    name: templateName,
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [{ type: 'text', text: otp }],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: otp }],
      },
    ],
  },
};
```

Provider acceptance was treated as success when the HTTP response was OK, response body had `success === true`, and a provider message id could be extracted from `data[0].MaskId`, `data.id`, or `data.data.id`.
