import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileIcon, Upload, FolderOpen, Grid, List, Search, Filter, Trash2, Edit2, Download, Eye, Loader2, Plus, FileText, Image as ImageIcon, Film, FileArchive, MoreVertical } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function MediaCenterPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [search, setSearch] = useState('');

  // Data fetching
  const { data: filesRes, isLoading } = useQuery({
    queryKey: ['staff', 'files', search],
    queryFn: async () => (await api.get(`/staff/files?q=${search}&limit=100`)).data
  });
  const files = filesRes?.data || [];

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.post('/staff/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'files'] });
      toast.success('Fayl muvaffaqiyatli yuklandi');
      setUploadOpen(false);
    },
    onError: () => toast.error('Fayl yuklashda xatolik')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/staff/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'files'] });
      toast.success('Fayl o\'chirildi');
    }
  });

  // Handlers
  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    uploadMutation.mutate(formData);
  };

  const getFileIcon = (mime: string) => {
    if (mime?.startsWith('image/')) return <ImageIcon className="h-10 w-10 text-blue-500" />;
    if (mime?.startsWith('video/')) return <Film className="h-10 w-10 text-purple-500" />;
    if (mime?.includes('pdf') || mime?.includes('document')) return <FileText className="h-10 w-10 text-orange-500" />;
    if (mime?.includes('zip') || mime?.includes('rar')) return <FileArchive className="h-10 w-10 text-yellow-500" />;
    return <FileIcon className="h-10 w-10 text-gray-500" />;
  };

  const columns: Column<any>[] = [
    { key: 'fileName', title: 'Nomi', render: (i) => (
      <div className="flex items-center gap-3">
        {getFileIcon(i.mimeType)}
        <div className="flex flex-col">
          <span className="font-medium text-sm">{i.fileName}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{i.purpose}</span>
        </div>
      </div>
    )},
    { key: 'sizeBytes', title: 'Hajmi', render: (i) => (i.sizeBytes / 1024 / 1024).toFixed(2) + ' MB' },
    { key: 'createdAt', title: 'Sana', render: (i) => dayjs(i.createdAt).format('DD.MM.YYYY') },
    { key: 'actions', title: 'Amallar', render: (i) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Eye className="h-4 w-4" /></Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => deleteMutation.mutate(i.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Fayllar va Media" 
        description="Akademiya hujjatlari va media fayllarini boshqarish" 
        action={{ label: 'Fayl yuklash', icon: <Upload className="h-4 w-4" />, onClick: () => setUploadOpen(true) }} 
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Fayllardan qidirish..." 
            className="pl-10 h-10" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg shrink-0">
          <Button 
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 px-3" 
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4 mr-2" /> Grid
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 px-3" 
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" /> List
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {files.map((file: any) => (
            <Card key={file.id} className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col items-center justify-center bg-muted/20">
                {getFileIcon(file.mimeType)}
                <div className="mt-4 text-center">
                  <p className="text-xs font-medium line-clamp-1 px-2">{file.fileName}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tight">{file.purpose}</p>
                </div>
              </CardContent>
              <CardFooter className="p-2 border-t flex justify-between items-center bg-card">
                <span className="text-[10px] text-muted-foreground">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(file.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
          {files.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 text-muted-foreground opacity-50">
              <FolderOpen className="h-16 w-16" />
              <p>Hozircha fayllar yuklanmagan</p>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <DataTable columns={columns} data={files} loading={isLoading} />
          </CardContent>
        </Card>
      )}

      {/* Upload SlideOver */}
      <SlideOver open={uploadOpen} onOpenChange={setUploadOpen} title="Yangi fayl yuklash" size="sm">
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fayl turi (Owner Type)</Label>
              <Select name="ownerType" defaultValue="TENANT">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">Akademiya (Umumiy)</SelectItem>
                  <SelectItem value="STUDENT">O'quvchi</SelectItem>
                  <SelectItem value="STAFF">Xodim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Maqsadi (Purpose)</Label>
              <Select name="purpose" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OTHER">Boshqa</SelectItem>
                  <SelectItem value="STUDENT_PHOTO">O'quvchi rasmi</SelectItem>
                  <SelectItem value="DOCUMENT">Hujjat</SelectItem>
                  <SelectItem value="ASSET">Resurslar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Faylni tanlang</Label>
              <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer relative">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Bosing yoki faylni bu yerga tashlang</p>
                  <p className="text-xs text-muted-foreground mt-1">Maksimal 20 MB gacha</p>
                </div>
                <input type="file" name="file" className="absolute inset-0 opacity-0 cursor-pointer" required />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setUploadOpen(false)}>Bekor qilish</Button>
            <Button type="submit" className="w-full sm:w-auto gap-2" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Yuklashni boshlash
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
