import mongoose from 'mongoose';

const communicationLogSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  type: { 
    type: String, 
    enum: ['call', 'email', 'sms', 'whatsapp', 'visit'],
    required: true 
  },
  subject: { type: String },
  message: { type: String, required: true },
  direction: { 
    type: String, 
    enum: ['inbound', 'outbound'],
    required: true 
  },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  date: { type: Date, default: Date.now },
  followUpRequired: { type: Boolean, default: false },
  followUpDate: { type: Date },
}, { timestamps: true });

export const CommunicationLog = mongoose.models.CommunicationLog || mongoose.model('CommunicationLog', communicationLogSchema);
