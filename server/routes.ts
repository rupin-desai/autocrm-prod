import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import { connectDB } from "./db";
import { Product } from "./models/Product";
import { Employee } from "./models/Employee";
import { ServiceVisit } from "./models/ServiceVisit";
import { Order } from "./models/Order";
import { InventoryTransaction } from "./models/InventoryTransaction";
import { ProductReturn } from "./models/ProductReturn";
import { Notification } from "./models/Notification";
import { Attendance } from "./models/Attendance";
import { Leave } from "./models/Leave";
import { Task } from "./models/Task";
import { CommunicationLog } from "./models/CommunicationLog";
import { Feedback } from "./models/Feedback";
import { SupportTicket } from "./models/SupportTicket";
import { ActivityLog } from "./models/ActivityLog";
import { PerformanceLog } from "./models/PerformanceLog";
import { getNextSequence } from "./models/Counter";
import { checkAndNotifyLowStock, notifyNewOrder, notifyServiceVisitStatus, notifyPaymentOverdue, notifyPaymentDue } from "./utils/notifications";
import { logActivity } from "./utils/activityLogger";
import { User } from "./models/User";
import { authenticateUser, createUser, ROLE_PERMISSIONS, sendOTPToMobile, verifyOTP, sendEmployeeOTP, verifyEmployeeOTP } from "./auth";
import { requireAuth, requireRole, attachUser, requirePermission } from "./middleware";
import { insertCustomerSchema, insertVehicleSchema } from "./schemas";
import { RegistrationCustomer } from "./models/RegistrationCustomer";
import { RegistrationVehicle } from "./models/RegistrationVehicle";
import { Invoice } from "./models/Invoice";
import { Coupon } from "./models/Coupon";
import { Warranty } from "./models/Warranty";
import { sendInvoiceNotifications } from "./utils/invoiceNotifications";
import { generateInvoicePDF } from "./utils/generateInvoicePDF";
import { sendWhatsAppOTP, sendWhatsAppWelcome } from "./services/whatsapp";
import { generateDailyReportData, formatDailyReportHTML, sendDailyReportEmail } from "./utils/emailReports";

// Helper function to normalize selectedParts to ensure consistent format
function normalizeSelectedParts(selectedParts: any): Array<{ partId: string; quantity: number }> {
  if (!selectedParts || !Array.isArray(selectedParts)) {
    return [];
  }
  
  return selectedParts
    .filter(part => part) // Remove falsy values
    .map(part => {
      // If it's already in the new format {partId, quantity}
      if (typeof part === 'object' && part.partId) {
        return {
          partId: part.partId,
          quantity: part.quantity || 1
        };
      }
      // If it's in the old format (string)
      if (typeof part === 'string') {
        return {
          partId: part,
          quantity: 1
        };
      }
      // Invalid format, skip
      return null;
    })
    .filter((part): part is { partId: string; quantity: number } => part !== null);
}

