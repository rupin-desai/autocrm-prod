interface WhatsAppResponse {
  success: boolean;
  statusDesc?: string;
  statusCode?: number;
  data?: any;
  error?: string;
  providerMessageId?: string;
}

function parseEnvValue(envKey: string): string | undefined {
  const directValue = process.env[envKey]?.trim();
  if (directValue) {
    const keyPattern = new RegExp(`${envKey}\\s*=\\s*([^\\s]+)`);
    const match = directValue.match(keyPattern);
    return match ? match[1].trim() : directValue;
  }

  const mongoValue = process.env.MONGODB_URI?.trim();
  if (!mongoValue) return undefined;

  const keyPattern = new RegExp(`${envKey}\\s*=\\s*([^\\s]+)`);
  const match = mongoValue.match(keyPattern);
  return match ? match[1].trim() : undefined;
}

const WHATSAPP_API_KEY = parseEnvValue('WHATSAPP_API_KEY');
const WHATSAPP_PHONE_NUMBER_ID = parseEnvValue('WHATSAPP_PHONE_NUMBER_ID') || '919970127778';

const WHATSAPP_BASE_URL = 'https://cloudapi.akst.in/api/v1.0/messages';
const WHATSAPP_ONBOARDING_BASE_URL = process.env.WHATSAPP_ONBOARDING_BASE_URL?.trim() || 'https://onboarding.akst.in';
const WHATSAPP_ONBOARDING_VERSION = process.env.WHATSAPP_ONBOARDING_VERSION?.trim() || 'v23.0';
const WHATSAPP_ONBOARDING_PHONE_NUMBER_ID = parseEnvValue('WHATSAPP_ONBOARDING_PHONE_NUMBER_ID') || '951514724722583';
const WHATSAPP_ONBOARDING_ACCESS_TOKEN = parseEnvValue('WHATSAPP_ONBOARDING_ACCESS_TOKEN');
const WHATSAPP_ONBOARDING_OTP_TEMPLATE = process.env.WHATSAPP_ONBOARDING_OTP_TEMPLATE?.trim() || 'verify_code_1';
const WHATSAPP_ONBOARDING_OTP_BUTTON_TEXT = process.env.WHATSAPP_ONBOARDING_OTP_BUTTON_TEXT?.trim() || 'Copy';
const WHATSAPP_BIZ_OPAQUE_CALLBACK_DATA = process.env.WHATSAPP_BIZ_OPAQUE_CALLBACK_DATA?.trim() || '{{BizOpaqueCallbackData}}';
export const WHATSAPP_OTP_BRAND_NAME = process.env.WHATSAPP_OTP_BRAND_NAME?.trim() || 'MAULI CAR DECOR';

function extractProviderMessageId(data: any): string | undefined {
  if (Array.isArray(data?.messages) && typeof data.messages[0]?.id === 'string' && data.messages[0].id.trim()) {
    return data.messages[0].id.trim();
  }

  if (Array.isArray(data?.data) && typeof data.data[0]?.MaskId === 'string' && data.data[0].MaskId.trim()) {
    return data.data[0].MaskId.trim();
  }

  if (typeof data?.data?.id === 'string' && data.data.id.trim()) {
    return data.data.id.trim();
  }

  if (typeof data?.id === 'string' && data.id.trim()) {
    return data.id.trim();
  }

  return undefined;
}

function isAcceptedByWhatsAppProvider(response: Response, data: any): boolean {
  return response.ok && data?.success === true && !!extractProviderMessageId(data);
}

function isAcceptedByOnboardingProvider(response: Response, data: any): boolean {
  return response.ok && !!extractProviderMessageId(data);
}

