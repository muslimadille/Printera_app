import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableScroller } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { fetchLoginLogs, LoginLog } from '@/lib/userApi';
import { History, RefreshCw, Loader2 } from 'lucide-react';

const LoginHistory = ({ currentUser, currentPassword }: { currentUser: { username: string; is_admin: boolean }; currentPassword: string }) => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLoginLogs(currentUser.username, currentPassword);
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Card dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" /> سجل تسجيلات الدخول
        </CardTitle>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading} className="gap-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          تحديث
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد سجلات بعد</p>
        ) : (
          <TableScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">المستخدم</TableHead>
                  <TableHead className="text-start">وقت الدخول</TableHead>
                  <TableHead className="text-start">عنوان IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.username}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(log.logged_in_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{log.ip_address || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroller>
        )}
      </CardContent>
    </Card>
  );
};

export default LoginHistory;
