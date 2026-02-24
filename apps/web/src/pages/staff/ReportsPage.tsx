import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileDown, 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Download,
  Loader2,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export default function ReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);

  // Data for Charts
  const { data: statsRes } = useQuery({
    queryKey: ['staff', 'stats', 'trends'],
    queryFn: async () => (await api.get('/staff/dashboard/stats')).data
  });
  
  // Mock/Derived data for visual representation if real data is simple
  const attendanceData = [
    { name: 'Dush', rate: 94 },
    { name: 'Sesh', rate: 92 },
    { name: 'Chor', rate: 96 },
    { name: 'Pay', rate: 91 },
    { name: 'Jum', rate: 95 },
    { name: 'Shan', rate: 88 },
  ];

  const gradeTrends = [
    { month: 'Sent', avg: 72 },
    { month: 'Okt', avg: 75 },
    { month: 'Noy', avg: 74 },
    { month: 'Dek', avg: 78 },
    { month: 'Yan', avg: 82 },
    { month: 'Fev', avg: 85 },
  ];

  const handleExport = async (type: 'ATTENDANCE' | 'BILLING' | 'ASSESSMENTS') => {
    setExporting(type);
    try {
      let data: any[] = [];
      let filename = `report_${type.toLowerCase()}_${dayjs().format('YYYYMMDD')}.csv`;
      
      if (type === 'ATTENDANCE') {
        const res = await api.get('/staff/attendance/sessions?limit=1000');
        data = res.data?.data || [];
        // Map to flat structure for CSV
        const csvRows = [
          ['ID', 'Sana', 'Guruh', 'Mavzu', 'Davomat %'].join(','),
          ...data.map(i => [
            i.id, 
            dayjs(i.date).format('DD.MM.YYYY'), 
            i.group?.name || '', 
            `"${i.topic || ''}"`, 
            i.presentCount ? Math.round((i.presentCount / (i.presentCount + i.absentCount)) * 100) : 0
          ].join(','))
        ];
        downloadCSV(csvRows.join('\n'), filename);
      } else if (type === 'BILLING') {
        const res = await api.get('/staff/billing/invoices?limit=1000');
        data = res.data?.data || [];
        const csvRows = [
          ['ID', 'O\'quvchi', 'Turi', 'Summa', 'Holat', 'Muddati'].join(','),
          ...data.map(i => [
            i.id, 
            `"${i.student?.fullName || ''}"`, 
            i.type, 
            i.amount, 
            i.status, 
            dayjs(i.dueDate).format('DD.MM.YYYY')
          ].join(','))
        ];
        downloadCSV(csvRows.join('\n'), filename);
      } else if (type === 'ASSESSMENTS') {
        const res = await api.get('/staff/assessments?limit=1000');
        data = res.data?.data || [];
        const csvRows = [
          ['ID', 'Nomi', 'Fan', 'Guruh', 'Sana', 'Maksimal Ball'].join(','),
          ...data.map(i => [
            i.id, 
            `"${i.title || ''}"`, 
            i.subject?.name || '', 
            i.group?.name || '', 
            dayjs(i.date).format('DD.MM.YYYY'), 
            i.maxScore
          ].join(','))
        ];
        downloadCSV(csvRows.join('\n'), filename);
      }
      toast.success(`${type} hisoboti yuklab olindi`);
    } catch (e) {
      toast.error('Xatolik yuz berdi');
    } finally {
      setExporting(null);
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Hisobotlar va Analitika" 
        description="Akademiya faoliyati bo'yicha batafsil statistik ma'lumotlar va hisobotlar"
      />

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" /> Analitika Hub</TabsTrigger>
          <TabsTrigger value="exports" className="gap-2"><FileDown className="h-4 w-4" /> Ma'lumotlarni eksport qilish</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="overflow-hidden border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider">O'rtacha o'zlashtirish</CardDescription>
                <CardTitle className="text-3xl flex items-baseline gap-2">
                  82.4%
                  <span className="text-[10px] text-green-500 flex items-center bg-green-500/10 px-1 rounded"><ArrowUpRight className="h-3 w-3" /> 4.2%</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[80px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gradeTrends}>
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-sm bg-gradient-to-br from-purple-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider">Haftalik Davomat</CardDescription>
                <CardTitle className="text-3xl flex items-baseline gap-2">
                  92.8%
                  <span className="text-[10px] text-red-500 flex items-center bg-red-500/10 px-1 rounded"><ArrowDownRight className="h-3 w-3" /> 1.5%</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[80px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData}>
                      <Bar dataKey="rate" fill="#a855f7" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-sm bg-gradient-to-br from-orange-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider">To'lovlar intizomi</CardDescription>
                <CardTitle className="text-3xl flex items-baseline gap-2">
                  76.2%
                  <span className="text-[10px] text-green-500 flex items-center bg-green-500/10 px-1 rounded"><ArrowUpRight className="h-3 w-3" /> 12%</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 h-[80px] mt-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[10px]"><span>To'langan</span><span>76%</span></div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: '76%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> O'zlashtirish dinamikasi
                </CardTitle>
                <CardDescription>Oylik o'rtacha ballar o'zgarishi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gradeTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[60, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#3b82f6', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" /> Kunlik Davomat
                </CardTitle>
                <CardDescription>Hafta davomida o'rtacha davomat ko'rsatkichi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      />
                      <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                        {attendanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.rate < 90 ? '#ef4444' : '#a855f7'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exports">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-2">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-base">Davomat hisoboti</CardTitle>
                <CardDescription className="text-xs">Barcha darslardagi davomat ma'lumotlarini CSV formatida yuklab olish</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full gap-2 h-10" 
                  variant="outline" 
                  onClick={() => handleExport('ATTENDANCE')}
                  disabled={exporting === 'ATTENDANCE'}
                >
                  {exporting === 'ATTENDANCE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Yuklab olish (CSV)
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-2">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-base">Moliyaviy hisobot</CardTitle>
                <CardDescription className="text-xs">Invoyslar, to'lovlar va qarzdorlik haqidagi ma'lumotlar</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full gap-2 h-10" 
                  variant="outline" 
                  onClick={() => handleExport('BILLING')}
                  disabled={exporting === 'BILLING'}
                >
                  {exporting === 'BILLING' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Yuklab olish (CSV)
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-2">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-base">O'zlashtirish hisoboti</CardTitle>
                <CardDescription className="text-xs">Imtihonlar, nazorat ishlari va o'quvchilar ballari</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full gap-2 h-10" 
                  variant="outline" 
                  onClick={() => handleExport('ASSESSMENTS')}
                  disabled={exporting === 'ASSESSMENTS'}
                >
                  {exporting === 'ASSESSMENTS' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Yuklab olish (CSV)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
