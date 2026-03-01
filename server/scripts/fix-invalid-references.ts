import { connectDB } from '../db';
import { Task } from '../models/Task';
import { Leave } from '../models/Leave';
import { Employee } from '../models/Employee';

async function fixInvalidReferences() {
  try {
    await connectDB();
    console.log('🔧 Fixing invalid employee references...\n');
    
    // Get the first valid employee
    const validEmployee = await Employee.findOne();
    
    if (!validEmployee) {
      console.log('❌ No employees found in database. Please create an employee first.');
      process.exit(1);
    }
    
    console.log(`✅ Found valid employee: ${validEmployee.name} (ID: ${validEmployee._id})\n`);
    
    // Fix tasks with invalid assignedTo
    const tasks = await Task.find({}).lean();
    console.log(`📋 Checking ${tasks.length} tasks...`);
    
    let tasksFixed = 0;
    for (const task of tasks) {
      const employeeExists = await Employee.findById(task.assignedTo);
      if (!employeeExists) {
        await Task.updateOne(
          { _id: task._id },
          { $set: { assignedTo: validEmployee._id } }
        );
        tasksFixed++;
        console.log(`  ✓ Fixed task: ${task.title}`);
      }
    }
    console.log(`Fixed ${tasksFixed} tasks\n`);
    
    // Fix leaves with invalid employeeId
    const leaves = await Leave.find({}).lean();
    console.log(`📋 Checking ${leaves.length} leaves...`);
    
    let leavesFixed = 0;
    for (const leave of leaves) {
      const employeeExists = await Employee.findById(leave.employeeId);
      if (!employeeExists) {
        await Leave.updateOne(
          { _id: leave._id },
          { $set: { employeeId: validEmployee._id } }
        );
        leavesFixed++;
        console.log(`  ✓ Fixed leave: ${leave._id}`);
      }
    }
    console.log(`Fixed ${leavesFixed} leaves\n`);
    
    console.log('✨ All invalid references have been fixed!');
    console.log(`\nSummary:`);
    console.log(`  - Tasks fixed: ${tasksFixed}`);
    console.log(`  - Leaves fixed: ${leavesFixed}`);
    console.log(`  - All now point to: ${validEmployee.name}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixInvalidReferences();
