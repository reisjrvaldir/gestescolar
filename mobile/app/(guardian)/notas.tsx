import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

interface Report { subject_name: string; grade_1?: number; grade_2?: number; grade_3?: number; grade_4?: number; final?: number }

export default function GuardianNotas() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Report[] }>('/api/guardian/grades')
      .then(r => setReports(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function gradeColor(n?: number) {
    if (n == null) return 'text-ink-muted';
    if (n >= 7) return 'text-success';
    if (n >= 5) return 'text-warning';
    return 'text-danger';
  }

  return (
    <Screen title="Boletim">
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : reports.length === 0
          ? <Text className="text-ink-muted text-center mt-8">Sem notas disponíveis.</Text>
          : reports.map(r => (
            <Card key={r.subject_name}>
              <Text className="text-ink font-bold mb-2">{r.subject_name}</Text>
              <View className="flex-row justify-between">
                {([1,2,3,4] as const).map(b => (
                  <View key={b} className="items-center">
                    <Text className="text-ink-subtle text-xs">{b}º Bim</Text>
                    <Text className={`font-bold text-base ${gradeColor(r[`grade_${b}`])}`}>
                      {r[`grade_${b}`] != null ? r[`grade_${b}`]!.toFixed(1) : '—'}
                    </Text>
                  </View>
                ))}
                <View className="items-center">
                  <Text className="text-ink-subtle text-xs">Final</Text>
                  <Text className={`font-bold text-base ${gradeColor(r.final)}`}>
                    {r.final != null ? r.final.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
            </Card>
          ))
      }
    </Screen>
  );
}
