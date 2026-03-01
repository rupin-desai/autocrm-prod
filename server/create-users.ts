import { connectDB } from './db';
import { User } from './models/User';

async function createDefaultUsers() {
  try {
    await connectDB();
    console.log('ℹ️  User creation script');
    console.log('Users are now managed directly in the database.');
    console.log('Please use the database directly or the admin UI to manage users.\n');
    
    const userCount = await User.countDocuments();
    console.log(`Current user count: ${userCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createDefaultUsers();
