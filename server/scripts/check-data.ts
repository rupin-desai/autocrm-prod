import { connectDB } from '../db';
import { Task } from '../models/Task';
import { Leave } from '../models/Leave';

async function checkData() {
  try {
    await connectDB();
    console.log('Connected to MongoDB\n');
    
    console.log('=== TASKS (Raw Data) ===');
    const tasks = await Task.find({}).limit(3).lean();
    tasks.forEach(task => {
      console.log(`ID: ${task._id}`);
      console.log(`Title: ${task.title}`);
      console.log(`AssignedTo: ${task.assignedTo}`);
      console.log(`AssignedTo Type: ${typeof task.assignedTo}`);
      console.log('---');
    });
    
    console.log('\n=== TASKS (Populated) ===');
    const tasksPopulated = await Task.find({}).limit(3)
      .populate('assignedTo')
      .populate('assignedBy');
    tasksPopulated.forEach(task => {
      console.log(`ID: ${task._id}`);
      console.log(`Title: ${task.title}`);
      console.log(`AssignedTo: ${JSON.stringify(task.assignedTo)}`);
      console.log('---');
    });
    
    console.log('\n=== LEAVES (Raw Data) ===');
    const leaves = await Leave.find({}).limit(3).lean();
    leaves.forEach(leave => {
      console.log(`ID: ${leave._id}`);
      console.log(`EmployeeId: ${leave.employeeId}`);
      console.log(`EmployeeId Type: ${typeof leave.employeeId}`);
      console.log('---');
    });
    
    console.log('\n=== LEAVES (Populated) ===');
    const leavesPopulated = await Leave.find({}).limit(3)
      .populate('employeeId')
      .populate('approvedBy');
    leavesPopulated.forEach(leave => {
      console.log(`ID: ${leave._id}`);
      console.log(`EmployeeId: ${JSON.stringify(leave.employeeId)}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
