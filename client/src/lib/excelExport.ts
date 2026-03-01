import * as XLSX from 'xlsx';

interface ExcelSheet {
  name: string;
  data: any[];
  columns?: string[];
}

export function exportToExcel(sheets: ExcelSheet[], filename: string) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    let worksheet;
    
    if (sheet.data && sheet.data.length > 0) {
      if (sheet.columns) {
        const formattedData = sheet.data.map(row => {
          const formattedRow: any = {};
          sheet.columns!.forEach(col => {
            formattedRow[col] = row[col] !== undefined ? row[col] : '';
          });
          return formattedRow;
        });
        worksheet = XLSX.utils.json_to_sheet(formattedData, { header: sheet.columns });
      } else {
        worksheet = XLSX.utils.json_to_sheet(sheet.data);
      }

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!worksheet[address]) continue;
        worksheet[address].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }

      const colWidths = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            const cellValue = String(cell.v);
            maxWidth = Math.max(maxWidth, cellValue.length);
          }
        }
        colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
      }
      worksheet['!cols'] = colWidths;
    } else {
      worksheet = XLSX.utils.aoa_to_sheet([['No data available']]);
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatSalesDataForExcel(salesReport: any[]) {
  return salesReport.map(item => ({
    'Period': item._id.day 
      ? `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}` 
      : `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
    'Total Sales (₹)': item.totalSales,
    'Total Orders': item.totalOrders,
    'Avg Order Value (₹)': Math.round(item.avgOrderValue)
  }));
}

export function formatInventoryDataForExcel(inventoryReport: any) {
  const sheets = [];

  if (inventoryReport.lowStockProducts && inventoryReport.lowStockProducts.length > 0) {
    sheets.push({
      name: 'Low Stock Products',
      data: inventoryReport.lowStockProducts.map((p: any) => ({
        'Product Name': p.name,
        'Current Stock': p.stockQty,
        'Min Stock Level': p.minStockLevel,
        'Category': p.category || 'N/A',
        'Price (₹)': p.price || 'N/A'
      }))
    });
  }

  if (inventoryReport.outOfStockProducts && inventoryReport.outOfStockProducts.length > 0) {
    sheets.push({
      name: 'Out of Stock Products',
      data: inventoryReport.outOfStockProducts.map((p: any) => ({
        'Product Name': p.name,
        'Category': p.category || 'N/A',
        'Min Stock Level': p.minStockLevel,
        'Price (₹)': p.price || 'N/A'
      }))
    });
  }

  sheets.push({
    name: 'Summary',
    data: [{
      'Total Inventory Value (₹)': inventoryReport.totalInventoryValue?.totalValue || 0,
      'Total Items': inventoryReport.totalInventoryValue?.totalItems || 0,
      'Low Stock Count': inventoryReport.lowStockProducts?.length || 0,
      'Out of Stock Count': inventoryReport.outOfStockProducts?.length || 0
    }]
  });

  return sheets;
}

export function formatTopProductsForExcel(topProducts: any[]) {
  return topProducts.map((p: any) => ({
    'Product Name': p.product?.name || 'N/A',
    'Category': p.product?.category || 'N/A',
    'Total Quantity Sold': p.totalQuantity,
    'Total Revenue (₹)': p.totalRevenue,
    'Order Count': p.orderCount
  }));
}

export function formatEmployeePerformanceForExcel(employeePerformance: any[]) {
  return employeePerformance.map((emp: any) => ({
    'Employee Name': emp.employee?.name || 'N/A',
    'Role': emp.employee?.role || 'N/A',
    'Total Sales (₹)': emp.totalSales,
    'Order Count': emp.orderCount,
    'Avg Order Value (₹)': Math.round(emp.avgOrderValue)
  }));
}

export function formatSalesEnhancedForExcel(salesEnhanced: any) {
  const sheets = [];

  sheets.push({
    name: 'Sales Summary',
    data: [{
      'Total Revenue (₹)': salesEnhanced.invoices?.totalRevenue || 0,
      'Total Invoices': salesEnhanced.invoices?.totalInvoices || 0,
      'Avg Invoice Value (₹)': Math.round(salesEnhanced.invoices?.avgInvoiceValue || 0),
      'Total Discounts (₹)': salesEnhanced.invoices?.totalDiscount || 0
    }]
  });

  if (salesEnhanced.coupons && salesEnhanced.coupons.length > 0) {
    sheets.push({
      name: 'Coupon Usage',
      data: salesEnhanced.coupons.map((c: any) => ({
        'Coupon Code': c._id,
        'Usage Count': c.usageCount,
        'Total Discount (₹)': c.totalDiscount
      }))
    });
  }

  return sheets;
}

export function formatCustomersForExcel(customers: any) {
  const sheets = [];

  sheets.push({
    name: 'Customer Summary',
    data: [{
      'Total Customers': customers.total || 0,
      'Active Customers': customers.active || 0,
      'New Customers (30d)': customers.new || 0,
      'Repeat Customers': customers.repeat || 0,
      'Referred Customers': customers.referred || 0
    }]
  });

  if (customers.byReferralSource && customers.byReferralSource.length > 0) {
    sheets.push({
      name: 'Referral Sources',
      data: customers.byReferralSource.map((r: any) => ({
        'Source': r._id,
        'Customer Count': r.count
      }))
    });
  }

  return sheets;
}

export function formatInventoryEnhancedForExcel(inventoryEnhanced: any) {
  const sheets = [];

  sheets.push({
    name: 'Inventory Summary',
    data: [{
      'Total Inventory Value (₹)': inventoryEnhanced.totalInventoryValue?.totalValue || 0,
      'Total Products': inventoryEnhanced.totalInventoryValue?.totalProducts || 0,
      'Total Items': inventoryEnhanced.totalInventoryValue?.totalItems || 0,
      'Low Stock Count': inventoryEnhanced.lowStockProducts?.length || 0,
      'Out of Stock Count': inventoryEnhanced.outOfStockProducts?.length || 0
    }]
  });

  if (inventoryEnhanced.brandWise && inventoryEnhanced.brandWise.length > 0) {
    sheets.push({
      name: 'Brand-wise Analysis',
      data: inventoryEnhanced.brandWise.map((b: any) => ({
        'Brand': b._id,
        'Total Products': b.totalProducts,
        'Total Stock': b.totalStock,
        'Total Value (₹)': b.totalValue,
        'Avg Price (₹)': Math.round(b.avgPrice)
      }))
    });
  }

  if (inventoryEnhanced.colorWise && inventoryEnhanced.colorWise.length > 0) {
    sheets.push({
      name: 'Color-wise Analysis',
      data: inventoryEnhanced.colorWise.map((c: any) => ({
        'Color': c._id,
        'Total Products': c.totalProducts,
        'Total Stock': c.totalStock
      }))
    });
  }

  if (inventoryEnhanced.lowStockProducts && inventoryEnhanced.lowStockProducts.length > 0) {
    sheets.push({
      name: 'Low Stock Products',
      data: inventoryEnhanced.lowStockProducts.map((p: any) => ({
        'Product Name': p.name,
        'Current Stock': p.stockQty,
        'Min Stock Level': p.minStockLevel,
        'Category': p.category || 'N/A'
      }))
    });
  }

  if (inventoryEnhanced.outOfStockProducts && inventoryEnhanced.outOfStockProducts.length > 0) {
    sheets.push({
      name: 'Out of Stock Products',
      data: inventoryEnhanced.outOfStockProducts.map((p: any) => ({
        'Product Name': p.name,
        'Min Stock Level': p.minStockLevel,
        'Category': p.category || 'N/A'
      }))
    });
  }

  return sheets;
}

export function formatWarrantiesForExcel(warranties: any) {
  const sheets = [];

  sheets.push({
    name: 'Warranty Summary',
    data: [{
      'Active Warranties': warranties.active || 0,
      'Expiring Soon': warranties.expiringCount || 0,
      'Expired Warranties': warranties.expired || 0
    }]
  });

  if (warranties.byProduct && warranties.byProduct.length > 0) {
    sheets.push({
      name: 'Warranties by Product',
      data: warranties.byProduct.map((w: any) => ({
        'Product': w._id,
        'Total Warranties': w.count,
        'Active Warranties': w.activeCount
      }))
    });
  }

  if (warranties.expiring && warranties.expiring.length > 0) {
    sheets.push({
      name: 'Expiring Warranties',
      data: warranties.expiring.map((w: any) => ({
        'Customer': w.customerName || 'N/A',
        'Product': w.productName || 'N/A',
        'Expiry Date': w.expiryDate ? new Date(w.expiryDate).toLocaleDateString() : 'N/A',
        'Phone': w.phone || 'N/A'
      }))
    });
  }

  return sheets;
}

export function formatFeedbackForExcel(feedback: any) {
  const sheets = [];

  sheets.push({
    name: 'Feedback Summary',
    data: [{
      'Average Rating': feedback.averageRating ? feedback.averageRating.toFixed(2) : 'N/A',
      'Total Rated': feedback.totalRated || 0,
      'Total Complaints': feedback.totalComplaints || 0,
      'Open Complaints': feedback.openComplaints || 0
    }]
  });

  if (feedback.ratingDistribution && feedback.ratingDistribution.length > 0) {
    sheets.push({
      name: 'Rating Distribution',
      data: feedback.ratingDistribution.map((r: any) => ({
        'Rating': r._id + ' Stars',
        'Count': r.count
      }))
    });
  }

  if (feedback.byType && feedback.byType.length > 0) {
    sheets.push({
      name: 'Feedback by Type',
      data: feedback.byType.map((t: any) => ({
        'Type': t._id,
        'Count': t.count,
        'Avg Rating': t.avgRating ? t.avgRating.toFixed(2) : 'N/A'
      }))
    });
  }

  if (feedback.byStatus && feedback.byStatus.length > 0) {
    sheets.push({
      name: 'Feedback by Status',
      data: feedback.byStatus.map((s: any) => ({
        'Status': s._id,
        'Count': s.count
      }))
    });
  }

  if (feedback.byPriority && feedback.byPriority.length > 0) {
    sheets.push({
      name: 'Feedback by Priority',
      data: feedback.byPriority.map((p: any) => ({
        'Priority': p._id,
        'Count': p.count
      }))
    });
  }

  return sheets;
}
