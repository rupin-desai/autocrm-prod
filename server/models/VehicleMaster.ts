import mongoose from "mongoose";

const vehicleMasterModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const vehicleMasterBrandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    active: { type: Boolean, default: true },
    models: { type: [vehicleMasterModelSchema], default: [] },
  },
  { timestamps: true }
);

export const VehicleMasterBrand =
  mongoose.models.VehicleMasterBrand ||
  mongoose.model("VehicleMasterBrand", vehicleMasterBrandSchema);
