import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface CustomerDetails {
  referenceCode?: string;
  fullName: string;
  mobileNumber: string;
  alternativeNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  referralSource?: string;
  isVerified?: boolean;
  registrationDate?: Date;
}

interface VehicleDetails {
  vehicleId?: string;
  vehicleNumber?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  customModel?: string;
  variant?: string;
  color?: string;
  yearOfPurchase?: number;
  vehiclePhoto?: string;
  isNewVehicle?: boolean;
  chassisNumber?: string;
  selectedParts?: string[];
  vehicleRegistrationDate?: Date;
}

interface InvoiceData {
  invoiceNumber: string;
  createdAt: Date;
  dueDate?: Date;
  customerDetails: CustomerDetails;
  vehicleDetails: VehicleDetails[];
  items: Array<{
    name: string;
    hsnNumber?: string | null;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    hasGst?: boolean;
    gstAmount?: number;
  }>;
  subtotal: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount?: number;
  dueAmount: number;
  notes?: string;
  terms?: string;
}

export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const pdfDir = path.join(process.cwd(), 'invoices');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const filename = `invoice_${invoiceData.invoiceNumber.replace(/\//g, '_')}.pdf`;
      const filepath = path.join(pdfDir, filename);

      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      doc.fontSize(20).font('Helvetica-Bold').text('Mauli Car World', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Invoice', 50, 75);

      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).font('Helvetica').text(invoiceData.invoiceNumber, 400, 75, { align: 'right' });

      let yPosition = 120;

      // Customer Details Section
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, yPosition);
      yPosition += 20;
      
      const customer = invoiceData.customerDetails;
      doc.fontSize(10).font('Helvetica-Bold').text(customer.fullName, 50, yPosition, { width: 280 });
      yPosition += 18;
      
      if (customer.referenceCode) {
        doc.fontSize(9).font('Helvetica').text(`Ref: ${customer.referenceCode}`, 50, yPosition, { width: 280 });
        yPosition += 15;
      }
      
      doc.fontSize(9).font('Helvetica').text(`Mobile: ${customer.mobileNumber}`, 50, yPosition, { width: 280 });
      yPosition += 15;
      
      if (customer.alternativeNumber) {
        doc.text(`Alt Mobile: ${customer.alternativeNumber}`, 50, yPosition, { width: 280 });
        yPosition += 15;
      }
      
      if (customer.email) {
        doc.text(customer.email, 50, yPosition, { width: 280 });
        yPosition += 15;
      }
      
      if (customer.address) {
        const addressHeight = doc.heightOfString(customer.address, { width: 280 });
        doc.text(customer.address, 50, yPosition, { width: 280 });
        yPosition += Math.ceil(addressHeight) + 3;
      }
      
      const location = [customer.city, customer.taluka, customer.district, customer.state]
        .filter(Boolean)
        .join(', ');
      if (location) {
        const locationHeight = doc.heightOfString(location, { width: 280 });
        doc.text(location, 50, yPosition, { width: 280 });
        yPosition += Math.ceil(locationHeight) + 3;
      }
      
      if (customer.pinCode) {
        doc.text(`PIN: ${customer.pinCode}`, 50, yPosition, { width: 280 });
        yPosition += 15;
      }
      
      if (customer.referralSource) {
        doc.text(`Referral: ${customer.referralSource}`, 50, yPosition, { width: 280 });
        yPosition += 15;
      }
      
      if (customer.isVerified) {
        doc.fillColor('#0a8754').text('✓ Verified Customer', 50, yPosition, { width: 280 });
        doc.fillColor('#000');
        yPosition += 15;
      }

      // Invoice Date Section (Right Side)
      const invoiceDate = new Date(invoiceData.createdAt).toLocaleDateString();
      let rightYPos = 120;
      doc.fontSize(10).font('Helvetica-Bold').text('Invoice Date:', 400, rightYPos, { align: 'right' });
      rightYPos += 15;
      doc.font('Helvetica').text(invoiceDate, 400, rightYPos, { align: 'right' });
      rightYPos += 20;

      if (invoiceData.dueDate) {
        const dueDate = new Date(invoiceData.dueDate).toLocaleDateString();
        doc.font('Helvetica-Bold').text('Due Date:', 400, rightYPos, { align: 'right' });
        rightYPos += 15;
        doc.font('Helvetica').text(dueDate, 400, rightYPos, { align: 'right' });
        rightYPos += 20;
      }

      // Vehicle Details Section
      yPosition += 10;
      if (invoiceData.vehicleDetails && invoiceData.vehicleDetails.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Vehicle Details:', 50, yPosition);
        yPosition += 20;
        
        invoiceData.vehicleDetails.forEach((vehicle, index) => {
          if (invoiceData.vehicleDetails.length > 1) {
            doc.fontSize(10).font('Helvetica-Bold').text(`Vehicle ${index + 1}:`, 50, yPosition, { width: 280 });
            yPosition += 15;
          }
          
          doc.fontSize(9).font('Helvetica');
          
          if (vehicle.vehicleNumber) {
            doc.text(`Number: ${vehicle.vehicleNumber}`, 60, yPosition, { width: 270 });
            yPosition += 14;
          }
          
          if (vehicle.vehicleBrand || vehicle.vehicleModel) {
            const brandModel = [vehicle.vehicleBrand, vehicle.vehicleModel, vehicle.customModel]
              .filter(Boolean)
              .join(' - ');
            const modelHeight = doc.heightOfString(`Model: ${brandModel}`, { width: 270 });
            doc.text(`Model: ${brandModel}`, 60, yPosition, { width: 270 });
            yPosition += Math.ceil(modelHeight) + 2;
          }
          
          if (vehicle.variant) {
            doc.text(`Variant: ${vehicle.variant}`, 60, yPosition, { width: 270 });
            yPosition += 14;
          }
          
          if (vehicle.color) {
            doc.text(`Color: ${vehicle.color}`, 60, yPosition, { width: 270 });
            yPosition += 14;
          }
          
          if (vehicle.yearOfPurchase) {
            doc.text(`Year: ${vehicle.yearOfPurchase}`, 60, yPosition, { width: 270 });
            yPosition += 14;
          }
          
          if (vehicle.chassisNumber) {
            doc.text(`Chassis: ${vehicle.chassisNumber}`, 60, yPosition, { width: 270 });
            yPosition += 14;
          }
          
          if (vehicle.isNewVehicle !== undefined) {
            doc.text(`Condition: ${vehicle.isNewVehicle ? 'New' : 'Used'}`, 60, yPosition, { width: 270 });
            yPosition += 14;
          }
          
          if (vehicle.selectedParts && vehicle.selectedParts.length > 0) {
            const partsText = `Parts: ${vehicle.selectedParts.join(', ')}`;
            const partsHeight = doc.heightOfString(partsText, { width: 270 });
            doc.text(partsText, 60, yPosition, { width: 270 });
            yPosition += Math.ceil(partsHeight) + 2;
          }
          
          yPosition += 5;
        });
      }

      yPosition = Math.max(yPosition + 20, rightYPos + 20);

      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 20;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Product Name', 50, yPosition);
      doc.text('Qty', 230, yPosition, { width: 30, align: 'right' });
      doc.text('Unit Price', 270, yPosition, { width: 70, align: 'right' });
      doc.text('GST', 350, yPosition, { width: 50, align: 'right' });
      doc.fontSize(8).text('(18%)', 350, yPosition + 11, { width: 50, align: 'right' });
      doc.fontSize(10).text('Total', 410, yPosition, { width: 120, align: 'right' });

      yPosition += 20;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 15;

      doc.font('Helvetica');
      
      const sortedItems = [...invoiceData.items].sort((a, b) => {
        if (a.hasGst && !b.hasGst) return -1;
        if (!a.hasGst && b.hasGst) return 1;
        return 0;
      });
      
      sortedItems.forEach((item) => {
        const itemHeight = item.description ? 37 : 25;
        
        if (yPosition + itemHeight > 700) {
          doc.addPage();
          yPosition = 50;
          
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Product Name', 50, yPosition);
          doc.text('Qty', 230, yPosition, { width: 30, align: 'right' });
          doc.text('Unit Price', 270, yPosition, { width: 70, align: 'right' });
          doc.text('GST', 350, yPosition, { width: 50, align: 'right' });
          doc.fontSize(8).text('(18%)', 350, yPosition + 11, { width: 50, align: 'right' });
          doc.fontSize(10).text('Total', 410, yPosition, { width: 120, align: 'right' });
          yPosition += 20;
          doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
          yPosition += 15;
          doc.font('Helvetica');
        }

        const displayName = item.hsnNumber ? `${item.name} (${item.hsnNumber})` : item.name;
        doc.fontSize(10).text(displayName, 50, yPosition, { width: 170 });
        const itemYPosition = yPosition;
        
        if (item.description) {
          yPosition += 12;
          doc.fontSize(8).fillColor('#666').text(item.description, 50, yPosition, { width: 170 });
          doc.fillColor('#000');
        }

        const unitPriceExclGst = item.hasGst 
          ? (item.total - (item.gstAmount || 0))
          : item.total;
        const gstDisplay = item.hasGst && item.gstAmount 
          ? `${Math.round(item.gstAmount)}`
          : '-';

        doc.fontSize(10).text(item.quantity.toString(), 230, itemYPosition, { width: 30, align: 'right' });
        doc.text(Math.round(unitPriceExclGst).toString(), 270, itemYPosition, { width: 70, align: 'right' });
        doc.text(gstDisplay, 350, itemYPosition, { width: 50, align: 'right' });
        doc.text(Math.round(item.total).toString(), 410, itemYPosition, { width: 120, align: 'right' });

        yPosition += item.description ? 25 : 25;
      });

      yPosition += 10;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 20;

      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', 350, yPosition);
      doc.text(`Rs. ${invoiceData.subtotal.toFixed(0)}`, 430, yPosition, { width: 100, align: 'right' });
      yPosition += 20;

      if (invoiceData.discountAmount && invoiceData.discountAmount > 0) {
        let discountText = 'Discount:';
        if (invoiceData.discountType === 'percentage' && invoiceData.discountValue) {
          discountText = `Discount (${invoiceData.discountValue}%):`;
        }
        doc.text(discountText, 350, yPosition);
        doc.text(`-Rs. ${invoiceData.discountAmount.toFixed(0)}`, 430, yPosition, { width: 100, align: 'right' });
        yPosition += 20;
      }

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Total Amount:', 350, yPosition);
      doc.text(`Rs. ${invoiceData.totalAmount.toFixed(0)}`, 430, yPosition, { width: 100, align: 'right' });
      yPosition += 25;

      if (invoiceData.paidAmount && invoiceData.paidAmount > 0) {
        doc.fontSize(10).font('Helvetica');
        doc.text('Paid Amount:', 350, yPosition);
        doc.text(`Rs. ${invoiceData.paidAmount.toFixed(0)}`, 430, yPosition, { width: 100, align: 'right' });
        yPosition += 20;

        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Amount Due:', 350, yPosition);
        doc.text(`Rs. ${invoiceData.dueAmount.toFixed(0)}`, 430, yPosition, { width: 100, align: 'right' });
        yPosition += 25;
      }

      if (invoiceData.notes) {
        const notesHeight = doc.heightOfString(invoiceData.notes, { width: 500 });
        if (yPosition + notesHeight + 60 > 750) {
          doc.addPage();
          yPosition = 50;
        }
        yPosition += 20;
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50, yPosition);
        yPosition += 15;
        doc.fontSize(9).font('Helvetica').text(invoiceData.notes, 50, yPosition, { width: 500 });
        yPosition += Math.ceil(notesHeight) + 20;
      }

      if (invoiceData.terms) {
        const termsHeight = doc.heightOfString(invoiceData.terms, { width: 500 });
        if (yPosition + termsHeight + 40 > 750) {
          doc.addPage();
          yPosition = 50;
        }
        doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:', 50, yPosition);
        yPosition += 15;
        doc.fontSize(9).font('Helvetica').text(invoiceData.terms, 50, yPosition, { width: 500 });
      }

      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}
