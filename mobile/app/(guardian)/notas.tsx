import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

interface Student { id: string; name: string; class_name?: string }
interface GradeRow { student_id: string; subject: string; period: string; grade: number }
interface Boletim { students: Student[]; grades: GradeRow[]; settings?: { passing_grade?: number } }

function gradeColor(n: number | null, pass: number) {
  if (n == null) return 'text-ink-muted';
  return n >= pass ? 'text-success' : n >= pass - 2 ? 'text-warning' : 'text-danger';
}

export default function GuardianNotas() {
  const [data, setData] = useState<Boletim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Boletim }>('/api/grades/my-boletim')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Screen title="Boletim"><ActivityIndicator color="#1A56DB" className="mt-8" /></Screen>
  );

  const pass = data?.settings?.passing_grade ?? 7;

  if (!data?.students?.length) return (
    <Screen title="Boletim"><Text className="text-ink-muted text-center mt-8">Sem notas disponíveis.</Text></Screen>
  );

  return (
    <Screen title="Boletim">
      {data.students.map((st) => {
        // agrupa notas por matéria → média
        const bySubject = new Map<string, number[]>();
        data.grades.filter((g) => g.student_id === st.id).forEach((g) => {
          if (!bySubject.has(g.subject)) bySubject.set(g.subject, []);
          bySubject.get(g.subject)!.push(g.grade);
        });
        const subjects = [...bySubject.entries()].map(([subject, grades]) => ({
          subject,
          avg: grades.reduce((a, b) => a + b, 0) / grades.length,
        }));

        return (
          <Card key={st.id}>
            <Text className="text-ink font-bold mb-0.5">{st.name}</Text>
            {st.class_name && <Text className="text-ink-muted text-xs mb-3">{st.class_name}</Text>}
            {subjects.length === 0 ? (
              <Text className="text-ink-muted text-sm">Sem notas lançadas.</Text>
            ) : (
              subjects.map((s) => (
                <View key={s.subject} className="flex-row justify-between items-center py-1.5 border-b border-border last:border-0">
                  <Text className="text-ink text-sm flex-1">{s.subject}</Text>
                  <Text className={`font-bold ${gradeColor(s.avg, pass)}`}>{s.avg.toFixed(1)}</Text>
                </View>
              ))
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
