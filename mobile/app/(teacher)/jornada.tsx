import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useMe } from '@/context/AuthContext';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Schedule { id: string; weekday: number; start_time: string; end_time: string }

export default function TeacherJornada() {
  const me = useMe();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me?.profile_id) return;
    api.get<{ data: Schedule[] }>(`/api/schedules?user_id=${me.profile_id}`)
      .then((r) => setSchedules(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [me]);

  if (loading) return (
    <Screen title="Minha Jornada">
      <ActivityIndicator color="#1A56DB" size="large" className="mt-8" />
    </Screen>
  );

  const sorted = [...schedules].sort((a, b) => a.weekday - b.weekday);
  let totalMin = 0;
  sorted.forEach(s => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    totalMin += (eh * 60 + em) - (sh * 60 + sm);
  });

  return (
    <Screen title="Minha Jornada">
      <Card>
        <Text className="text-ink-muted text-xs mb-3">
          Carga semanal: <Text className="font-bold text-primary">{Math.round(totalMin / 60)}h</Text>
          {'  '}·{'  '}{sorted.length} dia(s) de trabalho
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {DAYS.map((day, i) => {
            const slot = sorted.find(s => s.weekday === i);
            return (
              <View
                key={i}
                className={`items-center rounded-xl px-3 py-2 min-w-[60px] border ${
                  slot ? 'bg-primary-soft border-primary/30' : 'bg-canvas border-border'
                }`}
              >
                <Text className={`text-xs font-bold ${slot ? 'text-primary' : 'text-ink-subtle'}`}>{day}</Text>
                {slot ? (
                  <>
                    <Text className="text-xs font-mono text-ink mt-1">{slot.start_time.slice(0, 5)}</Text>
                    <Text className="text-[10px] text-ink-muted">às</Text>
                    <Text className="text-xs font-mono text-ink">{slot.end_time.slice(0, 5)}</Text>
                  </>
                ) : (
                  <Text className="text-[10px] text-ink-subtle mt-1">Folga</Text>
                )}
              </View>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}
