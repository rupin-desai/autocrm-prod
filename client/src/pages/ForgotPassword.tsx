import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Smartphone, KeyRound, CheckCircle } from 'lucide-react';
import logoImage from '@assets/image_1760164042662.png';
import { apiRequest } from '@/lib/queryClient';

export default function ForgotPassword() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<'mobile' | 'otp' | 'password'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [maskedMobile, setMaskedMobile] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    if (role) {
      setSelectedRole(role);
    } else {
      setLocation('/select-role');
    }
  }, [location, setLocation]);

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/auth/forgot-password', {
        mobileNumber,
        role: selectedRole,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      const masked = mobileNumber.replace(/(\d{2})(\d+)(\d{2})/, '$1******$3');
      setMaskedMobile(masked);
      setStep('otp');
      toast({
        title: 'OTP Sent',
        description: `OTP sent to your WhatsApp number ${masked}`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to send OTP',
        description: error.message || 'Please check your mobile number and try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/auth/verify-reset-otp', {
        otp: otpInput,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setStep('password');
      toast({
        title: 'OTP Verified',
        description: 'You can now set a new password',
      });
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/auth/reset-password', {
        newPassword,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast({
        title: 'Password Reset Successful',
        description: 'You can now login with your new password',
      });
      
      setTimeout(() => {
        setLocation(`/login?role=${encodeURIComponent(selectedRole)}`);
      }, 1500);
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('mobile');
      setOtpInput('');
    } else if (step === 'password') {
      setStep('otp');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setLocation(`/login?role=${encodeURIComponent(selectedRole)}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-forgot-password">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Mauli Car World Logo" className="h-8 w-auto" />
              <CardTitle data-testid="text-title">Reset Password</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <CardDescription data-testid="text-description">
            {step === 'mobile' && `Reset password for ${selectedRole}`}
            {step === 'otp' && 'Enter the OTP sent to your WhatsApp'}
            {step === 'password' && 'Set your new password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'mobile' && (
            <form onSubmit={handleMobileSubmit} className="space-y-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile" data-testid="label-mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="Enter your registered mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                  data-testid="input-mobile"
                />
                <p className="text-xs text-muted-foreground" data-testid="text-mobile-info">
                  Enter your 10-digit mobile number registered with your account
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || mobileNumber.length !== 10}
                data-testid="button-send-otp"
              >
                {isLoading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <KeyRound className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp" data-testid="label-otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="text-center text-2xl tracking-widest"
                  required
                  data-testid="input-otp"
                />
                <p className="text-sm text-center text-muted-foreground" data-testid="text-otp-info">
                  OTP sent to {maskedMobile}
                </p>
                <p className="text-xs text-center text-orange-600 dark:text-orange-400" data-testid="text-whatsapp-info">
                  Check your WhatsApp for the OTP message
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || otpInput.length !== 6}
                data-testid="button-verify-otp"
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" data-testid="label-new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
                <p className="text-xs text-muted-foreground" data-testid="text-password-requirement">
                  Password must be at least 6 characters long
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" data-testid="label-confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || newPassword.length < 6 || confirmPassword.length < 6}
                data-testid="button-reset-password"
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
