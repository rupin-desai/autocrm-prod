interface WhatsAppResponse {
  success: boolean;
  statusDesc?: string;
  statusCode?: number;
  data?: any;
  error?: string;
  providerMessageId?: string;
}

function parseEnvValue(envKey: string): string | undefined {
  const rawValue = process.env[envKey]?.trim() || process.env.MONGODB_URI?.trim();
  if (!rawValue) return undefined;

  const keyPattern = new RegExp(`${envKey}\\s*=\\s*([^\\s]+)`);
  const match = rawValue.match(keyPattern);
  return match ? match[1].trim() : (envKey === process.env[envKey] ? undefined : rawValue);
}

let WHATSAPP_API_KEY = parseEnvValue('WHATSAPP_API_KEY');
let WHATSAPP_PHONE_NUMBER_ID = parseEnvValue('WHATSAPP_PHONE_NUMBER_ID') || '919970127778';

const WHATSAPP_BASE_URL = 'https://cloudapi.akst.in/api/v1.0/messages';
export const WHATSAPP_OTP_BRAND_NAME = process.env.WHATSAPP_OTP_BRAND_NAME?.trim() || 'MAULI CAR DECOR';
const WHATSAPP_OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || 'otptest';
const WHATSAPP_ROLE_OTP_TEMPLATE_NAME = process.env.WHATSAPP_ROLE_OTP_TEMPLATE_NAME?.trim() || 'roleotp';

function extractProviderMessageId(data: any): string | undefined {
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

export async function sendWhatsAppOTP({
  to,
  otp,
}: {
  to: string;
  otp: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error(`WhatsApp API key not configured for ${WHATSAPP_OTP_BRAND_NAME}`);
    return { success: false, error: `WhatsApp credentials not configured for ${WHATSAPP_OTP_BRAND_NAME}` };
  }

  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return {
      success: false,
      error: 'Invalid phone number format. Please provide a valid Indian mobile number (10 digits or with +91/91 prefix)',
    };
  }

  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  console.log('Sending WhatsApp OTP template');
  console.log('API URL:', url);
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Brand Name:', WHATSAPP_OTP_BRAND_NAME);
  console.log('Template Name:', WHATSAPP_OTP_TEMPLATE_NAME);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);

  return postWhatsAppTemplate({
    url,
    logLabel: 'WhatsApp OTP',
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: WHATSAPP_OTP_TEMPLATE_NAME,
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
    },
  });
}

export async function sendRoleOTP({
  to,
  otp,
}: {
  to: string;
  otp: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error(`WhatsApp API key not configured for ${WHATSAPP_OTP_BRAND_NAME}`);
    return { success: false, error: `WhatsApp credentials not configured for ${WHATSAPP_OTP_BRAND_NAME}` };
  }

  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return {
      success: false,
      error: 'Invalid phone number format. Please provide a valid Indian mobile number (10 digits or with +91/91 prefix)',
    };
  }

  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  console.log('Sending WhatsApp role OTP template');
  console.log('API URL:', url);
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Brand Name:', WHATSAPP_OTP_BRAND_NAME);
  console.log('Template Name:', WHATSAPP_ROLE_OTP_TEMPLATE_NAME);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);

  return postWhatsAppTemplate({
    url,
    logLabel: 'WhatsApp Role OTP',
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: WHATSAPP_ROLE_OTP_TEMPLATE_NAME,
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
    },
  });
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
