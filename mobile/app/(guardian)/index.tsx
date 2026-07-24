import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMe, useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Child {
  id: string; name: string; registration_number?: string;
  class_name?: string; present_month?: number; absent_month?: number;
  avg_grade?: number; open_invoices?: number;
}
interface GuardianStats {
  children: Child[];
  unread_messages: number;
  overdue_total?: number;
  overdue_count?: number;
}

export function useGuardianStats() {
  const [data, setData] = useState<GuardianStats | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    try { setData((await api.get<{ data: GuardianStats }>('/api/dashboard/stats')).data); }
    catch (e) { console.error(e); }
  };
  useEffect(() => { reload().finally(() => setLoading(false)); }, []);
  return { data, loading, reload };
}

export default function GuardianHome() {
  const me = useMe();
  const { signOut } = useAuth();
  const { data, loading, reload } = useGuardianStats();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() { setRefreshing(true); await reload(); setRefreshing(false); }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-4 pt-1 pb-3 bg-surface border-b border-border">
        <Text className="text-xl font-bold text-ink">Meus Filhos</Text>
        <TouchableOpacity onPress={signOut} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A56DB" />}
      >
        <View className="rounded-2xl border border-border bg-surface p-4 mb-3">
          <Text className="text-ink-muted text-sm">Bem-vindo(a), {me?.name?.split(' ')[0]}</Text>
          <Text className="text-ink-muted text-xs mt-0.5">{me?.school_name}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#1A56DB" className="mt-8" />
        ) : !data?.children?.length ? (
          <Text className="text-ink-muted text-center mt-8">Nenhum aluno vinculado.</Text>
        ) : (
          data.children.map((c) => (
            <View key={c.id} className="rounded-2xl border border-border bg-surface p-4 mb-3">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-11 h-11 rounded-full bg-primary-soft items-center justify-center">
                  <Text className="text-primary font-bold">{c.name[0]}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-ink font-bold">{c.name}</Text>
                  {c.class_name && <Text className="text-ink-muted text-xs">{c.class_name}</Text>}
                </View>
              </View>
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-ink-subtle text-xs">Média</Text>
                  <Text className="text-ink font-bold">{c.avg_grade != null ? Number(c.avg_grade).toFixed(1) : '—'}</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-ink-subtle text-xs">Presenças</Text>
                  <Text className="text-success font-bold">{c.present_month ?? 0}</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-ink-subtle text-xs">Faltas</Text>
                  <Text className="text-danger font-bold">{c.absent_month ?? 0}</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-ink-subtle text-xs">Faturas</Text>
                  <Text className={`font-bold ${(c.open_invoices ?? 0) > 0 ? 'text-warning' : 'text-ink'}`}>
                    {c.open_invoices ?? 0}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
