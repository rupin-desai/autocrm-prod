interface WhatsAppResponse {
  success: boolean;
  statusDesc?: string;
  statusCode?: number;
  data?: any;
  error?: string;
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

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = INITIAL_RETRY_DELAY,
  attempt: number = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= retries) {
      throw error;
    }
    
    console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms... (${retries - attempt} retries left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return retryWithBackoff(fn, retries, delay * 2, attempt + 1);
  }
}

function formatPhoneNumber(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    console.error('⚠️ Invalid phone number: empty or not a string');
    return null;
  }

  let formattedPhone = phone.trim().replace(/\D/g, '');
  
  if (!formattedPhone) {
    console.error('⚠️ Phone number contains no digits');
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
    console.error(`⚠️ Invalid phone number format after normalization: "${formattedPhone}" (original: "${phone}")`);
    console.error('Expected format: 12 digits starting with 91 (e.g., 919619523254)');
    return null;
  }
  
  return formattedPhone;
}

function validatePhoneNumber(phone: string | null): boolean {
  if (!phone) return false;
  return phone.length === 12 && phone.startsWith('91') && /^\d+$/.test(phone);
}

export async function sendWhatsAppOTP({ 
  to, 
  otp 
}: { 
  to: string; 
  otp: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error(`❌ WhatsApp API key not configured for ${WHATSAPP_OTP_BRAND_NAME}`);
    return { success: false, error: `WhatsApp credentials not configured for ${WHATSAPP_OTP_BRAND_NAME}` };
  }

  const formattedPhone = formatPhoneNumber(to);
  
  if (!formattedPhone) {
    console.error('❌ Invalid phone number format');
    return { success: false, error: 'Invalid phone number format. Please provide a valid Indian mobile number (10 digits or with +91/91 prefix)' };
  }
  
  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  
  console.log('\n📱 Sending WhatsApp OTP Template');
  console.log('================================');
  console.log('API URL:', url);
  console.log('API Key:', WHATSAPP_API_KEY.substring(0, 8) + '...');
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Brand Name:', WHATSAPP_OTP_BRAND_NAME);
  console.log('Template Name:', WHATSAPP_OTP_TEMPLATE_NAME);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);
  console.log('OTP:', otp);
  console.log('================================\n');

  try {
    const startTime = Date.now();
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: WHATSAPP_OTP_TEMPLATE_NAME,
        language: {
          code: 'en'
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: otp
              }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: otp
              }
            ]
          }
        ]
      }
    };

    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    console.log(`\n✅ WhatsApp OTP Response (${responseTime}ms)`);
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('================================\n');

    if (data.success) {
      return { 
        success: true, 
        statusDesc: data.statusDesc,
        data: data.data 
      };
    } else {
      return { 
        success: false, 
        error: data.statusDesc || `Failed to send WhatsApp OTP template for ${WHATSAPP_OTP_BRAND_NAME}`,
        statusCode: data.statusCode
      };
    }
  } catch (error) {
    console.error('❌ WhatsApp OTP Template API Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : `Failed to send WhatsApp OTP template for ${WHATSAPP_OTP_BRAND_NAME}`
    };
  }
}

export async function sendRoleOTP({ 
  to, 
  otp 
}: { 
  to: string; 
  otp: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error(`❌ WhatsApp API key not configured for ${WHATSAPP_OTP_BRAND_NAME}`);
    return { success: false, error: `WhatsApp credentials not configured for ${WHATSAPP_OTP_BRAND_NAME}` };
  }

  const formattedPhone = formatPhoneNumber(to);
  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  
  console.log('\n📱 Sending WhatsApp Role OTP Template');
  console.log('================================');
  console.log('API URL:', url);
  console.log('API Key:', WHATSAPP_API_KEY.substring(0, 8) + '...');
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Brand Name:', WHATSAPP_OTP_BRAND_NAME);
  console.log('Template Name:', WHATSAPP_ROLE_OTP_TEMPLATE_NAME);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);
  console.log('OTP:', otp);
  console.log('================================\n');

  try {
    const startTime = Date.now();
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: WHATSAPP_ROLE_OTP_TEMPLATE_NAME,
        language: {
          code: 'en'
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: otp
              }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: otp
              }
            ]
          }
        ]
      }
    };

    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    console.log(`\n✅ WhatsApp Role OTP Response (${responseTime}ms)`);
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('================================\n');

    if (data.success) {
      return { 
        success: true, 
        statusDesc: data.statusDesc,
        data: data.data 
      };
    } else {
      return { 
        success: false, 
        error: data.statusDesc || `Failed to send WhatsApp Role OTP template for ${WHATSAPP_OTP_BRAND_NAME}`,
        statusCode: data.statusCode
      };
    }
  } catch (error) {
    console.error('❌ WhatsApp Role OTP Template API Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : `Failed to send WhatsApp Role OTP template for ${WHATSAPP_OTP_BRAND_NAME}`
    };
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendWhatsAppWelcome({ 
  to, 
  templateName,
  customerId
}: { 
  to: string; 
  templateName: string;
  customerId: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error('❌ WhatsApp API key not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const formattedPhone = formatPhoneNumber(to);
  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  
  console.log('\n📱 Sending WhatsApp Welcome Template');
  console.log('================================');
  console.log('API URL:', url);
  console.log('API Key:', WHATSAPP_API_KEY.substring(0, 8) + '...');
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Template Name:', templateName);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);
  console.log('Customer ID:', customerId);
  console.log('================================\n');

  try {
    const startTime = Date.now();
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en'
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: customerId
              }
            ]
          }
        ]
      }
    };

    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    console.log(`\n✅ WhatsApp Welcome Response (${responseTime}ms)`);
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('================================\n');

    if (data.success) {
      return { 
        success: true, 
        statusDesc: data.statusDesc,
        data: data.data 
      };
    } else {
      return { 
        success: false, 
        error: data.statusDesc || 'Failed to send WhatsApp template',
        statusCode: data.statusCode
      };
    }
  } catch (error) {
    console.error('❌ WhatsApp Template API Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send WhatsApp template'
    };
  }
}

