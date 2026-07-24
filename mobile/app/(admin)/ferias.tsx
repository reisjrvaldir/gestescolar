import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface LeaveRequest { id: string; user_name?: string; type: string; start_date: string; end_date: string; status: string; reason?: string }
const TYPE_LABELS: Record<string, string> = { folga: 'Folga', licenca: 'Licença', ferias: 'Férias' };

export default function AdminFerias() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setItems((await api.get<{ data: LeaveRequest[] }>('/api/leave-requests')).data ?? []); } catch {}
    setLoading(false);
  }

  async function decide(id: string, status: 'approved' | 'rejected') {
    try {
      await api.patch(`/api/leave-requests/${id}/decide`, { status });
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível processar');
    }
  }

  return (
    <Screen title="Solicitações de Férias">
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : items.length === 0
          ? <Text className="text-ink-muted text-center mt-8">Nenhuma solicitação.</Text>
          : items.map(r => (
            <Card key={r.id}>
              <View className="flex-row items-start justify-between mb-1">
                <View className="flex-1">
                  <Text className="text-ink font-bold">{r.user_name}</Text>
                  <Text className="text-ink-muted text-sm">{TYPE_LABELS[r.type] ?? r.type}</Text>
                  <Text className="text-ink-muted text-xs mt-0.5">
                    {new Date(r.start_date).toLocaleDateString('pt-BR')} → {new Date(r.end_date).toLocaleDateString('pt-BR')}
                  </Text>
                  {r.reason && <Text className="text-ink-subtle text-xs mt-0.5">{r.reason}</Text>}
                </View>
                <Badge
                  label={r.status === 'pending' ? 'Pendente' : r.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                  tone={r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'success' : 'danger'}
                />
              </View>
              {r.status === 'pending' && (
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity onPress={() => decide(r.id, 'approved')} className="flex-1 bg-success-soft border border-success/30 rounded-lg py-2 items-center">
                    <Text className="text-success font-semibold text-sm">✓ Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => decide(r.id, 'rejected')} className="flex-1 bg-danger-soft border border-danger/30 rounded-lg py-2 items-center">
                    <Text className="text-danger font-semibold text-sm">✗ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
      }
    </Screen>
  );
}
