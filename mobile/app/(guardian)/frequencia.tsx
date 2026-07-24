import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface AttendanceRecord { date: string; present: boolean; subject_name?: string }
interface Summary { total: number; present: number; percent: number }

export default function GuardianFrequencia() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: AttendanceRecord[]; summary?: Summary }>('/api/guardian/attendance')
      .then(r => { setRecords(r.data ?? []); setSummary(r.summary ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Frequência">
      {summary && (
        <Card>
          <View className="flex-row justify-between items-center">
            <View><Text className="text-ink-muted text-xs">Presenças</Text><Text className="text-success font-bold text-xl">{summary.present}</Text></View>
            <View className="items-center"><Text className="text-ink-muted text-xs">Frequência</Text><Text className={`font-bold text-2xl ${summary.percent >= 75 ? 'text-success' : 'text-danger'}`}>{summary.percent.toFixed(0)}%</Text></View>
            <View className="items-end"><Text className="text-ink-muted text-xs">Faltas</Text><Text className="text-danger font-bold text-xl">{summary.total - summary.present}</Text></View>
          </View>
        </Card>
      )}

      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : records.map((r, i) => (
          <View key={i} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2 mb-1.5">
            <View className="flex-1">
              <Text className="text-ink text-sm">{new Date(r.date).toLocaleDateString('pt-BR')}</Text>
              {r.subject_name && <Text className="text-ink-muted text-xs">{r.subject_name}</Text>}
            </View>
            <Badge label={r.present ? 'Presente' : 'Falta'} tone={r.present ? 'success' : 'danger'} />
          </View>
        ))
      }
    </Screen>
  );
}
