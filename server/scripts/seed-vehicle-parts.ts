import { connectDB } from '../db';
import { Product } from '../models/Product';
import { VEHICLE_DATA } from '../../shared/vehicleData';

async function seedVehicleParts() {
  try {
    await connectDB();
    console.log('🌱 Starting to seed vehicle parts products...\n');

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const partsByNameAndPrice = new Map<string, {
      name: string;
      category: string;
      price: number;
      models: string[];
    }>();

    for (const brand of VEHICLE_DATA) {
      for (const model of brand.models) {
        const modelFullName = `${brand.name} ${model.name}`;
        
        for (const part of model.parts) {
          const price = part.price || 1000;
          const partKey = `${part.name.toLowerCase()}_${price}`;
          
          if (partsByNameAndPrice.has(partKey)) {
            const existingPart = partsByNameAndPrice.get(partKey)!;
            if (!existingPart.models.includes(modelFullName)) {
              existingPart.models.push(modelFullName);
            }
          } else {
            partsByNameAndPrice.set(partKey, {
              name: part.name,
              category: part.category,
              price: price,
              models: [modelFullName],
            });
          }
        }
      }
    }

    console.log(`📊 Found ${partsByNameAndPrice.size} unique part-price combinations across all vehicle models\n`);

    for (const partData of Array.from(partsByNameAndPrice.values())) {
      const existing = await Product.findOne({ 
        name: partData.name,
        sellingPrice: partData.price
      });

      if (existing) {
        const modelsChanged = 
          JSON.stringify(existing.modelCompatibility.sort()) !== JSON.stringify(partData.models.sort());

        if (modelsChanged) {
          existing.modelCompatibility = partData.models;
          await existing.save();
          
          console.log(`🔄 Updated: ${partData.name} @ ₹${partData.price}`);
          console.log(`   Compatible with ${partData.models.length} vehicle models`);
          updatedCount++;
        } else {
          skippedCount++;
        }
        continue;
      }

      const sellingPrice = partData.price;
      const mrp = sellingPrice + Math.floor(sellingPrice * 0.2);

      const product = await Product.create({
        name: partData.name,
        category: partData.category,
        brand: 'Mauli Auto Parts',
        modelCompatibility: partData.models,
        warranty: partData.category === 'Maintenance' ? '1 month' : 
                 partData.category === 'Electronics' ? '1 year' : '6 months',
        mrp: mrp,
        sellingPrice: sellingPrice,
        discount: 0,
        stockQty: Math.floor(Math.random() * 50) + 20,
        minStockLevel: 10,
        barcode: `VP${Date.now()}${Math.floor(Math.random() * 10000)}`,
        images: [],
        warehouseLocation: 'Main Warehouse',
      });

      console.log(`✅ Added: ${product.name} @ ₹${sellingPrice}, MRP: ₹${mrp}`);
      console.log(`   Compatible with ${partData.models.length} vehicle models`);
      addedCount++;
    }

    console.log('\n========================================');
    console.log('🎉 Seeding Complete!');
    console.log(`✅ Added: ${addedCount} new products`);
    console.log(`🔄 Updated: ${updatedCount} existing products`);
    console.log(`⏭️  Skipped: ${skippedCount} products (already up to date)`);
    console.log(`📦 Total unique part-price combinations: ${partsByNameAndPrice.size}`);
    console.log('========================================\n');

    console.log('Sample vehicle-specific parts:');
    console.log('- Toyota Innova Crysta: 22 specific parts with unique pricing');
    console.log('- Maruti Suzuki Brezza: 21 specific parts with unique pricing');
    console.log('- Maruti Suzuki Grand Vitara: 23 specific parts with unique pricing');
    console.log('- Mahindra Scorpio Classic: 28 specific parts with unique pricing');
    console.log('- Hyundai Creta 2025: 31 specific parts with unique pricing');
    console.log('- Toyota Taisor: 24 specific parts with unique pricing\n');
    
    console.log('Note: Parts with the same name but different prices are stored');
    console.log('as separate products to preserve model-specific pricing.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding vehicle parts:', error);
    process.exit(1);
  }
}

seedVehicleParts();
