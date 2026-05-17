import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center space-y-4">
        <h1 className="text-8xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Sahifa topilmadi</h2>
        <p className="text-muted-foreground">
          Siz qidirayotgan sahifa mavjud emas yoki o'chirilgan.
        </p>
        <Button asChild>
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Bosh sahifaga qaytish
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
