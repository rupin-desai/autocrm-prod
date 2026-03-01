import { connectDB } from './db';
import { Product } from './models/Product';
import { Employee } from './models/Employee';
import { ServiceVisit } from './models/ServiceVisit';
import { Order } from './models/Order';

async function seed() {
  try {
    await connectDB();
    console.log('🌱 Starting database seed...');

    await Product.deleteMany({});
    await Employee.deleteMany({});
    await ServiceVisit.deleteMany({});
    await Order.deleteMany({});

    console.log('ℹ️  Skipped user seeding - users are managed directly in the database');

    const employees = await Employee.insertMany([
      {
        employeeId: 'EMP001',
        name: 'Amit Sharma',
        role: 'Service Staff',
        contact: '+91 98765-43210',
        email: 'amit.sharma@carshop.com',
        isActive: true,
      },
      {
        employeeId: 'EMP002',
        name: 'Priya Patel',
        role: 'Service Staff',
        contact: '+91 98765-43211',
        email: 'priya.patel@carshop.com',
        isActive: true,
      },
      {
        employeeId: 'EMP003',
        name: 'Vikram Singh',
        role: 'Inventory Manager',
        contact: '+91 98765-43212',
        email: 'vikram.singh@carshop.com',
        isActive: true,
      },
      {
        employeeId: 'EMP004',
        name: 'Sneha Reddy',
        role: 'Sales Executive',
        contact: '+91 98765-43213',
        email: 'sneha.reddy@carshop.com',
        isActive: true,
      },
      {
        employeeId: 'EMP005',
        name: 'Rahul Deshmukh',
        role: 'HR Manager',
        contact: '+91 98765-43214',
        email: 'rahul.deshmukh@carshop.com',
        isActive: false,
      },
    ]);
    console.log(`✅ Created ${employees.length} employees`);

    const products = await Product.insertMany([
      {
        name: 'Engine Oil Filter - Mann W 712/75',
        category: 'Engine Parts',
        brand: 'Mann-Filter',
        modelCompatibility: ['Maruti Swift', 'Hyundai i20', 'Honda City'],
        warranty: '6 months',
        mrp: 3500,
        sellingPrice: 2850,
        discount: 18.57,
        stockQty: 45,
        minStockLevel: 20,
        status: 'in_stock',
        warehouseLocation: 'A-12',
        barcode: 'MF-W712-75',
      },
      {
        name: 'Brake Pads Set - Front',
        category: 'Brake System',
        brand: 'Brembo',
        modelCompatibility: ['Maruti Swift', 'Maruti Baleno'],
        warranty: '1 year',
        mrp: 9500,
        sellingPrice: 7800,
        discount: 17.89,
        stockQty: 12,
        minStockLevel: 20,
        status: 'low_stock',
        warehouseLocation: 'B-08',
        barcode: 'BRM-FBP-001',
      },
      {
        name: 'Air Filter - K&N 33-2304',
        category: 'Engine Parts',
        brand: 'K&N',
        modelCompatibility: ['Hyundai i20', 'Hyundai Creta'],
        warranty: '1 year',
        mrp: 5200,
        sellingPrice: 4400,
        discount: 15.38,
        stockQty: 0,
        minStockLevel: 10,
        status: 'out_of_stock',
        warehouseLocation: 'A-15',
        barcode: 'KN-33-2304',
      },
      {
        name: 'Spark Plugs Set (4pc)',
        category: 'Ignition System',
        brand: 'NGK',
        modelCompatibility: ['Honda City', 'Maruti Swift', 'Hyundai i20'],
        warranty: '6 months',
        mrp: 2500,
        sellingPrice: 2280,
        discount: 8.8,
        stockQty: 28,
        minStockLevel: 15,
        status: 'in_stock',
        warehouseLocation: 'C-05',
        barcode: 'NGK-SP-4PC',
      },
      {
        name: 'Cabin Air Filter',
        category: 'HVAC',
        brand: 'Bosch',
        modelCompatibility: ['All Models'],
        warranty: '6 months',
        mrp: 2000,
        sellingPrice: 1680,
        discount: 16,
        stockQty: 18,
        minStockLevel: 20,
        status: 'low_stock',
        warehouseLocation: 'A-20',
        barcode: 'BSH-CAF-001',
      },
      {
        name: 'Engine Oil 5W-30 - Mobil 1',
        category: 'Engine Parts',
        brand: 'Mobil',
        modelCompatibility: ['All Petrol Cars'],
        warranty: 'N/A',
        mrp: 4500,
        sellingPrice: 3850,
        discount: 14.44,
        stockQty: 8,
        minStockLevel: 15,
        status: 'low_stock',
        warehouseLocation: 'D-03',
        barcode: 'MOB-5W30-1L',
      },
      {
        name: 'LED Headlight Bulb H4',
        category: 'Lighting',
        brand: 'Philips',
        modelCompatibility: ['Maruti Swift', 'Hyundai i10', 'Honda Jazz'],
        warranty: '2 years',
        mrp: 3800,
        sellingPrice: 3200,
        discount: 15.79,
        stockQty: 35,
        minStockLevel: 15,
        status: 'in_stock',
        warehouseLocation: 'E-11',
        barcode: 'PHL-H4-LED',
      },
      {
        name: 'Wiper Blades Pair',
        category: 'Accessories',
        brand: 'Bosch',
        modelCompatibility: ['All Models'],
        warranty: '1 year',
        mrp: 1800,
        sellingPrice: 1450,
        discount: 19.44,
        stockQty: 52,
        minStockLevel: 25,
        status: 'in_stock',
        warehouseLocation: 'F-07',
        barcode: 'BSH-WPR-PAIR',
      },
      {
        name: 'Battery 12V 65Ah',
        category: 'Electrical',
        brand: 'Amaron',
        modelCompatibility: ['Maruti Swift', 'Hyundai i20', 'Honda City'],
        warranty: '3 years',
        mrp: 8500,
        sellingPrice: 7200,
        discount: 15.29,
        stockQty: 15,
        minStockLevel: 10,
        status: 'in_stock',
        warehouseLocation: 'G-02',
        barcode: 'AMR-BAT-65AH',
      },
      {
        name: 'Coolant/Antifreeze 1L',
        category: 'Engine Parts',
        brand: 'Shell',
        modelCompatibility: ['All Models'],
        warranty: 'N/A',
        mrp: 650,
        sellingPrice: 550,
        discount: 15.38,
        stockQty: 95,
        minStockLevel: 30,
        status: 'in_stock',
        warehouseLocation: 'D-08',
        barcode: 'SHL-CLT-1L',
      },
    ]);
    console.log(`✅ Created ${products.length} products`);

    // Customer model removed - using RegistrationCustomer instead
    console.log('✅ Skipped legacy customer seeding (use Customer Registration Dashboard)');
    console.log('✅ Skipped service visits and orders (can be created via UI)');

    console.log('🎉 Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();
