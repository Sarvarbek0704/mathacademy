import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Eye, Plus, Loader2, LayoutGrid, LayoutList, Filter } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import api from '@/lib/api';

function getInitials(fullName?: string, firstName?: string, lastName?: string): string {
  const name = fullName || `${firstName || ''} ${lastName || ''}`.trim();
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function getDisplayName(student: any): string {
  return (
    student.fullName ||
    student.full_name ||
    `${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}`.trim() ||
    '-'
  );
}

export default function StudentsPage() {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const {
    data: students,
    loading,
    total,
    page,
    totalPages,
    search,
    setSearch,
    setPage,
    create,
    update,
    remove,
    refetch,
  } = useCrud({
    endpoint: '/staff/students',
    queryParams: selectedGroup !== 'all' ? { groupId: selectedGroup } : {},
  });

  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api.get('/staff/groups');
        const groupsData = res.data?.data || res.data?.items || res.data || [];
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } catch {
        // silent — not critical
      } finally {
        setGroupsLoading(false);
      }
    };
    fetchGroups();
  }, []);

  // Re-fetch when group filter changes
  useEffect(() => {
    refetch();
  }, [selectedGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialForm = {
    fullName: '',
    gender: 'MALE',
    birthDate: '',
    admissionGrade: '10',
    admissionDate: new Date().toISOString().split('T')[0],
    expectedGraduationYear: new Date().getFullYear() + 2,
    groupId: '',
    livingTypeCode: 'DAY_ONLY',
    guardianFullName: '',
    guardianPhone: '',
    guardianRelation: 'FATHER',
    status: 'ACTIVE',
  };

  const [form, setForm] = useState<any>(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormErrors({});
    setForm({
      fullName: getDisplayName(item),
      gender: item.gender || 'MALE',
      birthDate: item.birthDate || item.birth_date || '',
      admissionGrade: String(item.admissionGrade || item.admission_grade || '10'),
      admissionDate: item.admissionDate || item.admission_date || '',
      expectedGraduationYear: item.expectedGraduationYear || item.expected_graduation_year || new Date().getFullYear() + 2,
      groupId: String(item.group?.id || item.groupId || item.group_id || ''),
      livingTypeCode: item.livingTypeCode || item.living_type_code || 'DAY_ONLY',
      guardianFullName: item.guardianFullName || item.guardian_full_name || '',
      guardianPhone: item.guardianPhone || item.guardian_phone || '',
      guardianRelation: item.guardianRelation || item.guardian_relation || 'FATHER',
      status: item.status || 'ACTIVE',
    });
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = "F.I.Sh kiritilishi shart";
    if (!form.admissionDate) errors.admissionDate = "Qabul sanasi kiritilishi shart";
    if (!form.guardianFullName.trim()) errors.guardianFullName = "Vasiy ismi kiritilishi shart";
    if (form.guardianPhone && !/^\+?[\d\s\-()]{7,20}$/.test(form.guardianPhone)) {
      errors.guardianPhone = "Telefon raqami noto'g'ri formatda";
    }
    const gradYear = parseInt(form.expectedGraduationYear, 10);
    if (isNaN(gradYear) || gradYear < 2000 || gradYear > 2100) {
      errors.expectedGraduationYear = "Bitiruv yili noto'g'ri";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Formada xatoliklar bor, iltimos tekshiring");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...form,
        fullName: form.fullName.trim(),
        admissionGrade: parseInt(form.admissionGrade, 10),
        expectedGraduationYear: parseInt(form.expectedGraduationYear, 10),
      };

      if (!payload.groupId) delete payload.groupId;
      if (!payload.birthDate) delete payload.birthDate;

      if (editing) {
        await update(editing.id, payload);
      } else {
        await create(payload);
      }
      setModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) {
      await remove(deleting.id);
      setDeleteOpen(false);
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="O'quvchilar"
        description="Barcha o'quvchilar ro'yxati"
        action={{
          label: "Yangi o'quvchi",
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate,
        }}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Input
            placeholder="Ism, familiya yoki ID bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              title="Grid ko'rinishi"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              title="Table ko'rinishi"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Guruhni tanlang..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha Guruhlar</SelectItem>
              {!groupsLoading && groups.map((group: any) => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.name || group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            Jami: {total} ta o'quvchi
          </span>
        </div>
      </div>

      {/* Students Grid/Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            {search || selectedGroup !== 'all' ? "Qidiruv bo'yicha o'quvchilar topilmadi" : "O'quvchilar mavjud emas"}
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>F.I.Sh</TableHead>
                  <TableHead className="w-32">O'quvchi ID</TableHead>
                  <TableHead>Guruh</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-20">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student: any, idx: number) => (
                  <TableRow key={student.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs text-muted-foreground">
                      {(page - 1) * 20 + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {getInitials(student.fullName || student.full_name, student.firstName || student.first_name, student.lastName || student.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{getDisplayName(student)}</span>
                          <span className="text-xs text-muted-foreground">
                            {student.guardianFullName || student.guardian_full_name || '-'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono font-bold text-primary">
                      {student.studentId || student.student_id || '-'}
                    </TableCell>
                    <TableCell className="text-sm">{student.group?.name || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={student.status || 'ACTIVE'} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/staff/students/${student.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setDeleting(student); setDeleteOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Jami: {total} ta o'quvchi | {page}/{totalPages}-sahifa
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                  Oldingi
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                  Keyingi
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student: any) => (
              <Card key={student.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {getInitials(student.fullName || student.full_name, student.firstName || student.first_name, student.lastName || student.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-2">{getDisplayName(student)}</p>
                        <p className="text-xs text-muted-foreground font-mono font-bold">
                          ID: {student.studentId || student.student_id || '-'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={student.status || 'ACTIVE'} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm border-t pt-3">
                    {(student.grade || student.admissionGrade) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sinf:</span>
                        <Badge variant="outline">{student.grade || student.admissionGrade}-sinf</Badge>
                      </div>
                    )}
                    {student.group?.name && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Guruh:</span>
                        <span className="font-medium text-xs">{student.group.name}</span>
                      </div>
                    )}
                    {(student.guardianFullName || student.guardian_full_name) && (
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">Vasiy:</span>
                        <span className="font-medium text-xs text-right max-w-[160px] truncate">
                          {student.guardianFullName || student.guardian_full_name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/staff/students/${student.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ko'rish
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(student)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setDeleting(student); setDeleteOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Jami: {total} ta o'quvchi | {page}/{totalPages}-sahifa
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                  Oldingi
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                  Keyingi
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Slide Over */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "O'quvchini tahrirlash" : "Yangi o'quvchi qo'shish"}
        description="Barcha majburiy maydonlarni to'ldiring"
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">O'quvchi ma'lumotlari</h3>

            {editing && (
              <div className="flex items-center gap-4">
                <AvatarUpload
                  ownerType="STUDENT"
                  ownerId={editing.id}
                  currentUrl={editing.photoUrl || editing.photo_url}
                  purpose="STUDENT_PHOTO"
                  size="lg"
                />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium">Rasm yuklash</p>
                  <p>JPG, PNG, WebP • maks 5MB</p>
                  <p>Kamera belgisini bosing</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>F.I.Sh *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ism va Familiya"
                className={formErrors.fullName ? 'border-destructive' : ''}
              />
              {formErrors.fullName && <p className="text-xs text-destructive">{formErrors.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jinsi *</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Erkak</SelectItem>
                    <SelectItem value="FEMALE">Ayol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tug'ilgan sana</Label>
                <DatePicker
                  value={form.birthDate}
                  onChange={(date) => setForm({ ...form, birthDate: date })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qabul sinfi *</Label>
                <Select
                  value={form.admissionGrade}
                  onValueChange={(v) => setForm({ ...form, admissionGrade: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8-sinf</SelectItem>
                    <SelectItem value="9">9-sinf</SelectItem>
                    <SelectItem value="10">10-sinf</SelectItem>
                    <SelectItem value="11">11-sinf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bitiruv yili *</Label>
                <Input
                  type="number"
                  value={form.expectedGraduationYear}
                  onChange={(e) => setForm({ ...form, expectedGraduationYear: e.target.value })}
                  className={formErrors.expectedGraduationYear ? 'border-destructive' : ''}
                />
                {formErrors.expectedGraduationYear && (
                  <p className="text-xs text-destructive">{formErrors.expectedGraduationYear}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Guruh</Label>
              <Select value={form.groupId || ''} onValueChange={(v) => setForm({ ...form, groupId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group: any) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qabul sanasi *</Label>
                <DatePicker
                  value={form.admissionDate}
                  onChange={(date) => setForm({ ...form, admissionDate: date })}
                />
                {formErrors.admissionDate && (
                  <p className="text-xs text-destructive">{formErrors.admissionDate}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Yashash turi *</Label>
                <Select
                  value={form.livingTypeCode}
                  onValueChange={(v) => setForm({ ...form, livingTypeCode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY_ONLY">Faqat kunduzgi</SelectItem>
                    <SelectItem value="WEEKDAYS_ONLY">5 kunlik yotoqxona</SelectItem>
                    <SelectItem value="FULL_BOARD">To'liq yotoqxona (7 kun)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Faol</SelectItem>
                    <SelectItem value="GRADUATED">Bitirgan</SelectItem>
                    <SelectItem value="EXPELLED">Chetlatilgan</SelectItem>
                    <SelectItem value="WITHDRAWN">Chiqib ketgan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">Ota-ona ma'lumotlari</h3>

            <div className="space-y-2">
              <Label>Aloqadorligi *</Label>
              <Select
                value={form.guardianRelation}
                onValueChange={(v) => setForm({ ...form, guardianRelation: v })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Ota-ona (Vasiy) F.I.Sh *</Label>
              <Input
                value={form.guardianFullName}
                onChange={(e) => setForm({ ...form, guardianFullName: e.target.value })}
                placeholder="Vasiyning ism-familiyasi"
                className={formErrors.guardianFullName ? 'border-destructive' : ''}
              />
              {formErrors.guardianFullName && (
                <p className="text-xs text-destructive">{formErrors.guardianFullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Telefon raqami</Label>
              <Input
                value={form.guardianPhone}
                onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                placeholder="+998901234567"
                className={formErrors.guardianPhone ? 'border-destructive' : ''}
              />
              {formErrors.guardianPhone && (
                <p className="text-xs text-destructive">{formErrors.guardianPhone}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setModalOpen(false)}
            disabled={isSubmitting}
          >
            Bekor qilish
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? 'Saqlash' : 'Yaratish'}
          </Button>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="O'quvchini o'chirish"
        description={`"${deleting ? getDisplayName(deleting) : ''}" ni o'chirishga ishonchingiz komilmi? Bu amal qaytarib bo'lmaydi.`}
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
