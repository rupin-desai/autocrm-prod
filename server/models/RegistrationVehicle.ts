import mongoose from 'mongoose';

const registrationVehicleSchema = new mongoose.Schema({
  vehicleId: { type: String, unique: true, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  vehicleNumber: { type: String, required: false },
  vehicleBrand: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  customModel: { type: String, default: null },
  variant: { type: String, enum: ['Top', 'Base'], default: null },
  color: { type: String, default: null },
  yearOfPurchase: { type: Number, default: null },
  vehiclePhoto: { type: String, required: true },
  isNewVehicle: { type: Boolean, default: false },
  chassisNumber: { type: String, default: null },
  selectedParts: {
    type: [{
      partId: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1, default: 1 }
    }],
    default: []
  },
  warrantyCards: { 
    type: [{
      partId: { type: String, required: true },
      partName: { type: String, required: true },
      fileData: { type: String, required: true }
    }], 
    default: [] 
  },
}, { timestamps: true });

export const RegistrationVehicle = mongoose.models.RegistrationVehicle || mongoose.model('RegistrationVehicle', registrationVehicleSchema);