function formatPhoneNumber(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    console.error('Invalid phone number: empty or not a string');
    return null;
  }

  let formattedPhone = phone.trim().replace(/\D/g, '');

  if (!formattedPhone) {
    console.error('Phone number contains no digits');
    return null;
  }

  if (formattedPhone.startsWith('0') && formattedPhone.length === 11) {
    formattedPhone = formattedPhone.substring(1);
  }

  if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
    return formattedPhone;
  }

  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone;
  }

  if (formattedPhone.length !== 12 || !formattedPhone.startsWith('91')) {
    console.error(`Invalid phone number format after normalization: "${formattedPhone}" (original: "${phone}")`);
    console.error('Expected format: 12 digits starting with 91 (for example 919619523254)');
    return null;
  }

  return formattedPhone;
}

function validatePhoneNumber(phone: string | null): boolean {
  if (!phone) return false;
  return phone.length === 12 && phone.startsWith('91') && /^\d+$/.test(phone);
}

async function postWhatsAppTemplate({
  url,
  payload,
  logLabel,
}: {
  url: string;
  payload: Record<string, any>;
  logLabel: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error('WhatsApp API key not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const startTime = Date.now();

  try {
    console.log(`Request Payload (${logLabel}):`, JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();
    const providerMessageId = extractProviderMessageId(data);

    console.log(`${logLabel} response (${responseTime}ms)`);
    console.log('HTTP Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('Provider Message ID:', providerMessageId || 'Not provided');

    if (isAcceptedByWhatsAppProvider(response, data)) {
      console.log(`${logLabel} accepted by provider`);
      console.log('Delivery still depends on provider/Meta status');
      return {
        success: true,
        statusDesc: data.statusDesc || 'Message accepted by provider',
        statusCode: data.statusCode,
        data: data.data,
        providerMessageId,
      };
    }

    console.error(`${logLabel} was not confirmed by provider`);
    return {
      success: false,
      error: data?.statusDesc || data?.error?.message || data?.message || 'WhatsApp provider did not confirm request acceptance',
      statusCode: data?.statusCode || response.status,
      data,
      providerMessageId,
    };
  } catch (error) {
    console.error(`${logLabel} API error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WhatsApp request failed',
    };
  }
}

async function postOnboardingOTP({
  url,
  payload,
  logLabel,
}: {
  url: string;
  payload: Record<string, any>;
  logLabel: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_ONBOARDING_ACCESS_TOKEN) {
    console.error('WhatsApp Onboarding access token not configured');
    return { success: false, error: 'WhatsApp Onboarding credentials not configured' };
  }

  const startTime = Date.now();

  try {
    console.log(`Request Payload (${logLabel}):`, JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${WHATSAPP_ONBOARDING_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();
    const providerMessageId = extractProviderMessageId(data);

    console.log(`${logLabel} response (${responseTime}ms)`);
    console.log('HTTP Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('Provider Message ID:', providerMessageId || 'Not provided');

    if (isAcceptedByOnboardingProvider(response, data)) {
      console.log(`${logLabel} accepted by Onboarding provider`);
      return {
        success: true,
        statusDesc: data.statusDesc || 'Message accepted by Onboarding provider',
        statusCode: data.statusCode || response.status,
        data,
        providerMessageId,
      };
    }

    console.error(`${logLabel} was not confirmed by Onboarding provider`);
    return {
      success: false,
      error: data?.error?.message || data?.statusDesc || data?.message || 'WhatsApp Onboarding provider did not confirm request acceptance',
      statusCode: data?.statusCode || response.status,
      data,
      providerMessageId,
    };
  } catch (error) {
    console.error(`${logLabel} API error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WhatsApp Onboarding request failed',
    };
  }
}

async function sendOnboardingOTP({
  to,
  otp,
  logLabel,
}: {
  to: string;
  otp: string;
  logLabel: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_ONBOARDING_ACCESS_TOKEN) {
    console.error(`WhatsApp Onboarding access token not configured for ${WHATSAPP_OTP_BRAND_NAME}`);
    return { success: false, error: `WhatsApp Onboarding credentials not configured for ${WHATSAPP_OTP_BRAND_NAME}` };
  }

  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return {
      success: false,
      error: 'Invalid phone number format. Please provide a valid Indian mobile number (10 digits or with +91/91 prefix)',
    };
  }

  const baseUrl = WHATSAPP_ONBOARDING_BASE_URL.replace(/\/$/, '');
  const version = WHATSAPP_ONBOARDING_VERSION.replace(/^\/|\/$/g, '');
  const url = `${baseUrl}/${version}/${WHATSAPP_ONBOARDING_PHONE_NUMBER_ID}/messages`;

  console.log(`Sending ${logLabel} via WhatsApp Onboarding template`);
  console.log('API URL:', url);
  console.log('Phone Number ID:', WHATSAPP_ONBOARDING_PHONE_NUMBER_ID);
  console.log('Brand Name:', WHATSAPP_OTP_BRAND_NAME);
  console.log('Template Name:', WHATSAPP_ONBOARDING_OTP_TEMPLATE);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);

  return postOnboardingOTP({
    url,
    logLabel,
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: WHATSAPP_ONBOARDING_OTP_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otp }],
          },
          {
            type: 'button',
            parameters: [{ type: 'text', text: WHATSAPP_ONBOARDING_OTP_BUTTON_TEXT }],
            sub_type: 'url',
            index: '0',
          },
        ],
      },
      biz_opaque_callback_data: WHATSAPP_BIZ_OPAQUE_CALLBACK_DATA,
    },
  });
}

