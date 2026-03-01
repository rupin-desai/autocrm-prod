import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { LogOut, User, Mail, Shield } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  if (!user) {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-500';
      case 'Manager':
        return 'bg-yellow-500';
      case 'Inventory Manager':
        return 'bg-blue-500';
      case 'Sales Executive':
        return 'bg-green-500';
      case 'HR Manager':
        return 'bg-purple-500';
      case 'Service Staff':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card data-testid="card-profile">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-title">
            <User className="h-6 w-6" />
            User Profile
          </CardTitle>
          <CardDescription data-testid="text-description">
            Your account information and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3" data-testid="section-name">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium" data-testid="text-name">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3" data-testid="section-email">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium" data-testid="text-email">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3" data-testid="section-role">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge className={getRoleBadgeColor(user.role)} data-testid="badge-role">
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>

          {user.permissions && (
            <div className="border-t pt-6" data-testid="section-permissions">
              <h3 className="font-semibold mb-3" data-testid="text-permissions-title">Permissions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(user.permissions).map(([resource, actions]) => (
                  <div key={resource} className="bg-muted p-3 rounded-md" data-testid={`permission-${resource}`}>
                    <p className="font-medium capitalize text-sm mb-1">{resource}</p>
                    <div className="flex flex-wrap gap-1">
                      {(actions as string[]).map((action) => (
                        <Badge key={action} variant="outline" className="text-xs" data-testid={`action-${action}`}>
                          {action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