// Helper function to build consistent product response with proper field mappings
function buildProductResponse(product: any) {
  // Handle both new (productName) and old (name) field structures
  const productName = product.productName || product.name;
  
  // Use existing category if available, otherwise derive from brand and model
  const displayCategory = product.category || 
    (product.model ? `${product.brand} - ${product.model}` : product.brand || 'Custom');
  
  return {
    _id: product._id, // Keep original _id for backward compatibility
    id: product._id?.toString() || product.id,
    productName: productName,
    productId: product.productId,
    name: productName, // For backward compatibility
    category: displayCategory, // Use existing or derive from brand and model
    brand: product.brand,
    model: product.model,
    price: product.sellingPrice || product.price,
    sellingPrice: product.sellingPrice || product.price,
    mrp: product.mrp,
    warranty: product.warranty,
    stockQty: product.stockQty,
    barcode: product.barcode,
    barcodeImage: product.barcodeImage,
    modelCompatibility: product.modelCompatibility,
    status: product.status,
    images: product.images,
    variants: product.variants,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  await connectDB();
  
  // Auto-migrate: Add vehicleId to existing vehicles without it
  try {
    const vehiclesWithoutId = await RegistrationVehicle.find({ 
      $or: [
        { vehicleId: { $exists: false } },
        { vehicleId: null },
        { vehicleId: '' }
      ]
    });
    
    if (vehiclesWithoutId.length > 0) {
      console.log(`🔄 Migrating ${vehiclesWithoutId.length} vehicles to add Vehicle IDs...`);
      for (const vehicle of vehiclesWithoutId) {
        const vehicleSeq = await getNextSequence('vehicle');
        const vehicleId = `VEH${String(vehicleSeq).padStart(3, '0')}`;
        
        await RegistrationVehicle.updateOne(
          { _id: vehicle._id },
          { $set: { vehicleId } }
        );
      }
      console.log(`✅ Migration complete: Added Vehicle IDs to ${vehiclesWithoutId.length} vehicles`);
    }
  } catch (error) {
    console.error('❌ Vehicle ID migration error:', error);
  }

  // Auto-migrate: Convert old warrantyCard to new warrantyCards array
  try {
    const vehiclesWithOldWarranty = await RegistrationVehicle.find({
      warrantyCard: { $exists: true, $nin: [null, ''] },
      $or: [
        { warrantyCards: { $exists: false } },
        { warrantyCards: { $size: 0 } }
      ]
    });
    
    if (vehiclesWithOldWarranty.length > 0) {
      console.log(`🔄 Migrating ${vehiclesWithOldWarranty.length} vehicles from warrantyCard to warrantyCards...`);
      for (const vehicle of vehiclesWithOldWarranty) {
        await RegistrationVehicle.updateOne(
          { _id: vehicle._id },
          { 
            $set: { 
              warrantyCards: [{
                partId: 'legacy',
                partName: 'Vehicle Warranty Card',
                fileData: (vehicle as any).warrantyCard
              }]
            },
            $unset: { warrantyCard: '' }
          }
        );
      }
      console.log(`✅ Migration complete: Migrated ${vehiclesWithOldWarranty.length} warranty cards`);
    }
  } catch (error) {
    console.error('❌ Warranty card migration error:', error);
  }

  // Auto-migrate: Convert old selectedParts string arrays to {partId, quantity} objects
  try {
    const vehiclesWithOldParts = await RegistrationVehicle.find({
      selectedParts: { $exists: true, $type: 'array', $ne: [] }
    }).lean();
    
    let migrated = 0;
    for (const vehicle of vehiclesWithOldParts) {
      // Check if selectedParts contains strings (old format)
      if (vehicle.selectedParts && vehicle.selectedParts.length > 0) {
        const firstPart = vehicle.selectedParts[0];
        if (typeof firstPart === 'string') {
          const normalized = normalizeSelectedParts(vehicle.selectedParts);
          await RegistrationVehicle.updateOne(
            { _id: vehicle._id },
            { $set: { selectedParts: normalized } }
          );
          migrated++;
        }
      }
    }
    
    if (migrated > 0) {
      console.log(`✅ Migration complete: Converted selectedParts for ${migrated} vehicles to {partId, quantity} format`);
    }
  } catch (error) {
    console.error('❌ selectedParts migration error:', error);
  }
  
  app.use(attachUser);

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, selectedRole } = req.body;
      
      const user = await authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (selectedRole && user.role !== selectedRole) {
        return res.status(403).json({ error: `Invalid role selection. This account is registered as ${user.role}.` });
      }
      
      if (!user.mobileNumber) {
        return res.status(400).json({ error: "No mobile number registered for this account. Please contact administrator." });
      }
      
      const otpResult = await sendOTPToMobile(user.mobileNumber);
      
      if (!otpResult.success) {
        return res.status(500).json({ error: otpResult.error || "Failed to send OTP" });
      }
      
      (req as any).session.pendingAuth = {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        mobileNumber: user.mobileNumber,
      };
      
      res.json({
        requireOTP: true,
        mobileNumber: user.mobileNumber,
        message: "OTP sent to your registered mobile number",
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const user = await User.findById(userId).select('-passwordHash');
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        mobileNumber: user.mobileNumber,
        permissions: ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || {},
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const user = await User.findById(userId).select('-passwordHash');
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        joiningDate: user.joiningDate,
        photo: user.photo,
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const { name, email, mobileNumber, department } = req.body;
      
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (mobileNumber) updateData.mobileNumber = mobileNumber;
      if (department) updateData.department = department;
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-passwordHash');
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      (req as any).session.userName = user.name;
      (req as any).session.userEmail = user.email;
      
      res.json({
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        joiningDate: user.joiningDate,
        photo: user.photo,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { mobileNumber } = req.body;
      
      if (!mobileNumber) {
        return res.status(400).json({ error: "Mobile number is required" });
      }
      
      const user = await User.findOne({ mobileNumber, isActive: true });
      if (!user) {
        return res.status(404).json({ error: "User not found with this mobile number" });
      }
      
      const result = await sendOTPToMobile(mobileNumber);
      
      if (result.success) {
        res.json({ success: true, message: "OTP sent successfully" });
      } else {
        res.status(500).json({ error: result.error || "Failed to send OTP" });
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { otp } = req.body;
      
      if (!otp) {
        return res.status(400).json({ error: "OTP is required" });
      }
      
      const pendingAuth = (req as any).session.pendingAuth;
      if (!pendingAuth || !pendingAuth.mobileNumber) {
        return res.status(400).json({ error: "No pending authentication. Please login again." });
      }
      
      const result = await verifyOTP(pendingAuth.mobileNumber, otp);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Invalid OTP" });
      }
      
      (req as any).session.userId = pendingAuth.userId;
      (req as any).session.userRole = pendingAuth.role;
      (req as any).session.userName = pendingAuth.name;
      (req as any).session.userEmail = pendingAuth.email;
      
      delete (req as any).session.pendingAuth;
      
      if (pendingAuth.role !== 'Admin') {
        (req as any).session.lastActivity = Date.now();
      }
      
      await logActivity({
        userId: pendingAuth.userId,
        userName: pendingAuth.name,
        userRole: pendingAuth.role,
        action: 'login',
        resource: 'user',
        description: `${pendingAuth.name} logged in`,
        ipAddress: req.ip,
      });
      
      res.json({
        id: pendingAuth.userId,
        email: pendingAuth.email,
        name: pendingAuth.name,
        role: pendingAuth.role,
        mobileNumber: pendingAuth.mobileNumber,
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Forgot Password - Request OTP
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { mobileNumber, role } = req.body;
      
      if (!mobileNumber) {
        return res.status(400).json({ error: "Mobile number is required" });
      }
      
      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }
      
      const user = await User.findOne({ mobileNumber, role, isActive: true });
      if (!user) {
        return res.status(404).json({ error: `No ${role} account found with this mobile number` });
      }
      
      const otpResult = await sendOTPToMobile(mobileNumber);
      
      if (!otpResult.success) {
        return res.status(500).json({ error: otpResult.error || "Failed to send OTP" });
      }
      
      (req as any).session.passwordReset = {
        userId: user._id.toString(),
        mobileNumber: mobileNumber,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      
      res.json({
        success: true,
        message: "OTP sent to your mobile number",
        mobileNumber: mobileNumber,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // Verify Reset OTP
  app.post("/api/auth/verify-reset-otp", async (req, res) => {
    try {
      const { otp } = req.body;
      
      if (!otp) {
        return res.status(400).json({ error: "OTP is required" });
      }
      
      const passwordReset = (req as any).session.passwordReset;
      if (!passwordReset || !passwordReset.mobileNumber) {
        return res.status(400).json({ error: "No password reset request found. Please request OTP again." });
      }
      
      const result = await verifyOTP(passwordReset.mobileNumber, otp);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Invalid OTP" });
      }
      
      (req as any).session.passwordReset.otpVerified = true;
      
      res.json({
        success: true,
        message: "OTP verified successfully. You can now reset your password.",
      });
    } catch (error) {
      console.error('Verify reset OTP error:', error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Reset Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      
      const passwordReset = (req as any).session.passwordReset;
      if (!passwordReset || !passwordReset.otpVerified) {
        return res.status(400).json({ error: "Please verify OTP first before resetting password" });
      }
      
      const user = await User.findById(passwordReset.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const bcrypt = await import('bcryptjs');
      const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
      
      if (isSamePassword) {
        return res.status(400).json({ error: "New password cannot be the same as your old password" });
      }
      
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      await User.findByIdAndUpdate(passwordReset.userId, {
        passwordHash: passwordHash,
      });
      
      await logActivity({
        userId: passwordReset.userId,
        userName: passwordReset.name,
        userRole: 'User',
        action: 'update',
        resource: 'user',
        description: `${passwordReset.name} reset their password`,
        ipAddress: req.ip,
      });
      
      delete (req as any).session.passwordReset;
      
      res.json({
        success: true,
        message: "Password reset successfully. You can now login with your new password.",
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // User management endpoints (Admin only)
  app.post("/api/users", requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const { email, password, name, role, mobileNumber } = req.body;
      
      if (!email || !password || !name || !role || !mobileNumber) {
        return res.status(400).json({ error: "All fields are required including mobile number" });
      }
      
      const existingUser = await User.findOne({ 
        $or: [{ email }, { mobileNumber }] 
      });
      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).json({ error: "User with this email already exists" });
        }
        if (existingUser.mobileNumber === mobileNumber) {
          return res.status(400).json({ error: "User with this mobile number already exists" });
        }
      }
      
      const user = await createUser(email, password, name, role, mobileNumber);
      
      res.json({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        mobileNumber: user.mobileNumber,
        isActive: user.isActive,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  app.get("/api/users", requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const { name, role, isActive, mobileNumber } = req.body;
      
      if (mobileNumber) {
        const existingUser = await User.findOne({ 
          mobileNumber, 
          _id: { $ne: req.params.id } 
        });
        if (existingUser) {
          return res.status(400).json({ error: "User with this mobile number already exists" });
        }
      }
      
      const updateData: any = { name, role, isActive };
      if (mobileNumber) {
        updateData.mobileNumber = mobileNumber;
      }
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select('-passwordHash');
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const userId = req.params.id;
      
      // Prevent admins from deleting themselves
      if (userId === (req as any).session.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const user = await User.findByIdAndDelete(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete user" });
    }
  });

  // Products endpoints with permission checks
  app.get("/api/products", requireAuth, requirePermission('products', 'read'), async (req, res) => {
    try {
      const products = await Product.find().sort({ createdAt: -1 });
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", requireAuth, requirePermission('products', 'create'), async (req, res) => {
    try {
      const product = await Product.create(req.body);
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'product',
        resourceId: product._id.toString(),
        description: `Created product: ${product.productName || product.name || 'Unknown Product'}`,
        details: { brand: product.brand, model: product.model },
        ipAddress: req.ip,
      });
      
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAuth, requirePermission('products', 'update'), async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'update',
        resource: 'product',
        resourceId: product._id.toString(),
        description: `Updated product: ${product.productName || product.name || 'Unknown Product'}`,
        details: req.body,
        ipAddress: req.ip,
      });
      
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requirePermission('products', 'delete'), async (req, res) => {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'product',
        resourceId: product._id.toString(),
        description: `Deleted product: ${product.productName || product.name || 'Unknown Product'}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete product" });
    }
  });

  app.post("/api/products/delete-duplicates", requireAuth, requirePermission('products', 'delete'), async (req, res) => {
    try {
      const duplicates = await Product.aggregate([
        {
          $group: {
            _id: { productName: "$productName", brand: "$brand", model: "$model" },
            ids: { $push: "$_id" },
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]);

      let deletedCount = 0;
      for (const dup of duplicates) {
        const idsToDelete = dup.ids.slice(1);
        await Product.deleteMany({ _id: { $in: idsToDelete } });
        deletedCount += idsToDelete.length;
      }

      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'product',
        resourceId: 'bulk',
        description: `Deleted ${deletedCount} duplicate products`,
        ipAddress: req.ip,
      });

      res.json({ success: true, deletedCount, duplicateGroups: duplicates.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete duplicates" });
    }
  });

  app.post("/api/products/resolve-by-ids", requireAuth, async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: "productIds must be an array" });
      }

      const { getPartById } = await import('@shared/vehicleData');
      const resolvedProducts: any[] = [];
      const notFoundIds: string[] = [];

      for (const productId of productIds) {
        let productData = null;
        
        try {
          const mongoId = productId.startsWith('product-') ? productId.replace('product-', '') : productId;
          const dbProduct = await Product.findById(mongoId);
          if (dbProduct) {
            productData = {
              id: productId,
              name: dbProduct.productName || dbProduct.name || 'Unknown Product',
              category: dbProduct.brand || dbProduct.category || 'Custom',
              brand: dbProduct.brand,
              price: dbProduct.sellingPrice,
              warranty: dbProduct.warranty,
              stockQty: dbProduct.stockQty,
              source: 'database'
            };
          }
        } catch (err) {
        }

        if (!productData) {
          const predefinedPart = getPartById(productId);
          if (predefinedPart) {
            productData = {
              id: predefinedPart.id,
              name: predefinedPart.name,
              category: predefinedPart.category,
              price: predefinedPart.price,
              warranty: undefined,
              source: 'predefined'
            };
          }
        }

        if (productData) {
          resolvedProducts.push(productData);
        } else {
          notFoundIds.push(productId);
        }
      }

      res.json({ 
        products: resolvedProducts,
        notFound: notFoundIds
      });
    } catch (error) {
      console.error('Error resolving product IDs:', error);
      res.status(500).json({ error: "Failed to resolve product IDs" });
    }
  });

  app.post("/api/products/import", requireAuth, requirePermission('products', 'create'), async (req, res) => {
    try {
      const { products } = req.body;
      
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "Invalid product data" });
      }

      const imported = [];
      const errors = [];

      for (let i = 0; i < products.length; i++) {
        try {
          const productData = products[i];
          
          if (!productData.name || !productData.category || !productData.brand) {
            errors.push({ row: i + 1, error: "Missing required fields (name, category, brand)" });
            continue;
          }

          const product = await Product.create({
            name: productData.name,
            category: productData.category,
            brand: productData.brand,
            modelCompatibility: productData.modelCompatibility || [],
            warranty: productData.warranty || "",
            mrp: Number(productData.mrp) || 0,
            sellingPrice: Number(productData.sellingPrice) || 0,
            discount: Number(productData.discount) || 0,
            stockQty: Number(productData.stockQty) || 0,
            minStockLevel: Number(productData.minStockLevel) || 10,
            warehouseLocation: productData.warehouseLocation || "",
            barcode: productData.barcode || "",
            images: productData.images || [],
            variants: productData.variants || [],
          });

          imported.push(product);
        } catch (err: any) {
          errors.push({ row: i + 1, error: err.message });
        }
      }

      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'product',
        resourceId: 'bulk',
        description: `Imported ${imported.length} products (${errors.length} errors)`,
        ipAddress: req.ip,
      });

      res.json({ 
        success: true, 
        imported: imported.length, 
        errors: errors.length,
        errorDetails: errors 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  // Employee OTP endpoints
  app.post("/api/employees/send-otp", requireAuth, requirePermission('employees', 'create'), async (req, res) => {
    try {
      const { mobileNumber, purpose } = req.body;
      
      if (!mobileNumber) {
        return res.status(400).json({ error: "Mobile number is required" });
      }

      const existingUser = await User.findOne({ mobileNumber });
      if (existingUser && purpose === 'employee_verification') {
        return res.status(400).json({ error: "An employee with this mobile number already exists" });
      }

      const result = await sendEmployeeOTP(mobileNumber, purpose || 'employee_verification');
      
      if (result.success) {
        res.json({ success: true, message: "OTP sent successfully" });
      } else {
        res.status(500).json({ error: result.error || "Failed to send OTP" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send OTP" });
    }
  });

  app.post("/api/employees/verify-otp", requireAuth, requirePermission('employees', 'create'), async (req, res) => {
    try {
      const { mobileNumber, otp, purpose } = req.body;
      
      if (!mobileNumber || !otp) {
        return res.status(400).json({ error: "Mobile number and OTP are required" });
      }

      const result = await verifyEmployeeOTP(mobileNumber, otp, purpose || 'employee_verification');
      
      if (result.success) {
        res.json({ success: true, message: "OTP verified successfully" });
      } else {
        res.status(400).json({ error: result.error || "Failed to verify OTP" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to verify OTP" });
    }
  });

  // Employees endpoints with permission checks (now using User model)
  app.get("/api/employees", requireAuth, requirePermission('employees', 'read'), async (req, res) => {
    try {
      const employees = await User.find().select('-passwordHash').sort({ createdAt: -1 });
      const formattedEmployees = employees.map(emp => ({
        ...emp.toObject(),
        contact: emp.mobileNumber,
      }));
      res.json(formattedEmployees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", requireAuth, requirePermission('employees', 'create'), async (req, res) => {
    try {
      const currentUserRole = (req as any).session.userRole;
      const mobileNumber = req.body.phone || req.body.contact;
      
      if (!mobileNumber) {
        return res.status(400).json({ error: "Mobile number is required" });
      }

      const { OTP } = await import('./models/OTP');
      const verifiedOTP = await OTP.findOne({
        mobileNumber,
        purpose: 'employee_verification',
        verified: true,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (!verifiedOTP) {
        return res.status(400).json({ error: "Please verify the mobile number with OTP before creating the employee" });
      }
      
      if (req.body.role === 'Admin' && currentUserRole !== 'Admin') {
        return res.status(403).json({ error: "Only Admin users can create Admin accounts" });
      }
      
      const isAdmin = req.body.role === 'Admin';
      const sequence = await getNextSequence(isAdmin ? 'admin_id' : 'employee_id');
      const employeeId = isAdmin ? `ADM${String(sequence).padStart(3, '0')}` : `EMP${String(sequence).padStart(3, '0')}`;
      
      const password = req.body.password || `${req.body.name.split(' ')[0].toLowerCase()}123`;
      
      const employee = await createUser(
        req.body.email,
        password,
        req.body.name,
        req.body.role,
        mobileNumber
      );
      
      const updateData: any = {
        employeeId,
        department: req.body.department,
        panNumber: req.body.panNumber,
        aadharNumber: req.body.aadharNumber,
        photo: req.body.photo,
        documents: req.body.documents,
      };
      
      if (!isAdmin) {
        updateData.salary = req.body.salary;
        updateData.joiningDate = req.body.joiningDate || new Date();
      }
      
      await User.findByIdAndUpdate(employee._id, updateData);
      
      const updatedEmployee = await User.findById(employee._id).select('-passwordHash');

      await OTP.deleteMany({ mobileNumber, purpose: 'employee_verification' });
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'employee',
        resourceId: employee._id.toString(),
        description: `Created employee: ${employee.name} (${employeeId})`,
        details: { role: employee.role, email: employee.email, employeeId },
        ipAddress: req.ip,
      });
      
      res.json({ ...updatedEmployee?.toObject(), contact: updatedEmployee?.mobileNumber });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create employee" });
    }
  });

  app.patch("/api/employees/:id", requireAuth, requirePermission('employees', 'update'), async (req, res) => {
    try {
      const currentUserRole = (req as any).session.userRole;
      const employee = await User.findById(req.params.id);
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const newMobileNumber = req.body.phone || req.body.contact;
      
      if (newMobileNumber && newMobileNumber !== employee.mobileNumber) {
        const { OTP } = await import('./models/OTP');
        const verifiedOTP = await OTP.findOne({
          mobileNumber: newMobileNumber,
          purpose: 'phone_update',
          verified: true,
          expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (!verifiedOTP) {
          return res.status(400).json({ error: "Please verify the new mobile number with OTP before updating" });
        }

        await OTP.deleteMany({ mobileNumber: newMobileNumber, purpose: 'phone_update' });
      }
      
      if (req.body.role === 'Admin' && currentUserRole !== 'Admin') {
        return res.status(403).json({ error: "Only Admin users can assign Admin role" });
      }
      
      const updateData: any = { ...req.body };
      if (req.body.phone || req.body.contact) {
        updateData.mobileNumber = req.body.phone || req.body.contact;
        delete updateData.phone;
        delete updateData.contact;
      }
      
      const updatedEmployee = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-passwordHash');
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'update',
        resource: 'employee',
        resourceId: updatedEmployee!._id.toString(),
        description: `Updated employee: ${updatedEmployee!.name}`,
        details: { role: updatedEmployee!.role },
        ipAddress: req.ip,
      });
      
      res.json({ ...updatedEmployee?.toObject(), contact: updatedEmployee?.mobileNumber });
    } catch (error) {
      res.status(400).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, requirePermission('employees', 'delete'), async (req, res) => {
    try {
      const currentUserRole = (req as any).session.userRole;
      const currentUserId = (req as any).session.userId;
      
      const employee = await User.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      if (req.params.id === currentUserId) {
        return res.status(403).json({ error: "Cannot delete your own account" });
      }
      
      if (employee.role === 'Admin' && currentUserRole !== 'Admin') {
        return res.status(403).json({ error: "Only Admin users can delete Admin accounts" });
      }
      
      await User.findByIdAndDelete(req.params.id);
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'employee',
        resourceId: employee._id.toString(),
        description: `Deleted employee: ${employee.name}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete employee" });
    }
  });

  // Performance Log endpoints
  app.get("/api/performance-logs", requireAuth, requirePermission('employees', 'read'), async (req, res) => {
    try {
      const { employeeId, month, year } = req.query;
      const filter: any = {};
      
      if (employeeId) filter.employeeId = employeeId;
      if (month) filter.month = parseInt(month as string);
      if (year) filter.year = parseInt(year as string);
      
      const logs = await PerformanceLog.find(filter)
        .populate('employeeId')
        .sort({ year: -1, month: -1 });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch performance logs" });
    }
  });

  app.post("/api/performance-logs/generate", requireAuth, requirePermission('employees', 'update'), async (req, res) => {
    try {
      const { month, year } = req.body;
      const targetMonth = month || new Date().getMonth() + 1;
      const targetYear = year || new Date().getFullYear();
      
      const employees = await Employee.find({ isActive: true });
      const logs = [];
      
      for (const employee of employees) {
        const existingLog = await PerformanceLog.findOne({
          employeeId: employee._id,
          month: targetMonth,
          year: targetYear
        });
        
        if (existingLog) continue;
        
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
        
        const salesData = await Order.aggregate([
          { 
            $match: { 
              salespersonId: employee._id,
              createdAt: { $gte: startDate, $lte: endDate }
            } 
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: '$total' },
              orderCount: { $sum: 1 },
              avgOrderValue: { $avg: '$total' }
            }
          }
        ]);
        
        const attendanceData = await Attendance.aggregate([
          {
            $match: {
              employeeId: employee._id,
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: 1 },
              presentDays: { 
                $sum: { 
                  $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] 
                } 
              }
            }
          }
        ]);
        
        const tasksData = await Task.countDocuments({
          assignedTo: employee._id,
          status: 'Completed',
          updatedAt: { $gte: startDate, $lte: endDate }
        });
        
        const sales = salesData[0] || { totalSales: 0, orderCount: 0, avgOrderValue: 0 };
        const attendance = attendanceData[0] || { totalDays: 0, presentDays: 0 };
        const attendanceRate = attendance.totalDays > 0 ? (attendance.presentDays / attendance.totalDays) * 100 : 0;
        
        const performanceScore = Math.round(
          (sales.totalSales / 100000) * 40 +
          attendanceRate * 0.3 +
          (tasksData / 10) * 30
        );
        
        const log = await PerformanceLog.create({
          employeeId: employee._id,
          employeeName: employee.name,
          employeeCode: employee.employeeId,
          month: targetMonth,
          year: targetYear,
          totalSales: sales.totalSales,
          orderCount: sales.orderCount,
          avgOrderValue: sales.avgOrderValue,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
          tasksCompleted: tasksData,
          performanceScore: Math.min(performanceScore, 100),
          createdBy: (req as any).session.userId
        });
        
        logs.push(log);
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'employee',
        description: `Generated ${logs.length} performance logs for ${targetMonth}/${targetYear}`,
        ipAddress: req.ip,
      });
      
      res.json({ 
        message: `Generated ${logs.length} performance logs`,
        logs 
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to generate performance logs" });
    }
  });

  // Service handlers endpoint - accessible to all authenticated users
  app.get("/api/service-handlers", requireAuth, async (req, res) => {
    try {
      // Fetch from User model (current employees), not Employee model (legacy/seed data)
      // Explicitly select only safe fields and exclude passwordHash for security
      const handlers = await User.find({
        role: 'Service Staff',
        isActive: true
      })
      .select('_id employeeId name role mobileNumber email department isActive')
      .sort({ name: 1 });
      
      // Map mobileNumber to contact for backwards compatibility with frontend
      const mappedHandlers = handlers.map(handler => ({
        ...handler.toObject(),
        contact: handler.mobileNumber
      }));
      
      res.json(mappedHandlers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service handlers" });
    }
  });

  // Service visits - use 'orders' resource for permissions (Service Staff can read/update)
  app.get("/api/service-visits", requireAuth, requirePermission('orders', 'read'), async (req, res) => {
    try {
      const visits = await ServiceVisit.find()
        .populate('customerId')
        .populate('handlerIds')
        .populate('partsUsed.productId')
        .sort({ createdAt: -1 });
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service visits" });
    }
  });

  app.post("/api/service-visits", requireAuth, requirePermission('orders', 'create'), async (req, res) => {
    try {
      const visit = await ServiceVisit.create(req.body);
      await visit.populate('customerId');
      await visit.populate('handlerIds');
      
      // Notify about new service visit
      const customerName = visit.customerId?.fullName || 'Unknown Customer';
      await notifyServiceVisitStatus(visit, customerName, visit.status);
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'service_visit',
        resourceId: visit._id.toString(),
        description: `Created service visit for ${visit.vehicleReg}`,
        details: { status: visit.status, customerName },
        ipAddress: req.ip,
      });
      
      res.json(visit);
    } catch (error) {
      res.status(400).json({ error: "Failed to create service visit" });
    }
  });

  // Get completed services for manual invoice creation (must come before :id routes)
  app.get("/api/service-visits/completed", requireAuth, async (req, res) => {
    try {
      const completed = await ServiceVisit.find({ status: 'completed' })
        .populate('customerId')
        .lean();
      res.json(completed);
    } catch (error) {
      console.error('Error fetching completed services:', error);
      res.status(500).json({ error: "Failed to fetch completed services" });
    }
  });

  // Get suggested products for a service visit based on vehicle's selected parts
  app.get("/api/service-visits/:id/suggested-products", requireAuth, requirePermission('orders', 'read'), async (req, res) => {
    try {
      console.log('\n========================================');
      console.log('🔍 SUGGESTED PRODUCTS API - START');
      console.log('========================================');
      
      const serviceVisit = await ServiceVisit.findById(req.params.id)
        .populate('customerId')
        .populate('partsUsed.productId');
      
      if (!serviceVisit) {
        console.log('❌ Service visit not found');
        return res.status(404).json({ error: "Service visit not found" });
      }

      console.log('📋 Service Visit Info:', {
        id: serviceVisit._id,
        vehicleReg: serviceVisit.vehicleReg,
        customerId: serviceVisit.customerId?._id,
        partsUsedCount: serviceVisit.partsUsed?.length || 0,
      });

      // First priority: Use partsUsed from the service visit (already has products)
      if (serviceVisit.partsUsed && serviceVisit.partsUsed.length > 0) {
        console.log('✅ Service visit has partsUsed, using those directly');
        console.log('PartsUsed details:', JSON.stringify(serviceVisit.partsUsed, null, 2));
        
        // Extract product IDs (handle both populated objects and ObjectId strings)
        const productIds = serviceVisit.partsUsed
          .map((part: any) => {
            if (part.productId) {
              return typeof part.productId === 'object' 
                ? part.productId._id?.toString() || part.productId.toString()
                : part.productId.toString();
            }
            return null;
          })
          .filter(Boolean);
        
        console.log('📦 Extracted Product IDs:', productIds);
        
        if (productIds.length > 0) {
          // Fetch all products explicitly to ensure we have complete data
          const products = await Product.find({ _id: { $in: productIds } });
          
          console.log('✅ Found products from partsUsed:', products.map(p => ({ id: p._id, name: p.productName, price: p.sellingPrice })));
          
          const suggestedProducts = products.map(product => {
            const transformed = buildProductResponse(product);
            return {
              productId: transformed.id,
              name: transformed.name,
              price: transformed.price,
              warranty: transformed.warranty,
              category: transformed.category,
              stockQty: transformed.stockQty
            };
          });
          
          console.log('🎯 Returning', suggestedProducts.length, 'products from partsUsed');
          console.log('========================================\n');
          return res.json({ products: suggestedProducts });
        }
      }

      console.log('🔄 No partsUsed, falling back to vehicle selectedParts');

      // Fallback: Look for products based on vehicle's selected parts
      const customerId = serviceVisit.customerId?._id?.toString();
      if (!customerId) {
        console.log('❌ No customer ID');
        console.log('========================================\n');
        return res.json({ products: [] });
      }

      // Find the specific vehicle for this service visit by matching vehicleReg
      const vehicleReg = serviceVisit.vehicleReg;
      if (!vehicleReg) {
        console.log('❌ No vehicle registration');
        console.log('========================================\n');
        return res.json({ products: [] });
      }

      // Try to find vehicle by vehicleNumber or vehicleId (registration number)
      const vehicle = await RegistrationVehicle.findOne({
        customerId,
        $or: [
          { vehicleNumber: vehicleReg },
          { vehicleId: vehicleReg }
        ]
      });

      console.log('🚗 Vehicle Lookup:', {
        vehicleReg,
        customerId,
        vehicleFound: !!vehicle,
        vehicleNumber: vehicle?.vehicleNumber,
        vehicleId: vehicle?.vehicleId,
        selectedPartsCount: vehicle?.selectedParts?.length || 0,
        selectedParts: vehicle?.selectedParts,
      });

      if (!vehicle || !vehicle.selectedParts || vehicle.selectedParts.length === 0) {
        console.log('❌ No vehicle or selectedParts found, returning empty');
        console.log('========================================\n');
        return res.json({ products: [] });
      }

      console.log('\n🔍 Looking up products by IDs from selectedParts');
      console.log('Product IDs to fetch:', vehicle.selectedParts);

      const mongoose = await import('mongoose');
      const productIdsForDb: string[] = [];
      const originalToStripped = new Map<string, string>();
      
      // Normalize selectedParts to handle both old (string[]) and new ({partId, quantity}[]) formats
      const normalizedParts = normalizeSelectedParts(vehicle.selectedParts);
      const partIds = normalizedParts.map(part => part.partId);
      
      console.log('Normalized selectedParts:', normalizedParts);
      console.log('Extracted Part IDs:', partIds);
      
      partIds.forEach((id: string) => {
        const mongoId = id.startsWith('product-') ? id.replace('product-', '') : id;
        try {
          new mongoose.Types.ObjectId(mongoId);
          productIdsForDb.push(mongoId);
          originalToStripped.set(id, mongoId);
        } catch {
        }
      });

      const dbProducts = await Product.find({ 
        _id: { $in: productIdsForDb },
        status: { $nin: ['discontinued'] }
      }).limit(20);

      console.log('✅ Found', dbProducts.length, 'products from database');

      const { getPartById } = await import('@shared/vehicleData');
      const foundDbProductIds = new Set(dbProducts.map(p => p._id.toString()));
      const foundDbProductOriginalIds = Array.from(originalToStripped.entries())
        .filter(([_, mongoId]) => foundDbProductIds.has(mongoId))
        .map(([originalId, _]) => originalId);
      
      const predefinedPartIds = partIds.filter((id: string) => 
        !foundDbProductOriginalIds.includes(id)
      );

      const predefinedProducts = predefinedPartIds
        .map((partId: string) => {
          const part = getPartById(partId);
          console.log(`  🔹 Predefined Part ID "${partId}" -> Name: "${part?.name}"`);
          return part;
        })
        .filter(Boolean);

      console.log('✅ Found', predefinedProducts.length, 'predefined products');

      const products = [
        ...dbProducts,
        ...predefinedProducts.map((p: any) => ({
          _id: p.id,
          name: p.name,
          sellingPrice: p.price,
          category: p.category,
          warranty: undefined,
          stockQty: 0
        }))
      ];

      console.log('✅ Found', products.length, 'products with exact name matches');
      const transformedProducts = products.map(buildProductResponse);
      console.log('Matched products:', transformedProducts.map(p => p.name));

      console.log('\n✅ Final Product Search Results:');
      console.log('  Total products found:', transformedProducts.length);
      console.log('  Product details:', transformedProducts.map(p => ({ 
        name: p.name, 
        category: p.category, 
        price: p.sellingPrice 
      })));

      const suggestedProducts = transformedProducts.map(product => ({
        productId: product.id,
        name: product.name,
        price: product.price,
        warranty: product.warranty,
        category: product.category,
        stockQty: product.stockQty
      }));

      console.log('🎯 Returning', suggestedProducts.length, 'suggested products');
      console.log('========================================\n');
      res.json({ products: suggestedProducts });
    } catch (error) {
      console.error('❌ Error fetching suggested products:', error);
      console.log('========================================\n');
      res.status(500).json({ error: "Failed to fetch suggested products" });
    }
  });

  app.patch("/api/service-visits/:id", requireAuth, requirePermission('orders', 'update'), async (req, res) => {
    try {
      // Truncate base64 images for cleaner logging
      const logBody = { ...req.body };
      if (logBody.beforeImages) {
        logBody.beforeImages = logBody.beforeImages.map((img: string) => 
          img.startsWith('data:') ? `[base64 image: ${img.substring(0, 30)}...]` : img
        );
      }
      if (logBody.afterImages) {
        logBody.afterImages = logBody.afterImages.map((img: string) => 
          img.startsWith('data:') ? `[base64 image: ${img.substring(0, 30)}...]` : img
        );
      }
      
      console.log('🔧 [SERVICE UPDATE] Request received:', {
        id: req.params.id,
        body: logBody,
        timestamp: new Date().toISOString()
      });

      const visit = await ServiceVisit.findById(req.params.id);
      if (!visit) {
        console.log('❌ [SERVICE UPDATE] Service visit not found:', req.params.id);
        return res.status(404).json({ error: "Service visit not found" });
      }

      console.log('📋 [SERVICE UPDATE] Previous state:', {
        status: visit.status,
        stageTimestamps: visit.stageTimestamps
      });
      
      // Validate base64 images if present (format and size check - limit to 50MB per image)
      // Also allow existing images (non-base64 URLs) to pass through unchanged
      const validateImages = (images: string[]) => {
        if (!images || !Array.isArray(images)) return true;
        const dataUriRegex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        const httpUrlRegex = /^https?:\/\//;
        
        return images.every(img => {
          if (!img) return true;
          
          // Allow existing HTTP/HTTPS URLs (already stored images)
          if (httpUrlRegex.test(img)) return true;
          
          // Check data URI format for new base64 images
          if (!dataUriRegex.test(img)) return false;
          
          // Extract and validate base64 content
          const base64Content = img.replace(dataUriRegex, '');
          if (!base64Regex.test(base64Content)) return false;
          
          // Check size (50MB limit)
          const sizeInMB = (base64Content.length * 0.75) / (1024 * 1024);
          return sizeInMB <= 50;
        });
      };

      if (req.body.beforeImages && !validateImages(req.body.beforeImages)) {
        console.log('❌ [SERVICE UPDATE] Invalid before images');
        return res.status(400).json({ error: "Invalid before images: must be valid base64 image data (PNG, JPEG, GIF, WebP) under 50MB per image" });
      }
      if (req.body.afterImages && !validateImages(req.body.afterImages)) {
        console.log('❌ [SERVICE UPDATE] Invalid after images');
        return res.status(400).json({ error: "Invalid after images: must be valid base64 image data (PNG, JPEG, GIF, WebP) under 50MB per image" });
      }

      // Store previous status for loyalty and notification logic
      const previousStatus = visit.status;
      const previousCustomerId = visit.customerId;

      // Update fields explicitly to ensure Mongoose tracks changes properly
      if (req.body.status !== undefined) visit.status = req.body.status;
      if (req.body.notes !== undefined) visit.notes = req.body.notes;
      if (req.body.beforeImages !== undefined) visit.beforeImages = req.body.beforeImages;
      if (req.body.afterImages !== undefined) visit.afterImages = req.body.afterImages;
      if (req.body.handlerIds !== undefined) {
        visit.handlerIds = req.body.handlerIds;
        visit.markModified('handlerIds'); // Explicitly mark as modified for Mongoose
      }
      if (req.body.partsUsed !== undefined) visit.partsUsed = req.body.partsUsed;
      if (req.body.totalAmount !== undefined) visit.totalAmount = req.body.totalAmount;
      
      console.log('💾 [SERVICE UPDATE] Saving with new data:', {
        newStatus: visit.status,
        handlerIds: visit.handlerIds,
        handlerIdsFromReqBody: req.body.handlerIds,
        statusChanged: previousStatus !== visit.status
      });

      // Save the document - this triggers the pre('save') hook which updates stageTimestamps
      await visit.save();
      
      console.log('🔍 [DEBUG] After save, BEFORE populate:', {
        handlerIds: visit.handlerIds,
        handlerIdsLength: visit.handlerIds?.length
      });
      
      // Populate after save
      await visit.populate('customerId');
      
      console.log('🔍 [DEBUG] After customerId populate, BEFORE handlerIds populate:', {
        handlerIds: visit.handlerIds,
        handlerIdsLength: visit.handlerIds?.length
      });
      
      await visit.populate('handlerIds');

      console.log('✅ [SERVICE UPDATE] Saved successfully:', {
        status: visit.status,
        handlerIds: visit.handlerIds,
        handlerIdsPopulated: visit.handlerIds?.map((h: any) => ({ id: h._id, name: h.name })),
        stageTimestamps: visit.stageTimestamps
      });
      
      // Update customer loyalty when visit is completed
      // Note: Customer loyalty fields (visitCount, totalSpent, loyaltyTier) are not yet implemented in the model
      // Commenting out until those fields are added to RegistrationCustomer schema
      /* 
      if (visit.status === 'completed' && previousStatus !== 'completed' && visit.customerId) {
        console.log('🎖️ [SERVICE UPDATE] Updating customer loyalty');
        const customer = await RegistrationCustomer.findById(visit.customerId._id);
        if (customer) {
          customer.visitCount += 1;
          customer.totalSpent += visit.totalAmount || 0;
          customer.calculateLoyaltyTier();
          await customer.save();
          console.log('✅ [SERVICE UPDATE] Customer loyalty updated:', {
            visitCount: customer.visitCount,
            totalSpent: customer.totalSpent,
            loyaltyTier: customer.loyaltyTier
          });
        }
      }
      */
      
      // Notify about service visit status change
      if (visit.status && previousStatus !== visit.status) {
        console.log('🔔 [SERVICE UPDATE] Sending status change notification');
        const customerName = visit.customerId?.name || 'Unknown Customer';
        await notifyServiceVisitStatus(visit, customerName, visit.status);
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'update',
        resource: 'service_visit',
        resourceId: visit._id.toString(),
        description: `Updated service visit for ${visit.vehicleReg}`,
        details: { status: visit.status },
        ipAddress: req.ip,
      });
      
      console.log('🎉 [SERVICE UPDATE] Update completed successfully');
      console.log('📤 [SERVICE UPDATE] Returning visit to frontend:', {
        _id: visit._id,
        handlerIds: visit.handlerIds,
        handlerIdsType: Array.isArray(visit.handlerIds) ? 'array' : typeof visit.handlerIds,
        handlerIdsLength: visit.handlerIds?.length,
      });
      console.log('\n');
      res.json(visit);
    } catch (error) {
      console.error('❌ [SERVICE UPDATE] Error:', error);
      res.status(400).json({ error: "Failed to update service visit" });
    }
  });

  app.delete("/api/service-visits/:id", requireAuth, requirePermission('orders', 'delete'), async (req, res) => {
    try {
      const visit = await ServiceVisit.findByIdAndDelete(req.params.id);
      if (!visit) {
        return res.status(404).json({ error: "Service visit not found" });
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'service_visit',
        resourceId: visit._id.toString(),
        description: `Deleted service visit for ${visit.vehicleReg}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete service visit" });
    }
  });

  // Orders endpoints with permission checks
  app.get("/api/orders", requireAuth, requirePermission('orders', 'read'), async (req, res) => {
    try {
      const orders = await Order.find()
        .populate('customerId')
        .populate('items.productId')
        .populate('salespersonId')
        .sort({ createdAt: -1 });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", requireAuth, requirePermission('orders', 'create'), async (req, res) => {
    try {
      const orderData = req.body;
      const order = await Order.create(orderData);
      
      for (const item of req.body.items) {
        const updatedProduct = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQty: -item.quantity } },
          { new: true }
        );
        
        await InventoryTransaction.create({
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: `Order ${order.invoiceNumber}`,
        });
        
        // Check for low stock after order
        if (updatedProduct) {
          await checkAndNotifyLowStock(updatedProduct);
        }
      }
      
      await order.populate('customerId');
      await order.populate('items.productId');
      
      // Notify about new order
      const customerName = order.customerId?.name || 'Unknown Customer';
      await notifyNewOrder(order, customerName);
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'order',
        resourceId: order._id.toString(),
        description: `Created order ${order.invoiceNumber} for ${customerName}`,
        details: { total: order.total, itemCount: order.items.length },
        ipAddress: req.ip,
      });
      
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id", requireAuth, requirePermission('orders', 'update'), async (req, res) => {
    try {
      const previousOrder = await Order.findById(req.params.id).populate('customerId');
      const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .populate('customerId')
        .populate('items.productId')
        .populate('salespersonId');
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Notify about payment status changes
      if (req.body.paymentStatus && previousOrder && req.body.paymentStatus !== previousOrder.paymentStatus) {
        const customerName = order.customerId?.name || 'Unknown Customer';
        if (req.body.paymentStatus === 'due') {
          await notifyPaymentDue(order, customerName);
        }
      }
      
      const customerName = order.customerId?.name || 'Unknown Customer';
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'update',
        resource: 'order',
        resourceId: order._id.toString(),
        description: `Updated order ${order.invoiceNumber} for ${customerName}`,
        details: { paymentStatus: order.paymentStatus, deliveryStatus: order.deliveryStatus },
        ipAddress: req.ip,
      });
      
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", requireAuth, requirePermission('orders', 'delete'), async (req, res) => {
    try {
      const order = await Order.findById(req.params.id).populate('customerId');
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      await Order.findByIdAndDelete(req.params.id);
      
      const customerName = order.customerId?.name || 'Unknown Customer';
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'order',
        resourceId: order._id.toString(),
        description: `Deleted order ${order.invoiceNumber} for ${customerName}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete order" });
    }
  });

  // Inventory transactions with permission checks
  app.get("/api/inventory-transactions", requireAuth, requirePermission('inventory', 'read'), async (req, res) => {
    try {
      const transactions = await InventoryTransaction.find()
        .populate('productId')
        .populate('userId')
        .populate('supplierId')
        .populate('purchaseOrderId')
        .sort({ date: -1 });
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/inventory-transactions", requireAuth, requirePermission('inventory', 'create'), async (req, res) => {
    try {
      const product = await Product.findById(req.body.productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const previousStock = product.stockQty;
      let multiplier = 1;
      
      if (req.body.type === 'IN' || req.body.type === 'RETURN') {
        multiplier = 1;
      } else if (req.body.type === 'OUT') {
        multiplier = -1;
      } else if (req.body.type === 'ADJUSTMENT') {
        multiplier = 0; // For adjustments, quantity is absolute
      }
      
      const newStock = req.body.type === 'ADJUSTMENT' 
        ? req.body.quantity 
        : previousStock + (multiplier * req.body.quantity);
      
      const transactionData = {
        ...req.body,
        userId: (req as any).session.userId,
        previousStock,
        newStock,
      };
      
      const transaction = await InventoryTransaction.create(transactionData);
      
      const updatedProduct = await Product.findByIdAndUpdate(
        req.body.productId,
        { stockQty: newStock },
        { new: true }
      );
      
      // Check for low stock and create notification
      if (updatedProduct && (req.body.type === 'OUT' || req.body.type === 'ADJUSTMENT')) {
        await checkAndNotifyLowStock(updatedProduct);
      }
      
      await transaction.populate(['productId', 'userId', 'supplierId', 'purchaseOrderId']);
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ error: "Failed to create transaction" });
    }
  });

  app.delete("/api/inventory-transactions/:id", requireAuth, requirePermission('inventory', 'update'), async (req, res) => {
    try {
      const transaction = await InventoryTransaction.findById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const product = await Product.findById(transaction.productId);
      
      // Revert stock if product exists
      if (product) {
        const multiplier = transaction.type === 'IN' || transaction.type === 'RETURN' ? -1 : 1;
        const reversedStock = transaction.type === 'ADJUSTMENT' 
          ? transaction.previousStock 
          : product.stockQty + (multiplier * transaction.quantity);

        await Product.findByIdAndUpdate(
          transaction.productId,
          { stockQty: reversedStock },
          { new: true }
        );
      }

      // Delete the transaction regardless of whether product exists
      await InventoryTransaction.findByIdAndDelete(req.params.id);

      res.json({ success: true, message: "Transaction deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete transaction" });
    }
  });

  // Low stock alerts
  app.get("/api/products/low-stock", requireAuth, requirePermission('products', 'read'), async (req, res) => {
    try {
      const lowStockProducts = await Product.find({
        $expr: { $lte: ['$stockQty', '$minStockLevel'] }
      }).sort({ stockQty: 1 });
      res.json(lowStockProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });

  // Product search by barcode/QR
  app.get("/api/products/barcode/:barcode", requireAuth, requirePermission('products', 'read'), async (req, res) => {
    try {
      const product = await Product.findOne({ barcode: req.params.barcode });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Product returns with permission checks
  app.get("/api/product-returns", requireAuth, requirePermission('inventory', 'read'), async (req, res) => {
    try {
      const returns = await ProductReturn.find()
        .populate('productId')
        .populate('customerId')
        .populate('orderId')
        .populate('processedBy')
        .sort({ returnDate: -1 });
      res.json(returns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product returns" });
    }
  });

  app.post("/api/product-returns", requireAuth, requirePermission('inventory', 'create'), async (req, res) => {
    try {
      const returnData = {
        ...req.body,
        returnDate: new Date(),
      };
      const productReturn = await ProductReturn.create(returnData);
      await productReturn.populate(['productId', 'customerId', 'orderId']);
      res.json(productReturn);
    } catch (error) {
      res.status(400).json({ error: "Failed to create product return" });
    }
  });

  app.patch("/api/product-returns/:id", requireAuth, requirePermission('inventory', 'update'), async (req, res) => {
    try {
      const { status, refundAmount, restockable, notes } = req.body;
      const updateData: any = { status, refundAmount, restockable, notes };
      
      if (status === 'processed') {
        updateData.processedBy = (req as any).session.userId;
        updateData.processedDate = new Date();
        
        // If approved and restockable, create inventory transaction
        if (restockable) {
          const productReturn = await ProductReturn.findById(req.params.id);
          if (productReturn) {
            await InventoryTransaction.create({
              productId: productReturn.productId,
              type: 'RETURN',
              quantity: productReturn.quantity,
              reason: `Product return: ${productReturn.reason}`,
              userId: (req as any).session.userId,
              returnId: productReturn._id,
              date: new Date(),
            });
            
            await Product.findByIdAndUpdate(
              productReturn.productId,
              { $inc: { stockQty: productReturn.quantity } }
            );
          }
        }
      }
      
      const updatedReturn = await ProductReturn.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).populate(['productId', 'customerId', 'orderId', 'processedBy']);
      
      if (!updatedReturn) {
        return res.status(404).json({ error: "Product return not found" });
      }
      
      res.json(updatedReturn);
    } catch (error) {
      res.status(400).json({ error: "Failed to update product return" });
    }
  });

  // Notifications with permission checks
  app.get("/api/notifications", requireAuth, requirePermission('notifications', 'read'), async (req, res) => {
    try {
      const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, requirePermission('notifications', 'update'), async (req, res) => {
    try {
      const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { read: true },
        { new: true }
      );
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(400).json({ error: "Failed to update notification" });
    }
  });

  app.patch("/api/notifications/mark-all-read", requireAuth, requirePermission('notifications', 'update'), async (req, res) => {
    try {
      await Notification.updateMany({ read: false }, { read: true });
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      res.status(400).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.post("/api/notifications/create-test", requireAuth, requirePermission('notifications', 'create'), async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: "Test endpoint only available in development" });
    }
    
    try {
      const testNotifications = [
        {
          message: "Low stock alert: Brake Pads Set (12 units remaining)",
          type: "low_stock",
          read: false,
        },
        {
          message: "New order received from Rajesh Kumar - Order #ORD-2024-001",
          type: "new_order",
          read: false,
        },
        {
          message: "Payment overdue: Invoice #INV-2024-045 (5 days)",
          type: "payment_due",
          read: false,
        },
      ];
      
      const created = await Notification.insertMany(testNotifications);
      res.json({ success: true, count: created.length, notifications: created });
    } catch (error) {
      res.status(400).json({ error: "Failed to create test notifications" });
    }
  });

  app.post("/api/notifications/check-overdue-payments", requireAuth, requirePermission('notifications', 'create'), async (req, res) => {
    try {
      const overdueThresholdDays = 7; // Consider payments overdue after 7 days
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - overdueThresholdDays);
      
      // Find orders with payment status 'due' or 'partial' created before threshold date
      const overdueOrders = await Order.find({
        paymentStatus: { $in: ['due', 'partial'] },
        createdAt: { $lt: thresholdDate }
      }).populate('customerId');
      
      let notificationsCreated = 0;
      
      for (const order of overdueOrders) {
        const orderAge = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const daysOverdue = Math.max(orderAge - overdueThresholdDays, 1);
        const customerName = order.customerId?.name || order.customerName || 'Unknown Customer';
        
        // Check if notification already exists for this order
        const existingNotification = await Notification.findOne({
          relatedId: order._id,
          type: 'payment_due',
          message: { $regex: 'overdue' }
        });
        
        if (!existingNotification) {
          await notifyPaymentOverdue(order, customerName, daysOverdue);
          notificationsCreated++;
        }
      }
      
      res.json({ 
        success: true, 
        checked: overdueOrders.length, 
        notificationsCreated,
        message: `Checked ${overdueOrders.length} overdue orders, created ${notificationsCreated} new notifications`
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to check overdue payments" });
    }
  });

  // Dashboard stats - role-based analytics aligned with ROLE_PERMISSIONS
  app.get("/api/dashboard-stats", requireAuth, async (req, res) => {
    try {
      const userRole = (req as any).session.userRole;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats: any = {};
      const permissions: any = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || {};
      
      // Admin sees everything (has permissions for all resources)
      if (userRole === 'Admin') {
        const todayInvoices = await Invoice.find({ 
          createdAt: { $gte: today },
          paymentStatus: { $in: ['paid', 'partial'] }
        });
        stats.todaySales = todayInvoices.reduce((sum, invoice) => sum + (invoice.paidAmount || 0), 0);
        stats.activeServices = await ServiceVisit.countDocuments({ 
          status: { $in: ['inquired', 'working', 'waiting'] } 
        });
        stats.totalCustomers = await RegistrationCustomer.countDocuments();
        stats.lowStockProducts = await Product.find({
          $expr: { $lte: ['$stockQty', '$minStockLevel'] }
        }).limit(5);
        stats.totalEmployees = await User.countDocuments();
        stats.totalProducts = await Product.countDocuments();
      }
      
      // Manager sees all sections (comprehensive stats like Admin)
      else if (userRole === 'Manager') {
        const todayInvoices = await Invoice.find({ 
          createdAt: { $gte: today },
          paymentStatus: { $in: ['paid', 'partial'] }
        });
        stats.todaySales = todayInvoices.reduce((sum, invoice) => sum + (invoice.paidAmount || 0), 0);
        stats.activeServices = await ServiceVisit.countDocuments({ 
          status: { $in: ['inquired', 'working', 'waiting'] } 
        });
        stats.totalCustomers = await RegistrationCustomer.countDocuments();
        stats.lowStockProducts = await Product.find({
          $expr: { $lte: ['$stockQty', '$minStockLevel'] }
        }).limit(5);
        stats.totalEmployees = await User.countDocuments();
        stats.totalProducts = await Product.countDocuments();
        stats.activeOrders = await Order.countDocuments({ 
          status: { $in: ['pending', 'processing'] } 
        });
        stats.presentToday = await Attendance.countDocuments({ 
          date: today, 
          status: 'present' 
        });
        stats.pendingLeaves = await Leave.countDocuments({ status: 'pending' });
        stats.activeTasks = await Task.countDocuments({ 
          status: { $in: ['pending', 'in_progress'] } 
        });
      }
      
      // Inventory Manager: only products and inventory (per ROLE_PERMISSIONS)
      else if (userRole === 'Inventory Manager') {
        stats.totalProducts = await Product.countDocuments();
        stats.lowStockProducts = await Product.find({
          $expr: { $lte: ['$stockQty', '$minStockLevel'] }
        }).limit(5);
        stats.totalInventoryValue = await Product.aggregate([
          { $group: { _id: null, total: { $sum: { $multiply: ['$stockQty', '$sellingPrice'] } } } }
        ]).then(result => result[0]?.total || 0);
        stats.recentTransactions = await InventoryTransaction.countDocuments({ 
          createdAt: { $gte: today } 
        });
      }
      
      // Sales Executive: service-related metrics (per ROLE_PERMISSIONS for orders)
      else if (userRole === 'Sales Executive') {
        stats.activeServices = await ServiceVisit.countDocuments({ 
          status: { $in: ['inquired', 'working', 'waiting'] } 
        });
        stats.completedToday = await ServiceVisit.countDocuments({
          status: 'completed',
          'stageTimestamps.completed': { $gte: today }
        });
        stats.waitingServices = await ServiceVisit.countDocuments({ 
          status: 'waiting' 
        });
        stats.totalServiceVisits = await ServiceVisit.countDocuments();
        stats.inquiredServices = await ServiceVisit.countDocuments({ 
          status: 'inquired' 
        });
        stats.workingServices = await ServiceVisit.countDocuments({ 
          status: 'working' 
        });
      }
      
      // HR Manager: only employees and attendance (per ROLE_PERMISSIONS)
      else if (userRole === 'HR Manager') {
        stats.totalEmployees = await User.countDocuments();
        stats.presentToday = await Attendance.countDocuments({ 
          date: today, 
          status: 'present' 
        });
        stats.pendingLeaves = await Leave.countDocuments({ status: 'pending' });
        stats.activeTasks = await Task.countDocuments({ 
          status: { $in: ['pending', 'in_progress'] } 
        });
      }
      
      // Service Staff: only support tickets (per ROLE_PERMISSIONS)
      else if (userRole === 'Service Staff') {
        const userId = (req as any).session.userId;
        // Support ticket statistics for Service Staff
        stats.myOpenTickets = await SupportTicket.countDocuments({ 
          assignedTo: userId,
          status: { $in: ['pending', 'in_progress'] } 
        });
        stats.resolvedToday = await SupportTicket.countDocuments({
          assignedTo: userId,
          status: 'resolved',
          resolvedAt: { $gte: today }
        });
        stats.urgentTickets = await SupportTicket.countDocuments({
          assignedTo: userId,
          priority: 'urgent',
          status: { $in: ['pending', 'in_progress'] }
        });
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Dashboard Analytics - Sales Trends (Last 7 Days)
  app.get("/api/dashboard/sales-trends", requireAuth, async (req, res) => {
    try {
      const days = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const [invoices, orders] = await Promise.all([
          Invoice.find({
            createdAt: { $gte: date, $lt: nextDate },
            status: { $in: ['approved', 'paid'] }
          }),
          Order.find({
            createdAt: { $gte: date, $lt: nextDate }
          })
        ]);
        
        const sales = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const orderCount = orders.length;
        
        days.push({
          day: dayNames[date.getDay()],
          sales: Math.round(sales),
          orders: orderCount
        });
      }
      
      res.json(days);
    } catch (error) {
      console.error('Sales trends error:', error);
      res.status(500).json({ error: "Failed to fetch sales trends" });
    }
  });

  // Dashboard Analytics - Service Status Distribution
  app.get("/api/dashboard/service-status", requireAuth, async (req, res) => {
    try {
      const [inquired, working, waiting, completed] = await Promise.all([
        ServiceVisit.countDocuments({ status: 'inquired' }),
        ServiceVisit.countDocuments({ status: 'working' }),
        ServiceVisit.countDocuments({ status: 'waiting' }),
        ServiceVisit.countDocuments({ status: 'completed' })
      ]);
      
      res.json([
        { name: 'Inquired', value: inquired, color: '#3b82f6' },
        { name: 'Working', value: working, color: '#f59e0b' },
        { name: 'Waiting', value: waiting, color: '#a855f7' },
        { name: 'Completed', value: completed, color: '#10b981' }
      ]);
    } catch (error) {
      console.error('Service status error:', error);
      res.status(500).json({ error: "Failed to fetch service status" });
    }
  });

  // Dashboard Analytics - Customer Growth (6 Months)
  app.get("/api/dashboard/customer-growth", requireAuth, async (req, res) => {
    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const months = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        
        const nextMonth = new Date(date);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        const customerCount = await RegistrationCustomer.countDocuments({
          createdAt: { $lt: nextMonth }
        });
        
        months.push({
          month: monthNames[date.getMonth()],
          customers: customerCount
        });
      }
      
      res.json(months);
    } catch (error) {
      console.error('Customer growth error:', error);
      res.status(500).json({ error: "Failed to fetch customer growth" });
    }
  });

  // Dashboard Analytics - Product Categories
  app.get("/api/dashboard/product-categories", requireAuth, async (req, res) => {
    try {
      const categories = await Product.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            value: { $sum: { $multiply: ['$stockQty', '$unitPrice'] } }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ]);
      
      const formattedCategories = categories.map(cat => ({
        category: cat._id || 'Uncategorized',
        count: cat.count,
        value: Math.round(cat.value)
      }));
      
      res.json(formattedCategories);
    } catch (error) {
      console.error('Product categories error:', error);
      res.status(500).json({ error: "Failed to fetch product categories" });
    }
  });


  // Attendance with permission checks
  app.get("/api/attendance", requireAuth, requirePermission('attendance', 'read'), async (req, res) => {
    try {
      const { employeeId, startDate, endDate } = req.query;
      const filter: any = {};
      
      if (employeeId) filter.employeeId = employeeId;
      if (startDate && endDate) {
        filter.date = { 
          $gte: new Date(startDate as string), 
          $lte: new Date(endDate as string) 
        };
      }
      
      const attendance = await Attendance.find(filter)
        .populate('employeeId')
        .sort({ date: -1 });
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", requireAuth, requirePermission('attendance', 'create'), async (req, res) => {
    try {
      const attendance = await Attendance.create(req.body);
      await attendance.populate('employeeId');
      res.json(attendance);
    } catch (error) {
      res.status(400).json({ error: "Failed to create attendance record" });
    }
  });

  app.patch("/api/attendance/:id", requireAuth, requirePermission('attendance', 'update'), async (req, res) => {
    try {
      const attendance = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .populate('employeeId');
      if (!attendance) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json(attendance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update attendance" });
    }
  });

  // Leaves with permission checks
  app.get("/api/leaves", requireAuth, requirePermission('leaves', 'read'), async (req, res) => {
    try {
      const { employeeId, status } = req.query;
      const filter: any = {};
      
      if (employeeId) filter.employeeId = employeeId;
      if (status) filter.status = status;
      
      const leaves = await Leave.find(filter)
        .populate('employeeId')
        .populate('approvedBy')
        .sort({ createdAt: -1 });
      
      console.log('📋 Fetched leaves:', leaves.map(l => ({
        id: l._id,
        employeeId: l.employeeId,
        employeeIdType: typeof l.employeeId
      })));
      
      res.json(leaves);
    } catch (error) {
      console.error('❌ Error fetching leaves:', error);
      res.status(500).json({ error: "Failed to fetch leaves" });
    }
  });

  app.post("/api/leaves", requireAuth, requirePermission('leaves', 'create'), async (req, res) => {
    try {
      console.log('📋 Creating leave with data:', JSON.stringify(req.body, null, 2));
      
      const createData = { ...req.body };
      if (createData.employeeId === '' || createData.employeeId === null) {
        delete createData.employeeId;
      }
      
      // Check if user/employee exists
      if (createData.employeeId) {
        const employeeExists = await User.findById(createData.employeeId);
        console.log('🔍 Checking if user/employee exists:', {
          requestedId: createData.employeeId,
          exists: !!employeeExists,
          employeeName: employeeExists?.name
        });
        
        if (!employeeExists) {
          console.error('❌ User/Employee not found with ID:', createData.employeeId);
          // List all available users/employees
          const allEmployees = await User.find({}).select('_id name role');
          console.log('📋 Available users/employees:', allEmployees.map(e => ({
            id: e._id.toString(),
            name: e.name,
            role: e.role
          })));
        }
      }
      
      const leave = await Leave.create(createData);
      console.log('💾 Leave created in database:', {
        id: leave._id,
        employeeId: leave.employeeId,
        employeeIdType: typeof leave.employeeId
      });
      
      await leave.populate('employeeId');
      
      console.log('📦 Leave after populate:', {
        id: leave._id,
        employeeId: leave.employeeId,
        employeeName: leave.employeeId?.name
      });
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'leave',
        resourceId: leave._id.toString(),
        description: `Created leave request for ${leave.employeeId?.name || 'employee'}`,
        details: { type: leave.leaveType, status: leave.status },
        ipAddress: req.ip,
      });
      
      res.json(leave);
    } catch (error) {
      res.status(400).json({ error: "Failed to create leave request" });
    }
  });

  app.patch("/api/leaves/:id", requireAuth, requirePermission('leaves', 'update'), async (req, res) => {
    try {
      console.log('📝 Updating leave with data:', JSON.stringify(req.body, null, 2));
      
      const updateData = { ...req.body };
      if (updateData.employeeId === '' || updateData.employeeId === null) {
        delete updateData.employeeId;
      }
      
      console.log('📝 Final update data to save:', JSON.stringify(updateData, null, 2));
      
      const leave = await Leave.findByIdAndUpdate(req.params.id, updateData, { new: true })
        .populate('employeeId')
        .populate('approvedBy');
      if (!leave) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      console.log('✅ Leave updated successfully:', {
        id: leave._id,
        employeeId: leave.employeeId,
        employeeName: leave.employeeId?.name
      });
      
      const action = req.body.status === 'approved' ? 'approve' : req.body.status === 'rejected' ? 'reject' : 'update';
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: action,
        resource: 'leave',
        resourceId: leave._id.toString(),
        description: `${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Updated'} leave request for ${leave.employeeId?.name || 'employee'}`,
        details: { status: leave.status, type: leave.leaveType },
        ipAddress: req.ip,
      });
      
      res.json(leave);
    } catch (error) {
      console.error('❌ Leave update error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update leave request" });
    }
  });

  app.delete("/api/leaves/:id", requireAuth, requirePermission('leaves', 'delete'), async (req, res) => {
    try {
      const leave = await Leave.findByIdAndDelete(req.params.id);
      if (!leave) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'leave',
        resourceId: leave._id.toString(),
        description: `Deleted leave request`,
        details: { status: leave.status, type: leave.leaveType },
        ipAddress: req.ip,
      });
      
      res.json({ message: "Leave request deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete leave request" });
    }
  });

  // Tasks with permission checks
  app.get("/api/tasks", requireAuth, requirePermission('tasks', 'read'), async (req, res) => {
    try {
      const { assignedTo, status } = req.query;
      const filter: any = {};
      
      if (assignedTo) filter.assignedTo = assignedTo;
      if (status) filter.status = status;
      
      const tasks = await Task.find(filter)
        .populate('assignedTo')
        .populate('assignedBy')
        .sort({ createdAt: -1 });
      
      console.log('📋 Fetched tasks:', tasks.map(t => ({
        id: t._id,
        title: t.title,
        assignedTo: t.assignedTo,
        assignedToType: typeof t.assignedTo
      })));
      
      res.json(tasks);
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, requirePermission('tasks', 'create'), async (req, res) => {
    try {
      console.log('📋 Creating task with data:', JSON.stringify(req.body, null, 2));
      console.log('👤 Session userId:', (req as any).session.userId);
      
      const createData = { ...req.body };
      if (createData.assignedTo === '' || createData.assignedTo === null) {
        delete createData.assignedTo;
      }
      
      // Check if user/employee exists
      if (createData.assignedTo) {
        const employeeExists = await User.findById(createData.assignedTo);
        console.log('🔍 Checking if user/employee exists:', {
          requestedId: createData.assignedTo,
          exists: !!employeeExists,
          employeeName: employeeExists?.name
        });
        
        if (!employeeExists) {
          console.error('❌ User/Employee not found with ID:', createData.assignedTo);
          // List all available users/employees
          const allEmployees = await User.find({}).select('_id name role');
          console.log('📋 Available users/employees:', allEmployees.map(e => ({
            id: e._id.toString(),
            name: e.name,
            role: e.role
          })));
        }
      }
      
      const task = await Task.create(createData);
      console.log('💾 Task created in database:', {
        id: task._id,
        assignedTo: task.assignedTo,
        assignedToType: typeof task.assignedTo
      });
      
      await task.populate('assignedTo');
      await task.populate('assignedBy');
      
      console.log('📦 Task after populate:', {
        id: task._id,
        assignedTo: task.assignedTo,
        assignedToName: task.assignedTo?.name
      });
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'create',
        resource: 'task',
        resourceId: task._id.toString(),
        description: `Created task: ${task.title} for ${task.assignedTo?.name || 'employee'}`,
        details: { priority: task.priority, status: task.status },
        ipAddress: req.ip,
      });
      
      res.json(task);
    } catch (error) {
      console.error('❌ Task creation error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, requirePermission('tasks', 'update'), async (req, res) => {
    try {
      console.log('📝 Updating task with data:', JSON.stringify(req.body, null, 2));
      
      const updateData = { ...req.body };
      if (updateData.assignedTo === '' || updateData.assignedTo === null) {
        delete updateData.assignedTo;
      }
      
      console.log('📝 Final update data to save:', JSON.stringify(updateData, null, 2));
      
      const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true })
        .populate('assignedTo')
        .populate('assignedBy');
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      console.log('✅ Task updated successfully:', {
        id: task._id,
        title: task.title,
        assignedTo: task.assignedTo,
        assignedToName: task.assignedTo?.name
      });
      
      const action = req.body.status === 'completed' ? 'complete' : 'update';
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: action,
        resource: 'task',
        resourceId: task._id.toString(),
        description: `${action === 'complete' ? 'Completed' : 'Updated'} task: ${task.title}`,
        details: { status: task.status, priority: task.priority },
        ipAddress: req.ip,
      });
      
      res.json(task);
    } catch (error) {
      console.error('❌ Task update error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, requirePermission('tasks', 'delete'), async (req, res) => {
    try {
      const task = await Task.findByIdAndDelete(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'task',
        resourceId: task._id.toString(),
        description: `Deleted task: ${task.title}`,
        details: { priority: task.priority, status: task.status },
        ipAddress: req.ip,
      });
      
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete task" });
    }
  });

  // Communication logs with permission checks
  app.get("/api/communication-logs", requireAuth, requirePermission('communications', 'read'), async (req, res) => {
    try {
      const { customerId } = req.query;
      const filter: any = {};
      
      if (customerId) filter.customerId = customerId;
      
      const logs = await CommunicationLog.find(filter)
        .populate('customerId')
        .populate('handledBy')
        .sort({ date: -1 });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch communication logs" });
    }
  });

  app.post("/api/communication-logs", requireAuth, requirePermission('communications', 'create'), async (req, res) => {
    try {
      const log = await CommunicationLog.create(req.body);
      await log.populate('customerId');
      await log.populate('handledBy');
      res.json(log);
    } catch (error) {
      res.status(400).json({ error: "Failed to create communication log" });
    }
  });

  // Feedbacks with permission checks
  app.get("/api/feedbacks", requireAuth, requirePermission('feedbacks', 'read'), async (req, res) => {
    try {
      const { customerId, type, status } = req.query;
      const filter: any = {};
      
      if (customerId) filter.customerId = customerId;
      if (type) filter.type = type;
      if (status) filter.status = status;
      
      const feedbacks = await Feedback.find(filter)
        .populate('customerId')
        .populate('assignedTo')
        .sort({ createdAt: -1 });
      res.json(feedbacks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feedbacks" });
    }
  });

  app.post("/api/feedbacks", requireAuth, requirePermission('feedbacks', 'create'), async (req, res) => {
    try {
      const feedback = await Feedback.create(req.body);
      await feedback.populate('customerId');
      res.json(feedback);
    } catch (error) {
      res.status(400).json({ error: "Failed to create feedback" });
    }
  });

  app.patch("/api/feedbacks/:id", requireAuth, requirePermission('feedbacks', 'update'), async (req, res) => {
    try {
      const feedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .populate('customerId')
        .populate('assignedTo');
      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }
      res.json(feedback);
    } catch (error) {
      res.status(400).json({ error: "Failed to update feedback" });
    }
  });

  app.get("/api/feedbacks/analytics/ratings", requireAuth, requirePermission('feedbacks', 'read'), async (req, res) => {
    try {
      const ratingStats = await Feedback.aggregate([
        {
          $match: { rating: { $exists: true, $ne: null } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            averageRating: { $avg: '$rating' },
            totalFeedbacks: { $sum: 1 },
            ratingDistribution: {
              $push: '$rating'
            }
          }
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 }
        }
      ]);

      const overallStats = await Feedback.aggregate([
        {
          $match: { rating: { $exists: true, $ne: null } }
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalFeedbacks: { $sum: 1 },
            rating1: {
              $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] }
            },
            rating2: {
              $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] }
            },
            rating3: {
              $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] }
            },
            rating4: {
              $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] }
            },
            rating5: {
              $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] }
            }
          }
        }
      ]);

      res.json({
        monthlyStats: ratingStats,
        overallStats: overallStats[0] || {
          averageRating: 0,
          totalFeedbacks: 0,
          rating1: 0,
          rating2: 0,
          rating3: 0,
          rating4: 0,
          rating5: 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rating analytics" });
    }
  });

  // Support Tickets
  app.get("/api/support-tickets", requireAuth, requirePermission('supportTickets', 'read'), async (req, res) => {
    try {
      const { customerId, vehicleReg, status, priority } = req.query;
      const filter: any = {};
      
      if (customerId) filter.customerId = customerId;
      if (vehicleReg) filter.vehicleReg = new RegExp(vehicleReg as string, 'i');
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      
      const tickets = await SupportTicket.find(filter)
        .populate('customerId', 'referenceCode fullName mobileNumber email city district isVerified')
        .populate('vehicleId')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('feedbackId')
        .sort({ createdAt: -1 })
        .lean();
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      res.status(500).json({ error: "Failed to fetch support tickets" });
    }
  });

  app.get("/api/support-tickets/search", requireAuth, requirePermission('supportTickets', 'read'), async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const customers = await RegistrationCustomer.find({
        $or: [
          { customerId: new RegExp(query as string, 'i') },
          { fullName: new RegExp(query as string, 'i') },
          { mobileNumber: new RegExp(query as string, 'i') }
        ]
      }).select('_id customerId fullName mobileNumber');
      
      const vehicles = await RegistrationVehicle.find({
        $or: [
          { vehicleId: new RegExp(query as string, 'i') },
          { vehicleRegistrationNumber: new RegExp(query as string, 'i') }
        ]
      }).select('_id vehicleId vehicleRegistrationNumber customerId');
      
      const customerIds = [...customers.map(c => c._id), ...vehicles.map(v => v.customerId)];
      
      const tickets = await SupportTicket.find({
        $or: [
          { customerId: { $in: customerIds } },
          { vehicleReg: new RegExp(query as string, 'i') },
          { ticketNumber: new RegExp(query as string, 'i') }
        ]
      })
        .populate('customerId', 'referenceCode fullName mobileNumber email city district isVerified')
        .populate('vehicleId')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();
      
      res.json({ tickets, customers, vehicles });
    } catch (error) {
      console.error('Error searching support tickets:', error);
      res.status(500).json({ error: "Failed to search support tickets" });
    }
  });

  app.get("/api/support-tickets/customer/:customerId", requireAuth, requirePermission('supportTickets', 'read'), async (req, res) => {
    try {
      const tickets = await SupportTicket.find({ customerId: req.params.customerId })
        .populate('customerId', 'referenceCode fullName mobileNumber email city district isVerified')
        .populate('vehicleId')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('feedbackId')
        .sort({ createdAt: -1 })
        .lean();
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching customer support history:', error);
      res.status(500).json({ error: "Failed to fetch customer support history" });
    }
  });

  app.post("/api/support-tickets", requireAuth, requirePermission('supportTickets', 'create'), async (req, res) => {
    try {
      const ticketSeq = await getNextSequence('supportTicket');
      const ticketNumber = `TKT${String(ticketSeq).padStart(5, '0')}`;
      
      const user = (req as any).user;
      const ticketData = {
        ...req.body,
        ticketNumber,
        createdBy: user.id,
        assignedTo: user.id
      };
      
      const ticket = await SupportTicket.create(ticketData);
      await ticket.populate([
        { path: 'customerId', select: 'referenceCode fullName mobileNumber email city district isVerified' },
        { path: 'vehicleId' },
        { path: 'assignedTo', select: 'name email' },
        { path: 'createdBy', select: 'name email' }
      ]);
      
      await logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'create',
        resource: 'support_ticket',
        resourceId: ticket._id.toString(),
        description: `Created support ticket ${ticketNumber} for customer`
      });
      
      res.json(ticket);
    } catch (error: any) {
      console.error('Error creating support ticket:', error);
      res.status(400).json({ error: error.message || "Failed to create support ticket" });
    }
  });

  app.patch("/api/support-tickets/:id", requireAuth, requirePermission('supportTickets', 'update'), async (req, res) => {
    try {
      const updates = { ...req.body };
      
      if (updates.status === 'resolved' && !updates.resolvedAt) {
        updates.resolvedAt = new Date();
      }
      
      if (updates.status === 'closed' && !updates.closedAt) {
        updates.closedAt = new Date();
      }
      
      const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id, 
        updates, 
        { new: true }
      )
        .populate('customerId', 'referenceCode fullName mobileNumber email city district isVerified')
        .populate('vehicleId')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('feedbackId');
      
      if (!ticket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      const user = (req as any).user;
      await logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'update',
        resource: 'support_ticket',
        resourceId: ticket._id.toString(),
        description: `Updated support ticket ${ticket.ticketNumber}`
      });
      
      res.json(ticket);
    } catch (error) {
      console.error('Error updating support ticket:', error);
      res.status(400).json({ error: "Failed to update support ticket" });
    }
  });

  app.post("/api/support-tickets/:id/notes", requireAuth, requirePermission('supportTickets', 'update'), async (req, res) => {
    try {
      const { note } = req.body;
      const user = (req as any).user;
      
      if (!note) {
        return res.status(400).json({ error: "Note is required" });
      }
      
      const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            notes: {
              note,
              addedBy: user.id,
              addedAt: new Date()
            }
          }
        },
        { new: true }
      )
        .populate('customerId', 'referenceCode fullName mobileNumber email city district isVerified')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('notes.addedBy', 'name email');
      
      if (!ticket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      res.json(ticket);
    } catch (error) {
      res.status(400).json({ error: "Failed to add note" });
    }
  });

  app.post("/api/support-tickets/:id/send-whatsapp", requireAuth, requirePermission('supportTickets', 'update'), async (req, res) => {
    try {
      const ticket = await SupportTicket.findById(req.params.id).populate('customerId');
      
      if (!ticket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      await SupportTicket.findByIdAndUpdate(req.params.id, {
        whatsappFollowUp: {
          sent: true,
          sentAt: new Date(),
          message: "Follow-up message sent (dummy implementation)"
        }
      });
      
      res.json({ success: true, message: "WhatsApp follow-up marked as sent (dummy)" });
    } catch (error) {
      res.status(400).json({ error: "Failed to send WhatsApp follow-up" });
    }
  });

  app.post("/api/support-tickets/:id/send-feedback", requireAuth, requirePermission('supportTickets', 'update'), async (req, res) => {
    try {
      const ticket = await SupportTicket.findById(req.params.id).populate('customerId');
      
      if (!ticket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      await SupportTicket.findByIdAndUpdate(req.params.id, {
        feedbackSent: {
          sent: true,
          sentAt: new Date()
        }
      });
      
      res.json({ success: true, message: "Feedback form link sent (dummy)" });
    } catch (error) {
      res.status(400).json({ error: "Failed to send feedback form" });
    }
  });

  app.post("/api/support-tickets/auto-close", requireAuth, async (req, res) => {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const result = await SupportTicket.updateMany(
        {
          status: 'resolved',
          resolvedAt: { $lte: threeDaysAgo },
          closedAt: { $exists: false }
        },
        {
          $set: {
            status: 'closed',
            closedAt: new Date()
          }
        }
      );
      
      res.json({ 
        success: true, 
        message: `Auto-closed ${result.modifiedCount} resolved tickets older than 3 days` 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to auto-close tickets" });
    }
  });

  app.delete("/api/support-tickets/:id", requireAuth, requirePermission('supportTickets', 'delete'), async (req, res) => {
    try {
      const ticket = await SupportTicket.findById(req.params.id);
      
      if (!ticket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      const user = (req as any).user;
      await logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'delete',
        resource: 'support_ticket',
        resourceId: ticket._id.toString(),
        description: `Deleted support ticket ${ticket.ticketNumber}`
      });
      
      await SupportTicket.findByIdAndDelete(req.params.id);
      
      res.json({ success: true, message: "Support ticket deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete support ticket" });
    }
  });

  // Reports - Admin and HR Manager can access
  app.get("/api/reports/sales", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const { startDate, endDate, period = 'daily' } = req.query;
      const matchStage: any = { status: 'approved' };
      
      if (startDate && endDate) {
        matchStage.createdAt = { 
          $gte: new Date(startDate as string), 
          $lte: new Date(endDate as string) 
        };
      }
      
      const groupFormat = period === 'monthly' 
        ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
        : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
      
      const salesReport = await Invoice.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: groupFormat,
            totalSales: { $sum: '$totalAmount' },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
      ]);
      
      res.json(salesReport);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate sales report" });
    }
  });

  app.get("/api/reports/inventory", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const lowStockProducts = await Product.find({
        $expr: { $lte: ['$stockQty', '$minStockLevel'] }
      }).sort({ stockQty: 1 });
      
      const outOfStockProducts = await Product.find({ stockQty: 0 });
      
      const totalInventoryValue = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$stockQty', '$sellingPrice'] } },
            totalItems: { $sum: '$stockQty' }
          }
        }
      ]);
      
      res.json({
        lowStockProducts,
        outOfStockProducts,
        totalInventoryValue: totalInventoryValue[0] || { totalValue: 0, totalItems: 0 }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate inventory report" });
    }
  });

  app.get("/api/reports/top-products", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      
      const topProducts = await Invoice.aggregate([
        { $match: { status: 'approved' } },
        { $unwind: '$items' },
        { $match: { 'items.type': 'product' } },
        {
          $group: {
            _id: '$items.productId',
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: parseInt(limit as string) },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' }
      ]);
      
      res.json(topProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate top products report" });
    }
  });

  app.get("/api/reports/employee-performance", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const employeeSales = await Invoice.aggregate([
        { $match: { status: 'approved', salesExecutiveId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$salesExecutiveId',
            totalSales: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' }
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: '_id',
            foreignField: '_id',
            as: 'employee'
          }
        },
        { $unwind: '$employee' },
        { $sort: { totalSales: -1 } }
      ]);
      
      res.json(employeeSales);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate employee performance report" });
    }
  });

  // Enhanced Sales Report with Invoice and Coupon data
  app.get("/api/reports/sales-enhanced", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const matchStage: any = { status: 'approved' };
      
      if (startDate && endDate) {
        matchStage.createdAt = { 
          $gte: new Date(startDate as string), 
          $lte: new Date(endDate as string) 
        };
      }
      
      const [invoiceStats, couponStats] = await Promise.all([
        Invoice.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              totalDiscount: { $sum: '$discountAmount' },
              avgInvoiceValue: { $avg: '$totalAmount' }
            }
          }
        ]),
        Invoice.aggregate([
          { $match: { ...matchStage, couponCode: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$couponCode',
              usageCount: { $sum: 1 },
              totalDiscount: { $sum: '$discountAmount' }
            }
          },
          { $sort: { usageCount: -1 } }
        ])
      ]);
      
      res.json({
        invoices: invoiceStats[0] || { totalInvoices: 0, totalRevenue: 0, totalDiscount: 0, avgInvoiceValue: 0 },
        coupons: couponStats
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate enhanced sales report" });
    }
  });

  // Customer Report
  app.get("/api/reports/customers", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const [
        totalCustomers,
        newCustomers,
        verifiedCustomers,
        referredCustomers,
        repeatCustomers
      ] = await Promise.all([
        RegistrationCustomer.countDocuments(),
        RegistrationCustomer.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        RegistrationCustomer.countDocuments({ isVerified: true }),
        RegistrationCustomer.countDocuments({ referralSource: { $exists: true, $nin: [null, ''] } }),
        Invoice.aggregate([
          {
            $group: {
              _id: '$customerId',
              invoiceCount: { $sum: 1 }
            }
          },
          { $match: { invoiceCount: { $gt: 1 } } },
          { $count: 'repeatCustomers' }
        ])
      ]);
      
      const customersByReferralSource = await RegistrationCustomer.aggregate([
        { $match: { referralSource: { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: '$referralSource',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      res.json({
        total: totalCustomers,
        active: verifiedCustomers,
        new: newCustomers,
        repeat: repeatCustomers[0]?.repeatCustomers || 0,
        referred: referredCustomers,
        byReferralSource: customersByReferralSource
      });
    } catch (error) {
      console.error('Customer report error:', error);
      res.status(500).json({ error: "Failed to generate customer report" });
    }
  });

  // Enhanced Inventory Report with Brand and Color Analysis
  app.get("/api/reports/inventory-enhanced", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const [brandWise, colorWise, lowStock, outOfStock, totalValue] = await Promise.all([
        Product.aggregate([
          {
            $group: {
              _id: '$brand',
              totalProducts: { $sum: 1 },
              totalStock: { $sum: '$stockQty' },
              totalValue: { $sum: { $multiply: ['$stockQty', '$sellingPrice'] } },
              avgPrice: { $avg: '$sellingPrice' }
            }
          },
          { $sort: { totalValue: -1 } }
        ]),
        Product.aggregate([
          { $unwind: '$variants' },
          {
            $group: {
              _id: '$variants.color',
              totalProducts: { $sum: 1 },
              totalStock: { $sum: '$stockQty' }
            }
          },
          { $match: { _id: { $ne: null } } },
          { $sort: { totalProducts: -1 } }
        ]),
        Product.find({
          $expr: { $lte: ['$stockQty', '$minStockLevel'] },
          stockQty: { $gt: 0 }
        }).select('name brand stockQty minStockLevel sellingPrice').sort({ stockQty: 1 }).limit(50),
        Product.find({ stockQty: 0 }).select('name brand category sellingPrice').limit(50),
        Product.aggregate([
          {
            $group: {
              _id: null,
              totalValue: { $sum: { $multiply: ['$stockQty', '$sellingPrice'] } },
              totalItems: { $sum: '$stockQty' },
              totalProducts: { $sum: 1 }
            }
          }
        ])
      ]);
      
      res.json({
        brandWise,
        colorWise,
        lowStockProducts: lowStock,
        outOfStockProducts: outOfStock,
        totalInventoryValue: totalValue[0] || { totalValue: 0, totalItems: 0, totalProducts: 0 }
      });
    } catch (error) {
      console.error('Inventory report error:', error);
      res.status(500).json({ error: "Failed to generate enhanced inventory report" });
    }
  });

  // Warranty Report
  app.get("/api/reports/warranties", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const [activeWarranties, expiringWarranties, expiredWarranties, warrantyByProduct] = await Promise.all([
        Warranty.countDocuments({ 
          status: 'active',
          endDate: { $gt: now }
        }),
        Warranty.find({
          status: 'active',
          endDate: { $gt: now, $lte: thirtyDaysFromNow }
        }).populate('customerId', 'fullName mobileNumber').sort({ endDate: 1 }).limit(100),
        Warranty.countDocuments({
          $or: [
            { status: 'expired' },
            { endDate: { $lte: now } }
          ]
        }),
        Warranty.aggregate([
          {
            $group: {
              _id: '$productName',
              count: { $sum: 1 },
              activeCount: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $eq: ['$status', 'active'] },
                      { $gt: ['$endDate', now] }
                    ]},
                    1,
                    0
                  ]
                }
              }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ])
      ]);
      
      const allWarranties = await Warranty.find({})
        .populate('customerId', 'fullName mobileNumber')
        .sort({ createdAt: -1 })
        .limit(100);
      
      res.json({
        active: activeWarranties,
        expiring: expiringWarranties,
        expiringCount: expiringWarranties.length,
        expired: expiredWarranties,
        byProduct: warrantyByProduct,
        recentWarranties: allWarranties
      });
    } catch (error) {
      console.error('Warranty report error:', error);
      res.status(500).json({ error: "Failed to generate warranty report" });
    }
  });

  // Feedback Report
  app.get("/api/reports/feedback", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const [ratingStats, typeStats, statusStats, priorityStats, recentFeedback] = await Promise.all([
        Feedback.aggregate([
          { $match: { rating: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Feedback.aggregate([
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              avgRating: { $avg: '$rating' }
            }
          }
        ]),
        Feedback.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        Feedback.aggregate([
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 }
            }
          }
        ]),
        Feedback.find({})
          .populate('customerId', 'fullName mobileNumber')
          .populate('assignedTo', 'name role')
          .sort({ createdAt: -1 })
          .limit(50)
      ]);
      
      const avgRating = await Feedback.aggregate([
        { $match: { rating: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalRated: { $sum: 1 }
          }
        }
      ]);
      
      const complaints = await Feedback.countDocuments({ type: 'complaint' });
      const openComplaints = await Feedback.countDocuments({ 
        type: 'complaint', 
        status: { $in: ['open', 'in_progress'] } 
      });
      
      res.json({
        ratingDistribution: ratingStats,
        byType: typeStats,
        byStatus: statusStats,
        byPriority: priorityStats,
        averageRating: avgRating[0]?.avgRating || 0,
        totalRated: avgRating[0]?.totalRated || 0,
        totalComplaints: complaints,
        openComplaints: openComplaints,
        recentFeedback: recentFeedback
      });
    } catch (error) {
      console.error('Feedback report error:', error);
      res.status(500).json({ error: "Failed to generate feedback report" });
    }
  });

  // Dashboard Overview - Comprehensive Analytics
  app.get("/api/reports/dashboard", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const [
        totalSales,
        totalInvoices,
        lowStockCount,
        activeWarranties,
        openComplaints,
        newCustomers
      ] = await Promise.all([
        Invoice.aggregate([
          { $match: { status: 'approved', createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Invoice.countDocuments({ status: 'approved', createdAt: { $gte: thirtyDaysAgo } }),
        Product.countDocuments({ $expr: { $lte: ['$stockQty', '$minStockLevel'] } }),
        Warranty.countDocuments({ status: 'active', endDate: { $gt: now } }),
        Feedback.countDocuments({ type: 'complaint', status: { $in: ['open', 'in_progress'] } }),
        RegistrationCustomer.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
      ]);
      
      res.json({
        totalSales: totalSales[0]?.total || 0,
        totalInvoices,
        lowStockCount,
        activeWarranties,
        openComplaints,
        newCustomers
      });
    } catch (error) {
      console.error('Dashboard report error:', error);
      res.status(500).json({ error: "Failed to generate dashboard report" });
    }
  });

  // Email Report Endpoints
  app.get("/api/reports/email/preview", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const reportData = await generateDailyReportData();
      const htmlContent = formatDailyReportHTML(reportData);
      
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    } catch (error) {
      console.error('Email preview error:', error);
      res.status(500).json({ error: "Failed to generate email preview" });
    }
  });

  app.post("/api/reports/email/send", requireAuth, requirePermission('reports', 'create'), async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      
      const result = await sendDailyReportEmail(email);
      
      if (result.success) {
        await logActivity({
          userId: (req as any).session.userId,
          userName: (req as any).session.userName,
          userRole: (req as any).session.userRole,
          action: 'create',
          resource: 'other',
          description: `Daily email report sent to ${email}`,
        });
        
        res.json({ 
          success: true, 
          message: "Daily report email has been queued for sending",
          note: "Email integration (SendGrid/Resend) must be configured for actual email delivery" 
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({ error: "Failed to send email report" });
    }
  });

  app.get("/api/reports/email/data", requireAuth, requirePermission('reports', 'read'), async (req, res) => {
    try {
      const reportData = await generateDailyReportData();
      res.json(reportData);
    } catch (error) {
      console.error('Email data error:', error);
      res.status(500).json({ error: "Failed to generate report data" });
    }
  });

  // New Customer Registration System Routes
  // Customer registration with OTP verification
  app.post("/api/registration/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      
      // Check if mobile number already exists
      const existing = await RegistrationCustomer.findOne({ mobileNumber: validatedData.mobileNumber });
      if (existing) {
        return res.status(400).json({ error: "Mobile number already registered" });
      }
      
      // Generate reference code
      const stateCodeMap: Record<string, string> = {
        "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
        "Chhattisgarh": "CG", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
        "Himachal Pradesh": "HP", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL",
        "Madhya Pradesh": "MP", "Maharashtra": "MH", "Manipur": "MN", "Meghalaya": "ML",
        "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OD", "Punjab": "PB",
        "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TS",
        "Tripura": "TR", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB"
      };
      
      const stateCode = stateCodeMap[validatedData.state] || validatedData.state.substring(0, 2).toUpperCase();
      
      // Generate reference code by finding the next available number (reuse deleted IDs)
      const customerCount = await RegistrationCustomer.countDocuments({ referenceCode: new RegExp(`^CUST-${stateCode}-`) });
      let nextNumber = customerCount + 1;
      let referenceCode = `CUST-${stateCode}-${String(nextNumber).padStart(6, '0')}`;
      
      // Check if this ID already exists (in case of deletions), if so try next numbers
      while (await RegistrationCustomer.findOne({ referenceCode })) {
        nextNumber++;
        referenceCode = `CUST-${stateCode}-${String(nextNumber).padStart(6, '0')}`;
      }
      
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Capture who registered the customer (if authenticated)
      const registeredBy = (req as any).user ? (req as any).user.name : null;
      const registeredByRole = (req as any).user ? (req as any).user.role : null;
      
      const customer = await RegistrationCustomer.create({
        ...validatedData,
        referenceCode,
        isVerified: false,
        otp,
        otpExpiresAt,
        registeredBy,
        registeredByRole
      });
      
      // Send OTP via WhatsApp
      console.log(`OTP for ${customer.mobileNumber}: ${otp}`);
      const whatsappResult = await sendWhatsAppOTP({
        to: customer.mobileNumber,
        otp
      });
      
      if (!whatsappResult.success) {
        console.warn('⚠️ WhatsApp OTP send failed:', whatsappResult.error);
      }
      
      res.json({ 
        customerId: customer._id.toString(),
        message: "OTP sent successfully",
        whatsappSent: whatsappResult.success,
        whatsappError: whatsappResult.error
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register customer" });
    }
  });
  
  // Verify OTP
  app.post("/api/registration/verify-otp", async (req, res) => {
    try {
      const { customerId, otp } = req.body;
      
      const customer = await RegistrationCustomer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      if (!customer.otp || !customer.otpExpiresAt) {
        return res.status(400).json({ error: "No OTP found for this customer" });
      }
      
      if (new Date() > customer.otpExpiresAt) {
        return res.status(400).json({ error: "OTP has expired" });
      }
      
      if (customer.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }
      
      customer.isVerified = true;
      customer.otp = null;
      customer.otpExpiresAt = null;
      await customer.save();
      
      // Log customer creation activity (after verification)
      await logActivity({
        userId: customer._id.toString(),
        userName: customer.fullName,
        userRole: 'Customer',
        action: 'create',
        resource: 'customer',
        resourceId: customer._id.toString(),
        description: `New customer registered: ${customer.fullName}`,
        details: { referenceCode: customer.referenceCode, mobile: customer.mobileNumber },
        ipAddress: req.ip,
      });
      
      res.json({ 
        success: true,
        customer: {
          id: customer._id.toString(),
          referenceCode: customer.referenceCode,
          fullName: customer.fullName,
          mobileNumber: customer.mobileNumber,
          alternativeNumber: customer.alternativeNumber,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          taluka: customer.taluka,
          district: customer.district,
          state: customer.state,
          pinCode: customer.pinCode,
          referralSource: customer.referralSource,
          isVerified: customer.isVerified,
          createdAt: customer.createdAt,
        },
        message: "Customer verified successfully"
      });
    } catch (error) {
      res.status(400).json({ error: "OTP verification failed" });
    }
  });
  
  // Add vehicle to customer
  app.post("/api/registration/vehicles", async (req, res) => {
    try {
      // Normalize selectedParts to handle both old (string[]) and new ({partId, quantity}[]) formats
      if (req.body.selectedParts) {
        req.body.selectedParts = normalizeSelectedParts(req.body.selectedParts);
      }
      
      const validatedData = insertVehicleSchema.parse(req.body);
      
      // Check if customer exists
      const customer = await RegistrationCustomer.findById(validatedData.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Check if vehicle number already exists (only if vehicle number is provided)
      if (validatedData.vehicleNumber) {
        const existing = await RegistrationVehicle.findOne({ vehicleNumber: validatedData.vehicleNumber });
        if (existing) {
          return res.status(400).json({ error: "Vehicle number already registered" });
        }
      }
      
      // Generate unique vehicle ID (VEH001, VEH002, etc.)
      const vehicleSeq = await getNextSequence('vehicle');
      const vehicleId = `VEH${String(vehicleSeq).padStart(3, '0')}`;
      
      const vehicle = await RegistrationVehicle.create({
        ...validatedData,
        vehicleId
      });
      
      res.json({ 
        vehicle: {
          id: vehicle._id.toString(),
          vehicleId: vehicle.vehicleId,
          customerId: vehicle.customerId,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleBrand: vehicle.vehicleBrand,
          vehicleModel: vehicle.vehicleModel,
          customModel: vehicle.customModel,
          variant: vehicle.variant,
          color: vehicle.color,
          yearOfPurchase: vehicle.yearOfPurchase,
          vehiclePhoto: vehicle.vehiclePhoto,
          isNewVehicle: vehicle.isNewVehicle,
          chassisNumber: vehicle.chassisNumber,
          selectedParts: vehicle.selectedParts,
          warrantyCards: vehicle.warrantyCards,
          createdAt: vehicle.createdAt,
        },
        customer: {
          id: customer._id.toString(),
          referenceCode: customer.referenceCode,
          fullName: customer.fullName,
        },
        message: "Vehicle registered successfully"
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register vehicle" });
    }
  });
  
  // Complete registration - Send welcome message
  app.post("/api/registration/complete", async (req, res) => {
    try {
      const { customerId } = req.body;
      
      const customer = await RegistrationCustomer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Get customer's vehicles
      const vehicles = await RegistrationVehicle.find({ customerId: customer._id });
      
      // Create service visit in "inquired" status for each vehicle
      for (const vehicle of vehicles) {
        const existingVisit = await ServiceVisit.findOne({
          customerId: customer._id,
          vehicleReg: vehicle.vehicleNumber || vehicle.vehicleId,
          status: 'inquired'
        });
        
        if (!existingVisit) {
          await ServiceVisit.create({
            customerId: customer._id,
            vehicleReg: vehicle.vehicleNumber || vehicle.vehicleId,
            status: 'inquired',
            handlerIds: [],
            notes: 'Auto-created from customer registration'
          });
        }
      }
      
      // Send WhatsApp welcome message with customer ID
      const whatsappResult = await sendWhatsAppWelcome({
        to: customer.mobileNumber,
        templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'crmtestingcustomer',
        customerId: customer.referenceCode
      });
      
      if (!whatsappResult.success) {
        console.warn('⚠️ WhatsApp welcome message send failed:', whatsappResult.error);
      } else {
        console.log('✅ WhatsApp welcome message sent successfully to', customer.mobileNumber);
      }
      
      res.json({ 
        success: true,
        whatsappSent: whatsappResult.success,
        whatsappError: whatsappResult.error,
        message: "Registration completed successfully"
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to complete registration" });
    }
  });

  // Get customer with vehicles
  app.get("/api/registration/customers/:id", async (req, res) => {
    try {
      const customer = await RegistrationCustomer.findById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const vehicles = await RegistrationVehicle.find({ customerId: req.params.id });
      
      res.json({ 
        customer: {
          id: customer._id.toString(),
          referenceCode: customer.referenceCode,
          fullName: customer.fullName,
          mobileNumber: customer.mobileNumber,
          alternativeNumber: customer.alternativeNumber,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          taluka: customer.taluka,
          district: customer.district,
          state: customer.state,
          pinCode: customer.pinCode,
          referralSource: customer.referralSource,
          isVerified: customer.isVerified,
          registeredBy: customer.registeredBy,
          registeredByRole: customer.registeredByRole,
          createdAt: customer.createdAt,
        },
        vehicles: vehicles.map(v => ({
          id: v._id.toString(),
          vehicleId: v.vehicleId,
          customerId: v.customerId,
          vehicleNumber: v.vehicleNumber,
          vehicleBrand: v.vehicleBrand,
          vehicleModel: v.vehicleModel,
          customModel: v.customModel,
          variant: v.variant,
          color: v.color,
          yearOfPurchase: v.yearOfPurchase,
          vehiclePhoto: v.vehiclePhoto,
          isNewVehicle: v.isNewVehicle,
          chassisNumber: v.chassisNumber,
          selectedParts: v.selectedParts,
          createdAt: v.createdAt,
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });
  
  // Get all registered customers with filtering
  app.get("/api/registration/customers", async (req, res) => {
    try {
      const { city, district, state, isVerified } = req.query;
      const filters: any = {};
      
      if (city) filters.city = city as string;
      if (district) filters.district = district as string;
      if (state) filters.state = state as string;
      if (isVerified !== undefined) filters.isVerified = isVerified === 'true';
      
      const customers = await RegistrationCustomer.find(filters).sort({ createdAt: -1 });
      
      res.json(customers.map(c => ({
        id: c._id.toString(),
        referenceCode: c.referenceCode,
        fullName: c.fullName,
        mobileNumber: c.mobileNumber,
        alternativeNumber: c.alternativeNumber,
        email: c.email,
        address: c.address,
        city: c.city,
        taluka: c.taluka,
        district: c.district,
        state: c.state,
        pinCode: c.pinCode,
        referralSource: c.referralSource,
        isVerified: c.isVerified,
        registeredBy: c.registeredBy,
        registeredByRole: c.registeredByRole,
        createdAt: c.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });
  
  // Get vehicles by customer
  app.get("/api/registration/customers/:id/vehicles", async (req, res) => {
    try {
      const vehicles = await RegistrationVehicle.find({ customerId: req.params.id });
      res.json(vehicles.map(v => ({
        id: v._id.toString(),
        vehicleId: v.vehicleId,
        customerId: v.customerId,
        vehicleNumber: v.vehicleNumber,
        vehicleBrand: v.vehicleBrand,
        vehicleModel: v.vehicleModel,
        customModel: v.customModel,
        variant: v.variant,
        color: v.color,
        yearOfPurchase: v.yearOfPurchase,
        vehiclePhoto: v.vehiclePhoto,
        isNewVehicle: v.isNewVehicle,
        chassisNumber: v.chassisNumber,
        selectedParts: v.selectedParts,
        warrantyCards: v.warrantyCards,
        createdAt: v.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });
  
  // Get all vehicles (for search functionality)
  app.get("/api/registration/vehicles", async (req, res) => {
    try {
      const vehicles = await RegistrationVehicle.find({}).sort({ createdAt: -1 });
      res.json(vehicles.map(v => ({
        id: v._id.toString(),
        vehicleId: v.vehicleId,
        customerId: v.customerId,
        vehicleNumber: v.vehicleNumber,
        vehicleBrand: v.vehicleBrand,
        vehicleModel: v.vehicleModel,
        customModel: v.customModel,
        variant: v.variant,
        color: v.color,
        yearOfPurchase: v.yearOfPurchase,
        vehiclePhoto: v.vehiclePhoto,
        isNewVehicle: v.isNewVehicle,
        chassisNumber: v.chassisNumber,
        selectedParts: v.selectedParts,
        warrantyCards: v.warrantyCards,
        createdAt: v.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });
  
  // Update vehicle
  app.patch("/api/registration/vehicles/:id", async (req, res) => {
    try {
      const vehicle = await RegistrationVehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json({
        id: vehicle._id.toString(),
        vehicleId: vehicle.vehicleId,
        customerId: vehicle.customerId,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleBrand: vehicle.vehicleBrand,
        vehicleModel: vehicle.vehicleModel,
        customModel: vehicle.customModel,
        variant: vehicle.variant,
        color: vehicle.color,
        yearOfPurchase: vehicle.yearOfPurchase,
        vehiclePhoto: vehicle.vehiclePhoto,
        isNewVehicle: vehicle.isNewVehicle,
        chassisNumber: vehicle.chassisNumber,
        selectedParts: vehicle.selectedParts,
        warrantyCards: vehicle.warrantyCards,
        createdAt: vehicle.createdAt,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to update vehicle" });
    }
  });
  
  // Delete vehicle
  app.delete("/api/registration/vehicles/:id", async (req, res) => {
    try {
      // First find the vehicle to get the customerId and vehicle registration
      const vehicle = await RegistrationVehicle.findById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      const customerId = vehicle.customerId;
      const vehicleReg = vehicle.vehicleNumber || vehicle.vehicleId;
      
      // Count how many vehicles this customer has
      const vehicleCount = await RegistrationVehicle.countDocuments({ customerId });
      
      // Count service visits related to this vehicle before deletion
      const serviceVisitCount = await ServiceVisit.countDocuments({
        $or: [
          { vehicleReg: vehicleReg },
          { vehicleReg: vehicle.vehicleNumber },
          { vehicleReg: vehicle.vehicleId }
        ]
      });
      
      // Cascade delete all service visits related to this vehicle
      await ServiceVisit.deleteMany({
        $or: [
          { vehicleReg: vehicleReg },
          { vehicleReg: vehicle.vehicleNumber },
          { vehicleReg: vehicle.vehicleId }
        ]
      });
      
      // Delete the vehicle
      await RegistrationVehicle.findByIdAndDelete(req.params.id);
      
      // If this was the last vehicle, also delete the customer
      if (vehicleCount === 1) {
        await RegistrationCustomer.findByIdAndDelete(customerId);
        res.json({ 
          success: true, 
          customerDeleted: true,
          serviceVisitsDeleted: serviceVisitCount 
        });
      } else {
        res.json({ 
          success: true, 
          customerDeleted: false,
          serviceVisitsDeleted: serviceVisitCount
        });
      }
    } catch (error) {
      res.status(400).json({ error: "Failed to delete vehicle" });
    }
  });
  
  // Resend OTP
  app.post("/api/registration/resend-otp", async (req, res) => {
    try {
      const { customerId } = req.body;
      
      const customer = await RegistrationCustomer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      if (customer.isVerified) {
        return res.status(400).json({ error: "Customer already verified" });
      }
      
      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      customer.otp = otp;
      customer.otpExpiresAt = otpExpiresAt;
      await customer.save();
      
      // TODO: Send OTP via SMS/WhatsApp
      console.log(`New OTP for ${customer.mobileNumber}: ${otp}`);
      
      res.json({ 
        message: "OTP resent successfully"
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to resend OTP" });
    }
  });
  
  // Update customer (Admin only)
  app.patch("/api/registration/customers/:id", requireAuth, requirePermission("customers", "update"), async (req, res) => {
    try {
      const customer = await RegistrationCustomer.findById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Update customer fields
      const updateData = req.body;
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== '_id' && key !== 'referenceCode') {
          (customer as any)[key] = updateData[key];
        }
      });
      
      await customer.save();
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'update',
        resource: 'customer',
        resourceId: customer._id.toString(),
        description: `Updated customer: ${customer.fullName}`,
        details: { referenceCode: customer.referenceCode },
        ipAddress: req.ip,
      });
      
      res.json({
        id: customer._id.toString(),
        referenceCode: customer.referenceCode,
        fullName: customer.fullName,
        mobileNumber: customer.mobileNumber,
        alternativeNumber: customer.alternativeNumber,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        taluka: customer.taluka,
        district: customer.district,
        state: customer.state,
        pinCode: customer.pinCode,
        isVerified: customer.isVerified,
        createdAt: customer.createdAt,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to update customer" });
    }
  });
  
  // Delete customer (Admin only) with cascade deletion
  app.delete("/api/registration/customers/:id", requireAuth, requirePermission("customers", "delete"), async (req, res) => {
    try {
      const customer = await RegistrationCustomer.findById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Count related records before deletion for logging
      const [vehicleCount, serviceVisitCount, supportTicketCount] = await Promise.all([
        RegistrationVehicle.countDocuments({ customerId: req.params.id }),
        ServiceVisit.countDocuments({ customerId: req.params.id }),
        SupportTicket.countDocuments({ customerId: req.params.id })
      ]);
      
      // Cascade delete all related records
      await Promise.all([
        // Delete all vehicles associated with this customer
        RegistrationVehicle.deleteMany({ customerId: req.params.id }),
        // Delete all service visits associated with this customer
        ServiceVisit.deleteMany({ customerId: req.params.id }),
        // Delete all support tickets associated with this customer
        SupportTicket.deleteMany({ customerId: req.params.id })
      ]);
      
      // Delete the customer
      await RegistrationCustomer.findByIdAndDelete(req.params.id);
      
      await logActivity({
        userId: (req as any).session.userId,
        userName: (req as any).session.userName,
        userRole: (req as any).session.userRole,
        action: 'delete',
        resource: 'customer',
        resourceId: customer._id.toString(),
        description: `Deleted customer: ${customer.fullName} (cascade deleted ${vehicleCount} vehicles, ${serviceVisitCount} service visits, ${supportTicketCount} support tickets)`,
        details: { 
          referenceCode: customer.referenceCode,
          cascadeDeleted: {
            vehicles: vehicleCount,
            serviceVisits: serviceVisitCount,
            supportTickets: supportTicketCount
          }
        },
        ipAddress: req.ip,
      });
      
      res.json({ 
        success: true, 
        message: `Customer deleted successfully along with ${vehicleCount} vehicles, ${serviceVisitCount} service visits, and ${supportTicketCount} support tickets` 
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete customer" });
    }
  });

  app.get("/api/activity-logs", requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const { limit = 50, role, resource, startDate, endDate } = req.query;
      
      const query: any = {};
      
      if (role) {
        query.userRole = role;
      }
      
      if (resource) {
        query.resource = resource;
      }
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate as string);
        }
      }
      
      const activities = await ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .lean();
      
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.post("/api/activity-logs", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      const { action, resource, resourceId, description, details } = req.body;
      
      const activity = await ActivityLog.create({
        userId,
        userName,
        userRole,
        action,
        resource,
        resourceId,
        description,
        details,
        ipAddress: req.ip,
      });
      
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity log" });
    }
  });

  // Migration endpoint to add vehicleId to existing vehicles
  app.post("/api/migrate/vehicle-ids", requireAuth, requireRole('Admin'), async (req, res) => {
    try {
      const vehiclesWithoutId = await RegistrationVehicle.find({ 
        $or: [
          { vehicleId: { $exists: false } },
          { vehicleId: null },
          { vehicleId: '' }
        ]
      });
      
      let updated = 0;
      for (const vehicle of vehiclesWithoutId) {
        const vehicleSeq = await getNextSequence('vehicle');
        const vehicleId = `VEH${String(vehicleSeq).padStart(3, '0')}`;
        
        await RegistrationVehicle.updateOne(
          { _id: vehicle._id },
          { $set: { vehicleId } }
        );
        updated++;
      }
      
      res.json({ 
        success: true, 
        message: `Updated ${updated} vehicles with Vehicle IDs`,
        updated 
      });
    } catch (error) {
      res.status(500).json({ error: "Migration failed" });
    }
  });

  // ==================== INVOICES ====================
  
  // Get all invoices
  app.get("/api/invoices", requireAuth, requirePermission('invoices', 'read'), async (req, res) => {
    try {
      const { status, paymentStatus, customerId, fromDate, toDate, search } = req.query;
      const userRole = (req as any).session.userRole;
      const userId = (req as any).session.userId;
      
      let query: any = {};
      
      // Sales Executive can only see their own invoices
      if (userRole === 'Sales Executive') {
        query.createdBy = userId;
      }
      
      if (status) {
        query.status = status;
      }
      
      if (paymentStatus) {
        query.paymentStatus = paymentStatus;
      }
      
      if (customerId) {
        query.customerId = customerId;
      }
      
      if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate as string);
        if (toDate) query.createdAt.$lte = new Date(toDate as string);
      }
      
      // Comprehensive search across multiple fields
      if (search && typeof search === 'string') {
        const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(sanitizedSearch, 'i');
        
        query.$or = [
          { invoiceNumber: searchRegex },
          { 'customerDetails.fullName': searchRegex },
          { 'customerDetails.mobileNumber': searchRegex },
          { 'customerDetails.email': searchRegex },
          { 'customerDetails.referenceCode': searchRegex },
          { 'vehicleDetails.vehicleNumber': searchRegex },
          { 'vehicleDetails.vehicleBrand': searchRegex },
          { 'vehicleDetails.vehicleModel': searchRegex },
        ];
      }
      
      const invoices = await Invoice.find(query)
        .populate('customerId', 'fullName mobileNumber email')
        .populate('createdBy', 'name email')
        .populate('salesExecutiveId', 'name')
        .populate('approvalStatus.approvedBy', 'name')
        .populate('approvalStatus.rejectedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();
      
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });
  
  // Get single invoice
  app.get("/api/invoices/:id", requireAuth, requirePermission('invoices', 'read'), async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id)
        .populate('customerId')
        .populate('createdBy', 'name email')
        .populate('salesExecutiveId', 'name')
        .populate('serviceVisitId')
        .populate('orderId')
        .populate('items.productId')
        .populate('approvalStatus.approvedBy', 'name')
        .populate('approvalStatus.rejectedBy', 'name')
        .lean();
      
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });
  
  // Create invoice from service visit
  // Create manual invoice
  app.post("/api/invoices/manual/create", requireAuth, requirePermission('invoices', 'create'), async (req, res) => {
    try {
      const { customerId } = req.body;
      
      const customer = await RegistrationCustomer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Get first completed service for this customer
      const serviceVisit = await ServiceVisit.findOne({ 
        customerId, 
        status: 'completed' 
      }).populate('customerId');
      
      if (!serviceVisit) {
        return res.status(404).json({ error: "No completed service found for this customer" });
      }
      
      // Get vehicle
      const vehicle = await RegistrationVehicle.findOne({ 
        customerId, 
        $or: [
          { vehicleId: serviceVisit.vehicleReg },
          { vehicleNumber: serviceVisit.vehicleReg }
        ]
      }).lean() as any;
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      const invoiceSeq = await getNextSequence('invoice');
      const invoiceNumber = `INV/${new Date().getFullYear()}/${String(invoiceSeq).padStart(4, '0')}`;
      
      const invoice = new Invoice({
        invoiceNumber,
        customerId,
        customerDetails: {
          fullName: customer.fullName,
          mobileNumber: customer.mobileNumber,
          email: customer.email,
          address: customer.address,
        },
        vehicleDetails: [{
          vehicleNumber: vehicle.vehicleNumber,
          vehicleBrand: vehicle.vehicleBrand,
          vehicleModel: vehicle.vehicleModel,
        }],
        items: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        status: 'draft',
        paymentStatus: 'unpaid',
        createdBy: (req as any).session.userName || 'System',
      });
      
      await invoice.save();
      res.json(invoice);
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      res.status(500).json({ error: "Failed to create manual invoice" });
    }
  });

  app.post("/api/invoices/from-service-visit", requireAuth, requirePermission('invoices', 'create'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      const { 
        serviceVisitId, 
        items, 
        couponCode,
        taxRate = 18,
        notes,
        terms
      } = req.body;
      
      // Fetch service visit
      const serviceVisit = await ServiceVisit.findById(serviceVisitId).populate('customerId');
      if (!serviceVisit) {
        return res.status(404).json({ error: "Service visit not found" });
      }
      
      if (!serviceVisit.customerId) {
        return res.status(400).json({ error: "Service visit has no associated customer" });
      }
      
      if (serviceVisit.status !== 'completed') {
        return res.status(400).json({ error: "Can only generate invoice for completed service visits" });
      }
      
      // Fetch only the specific vehicle for this service visit
      const customer = serviceVisit.customerId as any;
      const serviceVehicle = await RegistrationVehicle.findOne({ 
        customerId: customer._id.toString(),
        $or: [
          { vehicleId: serviceVisit.vehicleReg },
          { vehicleNumber: serviceVisit.vehicleReg }
        ]
      }).lean() as any;
      
      if (!serviceVehicle) {
        return res.status(404).json({ error: "Vehicle not found for this service visit" });
      }
      
      // Build customer details object with ALL fields
      const customerDetails = {
        referenceCode: customer.referenceCode,
        fullName: customer.fullName,
        mobileNumber: customer.mobileNumber,
        alternativeNumber: customer.alternativeNumber,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        taluka: customer.taluka,
        district: customer.district,
        state: customer.state,
        pinCode: customer.pinCode,
        referralSource: customer.referralSource,
        isVerified: customer.isVerified,
        registrationDate: customer.createdAt,
      };
      
      // Build vehicle details array with only the service vehicle
      // Extract partIds from selectedParts (which may be objects with {partId, quantity} or strings)
      const normalizedParts = normalizeSelectedParts(serviceVehicle.selectedParts);
      const partIds = normalizedParts.map(p => p.partId);
      
      const vehicleDetails = [{
        vehicleId: serviceVehicle.vehicleId,
        vehicleNumber: serviceVehicle.vehicleNumber,
        vehicleBrand: serviceVehicle.vehicleBrand,
        vehicleModel: serviceVehicle.vehicleModel,
        customModel: serviceVehicle.customModel,
        variant: serviceVehicle.variant,
        color: serviceVehicle.color,
        yearOfPurchase: serviceVehicle.yearOfPurchase,
        vehiclePhoto: serviceVehicle.vehiclePhoto,
        isNewVehicle: serviceVehicle.isNewVehicle,
        chassisNumber: serviceVehicle.chassisNumber,
        selectedParts: partIds,
        vehicleRegistrationDate: serviceVehicle.createdAt,
      }];
      
      // Calculate subtotal
      const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
      
      // Apply coupon if provided
      let discountAmount = 0;
      let couponId = null;
      let discountType = 'none';
      let discountValue = 0;
      
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
        if (coupon) {
          const validation = coupon.isValid(customer._id.toString(), subtotal);
          if (validation.valid) {
            discountAmount = coupon.calculateDiscount(subtotal);
            couponId = coupon._id;
            discountType = coupon.discountType;
            discountValue = coupon.discountValue;
          }
        }
      }
      
      // Calculate total (tax is already included in item totals via per-item GST)
      const totalAmount = subtotal - discountAmount;
      const taxAmount = 0;
      
      // Create invoice (using new + save to trigger pre-save hooks)
      const invoice = new Invoice({
        serviceVisitId,
        customerId: customer._id,
        customerDetails,
        vehicleDetails,
        items,
        subtotal,
        discountType,
        discountValue,
        discountAmount,
        couponCode: couponCode?.toUpperCase(),
        couponId,
        taxRate,
        taxAmount,
        totalAmount,
        dueAmount: totalAmount,
        createdBy: userId,
        status: 'pending_approval',
        notes,
        terms
      });
      
      await invoice.save();
      
      // Update coupon usage if applicable
      if (couponId) {
        await Coupon.findByIdAndUpdate(couponId, {
          $inc: { usedCount: 1 },
          $push: {
            usageHistory: {
              invoiceId: invoice._id,
              customerId: serviceVisit.customerId._id,
              discountApplied: discountAmount
            }
          }
        });
      }
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'create',
        resource: 'other',
        resourceId: invoice._id.toString(),
        description: `Created invoice ${invoice.invoiceNumber} for ${customerDetails.fullName} - Vehicle: ${serviceVehicle.vehicleNumber}`,
        ipAddress: req.ip,
      });
      
      res.json(invoice);
    } catch (error) {
      console.error('Invoice creation error:', error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });
  
  // Approve invoice
  app.post("/api/invoices/:id/approve", requireAuth, requirePermission('invoices', 'approve'), async (req, res) => {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('🔄 STARTING INVOICE APPROVAL PROCESS');
      console.log('='.repeat(80));
      
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      console.log('📋 Request Details:');
      console.log('   Invoice ID:', req.params.id);
      console.log('   User ID:', userId);
      console.log('   User Name:', userName);
      console.log('   User Role:', userRole);
      console.log('   Request IP:', req.ip);
      
      const invoice = await Invoice.findById(req.params.id)
        .populate('customerId')
        .populate('serviceVisitId');
      if (!invoice) {
        console.log('❌ Invoice not found:', req.params.id);
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      console.log('✅ Invoice found:');
      console.log('   Invoice Number:', invoice.invoiceNumber);
      console.log('   Current Status:', invoice.status);
      console.log('   Customer:', invoice.customerDetails?.fullName);
      console.log('   Customer Phone:', invoice.customerDetails?.mobileNumber);
      console.log('   Total Amount: ₹', invoice.totalAmount);
      
      if (invoice.status !== 'pending_approval') {
        console.log(`❌ Invoice approval failed: Invoice ${req.params.id} has status "${invoice.status}", expected "pending_approval"`);
        return res.status(400).json({ 
          error: "Invoice is not pending approval", 
          currentStatus: invoice.status 
        });
      }
      
      console.log('📝 Updating invoice status to "approved"...');
      invoice.status = 'approved';
      invoice.approvalStatus = {
        approvedBy: userId,
        approvedAt: new Date()
      } as any;
      
      console.log('🔐 Generating secure PDF access token...');
      // Generate secure access token for WhatsApp PDF delivery BEFORE PDF generation
      const crypto = await import('crypto');
      invoice.pdfAccessToken = crypto.randomBytes(32).toString('hex');
      // Token expires in 7 days
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 7);
      invoice.pdfTokenExpiry = tokenExpiry;
      
      console.log('   Token generated:', invoice.pdfAccessToken.substring(0, 12) + '...');
      console.log('   Token expires:', tokenExpiry.toISOString());
      
      console.log('💾 Saving invoice to database...');
      await invoice.save();
      console.log('✅ Invoice saved successfully');
      
      // Generate PDF
      console.log('📄 Starting PDF generation...');
      try {
        // Fetch HSN numbers for all products in invoice items
        console.log('   Fetching HSN numbers for products...');
        const hsnMap = new Map<string, string | null>();
        
        for (const item of invoice.items) {
          if (item.productId && !hsnMap.has(item.productId.toString())) {
            const product = await Product.findById(item.productId).lean();
            hsnMap.set(item.productId.toString(), product?.hsnNumber || null);
          }
        }
        
        console.log(`   Found HSN data for ${hsnMap.size} products`);

        const pdfData = {
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt,
          dueDate: invoice.dueDate,
          customerDetails: invoice.customerDetails,
          vehicleDetails: invoice.vehicleDetails || [],
          items: invoice.items.map((item: any) => ({
            name: item.name,
            hsnNumber: item.productId ? hsnMap.get(item.productId.toString()) : null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            hasGst: item.hasGst,
            gstAmount: item.gstAmount,
          })),
          subtotal: invoice.subtotal,
          discountType: invoice.discountType,
          discountValue: invoice.discountValue,
          discountAmount: invoice.discountAmount,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          dueAmount: invoice.dueAmount,
          notes: invoice.notes,
          terms: invoice.terms,
        };

        console.log('   PDF Data prepared, generating file...');
        const pdfPath = await generateInvoicePDF(pdfData);
        invoice.pdfPath = pdfPath;
        await invoice.save();
        console.log('✅ PDF generated and saved to:', pdfPath);
      } catch (pdfError) {
        console.error('❌ PDF generation error:', pdfError);
        console.error('   Error details:', pdfError instanceof Error ? pdfError.message : String(pdfError));
      }
      
      // Create warranties for items that have warranty enabled
      console.log('🛡️ Creating warranties for items with warranty...');
      try {
        const warrantyPromises = invoice.items
          .filter((item: any) => item.hasWarranty && item.type === 'product')
          .map(async (item: any) => {
            const product = await Product.findById(item.productId);
            if (!product || !product.warranty) return null;

            const durationMonths = parseInt(product.warranty.match(/\d+/)?.[0] || '12');
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + durationMonths);

            return Warranty.create({
              invoiceId: invoice._id,
              customerId: invoice.customerId,
              productId: item.productId,
              productName: item.name,
              warrantyType: 'manufacturer',
              durationMonths,
              startDate,
              endDate,
              coverage: product.warranty,
              status: 'active'
            });
          });

        await Promise.all(warrantyPromises);
        console.log('✅ Warranties created successfully');
      } catch (warrantyError) {
        console.error('❌ Warranty creation error:', warrantyError);
      }
      
      // Send WhatsApp and Email notifications with PDF (stub implementation)
      console.log('📤 Sending WhatsApp and Email notifications...');
      console.log('   Environment check:');
      console.log('   - APP_URL:', process.env.APP_URL || 'NOT SET (will use fallback)');
      console.log('   - REPLIT_DEV_DOMAIN:', process.env.REPLIT_DEV_DOMAIN || 'NOT SET');
      console.log('   - NODE_ENV:', process.env.NODE_ENV);
      
      try {
        await sendInvoiceNotifications(invoice);
        console.log('✅ Notifications sent successfully');
      } catch (notificationError) {
        console.error('❌ Notification sending error:', notificationError);
        console.error('   Error details:', notificationError instanceof Error ? notificationError.message : String(notificationError));
        console.error('   Stack:', notificationError instanceof Error ? notificationError.stack : 'No stack trace');
      }
      
      console.log('📊 Logging activity...');
      try {
        await logActivity({
          userId,
          userName,
          userRole,
          action: 'approve',
          resource: 'other',
          resourceId: invoice._id.toString(),
          description: `Approved invoice ${invoice.invoiceNumber}`,
          ipAddress: req.ip,
        });
        console.log('✅ Activity logged successfully');
      } catch (activityError) {
        console.error('❌ Activity logging error:', activityError);
      }
      
      console.log('='.repeat(80));
      console.log('✅ INVOICE APPROVAL PROCESS COMPLETED SUCCESSFULLY');
      console.log('   Invoice Number:', invoice.invoiceNumber);
      console.log('   Status:', invoice.status);
      console.log('   Total Amount: ₹', invoice.totalAmount);
      console.log('='.repeat(80) + '\n');
      
      res.json(invoice);
    } catch (error) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ INVOICE APPROVAL PROCESS FAILED');
      console.error('='.repeat(80));
      console.error('Error:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('='.repeat(80) + '\n');
      res.status(500).json({ error: "Failed to approve invoice", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  // Reject invoice
  app.post("/api/invoices/:id/reject", requireAuth, requirePermission('invoices', 'reject'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      const { reason } = req.body;
      
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (invoice.status !== 'pending_approval') {
        return res.status(400).json({ error: "Invoice is not pending approval" });
      }
      
      invoice.status = 'rejected';
      invoice.approvalStatus = {
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason
      } as any;
      
      await invoice.save();
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'reject',
        resource: 'other',
        resourceId: invoice._id.toString(),
        description: `Rejected invoice ${invoice.invoiceNumber}`,
        ipAddress: req.ip,
      });
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject invoice" });
    }
  });
  
  // Update invoice payment status
  app.patch("/api/invoices/:id/payment-status", requireAuth, requirePermission('invoices', 'update'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      const { paymentStatus, paymentMethod } = req.body;
      
      if (!paymentStatus || !['paid', 'unpaid', 'partial'].includes(paymentStatus)) {
        return res.status(400).json({ error: "Invalid payment status. Must be 'paid', 'unpaid', or 'partial'" });
      }
      
      // Validate payment method when marking as paid
      if (paymentStatus === 'paid' && paymentMethod) {
        if (!['UPI', 'Cash', 'Card', 'Net Banking', 'Cheque'].includes(paymentMethod)) {
          return res.status(400).json({ error: "Invalid payment method" });
        }
      }
      
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (invoice.status !== 'approved') {
        return res.status(400).json({ error: "Can only update payment status for approved invoices" });
      }
      
      const oldStatus = invoice.paymentStatus;
      invoice.paymentStatus = paymentStatus;
      
      // Update paid and due amounts based on the status
      if (paymentStatus === 'paid') {
        invoice.paidAmount = invoice.totalAmount;
        invoice.dueAmount = 0;
        // Save payment method when marking as paid
        if (paymentMethod) {
          invoice.paymentMethod = paymentMethod;
        }
      } else if (paymentStatus === 'unpaid') {
        invoice.paidAmount = 0;
        invoice.dueAmount = invoice.totalAmount;
        // Clear payment method when marking as unpaid
        invoice.paymentMethod = undefined;
      }
      
      await invoice.save();
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'update',
        resource: 'other',
        resourceId: invoice._id.toString(),
        description: `Updated payment status for invoice ${invoice.invoiceNumber} from ${oldStatus} to ${paymentStatus}`,
        ipAddress: req.ip,
      });
      
      res.json(invoice);
    } catch (error) {
      console.error('Update payment status error:', error);
      res.status(500).json({ error: "Failed to update payment status" });
    }
  });
  
  // Download invoice PDF (authenticated)
  app.get("/api/invoices/:id/pdf", requireAuth, async (req, res) => {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📥 AUTHENTICATED PDF DOWNLOAD REQUEST');
      console.log('='.repeat(80));
      console.log('   Invoice ID:', req.params.id);
      console.log('   Timestamp:', new Date().toISOString());
      
      console.log('\n1️⃣ Fetching invoice from database...');
      const invoice = await Invoice.findById(req.params.id).populate('serviceVisitId');
      if (!invoice) {
        console.log('❌ Invoice not found:', req.params.id);
        return res.status(404).json({ error: "Invoice not found" });
      }
      console.log('✅ Invoice found:', invoice.invoiceNumber);
      console.log('   Total Items:', invoice.items?.length || 0);
      console.log('   Items:', JSON.stringify(invoice.items.map((i: any) => ({ name: i.name, productId: i.productId })), null, 2));
      
      let pdfPath = invoice.pdfPath;
      console.log('\n2️⃣ Checking if PDF already exists...');
      console.log('   Stored PDF path:', pdfPath);
      console.log('   Path exists:', pdfPath ? fs.existsSync(pdfPath) : false);
      
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        console.log('\n3️⃣ PDF not found, generating new one...');
        
        try {
          // Fetch HSN numbers for all products
          console.log('   📌 Building HSN map...');
          const hsnMap = new Map<string, string | null>();
          
          for (const item of invoice.items) {
            console.log(`   📍 Processing item: "${item.name}" (ID: ${item.productId})`);
            if (item.productId && !hsnMap.has(item.productId.toString())) {
              try {
                console.log(`   🔍 Looking up Product in DB: ${item.productId}`);
                const product = await Product.findById(item.productId).lean();
                console.log(`   ✅ Product found: ${product?.name}, HSN: ${product?.hsnNumber || 'NONE'}`);
                hsnMap.set(item.productId.toString(), product?.hsnNumber || null);
              } catch (lookupError) {
                console.error(`   ❌ Error looking up product ${item.productId}:`, lookupError instanceof Error ? lookupError.message : String(lookupError));
                hsnMap.set(item.productId.toString(), null);
              }
            } else {
              console.log(`   ⏭️ Skipping item (no productId or already in map)`);
            }
          }
          console.log(`   ✅ HSN map built with ${hsnMap.size} entries`);

          console.log('\n   4️⃣ Building PDF data object...');
          const pdfData = {
            invoiceNumber: invoice.invoiceNumber,
            createdAt: invoice.createdAt,
            dueDate: invoice.dueDate,
            customerDetails: invoice.customerDetails,
            vehicleDetails: invoice.vehicleDetails || [],
            items: invoice.items.map((item: any) => {
              const hsnValue = item.productId ? hsnMap.get(item.productId.toString()) : null;
              console.log(`   📝 Mapping item "${item.name}" with HSN: ${hsnValue}`);
              return {
                name: item.name,
                hsnNumber: hsnValue,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                hasGst: item.hasGst,
                gstAmount: item.gstAmount,
              };
            }),
            subtotal: invoice.subtotal,
            discountType: invoice.discountType,
            discountValue: invoice.discountValue,
            discountAmount: invoice.discountAmount,
            taxRate: invoice.taxRate,
            taxAmount: invoice.taxAmount,
            totalAmount: invoice.totalAmount,
            paidAmount: invoice.paidAmount,
            dueAmount: invoice.dueAmount,
            notes: invoice.notes,
            terms: invoice.terms,
          };
          console.log('   ✅ PDF data object created');

          console.log('\n   5️⃣ Generating PDF file...');
          pdfPath = await generateInvoicePDF(pdfData);
          console.log('   ✅ PDF generated:', pdfPath);
          
          console.log('\n   6️⃣ Saving PDF path to invoice record...');
          invoice.pdfPath = pdfPath;
          await invoice.save();
          console.log('   ✅ Invoice saved with PDF path');
        } catch (pdfGenError) {
          console.error('\n   ❌ PDF generation failed:');
          console.error('      Error Type:', pdfGenError?.constructor?.name);
          console.error('      Error Message:', pdfGenError instanceof Error ? pdfGenError.message : String(pdfGenError));
          console.error('      Full Error:', JSON.stringify(pdfGenError, null, 2));
          throw pdfGenError;
        }
      }
      
      console.log('\n7️⃣ Streaming PDF to client...');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber.replace(/\//g, '_')}.pdf"`);
      
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.on('error', (error) => {
        console.error('❌ File stream error:', error);
        res.status(500).json({ error: "Failed to stream PDF" });
      });
      fileStream.on('end', () => {
        console.log('✅ PDF streamed successfully');
        console.log('='.repeat(80) + '\n');
      });
      fileStream.pipe(res);
    } catch (error) {
      console.error('\n❌ AUTHENTICATED PDF DOWNLOAD ERROR:');
      console.error('   Error Type:', error?.constructor?.name);
      console.error('   Error Message:', error instanceof Error ? error.message : String(error));
      console.error('   Full Error:', JSON.stringify(error, null, 2));
      console.error('   Stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.log('='.repeat(80) + '\n');
      res.status(500).json({ error: "Failed to download PDF" });
    }
  });
  
  // Download invoice PDF with token (public endpoint for WhatsApp integration)
  app.get("/api/public/invoices/:id/pdf", async (req, res) => {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📥 PUBLIC PDF ACCESS REQUEST');
      console.log('='.repeat(80));
      console.log('   Invoice ID:', req.params.id);
      console.log('   Token provided:', req.query.token ? String(req.query.token).substring(0, 12) + '...' : 'MISSING');
      console.log('   User-Agent:', req.headers['user-agent'] || 'Not provided');
      console.log('   IP Address:', req.ip || req.connection.remoteAddress);
      console.log('   Timestamp:', new Date().toISOString());
      
      const { token } = req.query;
      const invoice = await Invoice.findById(req.params.id).populate('serviceVisitId');
      
      if (!invoice) {
        console.log('❌ Invoice not found:', req.params.id);
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      console.log('✅ Invoice found:', invoice.invoiceNumber);
      console.log('   Status:', invoice.status);
      
      if (invoice.status !== 'approved') {
        console.log('❌ Invoice not approved. Current status:', invoice.status);
        return res.status(400).json({ error: "PDF can only be accessed for approved invoices" });
      }
      
      // Verify token
      const expectedToken = invoice.pdfAccessToken;
      const tokenExpiry = invoice.pdfTokenExpiry;
      
      console.log('🔐 Token Verification:');
      console.log('   Expected token:', expectedToken ? expectedToken.substring(0, 12) + '...' : 'NOT SET');
      console.log('   Token expiry:', tokenExpiry);
      console.log('   Current time:', new Date());
      console.log('   Token valid:', tokenExpiry && new Date() <= new Date(tokenExpiry) ? '✅' : '❌');
      
      if (!expectedToken || expectedToken !== token) {
        console.log('❌ TOKEN MISMATCH');
        console.log('   Expected:', expectedToken);
        console.log('   Received:', token);
        console.log('='.repeat(80) + '\n');
        return res.status(403).json({ error: "Invalid or missing access token" });
      }
      
      if (tokenExpiry && new Date() > new Date(tokenExpiry)) {
        console.log('❌ TOKEN EXPIRED');
        console.log('   Expired at:', tokenExpiry);
        console.log('   Current time:', new Date());
        console.log('='.repeat(80) + '\n');
        return res.status(403).json({ error: "Access token has expired" });
      }
      
      console.log('✅ Token verification passed');
      
      let pdfPath = invoice.pdfPath;
      
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        // Fetch HSN numbers for all products
        const hsnMap = new Map<string, string | null>();
        
        for (const item of invoice.items) {
          if (item.productId && !hsnMap.has(item.productId.toString())) {
            const product = await Product.findById(item.productId).lean();
            hsnMap.set(item.productId.toString(), product?.hsnNumber || null);
          }
        }

        const pdfData = {
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt,
          dueDate: invoice.dueDate,
          customerDetails: invoice.customerDetails,
          vehicleDetails: invoice.vehicleDetails || [],
          items: invoice.items.map((item: any) => ({
            name: item.name,
            hsnNumber: item.productId ? hsnMap.get(item.productId.toString()) : null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            hasGst: item.hasGst,
            gstAmount: item.gstAmount,
          })),
          subtotal: invoice.subtotal,
          discountType: invoice.discountType,
          discountValue: invoice.discountValue,
          discountAmount: invoice.discountAmount,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          dueAmount: invoice.dueAmount,
          notes: invoice.notes,
          terms: invoice.terms,
        };

        pdfPath = await generateInvoicePDF(pdfData);
        invoice.pdfPath = pdfPath;
        await invoice.save();
      }
      
      console.log('📄 Streaming PDF file...');
      console.log('   File path:', pdfPath);
      console.log('   File exists:', fs.existsSync(pdfPath));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber.replace(/\//g, '_')}.pdf"`);
      
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.on('error', (error) => {
        console.error('❌ File stream error:', error);
        console.log('='.repeat(80) + '\n');
        res.status(500).json({ error: "Failed to stream PDF" });
      });
      fileStream.on('end', () => {
        console.log('✅ PDF successfully streamed to client');
        console.log('='.repeat(80) + '\n');
      });
      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ PDF DOWNLOAD ERROR');
      console.error('Error:', error);
      console.error('Details:', error instanceof Error ? error.message : String(error));
      console.log('='.repeat(80) + '\n');
      res.status(500).json({ error: "Failed to download PDF" });
    }
  });
  
  // Add payment to invoice - supports both single and multiple payment methods
  app.post("/api/invoices/:id/payments", requireAuth, requirePermission('invoices', 'update'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      const { payments, notes, totalAmount } = req.body;
      
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (invoice.status !== 'approved') {
        return res.status(400).json({ error: "Can only add payments to approved invoices" });
      }
      
      if (totalAmount > invoice.dueAmount) {
        return res.status(400).json({ error: "Payment amount exceeds due amount" });
      }
      
      // Handle both array format (multiple payments) and old single payment format
      const paymentsToAdd = Array.isArray(payments) ? payments : [{ amount: totalAmount, paymentMode: payments?.paymentMode || 'Cash', transactionId: payments?.transactionId }];
      
      let totalPaid = 0;
      for (const payment of paymentsToAdd) {
        const paymentEntry = {
          amount: payment.amount,
          paymentMode: payment.paymentMode,
          transactionId: payment.transactionId,
          notes,
          recordedBy: userId,
          transactionDate: new Date()
        };
        invoice.payments.push(paymentEntry as any);
        totalPaid += payment.amount;
      }
      
      invoice.paidAmount += totalPaid;
      invoice.dueAmount -= totalPaid;
      
      if (invoice.dueAmount === 0) {
        invoice.paymentStatus = 'paid';
      } else if (invoice.paidAmount > 0) {
        invoice.paymentStatus = 'partial';
      }
      
      await invoice.save();
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'update',
        resource: 'other',
        resourceId: invoice._id.toString(),
        description: `Recorded payment of ₹${totalPaid} for invoice ${invoice.invoiceNumber} (${paymentsToAdd.length} payment method${paymentsToAdd.length > 1 ? 's' : ''})`,
        ipAddress: req.ip,
      });
      
      res.json(invoice);
    } catch (error) {
      console.error('Payment error:', error);
      res.status(500).json({ error: "Failed to add payment" });
    }
  });
  
  // Delete invoice
  app.delete("/api/invoices/:id", requireAuth, requirePermission('invoices', 'delete'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (invoice.pdfPath && fs.existsSync(invoice.pdfPath)) {
        const path = await import('path');
        const invoicesDir = path.resolve(process.cwd(), 'invoices');
        const resolvedPdfPath = path.resolve(invoice.pdfPath);
        const relativePath = path.relative(invoicesDir, resolvedPdfPath);
        
        if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
          fs.unlinkSync(resolvedPdfPath);
        }
      }
      
      await Invoice.findByIdAndDelete(req.params.id);
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'delete',
        resource: 'other',
        resourceId: req.params.id,
        description: `Deleted invoice ${invoice.invoiceNumber}`,
        ipAddress: req.ip,
      });
      
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Get products from an invoice for warranty card upload
  app.get("/api/invoices/:id/products", requireAuth, async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const products = invoice.items
        .filter((item: any) => item.type === 'product' && item.productId)
        .map((item: any) => ({
          itemIndex: invoice.items.indexOf(item),
          productId: item.productId?.toString(),
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          hasWarranty: item.hasWarranty,
          warrantyCards: item.warrantyCards || [],
        }));

      res.json({
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        products,
      });
    } catch (error) {
      console.error('Get invoice products error:', error);
      res.status(500).json({ error: "Failed to fetch invoice products" });
    }
  });

  // Upload warranty cards for invoice products
  app.post("/api/invoices/:id/warranty-cards", requireAuth, requirePermission('invoices', 'update'), async (req, res) => {
    try {
      const { itemIndex, warrantyCardData, filename } = req.body;

      if (typeof itemIndex !== 'number' || !warrantyCardData || !filename) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!warrantyCardData.startsWith('data:')) {
        return res.status(400).json({ error: "Invalid file data format" });
      }

      const dataUrlMatch = warrantyCardData.match(/^data:([^;]+);base64,(.+)$/);
      if (!dataUrlMatch) {
        return res.status(400).json({ error: "Invalid base64 format" });
      }

      const mimeType = dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];

      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedMimeTypes.includes(mimeType)) {
        return res.status(400).json({ error: "Invalid file type. Only images and PDFs are allowed" });
      }

      const fileSizeBytes = Math.ceil((base64Data.length * 3) / 4);
      const maxSizeBytes = 50 * 1024 * 1024;
      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).json({ error: "File size exceeds 50MB limit" });
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (itemIndex < 0 || itemIndex >= invoice.items.length) {
        return res.status(400).json({ error: "Invalid item index" });
      }

      const item = invoice.items[itemIndex];

      if (!item.warrantyCards) {
        item.warrantyCards = [];
      }

      item.warrantyCards.push({
        url: warrantyCardData,
        filename,
        uploadedAt: new Date(),
      });

      await invoice.save();

      if (item.productId && invoice.customerId) {
        const invoiceVehicleIds = (invoice.vehicleDetails || [])
          .filter((vd: any) => vd.vehicleId)
          .map((vd: any) => vd.vehicleId);

        if (invoiceVehicleIds.length === 0) {
          console.warn(`Invoice ${invoice.invoiceNumber} has no vehicle details. Warranty card saved to invoice but not synced to vehicle.`);
        } else {
          const vehicles = await RegistrationVehicle.find({ customerId: invoice.customerId.toString() });
          let syncedCount = 0;
          
          for (const vehicle of vehicles) {
            const vehicleIdMatch = invoiceVehicleIds.includes(vehicle.vehicleId) ||
                                  invoiceVehicleIds.includes(vehicle._id.toString());

            if (!vehicleIdMatch) {
              continue;
            }

            const productIdStr = item.productId.toString();
            const hasProductInSelectedParts = vehicle.selectedParts && 
                                             vehicle.selectedParts.includes(productIdStr);

            if (!hasProductInSelectedParts) {
              continue;
            }

            if (!vehicle.warrantyCards) {
              vehicle.warrantyCards = [];
            }

            const existingIndex = vehicle.warrantyCards.findIndex(
              (wc: any) => wc.partId === productIdStr
            );

            if (existingIndex >= 0) {
              vehicle.warrantyCards[existingIndex] = {
                partId: productIdStr,
                partName: item.name,
                fileData: warrantyCardData,
              };
            } else {
              vehicle.warrantyCards.push({
                partId: productIdStr,
                partName: item.name,
                fileData: warrantyCardData,
              });
            }

            await vehicle.save();
            syncedCount++;
          }

          if (syncedCount === 0) {
            console.warn(`Warranty card for ${item.name} saved to invoice but no matching vehicle found with this product in selectedParts.`);
          }
        }
      }

      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;

      await logActivity({
        userId,
        userName,
        userRole,
        action: 'update',
        resource: 'other',
        resourceId: invoice._id.toString(),
        description: `Uploaded warranty card for ${item.name} in invoice ${invoice.invoiceNumber}`,
        ipAddress: req.ip,
      });

      res.json({ 
        message: "Warranty card uploaded successfully",
        warrantyCard: item.warrantyCards[item.warrantyCards.length - 1],
      });
    } catch (error) {
      console.error('Upload warranty card error:', error);
      res.status(500).json({ error: "Failed to upload warranty card" });
    }
  });
  
  // ==================== COUPONS ====================
  
  // Get all coupons
  app.get("/api/coupons", requireAuth, requirePermission('coupons', 'read'), async (req, res) => {
    try {
      const coupons = await Coupon.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .lean();
      
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });
  
  // Validate coupon
  app.post("/api/coupons/validate", requireAuth, async (req, res) => {
    try {
      const { code, customerId, purchaseAmount } = req.body;
      
      const coupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      
      const validation = coupon.isValid(customerId, purchaseAmount);
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }
      
      const discount = coupon.calculateDiscount(purchaseAmount);
      
      res.json({
        valid: true,
        coupon: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount: discount
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });
  
  // Create coupon
  app.post("/api/coupons", requireAuth, requirePermission('coupons', 'create'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      const couponData = {
        ...req.body,
        code: req.body.code.toUpperCase(),
        createdBy: userId
      };
      
      const coupon = await Coupon.create(couponData);
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'create',
        resource: 'other',
        resourceId: coupon._id.toString(),
        description: `Created coupon ${coupon.code}`,
        ipAddress: req.ip,
      });
      
      res.json(coupon);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ error: "Coupon code already exists" });
      }
      res.status(500).json({ error: "Failed to create coupon" });
    }
  });
  
  // Update coupon
  app.patch("/api/coupons/:id", requireAuth, requirePermission('coupons', 'update'), async (req, res) => {
    try {
      const userId = (req as any).session.userId;
      const userName = (req as any).session.userName;
      const userRole = (req as any).session.userRole;
      
      const coupon = await Coupon.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      
      await logActivity({
        userId,
        userName,
        userRole,
        action: 'update',
        resource: 'other',
        resourceId: coupon._id.toString(),
        description: `Updated coupon ${coupon.code}`,
        ipAddress: req.ip,
      });
      
      res.json(coupon);
    } catch (error) {
      res.status(500).json({ error: "Failed to update coupon" });
    }
  });
  
  // ==================== WARRANTIES ====================
  
  // Get warranties
  app.get("/api/warranties", requireAuth, requirePermission('warranties', 'read'), async (req, res) => {
    try {
      const { status, customerId } = req.query;
      
      let query: any = {};
      if (status) query.status = status;
      if (customerId) query.customerId = customerId;
      
      const warranties = await Warranty.find(query)
        .populate('customerId', 'fullName mobileNumber')
        .populate('productId', 'name')
        .populate('invoiceId', 'invoiceNumber')
        .sort({ createdAt: -1 })
        .lean();
      
      res.json(warranties);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch warranties" });
    }
  });
  
  // Create warranty
  app.post("/api/warranties", requireAuth, requirePermission('warranties', 'create'), async (req, res) => {
    try {
      const warranty = await Warranty.create(req.body);
      res.json(warranty);
    } catch (error) {
      res.status(500).json({ error: "Failed to create warranty" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
