import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Layers, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Loader2,
  Calendar,
  GraduationCap,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CohortsPage() {
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/cohorts' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ name: '', year: new Date().getFullYear().toString() });

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedCohort.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Kohortalar" 
        description="Bitiruvchilar oqimi va yillik talabalar guruhlari" 
        action={{ 
          label: "Kohorta qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ name: '', year: new Date().getFullYear().toString() });
            setIsEditing(false);
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Kohortalardan qidirish..." className="pl-10" onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((cohort: any) => (
            <Card key={cohort.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="p-5">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setSelectedCohort(cohort);
                        setForm({ name: cohort.name, year: cohort.year || '' });
                        setIsEditing(true);
                        setModalOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedCohort(cohort); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-4 text-lg">{cohort.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1 font-semibold text-blue-600">
                  <Calendar className="h-3.5 w-3.5" /> {cohort.year}-yil bitiruvchilari
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4 flex-1">
                <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Guruhlar</span>
                    <span className="text-sm font-semibold">{cohort.groupCount || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Bitiruvchilar</span>
                    <span className="text-sm font-semibold">{cohort.studentCount || 0}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 border-t bg-muted/20">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span>Akademik salohiyat: A+</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Kohortani tahrirlash" : "Yangi kohorta qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Kohorta nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Generation Alpha" />
          </div>

          <div className="space-y-2">
            <Label>Yil (Bitiruv yili)</Label>
            <Input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="Masalan: 2025" type="number" />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              {isEditing ? 'Saqlash' : 'Yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="O'chirish" 
        description="Ushbu kohortani o'chirishga ishonchingiz komilmi?" 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedCohort.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
