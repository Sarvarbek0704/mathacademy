import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { AppLogoIcon } from '@/components/shared/AppLogo';
import { toast } from 'sonner';

export default function StaffLogin() {
  const [tenantSlug, setTenantSlug] = useState(''); // ✅ qo'shildi
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantSlug.trim() || !username.trim() || !password.trim()) {
      toast.error("Iltimos, barcha maydonlarni to'ldiring");
      return;
    }

    setLoading(true);
    try {
      await login('STAFF', {
        tenantSlug: tenantSlug.trim(),
        username: username.trim(),
        password,
      });
      toast.success('Muvaffaqiyatli kirdingiz!');
      navigate('/staff/dashboard');
    } catch (err) {
      const msg = getApiErrorMessage(err, "Login yoki parol noto'g'ri");
      toast.error('Kirish xatosi', { description: msg }); // ✅ endi object emas, string
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-accent" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-accent/50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border-2 border-primary-foreground/20" />
        </div>
        <div className="relative z-10 text-primary-foreground text-center px-12 max-w-lg">
          <div className="flex justify-center mb-8">
            <AppLogoIcon size={72} />
          </div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">
            Math<span className="text-indigo-300">Academy</span>
          </h1>
          <h2 className="text-xl font-semibold mb-3 opacity-90">Digital Campus</h2>
          <p className="text-base opacity-75 leading-relaxed">
            Akademiya boshqaruv tizimi — o'quvchilar monitoringi, baholash, davomat, intizom va moliya bitta platformada.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex justify-center mb-8">
            <AppLogoIcon size={52} />
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Xodim kirishi</CardTitle>
              <CardDescription>Tizimga kirish uchun ma'lumotlaringizni kiriting</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantSlug">Tenant slug</Label>
                  <Input
                    id="tenantSlug"
                    placeholder="mathacademy"
                    value={tenantSlug}
                    onChange={e => setTenantSlug(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Login (username)</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Parol</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Kirish
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Ota-ona sifatida kirishni xohlaysizmi?{' '}
            <Link to="/guardian/login" className="text-primary font-medium hover:underline">
              Ota-ona kirishi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}