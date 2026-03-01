import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Warehouse, ShoppingCart, Users, Headphones, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImage from '@assets/image_1760164042662.png';
import bgImage from '@assets/bg_1761112040031.jpg';

interface RoleOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const roles: RoleOption[] = [
  {
    id: 'Admin',
    name: 'Admin',
    description: 'Full system access and management',
    icon: <Package className="h-6 w-6" />,
  },
  {
    id: 'Manager',
    name: 'Manager',
    description: 'Branch head with sub-admin access',
    icon: <Building2 className="h-6 w-6" />,
  },
  {
    id: 'Inventory Manager',
    name: 'Inventory Manager',
    description: 'Manage products and inventory',
    icon: <Warehouse className="h-6 w-6" />,
  },
  {
    id: 'Sales Executive',
    name: 'Sales Executive',
    description: 'Handle orders and customers',
    icon: <ShoppingCart className="h-6 w-6" />,
  },
  {
    id: 'HR Manager',
    name: 'HR Manager',
    description: 'Manage employees and HR tasks',
    icon: <Users className="h-6 w-6" />,
  },
  {
    id: 'Service Staff',
    name: 'Service Staff',
    description: 'Customer support and service',
    icon: <Headphones className="h-6 w-6" />,
  },
];

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [, setLocation] = useLocation();

  const handleContinue = () => {
    if (selectedRole) {
      setLocation(`/login?role=${encodeURIComponent(selectedRole)}`);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div className="w-full max-w-4xl relative z-10">
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm mb-6">
          <CardContent className="text-center py-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <img src={logoImage} alt="Mauli Car World Logo" className="h-14 w-auto" />
              <h1 className="text-3xl font-bold" data-testid="text-title">Mauli Car World</h1>
            </div>
            <p className="text-base text-muted-foreground" data-testid="text-subtitle">
              Select your role to access the system
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {roles.map((role) => (
            <Card
              key={role.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md bg-white dark:bg-gray-900',
                selectedRole === role.id && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedRole(role.id)}
              data-testid={`card-role-${role.id.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardContent className="flex items-start gap-4 p-6">
                <div className={cn(
                  'p-3 rounded-lg',
                  selectedRole === role.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  {role.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1" data-testid={`text-role-${role.id.toLowerCase().replace(/\s+/g, '-')}`}>
                    {role.name}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid={`text-description-${role.id.toLowerCase().replace(/\s+/g, '-')}`}>
                    {role.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={!selectedRole}
            className="px-8 disabled:opacity-100"
            size="default"
            data-testid="button-continue"
          >
            Continue as {selectedRole ? roles.find(r => r.id === selectedRole)?.name : 'User'}
          </Button>
        </div>
      </div>
    </div>
  );
}
