import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function StudentsPage() {
  const { data, loading, total, page, totalPages, setSearch, setPage, create, update, remove } = useCrud({ endpoint: '/staff/students' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const initialForm = {
    fullName: '',
    gender: 'MALE',
    birthDate: '',
    admissionGrade: '10',
    admissionDate: new Date().toISOString().split('T')[0],
    expectedGraduationYear: new Date().getFullYear() + 2,
    livingTypeCode: 'DAY_ONLY',
    guardianFullName: '',
    guardianPhone: '',
    guardianRelation: 'FATHER',
    status: 'ACTIVE'
  };

  const [form, setForm] = useState<any>(initialForm);

  const columns: Column<any>[] = [
    {
      key: 'name', title: "O'quvchi",
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {(item.firstName || item.first_name || '?')[0]}{(item.lastName || item.last_name || '?')[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{item.firstName || item.first_name} {item.lastName || item.last_name}</p>
            <p className="text-xs text-muted-foreground">{item.studentId || item.student_id}</p>
          </div>
        </div>
      ),
    },
    { key: 'grade', title: 'Sinf', render: (item) => <span className="font-medium">{item.grade || '-'}</span> },
    { key: 'group', title: 'Guruh', render: (item) => item.group?.name || item.groupName || '-' },
    { key: 'status', title: 'Status', render: (item) => <StatusBadge status={item.status || 'ACTIVE'} /> },
    { key: 'livingType', title: 'Yashash turi', render: (item) => item.livingType || item.living_type || '-' },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      fullName: item.fullName || item.full_name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || '',
      gender: item.gender || 'MALE',
      birthDate: item.birthDate ? new Date(item.birthDate).toISOString().split('T')[0] : '',
      admissionGrade: String(item.admissionGrade || item.grade || '10'),
      admissionDate: item.admissionDate ? new Date(item.admissionDate).toISOString().split('T')[0] : '',
      expectedGraduationYear: item.expectedGraduationYear || (new Date().getFullYear() + 2),
      livingTypeCode: item.livingTypeCode || item.living_type_code || 'DAY_ONLY',
      guardianFullName: item.guardianFullName || item.guardian_full_name || '',
      guardianPhone: item.guardianPhone || item.guardian_phone || '',
      guardianRelation: item.guardianRelation || item.guardian_relation || 'FATHER',
      status: item.status || 'ACTIVE',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      admissionGrade: parseInt(form.admissionGrade, 10),
      expectedGraduationYear: parseInt(form.expectedGraduationYear, 10),
    };

    if (editing) {
      await update(editing.id, payload);
    } else {
      await create(payload);
    }
    setModalOpen(false);
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
      <PageHeader title="O'quvchilar" description="Barcha o'quvchilar ro'yxati"
        action={{ label: "Yangi o'quvchi", onClick: openCreate }} />

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchable
        searchPlaceholder="Ism, familiya yoki ID bo'yicha qidirish..."
        onSearch={setSearch}
        pagination={{ page, totalPages, total, onPageChange: setPage }}
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      <SlideOver open={modalOpen} onOpenChange={setModalOpen}
        title={editing ? "O'quvchini tahrirlash" : "Yangi o'quvchi qo'shish"}
        description="Barcha majburiy maydonlarni to'ldiring" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">O'quvchi ma'lumotlari</h3>
            
            <div className="space-y-2">
              <Label>F.I.Sh</Label>
              <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Ism va Familiya" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jinsi</Label>
                <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Erkak</SelectItem>
                    <SelectItem value="FEMALE">Ayol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tug'ilgan sana</Label>
                <Input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qabul sinfi</Label>
                <Select value={form.admissionGrade} onValueChange={v => setForm({ ...form, admissionGrade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8-sinf</SelectItem>
                    <SelectItem value="9">9-sinf</SelectItem>
                    <SelectItem value="10">10-sinf</SelectItem>
                    <SelectItem value="11">11-sinf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bitiruv yili</Label>
                <Input type="number" value={form.expectedGraduationYear} onChange={e => setForm({ ...form, expectedGraduationYear: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qabul sanasi</Label>
                <Input type="date" value={form.admissionDate} onChange={e => setForm({ ...form, admissionDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Yashash turi</Label>
                <Select value={form.livingTypeCode} onValueChange={v => setForm({ ...form, livingTypeCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Aloqadorligi</Label>
              <Select value={form.guardianRelation} onValueChange={v => setForm({ ...form, guardianRelation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FATHER">Ota</SelectItem>
                  <SelectItem value="MOTHER">Ona</SelectItem>
                  <SelectItem value="GUARDIAN">Vasiy</SelectItem>
                  <SelectItem value="OTHER">Boshqa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ota-ona (Vasiy) F.I.Sh</Label>
              <Input value={form.guardianFullName} onChange={e => setForm({ ...form, guardianFullName: e.target.value })} placeholder="Vasiyning ism-familiyasi" />
            </div>

            <div className="space-y-2">
              <Label>Telefon raqami</Label>
              <Input value={form.guardianPhone} onChange={e => setForm({ ...form, guardianPhone: e.target.value })} placeholder="+998901234567" />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
          <Button className="w-full sm:w-auto" onClick={handleSubmit}>{editing ? 'Saqlash' : 'Yaratish'}</Button>
        </div>
      </SlideOver>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen}
        title="O'quvchini o'chirish" description={`"${deleting?.firstName || ''} ${deleting?.lastName || ''}" ni o'chirishga ishonchingiz komilmi?`}
        confirmText="O'chirish" variant="destructive" onConfirm={handleDelete} />
    </div>
  );
}