export async function sendWhatsAppInvoice({ 
  to, 
  customerName,
  invoiceNumber,
  service,
  totalAmount,
  pdfUrl
}: { 
  to: string; 
  customerName: string;
  invoiceNumber: string;
  service: string;
  totalAmount: string;
  pdfUrl: string;
}): Promise<WhatsAppResponse> {
  if (!WHATSAPP_API_KEY) {
    console.error('❌ WhatsApp API key not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  if (!pdfUrl || !pdfUrl.startsWith('http')) {
    console.error('❌ Invalid PDF URL provided:', pdfUrl);
    return { success: false, error: 'Invalid PDF URL - must be a valid HTTP/HTTPS URL' };
  }

  const formattedPhone = formatPhoneNumber(to);
  
  if (!validatePhoneNumber(formattedPhone)) {
    console.error('❌ Phone number validation failed');
    return { 
      success: false, 
      error: `Invalid phone number format: "${to}". Expected Indian mobile number (10 digits or with +91/91 prefix)` 
    };
  }

  const url = `${WHATSAPP_BASE_URL}/send-template/${WHATSAPP_PHONE_NUMBER_ID}`;
  const templateName = process.env.WHATSAPP_INVOICE_TEMPLATE || 'invoicetest1';
  
  console.log('\n📱 Sending WhatsApp Invoice Template with PDF');
  console.log('================================');
  console.log('API URL:', url);
  console.log('API Key:', WHATSAPP_API_KEY.substring(0, 8) + '...');
  console.log('Channel Number:', WHATSAPP_PHONE_NUMBER_ID);
  console.log('Template Name:', templateName);
  console.log('To (Original):', to);
  console.log('To (Formatted):', formattedPhone);
  console.log('Customer Name:', customerName);
  console.log('Invoice Number:', invoiceNumber);
  console.log('Service:', service);
  console.log('Total Amount:', totalAmount);
  console.log('PDF URL:', pdfUrl);
  console.log('================================\n');

  try {
    const startTime = Date.now();
    
    // Template payload matching your WhatsApp Business template structure
    // Template "invoicetest1" only has header (document) - no body parameters
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en'
        },
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
          }
        ]
      }
    };

    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      console.warn(`⚠️ WhatsApp API returned HTTP ${response.status}`);
    }
    
    const data = await response.json();

    console.log(`\n📥 WhatsApp Invoice API Response (${responseTime}ms)`);
    console.log('================================');
    console.log('HTTP Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('================================\n');

    // Check if API returned success
    if (data.success === true || response.status === 200) {
      console.log('✅ WhatsApp API reported SUCCESS');
      console.log('   Status Description:', data.statusDesc || 'Message sent');
      console.log('   Message ID:', data.data?.id || data.id || 'Not provided');
      return { 
        success: true, 
        statusDesc: data.statusDesc || 'Message sent successfully',
        data: data.data 
      };
    } else {
      console.error('❌ WhatsApp API returned FAILURE');
      console.error('   Error:', data.statusDesc || data.error || data.message || 'Unknown error');
      console.error('   Status Code:', data.statusCode || response.status);
      console.error('   Full Response:', JSON.stringify(data, null, 2));
      
      // Check for common errors
      if (data.error?.message) {
        console.error('   Detailed Error Message:', data.error.message);
      }
      if (data.error?.error_data) {
        console.error('   Error Data:', JSON.stringify(data.error.error_data, null, 2));
      }
      
      return { 
        success: false, 
        error: data.statusDesc || data.error?.message || data.message || 'Failed to send WhatsApp invoice',
        statusCode: data.statusCode || response.status
      };
    }
  } catch (error) {
    console.error('❌ WhatsApp Invoice API Error:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send WhatsApp invoice template'
    };
  }
}
