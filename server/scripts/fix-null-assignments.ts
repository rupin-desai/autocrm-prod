import { connectDB } from '../db';
import { Task } from '../models/Task';
import { Leave } from '../models/Leave';

async function fixNullAssignments() {
  try {
    await connectDB();
    console.log('🔧 Starting to fix null assignments...\n');

    // Find tasks with null or missing assignedTo
    const tasksWithNullAssignedTo = await Task.find({
      $or: [
        { assignedTo: null },
        { assignedTo: { $exists: false } }
      ]
    });
    
    console.log(`Found ${tasksWithNullAssignedTo.length} tasks with null assignedTo`);
    
    if (tasksWithNullAssignedTo.length > 0) {
      // Delete tasks with null assignedTo since they're invalid
      const taskIds = tasksWithNullAssignedTo.map(t => t._id);
      await Task.deleteMany({ _id: { $in: taskIds } });
      console.log(`✅ Deleted ${tasksWithNullAssignedTo.length} tasks with null assignedTo\n`);
    }

    // Find leaves with null or missing employeeId
    const leavesWithNullEmployee = await Leave.find({
      $or: [
        { employeeId: null },
        { employeeId: { $exists: false } }
      ]
    });
    
    console.log(`Found ${leavesWithNullEmployee.length} leaves with null employeeId`);
    
    if (leavesWithNullEmployee.length > 0) {
      // Delete leaves with null employeeId since they're invalid
      const leaveIds = leavesWithNullEmployee.map(l => l._id);
      await Leave.deleteMany({ _id: { $in: leaveIds } });
      console.log(`✅ Deleted ${leavesWithNullEmployee.length} leaves with null employeeId\n`);
    }

    console.log('✨ Database cleanup completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing null assignments:', error);
    process.exit(1);
  }
}

fixNullAssignments();
