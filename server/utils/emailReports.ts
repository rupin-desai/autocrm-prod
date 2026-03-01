import { Invoice } from '../models/Invoice';
import { RegistrationCustomer } from '../models/RegistrationCustomer';
import { Product } from '../models/Product';
import { Warranty } from '../models/Warranty';
import { Feedback } from '../models/Feedback';

interface DailyReportData {
  date: string;
  sales: {
    totalRevenue: number;
    totalInvoices: number;
    avgInvoiceValue: number;
  };
  customers: {
    total: number;
    new: number;
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
  };
  warranties: {
    active: number;
    expiring: number;
  };
  feedback: {
    totalComplaints: number;
    openComplaints: number;
    avgRating: number;
  };
}

export async function generateDailyReportData(): Promise<DailyReportData> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    invoiceStats,
    totalCustomers,
    newCustomers,
    lowStock,
    outOfStock,
    activeWarranties,
    expiringWarranties,
    totalComplaints,
    openComplaints,
    avgRatingData
  ] = await Promise.all([
    Invoice.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalInvoices: { $sum: 1 },
          avgInvoiceValue: { $avg: '$grandTotal' }
        }
      }
    ]),
    RegistrationCustomer.countDocuments(),
    RegistrationCustomer.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Product.countDocuments({ $expr: { $lte: ['$stockQty', '$minStockLevel'] }, stockQty: { $gt: 0 } }),
    Product.countDocuments({ stockQty: 0 }),
    Warranty.countDocuments({ status: 'active', endDate: { $gt: now } }),
    Warranty.countDocuments({
      status: 'active',
      endDate: { $gt: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
    }),
    Feedback.countDocuments({ type: 'complaint' }),
    Feedback.countDocuments({ type: 'complaint', status: { $in: ['open', 'in_progress'] } }),
    Feedback.aggregate([
      { $match: { rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ])
  ]);

  return {
    date: now.toISOString().split('T')[0],
    sales: {
      totalRevenue: invoiceStats[0]?.totalRevenue || 0,
      totalInvoices: invoiceStats[0]?.totalInvoices || 0,
      avgInvoiceValue: invoiceStats[0]?.avgInvoiceValue || 0
    },
    customers: {
      total: totalCustomers,
      new: newCustomers
    },
    inventory: {
      lowStock,
      outOfStock
    },
    warranties: {
      active: activeWarranties,
      expiring: expiringWarranties
    },
    feedback: {
      totalComplaints,
      openComplaints,
      avgRating: avgRatingData[0]?.avgRating || 0
    }
  };
}

export function formatDailyReportHTML(data: DailyReportData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Business Report - ${data.date}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #f97316;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #f97316;
      font-size: 18px;
      margin-bottom: 15px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .metric {
      background-color: #f9fafb;
      border-left: 4px solid #f97316;
      padding: 15px;
      border-radius: 4px;
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
      margin-top: 5px;
    }
    .alert {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
    }
    .alert h3 {
      color: #ef4444;
      margin: 0 0 10px 0;
      font-size: 16px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Daily Business Report</h1>
    <p style="color: #6b7280; margin-bottom: 30px;">Report Date: <strong>${data.date}</strong></p>
    
    <div class="section">
      <h2>💰 Sales Performance</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value">₹${data.sales.totalRevenue.toLocaleString('en-IN')}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Invoices</div>
          <div class="metric-value">${data.sales.totalInvoices}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Avg Invoice Value</div>
          <div class="metric-value">₹${data.sales.avgInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>👥 Customer Metrics</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Total Customers</div>
          <div class="metric-value">${data.customers.total}</div>
        </div>
        <div class="metric">
          <div class="metric-label">New Customers (30d)</div>
          <div class="metric-value">${data.customers.new}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>📦 Inventory Status</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Low Stock Items</div>
          <div class="metric-value" style="color: ${data.inventory.lowStock > 0 ? '#f97316' : '#10b981'};">${data.inventory.lowStock}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Out of Stock</div>
          <div class="metric-value" style="color: ${data.inventory.outOfStock > 0 ? '#ef4444' : '#10b981'};">${data.inventory.outOfStock}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>🛡️ Warranty Information</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Active Warranties</div>
          <div class="metric-value">${data.warranties.active}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Expiring Soon (30d)</div>
          <div class="metric-value" style="color: ${data.warranties.expiring > 0 ? '#f97316' : '#10b981'};">${data.warranties.expiring}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>💬 Customer Feedback</h2>
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Average Rating</div>
          <div class="metric-value">${data.feedback.avgRating.toFixed(1)} / 5.0</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Complaints</div>
          <div class="metric-value">${data.feedback.totalComplaints}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Open Complaints</div>
          <div class="metric-value" style="color: ${data.feedback.openComplaints > 0 ? '#ef4444' : '#10b981'};">${data.feedback.openComplaints}</div>
        </div>
      </div>
    </div>
    
    ${(data.inventory.lowStock > 0 || data.inventory.outOfStock > 0 || data.feedback.openComplaints > 0 || data.warranties.expiring > 0) ? `
    <div class="alert">
      <h3>⚠️ Action Required</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${data.inventory.outOfStock > 0 ? `<li>${data.inventory.outOfStock} products are out of stock</li>` : ''}
        ${data.inventory.lowStock > 0 ? `<li>${data.inventory.lowStock} products have low stock</li>` : ''}
        ${data.feedback.openComplaints > 0 ? `<li>${data.feedback.openComplaints} customer complaints need attention</li>` : ''}
        ${data.warranties.expiring > 0 ? `<li>${data.warranties.expiring} warranties expiring in the next 30 days</li>` : ''}
      </ul>
    </div>
    ` : ''}
    
    <div class="footer">
      <p>This is an automated daily report from Mauli Car World Management System</p>
      <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendDailyReportEmail(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const reportData = await generateDailyReportData();
    const htmlContent = formatDailyReportHTML(reportData);
    
    console.log('📧 Email Report Generated for:', recipientEmail);
    console.log('Report Data:', JSON.stringify(reportData, null, 2));
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to generate daily report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
