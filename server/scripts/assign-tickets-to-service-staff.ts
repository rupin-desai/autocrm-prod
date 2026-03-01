import mongoose from 'mongoose';
import { SupportTicket } from '../models/SupportTicket';
import { User } from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function assignTicketsToServiceStaff() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all Service Staff users
    const serviceStaffUsers = await User.find({ role: 'Service Staff', isActive: true });
    console.log(`\n📋 Found ${serviceStaffUsers.length} Service Staff users:`);
    serviceStaffUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ID: ${user._id}`);
    });

    if (serviceStaffUsers.length === 0) {
      console.log('\n⚠️ No Service Staff users found. Please create a Service Staff user first.');
      process.exit(0);
    }

    // Find all unassigned tickets or tickets with status pending/in_progress
    const unassignedTickets = await SupportTicket.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: null }
      ],
      status: { $in: ['pending', 'in_progress'] }
    });

    console.log(`\n🎫 Found ${unassignedTickets.length} unassigned tickets with pending/in_progress status`);

    if (unassignedTickets.length === 0) {
      console.log('\n✅ No unassigned tickets found. All tickets are already assigned.');
      
      // Show current ticket assignments
      const allTickets = await SupportTicket.find().populate('assignedTo', 'name email role');
      console.log(`\n📊 Current ticket assignments (${allTickets.length} total tickets):`);
      allTickets.forEach(ticket => {
        console.log(`  - Ticket #${ticket.ticketNumber}: ${ticket.subject}`);
        console.log(`    Status: ${ticket.status}, Priority: ${ticket.priority}`);
        console.log(`    Assigned to: ${ticket.assignedTo ? `${ticket.assignedTo.name} (${ticket.assignedTo.email})` : 'Unassigned'}`);
      });
      
      process.exit(0);
    }

    // Assign tickets to first Service Staff user (round-robin can be added later)
    const firstServiceStaff = serviceStaffUsers[0];
    console.log(`\n✏️ Assigning ${unassignedTickets.length} ticket(s) to ${firstServiceStaff.name}...`);

    for (const ticket of unassignedTickets) {
      await SupportTicket.findByIdAndUpdate(ticket._id, {
        assignedTo: firstServiceStaff._id
      });
      console.log(`  ✅ Assigned Ticket #${ticket.ticketNumber} - "${ticket.subject}"`);
    }

    console.log(`\n✨ Successfully assigned ${unassignedTickets.length} ticket(s) to ${firstServiceStaff.name}`);
    console.log('\n📊 Now the Service Staff dashboard will show these tickets!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

assignTicketsToServiceStaff();
