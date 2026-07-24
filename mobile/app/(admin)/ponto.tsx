import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Entry {
  id: string; user_name: string;
  clock_in: string; clock_out: string | null;
  approval_status: 'auto' | 'approved' | 'pending' | 'rejected';
  is_adjustment?: boolean;
}

const STATUS: Record<string, { label: string; tone: any }> = {
  auto:     { label: 'OK',        tone: 'success' },
  approved: { label: 'Aprovado',  tone: 'success' },
  pending:  { label: 'Pendente',  tone: 'warning' },
  rejected: { label: 'Rejeitado', tone: 'danger' },
};

function hours(inISO: string, outISO: string | null): string {
  if (!outISO) return '—';
  const ms = new Date(outISO).getTime() - new Date(inISO).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export default function AdminPonto() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try { setEntries((await api.get<{ data: Entry[] }>('/api/timeclock/all')).data ?? []); }
    catch (e) { console.error(e); }
  }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const pending = entries.filter((e) => e.approval_status === 'pending').length;
  const t = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const d = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <View className="px-4 pt-1 pb-3 bg-surface border-b border-border">
        <Text className="text-xl font-bold text-ink">Controle de Ponto</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A56DB" />}
      >
        {pending > 0 && (
          <View className="flex-row items-center gap-2 rounded-2xl border border-warning/20 bg-warning-soft p-3 mb-3">
            <Ionicons name="warning-outline" size={18} color="#D97706" />
            <Text className="text-warning text-sm flex-1">{pending} ajuste(s) aguardando aprovação (gerencie no painel web).</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#1A56DB" size="large" className="mt-8" />
        ) : entries.length === 0 ? (
          <Text className="text-ink-muted text-center mt-8">Nenhum registro de ponto neste mês.</Text>
        ) : (
          entries.map((e) => {
            const st = STATUS[e.approval_status] ?? STATUS.auto;
            return (
              <View key={e.id} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-3 mb-1.5">
                <View className="flex-1">
                  <Text className="text-ink font-medium text-sm">{e.user_name}</Text>
                  <Text className="text-ink-muted text-xs">
                    {d(e.clock_in)} · {t(e.clock_in)} → {e.clock_out ? t(e.clock_out) : 'aberto'}
                    {e.is_adjustment ? '  (ajuste)' : ''}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-ink font-semibold text-sm">{hours(e.clock_in, e.clock_out)}</Text>
                  <Badge label={st.label} tone={st.tone} />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
