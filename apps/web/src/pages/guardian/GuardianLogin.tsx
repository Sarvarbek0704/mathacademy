import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { AppLogoIcon } from '@/components/shared/AppLogo';
import { toast } from 'sonner';

export default function GuardianLogin() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && user?.type === 'GUARDIAN') {
    return <Navigate to="/guardian/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !password.trim()) {
      toast.error("Iltimos, barcha maydonlarni to'ldiring");
      return;
    }
    setLoading(true);
    try {
      await login('GUARDIAN', { studentId, password });
      toast.success('Muvaffaqiyatli kirdingiz!');
      navigate('/guardian/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Student ID yoki parol noto'g'ri";
      toast.error('Kirish xatosi', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, hsl(160 60% 30%), hsl(160 60% 45%), hsl(180 50% 40%))' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-32 right-20 w-80 h-80 rounded-full bg-background" />
          <div className="absolute bottom-10 left-10 w-60 h-60 rounded-full bg-background/50" />
        </div>
        <div className="relative z-10 text-center px-12 max-w-lg" style={{ color: 'white' }}>
          <div className="flex justify-center mb-8">
            <AppLogoIcon size={72} />
          </div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">
            Math<span style={{ color: 'rgba(255,255,255,0.7)' }}>Academy</span>
          </h1>
          <p className="text-base opacity-85 leading-relaxed">
            Farzandingizning baholar, davomat, intizom va to'lov holatini kuzatib boring.
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
              <CardTitle className="text-2xl font-bold">Ota-ona kirishi</CardTitle>
              <CardDescription>O'quvchi ID va parolingizni kiriting</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId">O'quvchi ID</Label>
                  <Input id="studentId" placeholder="STU-001" value={studentId}
                    onChange={e => setStudentId(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Parol</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} disabled={loading} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
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
            Xodim sifatida kirish?{' '}
            <Link to="/staff/login" className="text-primary font-medium hover:underline">
              Xodim kirishi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
