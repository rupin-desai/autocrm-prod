import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import logoImage from '@assets/image_1760164042662.png';

export default function Login() {
  const [location, setLocation] = useLocation();
  const { login, verifyOTP } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otpInput, setOtpInput] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    if (role) {
      setSelectedRole(role);
    }
  }, [location]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, selectedRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.requireOTP) {
        const mobile = data.mobileNumber;
        const masked = mobile.replace(/(\d{2})(\d+)(\d{2})/, '$1******$3');
        setMaskedMobile(masked);
        setStep('otp');
        toast({
          title: 'OTP Sent',
          description: `OTP sent to your registered WhatsApp number ending in ${mobile.slice(-4)}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password',
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
      await verifyOTP(otpInput);
      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });
      setLocation('/');
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Mauli Car World Logo" className="h-8 w-auto" />
              <CardTitle data-testid="text-title">Mauli Car World</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/select-role')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <CardDescription data-testid="text-description">
            {selectedRole ? `Sign in as ${selectedRole}` : 'Sign in to access your dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@maulicarworld.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" data-testid="label-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setLocation(`/forgot-password?role=${encodeURIComponent(selectedRole)}`)}
                    className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? 'Verifying credentials...' : 'Continue'}
              </Button>
              <p className="text-sm text-center text-muted-foreground" data-testid="text-info">
                OTP will be sent to your registered WhatsApp number
              </p>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" data-testid="label-otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  className="text-center text-2xl tracking-widest"
                  required
                  data-testid="input-otp-login"
                />
                <p className="text-sm text-center text-muted-foreground" data-testid="text-otp-info">
                  OTP sent to your registered WhatsApp number {maskedMobile}
                </p>
                <p className="text-xs text-center text-orange-600 dark:text-orange-400" data-testid="text-whatsapp-info">
                  Check your WhatsApp for the OTP message
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep('credentials');
                    setOtpInput('');
                    setMaskedMobile('');
                  }}
                  className="w-full"
                  data-testid="button-back-to-credentials"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || otpInput.length !== 6}
                  data-testid="button-verify-otp"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
