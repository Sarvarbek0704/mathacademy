import { useState } from 'react';
import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { useAuth, type GuardianUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Loader2, User, Phone, MapPin, Calendar, GraduationCap, 
  Briefcase, Info, Shield, Edit2, Lock, Save 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SlideOver } from '@/components/shared/SlideOver';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GuardianStudent() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'profile'],
    queryFn: async () => (await api.get('/guardian/student')).data
  });

  const student = profileRes?.student;
  const guardian = profileRes?.guardianAccount;

  // Profile Update Mutation
  const profileMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values };
      if (payload.telegramUsername && !payload.telegramUsername.startsWith('@')) {
        payload.telegramUsername = `@${payload.telegramUsername}`;
      }
      return (await api.put('/auth/profile', payload)).data;
    },
    onSuccess: () => {
      toast.success('Profil muvaffaqiyatli saqlandi');
      queryClient.invalidateQueries({ queryKey: ['guardian', 'student', 'profile'] });
      refreshProfile(); // Sync global user state (sidebar, etc)
      setEditOpen(false);
    }
  });

  // Password Update Mutation
  const passwordMutation = useMutation({
    mutationFn: async (values: any) => {
      return (await api.post('/auth/guardian/change-password', values)).data;
    },
    onSuccess: () => {
      toast.success('Parol muvaffaqiyatli o\'zgartirildi');
      setEditOpen(false);
    }
  });

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  const InfoRow = ({ label, value, icon: Icon }: { label: string, value: string | React.ReactNode, icon?: any }) => (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{value || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader title="O'quvchi profili" description="Farzandingiz va hisobingiz haqida batafsil ma'lumot" />
        <Button onClick={() => setEditOpen(true)} className="flex items-center gap-2">
          <Edit2 className="h-4 w-4" />
          Tahrirlash
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="-mt-12 pt-0">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4 border-4 border-background shadow-xl">
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                    {student?.fullName?.charAt(0) || 'S'}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold">{student?.fullName}</h2>
                <p className="text-sm text-muted-foreground mb-4 font-mono">ID: {guardian?.studentLoginId}</p>
                <div className={`px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                  student?.status === 'ACTIVE' ? 'bg-success/10 text-success border border-success/20' : 'bg-muted text-muted-foreground'
                }`}>
                  {student?.status === 'ACTIVE' ? 'FAOL' : student?.status}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Hisob ma'lumotlari</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-1">
              <InfoRow label="Login" value={guardian?.studentLoginId} icon={User} />
              <InfoRow label="Profil" value={guardian?.profileCompleted ? 'Toʻldirilgan' : 'Toʻldirilmagan'} />
              <InfoRow label="Oxirgi kirish" value={guardian?.lastLoginAt ? new Date(guardian.lastLoginAt).toLocaleDateString('uz') : 'Yaqinda emas'} />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-semibold flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> Akademik ma'lumotlar</CardTitle></CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow label="Guruh" value={student?.group?.name} icon={Briefcase} />
              <InfoRow label="Kurs/Sinf" value={`${student?.admissionGrade}-sinf`} icon={Calendar} />
              <InfoRow label="O'quv yili" value={student?.group?.academicYear} icon={Calendar} />
              <InfoRow label="Yo'nalish" value={student?.track?.name} icon={Briefcase} />
              <InfoRow label="O'qishga kirgan" value={student?.admissionDate ? new Date(student.admissionDate).toLocaleDateString('uz') : '-'} />
              <InfoRow label="Bitiruv yili" value={student?.expectedGraduationYear} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-semibold flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Manzil</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-1">
                <InfoRow label="Kampus" value={student?.campus?.name} icon={MapPin} />
                <InfoRow label="Yashash turi" value={student?.livingType?.name} icon={Info} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-semibold flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Vasiy (Siz)</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-1">
                <InfoRow label="F.I.SH" value={guardian?.profileFullName} icon={User} />
                <InfoRow label="Telefon" value={guardian?.profilePhone} icon={Phone} />
                <InfoRow label="Aloqa turi" value={guardian?.profileRelation} />
                <InfoRow label="Telegram" value={guardian?.telegramUsername ? `@${guardian.telegramUsername}` : '-'} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <SlideOver 
        open={editOpen} 
        onOpenChange={setEditOpen} 
        title="Profilni boshqarish" 
        description="Shaxsiy ma'lumotlaringiz va xavfsizlik sozlamalari"
      >
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="profile">Ma'lumotlar</TabsTrigger>
            <TabsTrigger value="password">Xavfsizlik</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6">
            <form onSubmit={(e: any) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              profileMutation.mutate({
                fullName: formData.get('fullName'),
                phone: formData.get('phone'),
                profileRelation: formData.get('relation'),
                telegramUsername: formData.get('telegram'),
              });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">To'liq ismingiz</Label>
                <Input id="fullName" name="fullName" defaultValue={guardian?.profileFullName || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon raqamingiz</Label>
                <Input id="phone" name="phone" defaultValue={guardian?.profilePhone || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relation">O'quvchiga aloqadorlik</Label>
                <Select name="relation" defaultValue={guardian?.profileRelation || 'FATHER'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FATHER">Ota</SelectItem>
                    <SelectItem value="MOTHER">Ona</SelectItem>
                    <SelectItem value="GUARDIAN">Vasiy</SelectItem>
                    <SelectItem value="OTHER">Boshqa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram (masalan: @username)</Label>
                <Input id="telegram" name="telegram" defaultValue={guardian?.telegramUsername ? `@${guardian.telegramUsername}` : ''} placeholder="@username" />
              </div>
              <Button type="submit" className="w-full" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Saqlash
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="password">
            <form onSubmit={(e: any) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const oldPassword = formData.get('oldPassword');
              const newPassword = formData.get('newPassword');
              const confirmPassword = formData.get('confirmPassword');

              if (newPassword !== confirmPassword) {
                toast.error('Yangi parollar mos kelmadi');
                return;
              }
              passwordMutation.mutate({ oldPassword, newPassword });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Eski parol</Label>
                <Input id="oldPassword" name="oldPassword" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Yangi parol</Label>
                <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Yangi parolni tasdiqlang</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
              </div>
              <Button type="submit" variant="destructive" className="w-full" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Parolni yangilash
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </SlideOver>
    </div>
  );
}
