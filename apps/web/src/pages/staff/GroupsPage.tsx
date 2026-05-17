import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Trash2,
  Edit2,
  Plus,
  Search,
  Loader2,
  Calendar,
  UserCheck,
  LayoutGrid,
  List as ListIcon,
  Route,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { data, loading, setSearch, create, update, remove } =
    useCrud({ endpoint: '/staff/groups' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [filterTrackId, setFilterTrackId] = useState('all');

  const [form, setForm] = useState({ name: '', grade: '10', academicYearId: '', trackId: '' });

  const { data: currentAy } = useQuery({
    queryKey: ['academic-years', 'current', 'for_groups'],
    queryFn: async () => {
      const res = await api.get('/staff/academic-years?isCurrent=true');
      return res.data?.data?.[0];
    },
  });

  const { data: allAcademicYears } = useQuery({
    queryKey: ['academic-years', 'all', 'for_groups_select'],
    queryFn: async () => {
      const res = await api.get('/staff/academic-years?limit=100');
      return res.data?.data || [];
    },
  });

  const { data: tracksRes } = useQuery({
    queryKey: ['staff', 'tracks', 'for-groups'],
    queryFn: async () => (await api.get('/staff/tracks?limit=100')).data,
  });
  const tracks = tracksRes?.data || [];

  const handleCreateOrUpdate = async () => {
    if (!form.name.trim()) { toast.error('Guruh nomi kiritilishi shart'); return; }
    if (!form.academicYearId) { toast.error('Akademik yil tanlanishi shart'); return; }

    const payload: any = {
      name: form.name.trim(),
      grade: parseInt(form.grade, 10),
      academicYearId: form.academicYearId,
    };
    if (form.trackId && form.trackId !== 'none') payload.trackId = form.trackId;

    try {
      if (editing) await update(editing.id, payload);
      else await create(payload);
      setModalOpen(false);
    } catch {}
  };

  const filteredData = filterTrackId === 'all'
    ? data
    : data.filter((g: any) =>
        filterTrackId === 'none' ? !g.trackId : String(g.trackId) === filterTrackId
      );

  const getTrackColor = (group: any): string | null => {
    if (group.track?.color) return group.track.color;
    const t = tracks.find((t: any) => String(t.id) === String(group.trackId));
    return t?.color || null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guruhlar boshqaruvi"
        description="Sinflar, oqimlar va o'quv guruhlarini tashkillash"
        action={{
          label: 'Yangi guruh',
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setEditing(null);
            setForm({
              name: '',
              grade: '10',
              academicYearId: currentAy?.id ? String(currentAy.id) : '',
              trackId: '',
            });
            setModalOpen(true);
          },
        }}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Guruhlardan qidirish..."
            className="pl-10"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {tracks.length > 0 && (
          <Select value={filterTrackId} onValueChange={setFilterTrackId}>
            <SelectTrigger className="w-48 shrink-0">
              <Route className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Yo'nalish" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha yo'nalishlar</SelectItem>
              <SelectItem value="none">Yo'nalishsiz</SelectItem>
              {tracks.map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex bg-muted p-1 rounded-lg shrink-0">
          <Button
            variant={viewMode === 'GRID' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode('GRID')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'LIST' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode('LIST')}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Guruhlar topilmadi</p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'GRID'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-3'
          }
        >
          {filteredData.map((group: any) => {
            const trackColor = getTrackColor(group);
            return viewMode === 'GRID' ? (
              <Card
                key={group.id}
                className="group hover:border-primary/50 transition-all flex flex-col h-full shadow-sm overflow-hidden"
                style={trackColor ? { borderTopColor: trackColor, borderTopWidth: 3 } : undefined}
              >
                <CardHeader className="p-5 pb-0">
                  <div className="flex justify-between items-start">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center border"
                      style={
                        trackColor
                          ? { backgroundColor: `${trackColor}1a`, borderColor: `${trackColor}40` }
                          : { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }
                      }
                    >
                      <Users
                        className="h-5 w-5"
                        style={trackColor ? { color: trackColor } : { color: '#4f46e5' }}
                      />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditing(group);
                          setForm({
                            name: group.name,
                            grade: String(group.grade || '10'),
                            academicYearId: group.academicYearId ? String(group.academicYearId) : '',
                            trackId: group.trackId ? String(group.trackId) : '',
                          });
                          setModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => { setDeleting(group); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <CardTitle className="text-xl font-black">{group.name}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-0"
                      >
                        {group.grade}-sinf
                      </Badge>
                      {group.track && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0"
                          style={trackColor ? { borderColor: trackColor, color: trackColor } : undefined}
                        >
                          {group.track.name}
                        </Badge>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {group.academicYear?.name}
                      </span>
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-end">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{group.studentCount || 0}</span>
                    <span>o'quvchi</span>
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20 flex justify-between text-[11px] font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {group.academicYear?.startDate
                      ? new Date(group.academicYear.startDate).toLocaleDateString('uz')
                      : '—'}
                  </div>
                  <button
                    className="hover:text-primary cursor-pointer transition-colors"
                    onClick={() => navigate(`/staff/students?groupId=${group.id}`)}
                  >
                    Ro'yxatni ko'rish →
                  </button>
                </CardFooter>
              </Card>
            ) : (
              <Card
                key={group.id}
                className="hover:bg-muted/30 transition-colors border-none shadow-none bg-card/50"
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={
                        trackColor
                          ? { backgroundColor: `${trackColor}1a`, color: trackColor }
                          : { backgroundColor: '#e0e7ff', color: '#4f46e5' }
                      }
                    >
                      {group.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{group.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {group.grade}-sinf • {group.studentCount || 0} o'quvchi
                        {group.track && ` • ${group.track.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 text-xs"
                      onClick={() => {
                        setEditing(group);
                        setForm({
                          name: group.name,
                          grade: String(group.grade || '10'),
                          academicYearId: group.academicYearId ? String(group.academicYearId) : '',
                          trackId: group.trackId ? String(group.trackId) : '',
                        });
                        setModalOpen(true);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Tahrirlash
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive"
                      onClick={() => { setDeleting(group); setDeleteOpen(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? 'Guruhni tahrirlash' : 'Yangi guruh yaratish'}
        size="sm"
      >
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label>Guruh nomi *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Masalan: 10-A"
              className="font-bold text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Sinf (Daraja)</Label>
            <div className="flex gap-2">
              {['10', '11'].map((g) => (
                <Button
                  key={g}
                  variant={form.grade === g ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setForm({ ...form, grade: g })}
                >
                  {g}-sinf
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ay-select">Akademik yil *</Label>
            <Select
              value={form.academicYearId}
              onValueChange={(value) => setForm({ ...form, academicYearId: value })}
            >
              <SelectTrigger id="ay-select">
                <SelectValue placeholder="Akademik yil tanlang..." />
              </SelectTrigger>
              <SelectContent>
                {(allAcademicYears || []).map((ay: any) => (
                  <SelectItem key={ay.id} value={String(ay.id)}>
                    {ay.name}{ay.isCurrent ? ' (Joriy)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.academicYearId && (
              <p className="text-xs text-destructive">Akademik yil tanlanishi shart</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="track-select">Yo'nalish (ixtiyoriy)</Label>
            <Select
              value={form.trackId || 'none'}
              onValueChange={(value) => setForm({ ...form, trackId: value === 'none' ? '' : value })}
            >
              <SelectTrigger id="track-select">
                <SelectValue placeholder="Yo'nalish tanlang..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yo'nalishsiz —</SelectItem>
                {tracks.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setModalOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              {editing ? 'Saqlash' : 'Guruhni yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Guruhni o'chirish"
        description={`"${deleting?.name}" guruhini o'chirishga ishonchingiz komilmi? Bu amaldan so'ng ushbu guruhga bog'langan barcha o'quvchilar guruhsiz qolishi mumkin.`}
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          if (deleting) {
            await remove(deleting.id);
            setDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
