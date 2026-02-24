import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Award, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  School,
  FileBadge,
  GraduationCap,
  Loader2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import dayjs from 'dayjs';

export default function CertificatesPage() {
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/certificates' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ 
    type: 'IELTS', 
    name: '', 
    score: '', 
    studentId: '',
    date: dayjs().format('YYYY-MM-DD')
  });

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'for_certs'],
    queryFn: async () => (await api.get('/staff/students?limit=500')).data
  });
  const students = studentsRes?.data || [];

  const certTypes = ['IELTS', 'SAT', 'TOEFL', 'CEFR', 'GMAT', 'GRE', 'OTHER'];

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedCert.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Sertifikatlar" 
        description="O'quvchilarning IELTS, SAT va boshqa xalqaro sertifikatlari" 
        action={{ 
          label: "Sertifikat qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ type: 'IELTS', name: '', score: '', studentId: '', date: dayjs().format('YYYY-MM-DD') });
            setIsEditing(false);
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Sertifikatlardan qidirish..." className="pl-10" onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((cert: any) => (
            <Card key={cert.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full">
              <CardHeader className="p-5 pb-2">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <FileBadge className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setSelectedCert(cert);
                        setForm({ 
                          type: cert.type, 
                          name: cert.name, 
                          score: cert.score || '', 
                          studentId: String(cert.studentId || ''),
                          date: dayjs(cert.date).format('YYYY-MM-DD')
                        });
                        setIsEditing(true);
                        setModalOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedCert(cert); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                    {cert.type}
                  </Badge>
                  <span className="text-sm font-semibold text-primary">{cert.score}</span>
                </div>
                <CardTitle className="mt-2 text-base line-clamp-1">{cert.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4 flex-1">
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{cert.student?.fullName || cert.student?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {dayjs(cert.date).format('DD.MM.YYYY')} kiritildi
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 border-t bg-muted/20 mt-auto">
                <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Tasdiqlangan sertifikat
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Sertifikatni tahrirlash" : "Yangi sertifikat"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>O'quvchi</Label>
            <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}>
              <SelectTrigger><SelectValue placeholder="O'quvchini tanlang" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.fullName || s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sertifikat turi</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {certTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ball / Natija</Label>
              <Input value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} placeholder="Masalan: 7.5 yoki 1520" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sertifikat nomi / Izoh</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: IELTS Academic Test" />
          </div>

          <div className="space-y-2">
            <Label>Sana</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>Saqlash</Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="O'chirish" 
        description="Sertifikatni o'chirishga ishonchingiz komilmi?" 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedCert.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
