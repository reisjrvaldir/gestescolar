import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMe, useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Stats {
  role: string;
  students: number;
  classes: number;
  teachers: number;
  attendance_today: number;
  revenue_month?: number;
  revenue_delta_pct?: number | null;
  overdue_amount?: number;
  overdue_count?: number;
  expenses_month?: number;
  balance_month?: number;
  trial_days_left?: number | null;
}

const fmt = (v?: number) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

function Kpi({ icon, color, bg, value, label }: {
  icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; value: string; label: string;
}) {
  return (
    <View className="flex-1 min-w-[45%] rounded-2xl border border-border bg-surface p-4">
      <View style={{ backgroundColor: bg }} className="w-9 h-9 rounded-xl items-center justify-center mb-2">
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-ink text-xl font-bold">{value}</Text>
      <Text className="text-ink-muted text-xs mt-0.5">{label}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const me = useMe();
  const { signOut } = useAuth();
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ data: Stats }>('/api/dashboard/stats');
      setData(r.data);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-4 pt-1 pb-3 bg-surface border-b border-border">
        <Text className="text-xl font-bold text-ink">Dashboard</Text>
        <TouchableOpacity onPress={signOut} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A56DB" />}
      >
        <View className="rounded-2xl border border-border bg-surface p-4 mb-4">
          <Text className="text-ink-muted text-sm">Olá, {me?.name?.split(' ')[0]}</Text>
          <Text className="text-ink font-bold text-base mt-0.5">{me?.school_name}</Text>
          {data?.trial_days_left != null && (
            <View className="flex-row items-center gap-1 mt-2">
              <Ionicons name="time-outline" size={14} color="#D97706" />
              <Text className="text-warning text-xs">
                {data.trial_days_left} dia(s) restantes no período de teste
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#1A56DB" size="large" className="mt-8" />
        ) : data ? (
          <>
            <View className="flex-row flex-wrap gap-3">
              <Kpi icon="school" color="#1A56DB" bg="#EBF2FF" value={String(data.students)} label="Alunos ativos" />
              <Kpi icon="people" color="#16A34A" bg="#DCFCE7" value={String(data.teachers)} label="Funcionários" />
              <Kpi icon="library" color="#7C3AED" bg="#F3E8FF" value={String(data.classes)} label="Turmas" />
              <Kpi icon="checkbox" color="#D97706" bg="#FEF3C7" value={String(data.attendance_today)} label="Chamadas hoje" />
            </View>

            {data.revenue_month != null && (
              <>
                <Text className="text-ink-subtle text-xs font-semibold uppercase tracking-wide mt-6 mb-2">
                  Financeiro do mês
                </Text>
                <View className="rounded-2xl border border-border bg-surface p-4">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-ink-muted text-sm">Receita recebida</Text>
                    <Text className="text-success font-bold text-lg">{fmt(data.revenue_month)}</Text>
                  </View>
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-ink-muted text-sm">Despesas</Text>
                    <Text className="text-danger font-bold text-lg">{fmt(data.expenses_month)}</Text>
                  </View>
                  <View className="h-px bg-border my-1" />
                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-ink font-semibold">Saldo</Text>
                    <Text className={`font-bold text-lg ${(data.balance_month ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      {fmt(data.balance_month)}
                    </Text>
                  </View>
                </View>

                {(data.overdue_count ?? 0) > 0 && (
                  <View className="flex-row items-center gap-2 rounded-2xl border border-danger/20 bg-danger-soft p-4 mt-3">
                    <Ionicons name="alert-circle" size={20} color="#DC2626" />
                    <Text className="text-danger text-sm flex-1">
                      {data.overdue_count} fatura(s) em atraso — {fmt(data.overdue_amount)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <Text className="text-ink-muted text-center mt-8">Não foi possível carregar os dados.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
