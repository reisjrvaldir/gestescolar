import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

interface Child {
  id: string; name: string; class_name?: string;
  present_month?: number; absent_month?: number;
}

export default function GuardianFrequencia() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: { children: Child[] } }>('/api/dashboard/stats')
      .then((r) => setChildren(r.data?.children ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Screen title="Frequência"><ActivityIndicator color="#1A56DB" className="mt-8" /></Screen>
  );

  if (!children.length) return (
    <Screen title="Frequência"><Text className="text-ink-muted text-center mt-8">Sem dados de frequência.</Text></Screen>
  );

  return (
    <Screen title="Frequência">
      {children.map((c) => {
        const present = c.present_month ?? 0;
        const absent = c.absent_month ?? 0;
        const total = present + absent;
        const pct = total > 0 ? (present / total) * 100 : 100;
        return (
          <Card key={c.id}>
            <Text className="text-ink font-bold mb-0.5">{c.name}</Text>
            {c.class_name && <Text className="text-ink-muted text-xs mb-3">{c.class_name}</Text>}
            <View className="flex-row justify-between items-center">
              <View className="items-center">
                <Text className="text-ink-muted text-xs">Presenças</Text>
                <Text className="text-success font-bold text-xl">{present}</Text>
              </View>
              <View className="items-center">
                <Text className="text-ink-muted text-xs">Frequência (mês)</Text>
                <Text className={`font-bold text-2xl ${pct >= 75 ? 'text-success' : 'text-danger'}`}>{pct.toFixed(0)}%</Text>
              </View>
              <View className="items-center">
                <Text className="text-ink-muted text-xs">Faltas</Text>
                <Text className="text-danger font-bold text-xl">{absent}</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
