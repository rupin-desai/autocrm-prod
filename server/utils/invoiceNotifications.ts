import { Invoice } from '../models/Invoice';
import { sendWhatsAppInvoice } from '../services/whatsapp.js';
import { generateInvoicePDF as generatePDF } from './generateInvoicePDF.js';

interface NotificationData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  invoiceNumber: string;
  totalAmount: number;
  service: string;
  invoiceUrl?: string;
  pdfUrl?: string;
}

export async function sendInvoiceEmail(data: NotificationData): Promise<boolean> {
  try {
    console.log('📧 [STUB] Sending invoice email...');
    console.log('   To:', data.customerEmail);
    console.log('   Invoice:', data.invoiceNumber);
    console.log('   Amount: ₹', data.totalAmount);
    console.log('   PDF URL:', data.pdfUrl || 'Not generated');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ [STUB] Email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ [STUB] Email sending failed:', error);
    return false;
  }
}

export async function sendInvoiceWhatsApp(data: NotificationData): Promise<boolean> {
  try {
    if (!data.customerPhone) {
      console.log('⚠️ No customer phone number provided, skipping WhatsApp notification');
      return false;
    }

    if (!data.pdfUrl) {
      console.log('⚠️ No PDF URL provided, cannot send WhatsApp invoice');
      return false;
    }

    console.log('📱 Sending invoice via WhatsApp...');
    console.log('   To:', data.customerPhone);
    console.log('   Customer:', data.customerName);
    console.log('   Invoice:', data.invoiceNumber);
    console.log('   Service:', data.service);
    console.log('   Amount: ₹', data.totalAmount.toLocaleString());
    console.log('   PDF URL:', data.pdfUrl);

    const result = await sendWhatsAppInvoice({
      to: data.customerPhone,
      customerName: data.customerName,
      invoiceNumber: data.invoiceNumber,
      service: data.service,
      totalAmount: `₹${data.totalAmount.toLocaleString()}`,
      pdfUrl: data.pdfUrl
    });

    if (result.success) {
      console.log('✅ WhatsApp invoice sent successfully');
      return true;
    } else {
      console.error('❌ WhatsApp invoice sending failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ WhatsApp sending failed:', error);
    return false;
  }
}

export async function generateInvoicePDF(invoice: any): Promise<string> {
  try {
    console.log('📄 Generating invoice PDF...');
    console.log('   Invoice:', invoice.invoiceNumber);
    console.log('   Invoice ID:', invoice._id);
    
    const pdfPath = await generatePDF(invoice);
    
    // Priority: APP_URL (production) > REPLIT_DEV_DOMAIN (Replit) > localhost (local dev)
    let baseUrl = '';
    
    if (process.env.APP_URL) {
      // Production environment (e.g., https://crm.maulicardecor.com)
      baseUrl = process.env.APP_URL.replace(/\/$/, ''); // Remove trailing slash
      console.log('   Using APP_URL:', baseUrl);
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      // Replit development environment
      baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      console.log('   Using REPLIT_DEV_DOMAIN:', baseUrl);
    } else {
      // Local development fallback
      baseUrl = 'http://localhost:5000';
      console.log('   Using localhost (development):', baseUrl);
    }
    
    const token = invoice.pdfAccessToken;
    const pdfUrl = `${baseUrl}/api/public/invoices/${invoice._id}/pdf?token=${token}`;
    
    console.log('✅ PDF generated successfully');
    console.log('   Local path:', pdfPath);
    console.log('   Public URL:', pdfUrl);
    console.log('   Access Token:', token ? `${token.substring(0, 12)}...` : 'MISSING');
    console.log('   Token expires:', invoice.pdfTokenExpiry);
    console.log('   Current time:', new Date().toISOString());
    console.log('   Token valid:', invoice.pdfTokenExpiry > new Date() ? '✅ Yes' : '❌ Expired');
    
    return pdfUrl;
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    console.error('   Error details:', error instanceof Error ? error.message : String(error));
    console.error('   Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return '';
  }
}

export async function sendInvoiceNotifications(invoice: any): Promise<void> {
  try {
    if (invoice.notificationsSent?.whatsapp && invoice.notificationsSent?.whatsappSentAt) {
      console.log('⏭️ WhatsApp notification already sent on', invoice.notificationsSent.whatsappSentAt);
      console.log('   Skipping to prevent duplicate messages');
      return;
    }

    const pdfUrl = await generateInvoicePDF(invoice);
    
    let serviceDescription = 'Service';
    if (invoice.items && invoice.items.length > 0) {
      const firstItem = invoice.items[0];
      serviceDescription = firstItem.description || firstItem.productName || 'Service';
      if (invoice.items.length > 1) {
        serviceDescription += ` +${invoice.items.length - 1} more`;
      }
    }
    
    const notificationData: NotificationData = {
      customerName: invoice.customerDetails?.fullName || '',
      customerEmail: invoice.customerDetails?.email,
      customerPhone: invoice.customerDetails?.mobileNumber,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      service: serviceDescription,
      pdfUrl,
    };

    const emailSent = (invoice.customerDetails?.email && !invoice.notificationsSent?.email)
      ? await sendInvoiceEmail(notificationData)
      : false;

    let whatsappSent = false;
    if (invoice.customerDetails?.mobileNumber && !invoice.notificationsSent?.whatsapp) {
      invoice.notificationsSent.whatsapp = true;
      invoice.notificationsSent.whatsappSentAt = new Date();
      await invoice.save();
      
      console.log('🔒 WhatsApp send flag set to true and persisted (prevents duplicates)');
      
      whatsappSent = await sendInvoiceWhatsApp(notificationData);
      
      if (!whatsappSent) {
        console.error('❌ WhatsApp send failed, but flag remains TRUE to prevent duplicates');
        console.error('   ⚠️ IMPORTANT: Flag will NOT be cleared automatically');
        console.error('   If you are certain the message was not delivered, manually clear the flag in database');
        console.error('   Invoice ID:', invoice._id);
      }
    }

    if (emailSent) {
      invoice.notificationsSent.email = true;
      invoice.notificationsSent.emailSentAt = new Date();
      await invoice.save();
    }

    console.log('📨 Notifications summary:');
    console.log('   Email:', emailSent ? '✅' : (invoice.notificationsSent?.email ? '⏭️ Already sent' : '❌'));
    console.log('   WhatsApp:', whatsappSent ? '✅' : (invoice.notificationsSent?.whatsapp ? '⏭️ Already sent' : '❌'));
  } catch (error) {
    console.error('❌ Failed to send invoice notifications:', error);
  }
}
