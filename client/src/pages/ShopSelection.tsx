import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImage from '@assets/image_1760164042662.png';
import bgImage from '@assets/bg_1761112040031.jpg';

interface ShopOption {
  id: string;
  name: string;
  location: string;
}

const shops: ShopOption[] = [
  {
    id: 'beed',
    name: 'Shop A',
    location: 'Beed',
  },
  {
    id: 'ahilyanagar',
    name: 'Shop B',
    location: 'Chhatrapati Sambhaji Nagar',
  },
];

export default function ShopSelection() {
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [, setLocation] = useLocation();

  const handleContinue = () => {
    if (selectedShop) {
      localStorage.setItem('selectedShop', selectedShop);
      setLocation('/select-role');
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
              Select your shop location to continue
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {shops.map((shop) => (
            <Card
              key={shop.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md bg-white dark:bg-gray-900',
                selectedShop === shop.id && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedShop(shop.id)}
              data-testid={`card-shop-${shop.id}`}
            >
              <CardContent className="flex items-start gap-4 p-6">
                <div className={cn(
                  'p-3 rounded-lg',
                  selectedShop === shop.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <Store className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1" data-testid={`text-shop-${shop.id}`}>
                    {shop.name}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid={`text-location-${shop.id}`}>
                    {shop.location}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={!selectedShop}
            className="px-8 disabled:opacity-100"
            size="default"
            data-testid="button-continue"
          >
            Continue to Role Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
