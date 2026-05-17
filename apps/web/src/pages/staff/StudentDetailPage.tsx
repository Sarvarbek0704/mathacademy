import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Loader2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Users,
  BookOpen,
  TrendingUp,
  Clock,
  Target,
  AlertCircle,
  CreditCard,
  AlertTriangle,
  Award,
  Home,
  GraduationCap,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch main student data first (required)
        const res = await api.get(`/staff/students/${id}`);
        const studentData = res.data?.data || res.data;
        if (!studentData) throw new Error('NOT_FOUND');
        setStudent(studentData);

        // Fetch all supplementary data in parallel
        const [statsRes, attendanceRes, paymentsRes, violationsRes, resultsRes] =
          await Promise.allSettled([
            api.get(`/staff/students/${id}/stats`),
            api.get(`/staff/students/${id}/attendance`),
            api.get(`/staff/students/${id}/payments`),
            api.get(`/staff/students/${id}/violations`),
            api.get(`/staff/students/${id}/assessments`),
          ]);

        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data?.data || statsRes.value.data);
        }
        if (attendanceRes.status === 'fulfilled') {
          setAttendance(attendanceRes.value.data?.data || attendanceRes.value.data);
        }
        if (paymentsRes.status === 'fulfilled') {
          const d = paymentsRes.value.data?.data || paymentsRes.value.data?.items || paymentsRes.value.data;
          setPayments(Array.isArray(d) ? d : []);
        }
        if (violationsRes.status === 'fulfilled') {
          const d = violationsRes.value.data?.data || violationsRes.value.data?.items || violationsRes.value.data;
          setViolations(Array.isArray(d) ? d : []);
        }
        if (resultsRes.status === 'fulfilled') {
          setResults(resultsRes.value.data?.data || resultsRes.value.data);
        }
      } catch {
        toast.error("O'quvchi ma'lumotlarini yuklashda xatolik");
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Orqaga
        </Button>
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            O'quvchi topilmadi
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRelationLabel = (relation: string) => {
    const map: Record<string, string> = {
      FATHER: 'Ota',
      MOTHER: 'Ona',
      GUARDIAN: 'Vasiy',
      OTHER: 'Boshqa',
    };
    return map[relation] || relation;
  };

  const getLivingTypeLabel = (code: string) => {
    const map: Record<string, string> = {
      DAY_ONLY: 'Faqat kunduzgi',
      WEEKDAYS_ONLY: '5 kunlik yotoqxona',
      FULL_BOARD: "To'liq yotoqxona (7 kun)",
    };
    return map[code] || code;
  };

  const getGenderLabel = (gender: string) => {
    return gender === 'MALE' ? 'Erkak' : 'Ayol';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'Faol',
      GRADUATED: 'Bitirgan',
      EXPELLED: 'Chetlatilgan',
      WITHDRAWN: 'Chiqib ketgan',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      GRADUATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      EXPELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      WITHDRAWN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const studentName =
    `${student.firstName || student.first_name} ${student.lastName || student.last_name}`.trim() ||
    'N/A';
  const studentId = student.studentId || student.student_id || 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Orqaga
        </Button>
        <h1 className="text-3xl font-bold">O'quvchi MA'LUMOTLARI</h1>
        <div className="w-12" />
      </div>

      {/* Student Header Card - BIG AND PROMINENT */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-6 flex-1">
              <Avatar className="h-28 w-28 border-4 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {(student.firstName?.[0] || student.first_name?.[0] || '?').toUpperCase()}
                  {(student.lastName?.[0] || student.last_name?.[0] || '?').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-4xl font-bold text-primary">{studentName}</h2>
                <p className="text-2xl text-muted-foreground mt-2 font-mono font-bold">
                  ID: {studentId}
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge className={`${getStatusColor(student.status || 'ACTIVE')} text-lg`}>
                    {getStatusLabel(student.status || 'ACTIVE')}
                  </Badge>
                  {student.group?.name && (
                    <Badge variant="outline" className="text-lg">
                      {student.group.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* MAIN STATISTICS - 8 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Average Grade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              O'rtacha Ball
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              {stats?.averageGrade ? stats.averageGrade.toFixed(2) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalTests ? `${stats.totalTests} ta test` : "Testlar yo'q"}
            </p>
          </CardContent>
        </Card>

        {/* 2. Attendance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-500" />
              Davomatlik
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              {attendance?.percentageAttended || stats?.attendancePercentage
                ? `${Math.round(attendance?.percentageAttended || stats?.attendancePercentage || 0)}%`
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {attendance?.totalClasses || stats?.totalClasses
                ? `${attendance?.totalClasses || stats?.totalClasses} ta dars`
                : '—'}
            </p>
          </CardContent>
        </Card>

        {/* 3. Ranking */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-500" />
              Guruhdagi O'rni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600">
              {stats?.groupRank ? `#${stats.groupRank}` : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.groupSize ? `${stats.groupSize} o'quvchidan` : '—'}
            </p>
          </CardContent>
        </Card>

        {/* 4. Total Paid Amount */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-500" />
              To'langan Summa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {payments.length > 0
                ? payments
                    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
                    .toLocaleString()
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{payments.length} ta to'lov</p>
          </CardContent>
        </Card>

        {/* 5. School Years */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-500" />
              O'qiyotgan Vaqti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-cyan-600">
              {student.admissionDate
                ? Math.floor(
                    (new Date().getTime() - new Date(student.admissionDate).getTime()) /
                      (1000 * 60 * 60 * 24 * 365),
                  ) + 1
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">yil</p>
          </CardContent>
        </Card>

        {/* 6. Violations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Qoidabuzarliklar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{violations.length}</div>
            <p className="text-xs text-muted-foreground mt-2">ta xiloflik</p>
          </CardContent>
        </Card>

        {/* 7. Pending Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              To'longani Qolgan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {stats?.pendingPayments || '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">so'm</p>
          </CardContent>
        </Card>

        {/* 8. Achievements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4 text-green-600" />
              Mukofotlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{stats?.awards || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">ta mukofot</p>
          </CardContent>
        </Card>
      </div>

      {/* DETAILED SECTIONS */}

      {/* Attendance Section */}
      {attendance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
              Davomatlik Diagrammasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Davomatlik Darajasi</span>
                <span className="text-sm font-bold">
                  {Math.round(attendance?.percentageAttended || 0)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(attendance?.percentageAttended || 0, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center border-r">
                <div className="text-2xl font-bold text-green-600">
                  {attendance?.presentDays || 0}
                </div>
                <p className="text-xs text-muted-foreground">Kelgan</p>
              </div>
              <div className="text-center border-r">
                <div className="text-2xl font-bold text-red-600">{attendance?.absentDays || 0}</div>
                <p className="text-xs text-muted-foreground">Kelmagan</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {attendance?.lateDays || 0}
                </div>
                <p className="text-xs text-muted-foreground">Kechikkan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results/Grades Section */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-500" />
              Natijalar Diagrammasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.subjectResults && Object.keys(results.subjectResults).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(results.subjectResults).map(([subject, data]: any) => (
                  <div key={subject} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{subject}</span>
                      <span className="text-sm font-bold">
                        {data?.score?.toFixed(1) || '-'}/100
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full"
                        style={{
                          width: `${Math.min(((data?.score || 0) / 100) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Natijalar topilmadi</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payments Section */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-500" />
              To'lov Tarixchi ({payments.length} ta)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {payments.map((payment: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{payment.description || "To'lov"}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.createdAt
                        ? new Date(payment.createdAt).toLocaleDateString('uz-UZ')
                        : "Sana ko'rsatilmagan"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg font-bold">
                    {payment.amount?.toLocaleString()} so'm
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Jami to'langan:</span>
                <span className="text-lg font-bold text-purple-600">
                  {payments
                    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
                    .toLocaleString()}{' '}
                  so'm
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Violations Section */}
      {violations.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Qoidabuzarliklar ({violations.length} ta)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {violations.map((violation: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-red-900 dark:text-red-100">
                        {violation.description || 'Qoidabuzarlik'}
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                        {violation.date
                          ? new Date(violation.date).toLocaleDateString('uz-UZ')
                          : violation.createdAt
                            ? new Date(violation.createdAt).toLocaleDateString('uz-UZ')
                            : "Sana ko'rsatilmagan"}
                      </p>
                    </div>
                    {violation.severity && (
                      <Badge
                        className={`${
                          violation.severity === 'CRITICAL'
                            ? 'bg-red-600'
                            : violation.severity === 'HIGH'
                              ? 'bg-orange-600'
                              : 'bg-yellow-600'
                        } text-white`}
                      >
                        {violation.severity}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Shaxsiy Ma'lumotlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Jinsi:</span>
                <span className="font-medium">{getGenderLabel(student.gender || 'MALE')}</span>
              </div>

              {student.birthDate && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Tug'ilgan sana:</span>
                  <span className="font-medium">
                    {new Date(student.birthDate).toLocaleDateString('uz-UZ')}
                  </span>
                </div>
              )}

              {student.admissionDate && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Qabul sanasi:</span>
                  <span className="font-medium">
                    {new Date(student.admissionDate).toLocaleDateString('uz-UZ')}
                  </span>
                </div>
              )}

              {student.expectedGraduationYear && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Bitiruv yili:</span>
                  <span className="font-medium">{student.expectedGraduationYear}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Academic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              O'qish Ma'lumotlari
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {student.grade && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Hozirgi sinf:</span>
                  <Badge>{student.grade}-sinf</Badge>
                </div>
              )}

              {student.group?.name && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Guruh:</span>
                  <span className="font-medium">{student.group.name}</span>
                </div>
              )}

              {student.admissionGrade && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Qabul sinfi:</span>
                  <Badge variant="outline">{student.admissionGrade}-sinf</Badge>
                </div>
              )}

              {student.livingType?.name ||
                (student.living_type && (
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      Yashash turi:
                    </span>
                    <span className="font-medium">
                      {student.livingType?.name || getLivingTypeLabel(student.living_type)}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guardian Info */}
      {(student.guardianFullName || student.guardian_full_name) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Ota-ona / Vasiy Ma'lumotlari
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Aloqadorligi:</span>
              <span className="font-medium">
                {getRelationLabel(
                  student.guardianRelation || student.guardian_relation || 'FATHER',
                )}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">F.I.Sh:</span>
              <span className="font-medium">
                {student.guardianFullName || student.guardian_full_name}
              </span>
            </div>

            {(student.guardianPhone || student.guardian_phone) && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telefon:
                </span>
                <a
                  href={`tel:${student.guardianPhone || student.guardian_phone}`}
                  className="font-medium text-primary hover:underline"
                >
                  {student.guardianPhone || student.guardian_phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
