import mongoose from 'mongoose';
import { SupportTicket } from '../models/SupportTicket';
import { User } from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function reassignTicket() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Find the Service Staff user with email hr@maulicarworld.com (the one logged in)
    const serviceUser = await User.findOne({ 
      email: 'hr@maulicarworld.com',
      role: 'Service Staff' 
    });

    if (!serviceUser) {
      console.log('❌ Service Staff user (hr@maulicarworld.com) not found');
      process.exit(1);
    }

    console.log(`\n👤 Found Service Staff user: ${serviceUser.name} (${serviceUser.email})`);
    console.log(`   User ID: ${serviceUser._id}`);

    // Find ticket #TKT00005
    const ticket = await SupportTicket.findOne({ ticketNumber: 'TKT00005' })
      .populate('assignedTo', 'name email');

    if (!ticket) {
      console.log('❌ Ticket #TKT00005 not found');
      process.exit(1);
    }

    console.log(`\n🎫 Found ticket #${ticket.ticketNumber}: "${ticket.subject}"`);
    console.log(`   Current assignment: ${ticket.assignedTo ? `${ticket.assignedTo.name} (${ticket.assignedTo.email})` : 'Unassigned'}`);
    console.log(`   Status: ${ticket.status}`);
    console.log(`   Priority: ${ticket.priority}`);

    // Reassign to the Service Staff user
    await SupportTicket.findByIdAndUpdate(ticket._id, {
      assignedTo: serviceUser._id
    });

    console.log(`\n✅ Successfully reassigned ticket #${ticket.ticketNumber} to ${serviceUser.name}`);
    console.log('\n📊 The dashboard will now show this ticket with proper counts!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

reassignTicket();
