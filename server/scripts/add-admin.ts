import mongoose from 'mongoose';
import { createUser } from '../auth.js';

async function addAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mauli-car-world';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const email = 'aniket@maulicarworld.com';
    const password = 'admin123';
    const name = 'Aniket Rane';
    const role = 'Admin';
    const mobileNumber = '7507219775';

    const user = await createUser(email, password, name, role, mobileNumber);
    console.log('✅ Admin user created successfully:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Mobile: ${user.mobileNumber}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password: ${password}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.log('User with this email or mobile number already exists');
    }
    process.exit(1);
  }
}

addAdmin();