export async function sendWhatsAppOTP({
  to,
  otp,
}: {
  to: string;
  otp: string;
}): Promise<WhatsAppResponse> {
  return sendOnboardingOTP({ to, otp, logLabel: 'WhatsApp OTP' });
}

export async function sendRoleOTP({
  to,
  otp,
}: {
  to: string;
  otp: string;
}): Promise<WhatsAppResponse> {
  return sendOnboardingOTP({ to, otp, logLabel: 'WhatsApp Role OTP' });
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendWhatsAppWelcome({
  to,
  templateName,
  customerId,
}: {
  to: string;
  templateName: string;
  customerId: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error('WhatsApp API key not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return {
      success: false,
      error: 'Invalid phone number format. Please provide a valid Indian mobile number (10 digits or with +91/91 prefix)',
    };
  }

  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  console.log('Sending WhatsApp welcome template');
  console.log('API URL:', url);
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Template Name:', templateName);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);
  console.log('Customer ID:', customerId);

  return postWhatsAppTemplate({
    url,
    logLabel: 'WhatsApp Welcome',
    payload: {
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
            parameters: [{ type: 'text', text: customerId }],
          },
        ],
      },
    },
  });
}

export async function sendWhatsAppInvoice({
  to,
  customerName,
  invoiceNumber,
  service,
  totalAmount,
  pdfUrl,
}: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  service: string;
  totalAmount: string;
  pdfUrl: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error('WhatsApp API key not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  if (!pdfUrl || !pdfUrl.startsWith('http')) {
    console.error('Invalid PDF URL provided:', pdfUrl);
    return { success: false, error: 'Invalid PDF URL - must be a valid HTTP/HTTPS URL' };
  }

  const formattedPhone = formatPhoneNumber(to);
  if (!validatePhoneNumber(formattedPhone)) {
    return {
      success: false,
      error: `Invalid phone number format: "${to}". Expected Indian mobile number (10 digits or with +91/91 prefix)`,
    };
  }

  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  const templateName = process.env.WHATSAPP_INVOICE_TEMPLATE || 'invoicetest1';

  console.log('Sending WhatsApp invoice template with PDF');
  console.log('API URL:', url);
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Template Name:', templateName);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);
  console.log('Customer Name:', customerName);
  console.log('Invoice Number:', invoiceNumber);
  console.log('Service:', service);
  console.log('Total Amount:', totalAmount);
  console.log('PDF URL:', pdfUrl);

  return postWhatsAppTemplate({
    url,
    logLabel: 'WhatsApp Invoice',
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: {
                  link: pdfUrl,
                  caption: '',
                  filename: `Invoice_${invoiceNumber.replace(/\//g, '_')}.pdf`,
                },
              },
            ],
          },
        ],
      },
    },
  });
}
