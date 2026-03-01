import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RegistrationCustomer', 
    required: true 
  },
  vehicleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RegistrationVehicle' 
  },
  vehicleReg: { type: String },
  subject: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  category: {
    type: String,
    enum: ['service_quality', 'product_issue', 'billing', 'parts_warranty', 'general'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  resolution: { type: String },
  resolvedAt: { type: Date },
  closedAt: { type: Date },
  whatsappFollowUp: {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date },
    message: { type: String }
  },
  feedbackSent: {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date }
  },
  feedbackId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Feedback' 
  },
  notes: [
    {
      note: { type: String, required: true },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

supportTicketSchema.index({ customerId: 1, createdAt: -1 });
supportTicketSchema.index({ vehicleReg: 1 });
supportTicketSchema.index({ status: 1 });

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
