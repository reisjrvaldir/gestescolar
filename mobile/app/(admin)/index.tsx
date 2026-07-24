import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { useMe, useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface DashData { total_students: number; active_students: number; total_staff: number; monthly_revenue?: number; adimplencia?: number }

export default function AdminDashboard() {
  const me = useMe();
  const { signOut } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: DashData }>('/api/dashboard/summary')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (v?: number) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  return (
    <Screen title="Dashboard">
      <Card>
        <Text className="text-ink-muted text-sm">Olá, {me?.name?.split(' ')[0]} 👋</Text>
        <Text className="text-ink font-bold text-base mt-0.5">{me?.school_name}</Text>
      </Card>

      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-4" />
        : data && (
          <View className="flex-row flex-wrap gap-3 mt-1">
            <View className="flex-1 min-w-[140px] bg-primary-soft border border-primary/20 rounded-2xl p-4">
              <Text className="text-primary text-2xl font-bold">{data.active_students}</Text>
              <Text className="text-primary text-xs mt-1">Alunos ativos</Text>
            </View>
            <View className="flex-1 min-w-[140px] bg-success-soft border border-success/20 rounded-2xl p-4">
              <Text className="text-success text-2xl font-bold">{data.total_staff}</Text>
              <Text className="text-success text-xs mt-1">Funcionários</Text>
            </View>
            {data.monthly_revenue != null && (
              <View className="flex-1 min-w-[140px] bg-canvas border border-border rounded-2xl p-4">
                <Text className="text-ink text-xl font-bold">{fmt(data.monthly_revenue)}</Text>
                <Text className="text-ink-muted text-xs mt-1">Receita/mês</Text>
              </View>
            )}
            {data.adimplencia != null && (
              <View className="flex-1 min-w-[140px] bg-canvas border border-border rounded-2xl p-4">
                <Text className="text-ink text-2xl font-bold">{data.adimplencia.toFixed(0)}%</Text>
                <Text className="text-ink-muted text-xs mt-1">Adimplência</Text>
              </View>
            )}
          </View>
        )
      }

      <TouchableOpacity onPress={signOut} className="mt-6">
        <Text className="text-center text-danger text-sm">Sair da conta</Text>
      </TouchableOpacity>
    </Screen>
  );
}
