import bcrypt from 'bcryptjs';
import { User } from './models/User';
import { OTP } from './models/OTP';
import { sendRoleOTP, sendWhatsAppOTP, generateOTP } from './services/whatsapp';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(email: string, password: string, name: string, role: string, mobileNumber: string) {
  const passwordHash = await hashPassword(password);
  return User.create({
    email,
    passwordHash,
    name,
    role,
    mobileNumber,
    isActive: true
  });
}

export async function authenticateUser(email: string, password: string) {
  const user = await User.findOne({ email, isActive: true });
  if (!user) {
    return null;
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }
  
  return user;
}

export const ROLE_PERMISSIONS = {
  Admin: {
    products: ['read', 'create', 'update', 'delete'],
    inventory: ['read', 'create', 'update', 'delete'],
    employees: ['read', 'create', 'update', 'delete'],
    customers: ['read', 'create', 'update', 'delete'],
    orders: ['read', 'create', 'update', 'delete'],
    invoices: ['read', 'create', 'update', 'delete', 'approve', 'reject'],
    coupons: ['read', 'create', 'update', 'delete'],
    warranties: ['read', 'create', 'update', 'delete'],
    reports: ['read'],
    notifications: ['read', 'update'],
    users: ['read', 'create', 'update', 'delete'],
    suppliers: ['read', 'create', 'update', 'delete'],
    purchaseOrders: ['read', 'create', 'update', 'delete'],
    attendance: ['read', 'create', 'update', 'delete'],
    leaves: ['read', 'create', 'update', 'delete'],
    tasks: ['read', 'create', 'update', 'delete'],
    communications: ['read', 'create', 'update', 'delete'],
    feedbacks: ['read', 'create', 'update', 'delete'],
    supportTickets: ['read', 'create', 'update', 'delete'],
  },
  Manager: {
    products: ['read', 'create', 'update', 'delete'],
    inventory: ['read', 'create', 'update', 'delete'],
    employees: ['read', 'create', 'update', 'delete'],
    customers: ['read', 'create', 'update', 'delete'],
    orders: ['read', 'create', 'update', 'delete'],
    invoices: ['read', 'create', 'update', 'delete', 'approve', 'reject'],
    coupons: ['read', 'create', 'update', 'delete'],
    warranties: ['read', 'create', 'update', 'delete'],
    reports: ['read'],
    notifications: ['read', 'update'],
    users: ['read', 'create', 'update', 'delete'],
    suppliers: ['read', 'create', 'update', 'delete'],
    purchaseOrders: ['read', 'create', 'update', 'delete'],
    attendance: ['read', 'create', 'update', 'delete'],
    leaves: ['read', 'create', 'update', 'delete'],
    tasks: ['read', 'create', 'update', 'delete'],
    communications: ['read', 'create', 'update', 'delete'],
    feedbacks: ['read', 'create', 'update', 'delete'],
    supportTickets: ['read', 'create', 'update', 'delete'],
  },
  'Inventory Manager': {
    products: ['read', 'create', 'update', 'delete'],
    inventory: ['read', 'create', 'update', 'delete'],
    orders: ['read', 'create', 'update', 'delete'],
  },
  'Sales Executive': {
    customers: ['read', 'create', 'update', 'delete'],
    orders: ['read', 'create', 'update', 'delete'],
    invoices: ['read', 'create'],
    warranties: ['read', 'create'],
  },
  'HR Manager': {
    employees: ['read', 'create', 'update', 'delete'],
    attendance: ['read', 'create', 'update', 'delete'],
    tasks: ['read', 'create', 'update', 'delete'],
    leaves: ['read', 'create', 'update', 'delete'],
    users: ['read', 'create', 'update', 'delete'],
  },
  'Service Staff': {
    supportTickets: ['read', 'create', 'update'],
    feedbacks: ['read', 'create'],
  },
};

export function hasPermission(userRole: string, resource: string, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
  if (!permissions) return false;
  
  const resourcePermissions = permissions[resource as keyof typeof permissions] as string[] | undefined;
  if (!resourcePermissions) return false;
  
  return resourcePermissions.includes(action);
}

export async function sendOTPToMobile(mobileNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.deleteMany({ mobileNumber, verified: false });

    await OTP.create({
      mobileNumber,
      otp,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    const result = await sendRoleOTP({ to: mobileNumber, otp });

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Failed to send OTP' };
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, error: 'Failed to send OTP' };
  }
}

export async function verifyOTP(mobileNumber: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const otpRecord = await OTP.findOne({
      mobileNumber,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return { success: false, error: 'Invalid or expired OTP' };
    }

    if (otpRecord.attempts >= 3) {
      return { success: false, error: 'Maximum verification attempts exceeded' };
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return { success: false, error: 'Invalid OTP' };
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return { success: true };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, error: 'Failed to verify OTP' };
  }
}

export async function sendEmployeeOTP(mobileNumber: string, purpose: 'employee_verification' | 'phone_update' = 'employee_verification'): Promise<{ success: boolean; error?: string }> {
  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.deleteMany({ mobileNumber, purpose, verified: false });

    await OTP.create({
      mobileNumber,
      otp,
      purpose,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    const result = await sendWhatsAppOTP({ to: mobileNumber, otp });

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Failed to send OTP' };
    }
  } catch (error) {
    console.error('Error sending employee OTP:', error);
    return { success: false, error: 'Failed to send OTP' };
  }
}

export async function verifyEmployeeOTP(mobileNumber: string, otp: string, purpose: 'employee_verification' | 'phone_update' = 'employee_verification'): Promise<{ success: boolean; error?: string }> {
  try {
    const otpRecord = await OTP.findOne({
      mobileNumber,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return { success: false, error: 'Invalid or expired OTP' };
    }

    if (otpRecord.attempts >= 3) {
      return { success: false, error: 'Maximum verification attempts exceeded' };
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return { success: false, error: 'Invalid OTP' };
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return { success: true };
  } catch (error) {
    console.error('Error verifying employee OTP:', error);
    return { success: false, error: 'Failed to verify OTP' };
  }
}
