import { connectDB } from '../db';
import { Task } from '../models/Task';
import { Leave } from '../models/Leave';
import { Employee } from '../models/Employee';
import { User } from '../models/User';

async function verifyPopulate() {
  try {
    await connectDB();
    console.log('Connected to MongoDB\n');
    
    // First, check if we have employees
    const employeeCount = await Employee.countDocuments();
    const userCount = await User.countDocuments();
    console.log(`Total employees in database: ${employeeCount}`);
    console.log(`Total users in database: ${userCount}\n`);
    
    if (employeeCount > 0) {
      const employees = await Employee.find().limit(5);
      console.log('All employees:');
      employees.forEach(emp => {
        console.log(`  - ID: ${emp._id}, Name: ${emp.name}`);
      });
      console.log();
    }
    
    // Check tasks
    console.log('=== TASKS ===');
    const tasks = await Task.find({}).limit(3)
      .populate('assignedTo')
      .populate('assignedBy');
    
    if (tasks.length === 0) {
      console.log('No tasks found');
    } else {
      tasks.forEach(task => {
        console.log(`Task: ${task.title}`);
        console.log(`  _id: ${task._id}`);
        console.log(`  assignedTo raw: ${(task as any).assignedTo}`);
        console.log(`  assignedTo populated:`, task.assignedTo);
        console.log(`  assignedTo type: ${typeof task.assignedTo}`);
        if (task.assignedTo && typeof task.assignedTo === 'object') {
          console.log(`  assignedTo.name: ${(task.assignedTo as any).name}`);
        }
        console.log('---');
      });
    }
    
    console.log('\n=== LEAVES ===');
    const leaves = await Leave.find({}).limit(3)
      .populate('employeeId')
      .populate('approvedBy');
    
    if (leaves.length === 0) {
      console.log('No leaves found');
    } else {
      leaves.forEach(leave => {
        console.log(`Leave ID: ${leave._id}`);
        console.log(`  employeeId raw: ${(leave as any).employeeId}`);
        console.log(`  employeeId populated:`, leave.employeeId);
        console.log(`  employeeId type: ${typeof leave.employeeId}`);
        if (leave.employeeId && typeof leave.employeeId === 'object') {
          console.log(`  employeeId.name: ${(leave.employeeId as any).name}`);
        }
        console.log('---');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPopulate();
