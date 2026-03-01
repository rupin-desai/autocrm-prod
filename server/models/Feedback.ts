import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  type: { 
    type: String, 
    enum: ['feedback', 'complaint', 'suggestion'],
    required: true 
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  resolution: { type: String },
  resolvedDate: { type: Date },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
}, { timestamps: true });

export const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
