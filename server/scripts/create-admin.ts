import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Manager', 'Inventory Manager', 'Sales Executive', 'HR Manager', 'Service Staff'],
    default: 'Service Staff'
  },
  isActive: { type: Boolean, default: true },
  department: { type: String },
  salary: { type: Number },
  joiningDate: { type: Date, default: Date.now },
  panNumber: { type: String },
  aadharNumber: { type: String },
  photo: { type: String },
  documents: [{ type: String }],
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function createAdminUser() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const email = process.argv[2];
    const password = process.argv[3];
    const name = process.argv[4];
    const mobileNumber = process.argv[5];

    if (!email || !password || !name || !mobileNumber) {
      console.error('❌ Usage: tsx server/scripts/create-admin.ts <email> <password> <name> <mobileNumber>');
      console.error('   Example: tsx server/scripts/create-admin.ts admin@example.com Admin@123 "Admin User" 9999999999');
      process.exit(1);
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { mobileNumber }] 
    });

    if (existingUser) {
      console.error('❌ User with this email or mobile number already exists');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      name,
      role: 'Admin',
      mobileNumber,
      isActive: true
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('📱 Mobile:', user.mobileNumber);
    console.log('🔑 Role:', user.role);
    console.log('\n🎉 You can now login with the provided credentials');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
