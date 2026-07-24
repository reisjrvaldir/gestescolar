import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Entry { id: string; user_name: string; type: 'in' | 'out'; clocked_at: string; manual?: boolean; note?: string }

export default function AdminPonto() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<Entry | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setEntries((await api.get<{ data: Entry[] }>('/api/timeclock?limit=50')).data ?? []); } catch {}
    setLoading(false);
  }

  async function approve(id: string) {
    try {
      await api.patch(`/api/timeclock/${id}/approve`, {});
      await load();
    } catch (e: any) { Alert.alert('Erro', e?.message); }
  }

  async function adjust() {
    if (!adjustEntry) return;
    try {
      await api.patch(`/api/timeclock/${adjustEntry.id}/adjust`, { note });
      setAdjustModal(false);
      setNote('');
      await load();
    } catch (e: any) { Alert.alert('Erro', e?.message); }
  }

  return (
    <Screen title="Controle de Ponto">
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : entries.map(e => (
          <View key={e.id} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-3 mb-1.5">
            <View className="flex-1">
              <Text className="text-ink font-medium text-sm">{e.user_name}</Text>
              <Text className="text-ink-muted text-xs">
                {e.type === 'in' ? 'Entrada' : 'Saída'} · {new Date(e.clocked_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Text>
              {e.manual && <Text className="text-warning text-xs">⚠ Manual</Text>}
            </View>
            <TouchableOpacity
              onPress={() => { setAdjustEntry(e); setAdjustModal(true); }}
              className="ml-2 border border-border rounded-lg px-2 py-1"
            >
              <Text className="text-ink-muted text-xs">Ajustar</Text>
            </TouchableOpacity>
          </View>
        ))
      }

      <Modal visible={adjustModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-canvas p-6">
          <Text className="text-ink text-xl font-bold mb-2">Ajustar ponto</Text>
          {adjustEntry && (
            <Text className="text-ink-muted text-sm mb-4">
              {adjustEntry.user_name} · {adjustEntry.type === 'in' ? 'Entrada' : 'Saída'} às{' '}
              {new Date(adjustEntry.clocked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <Text className="text-ink text-sm font-medium mb-1">Observação</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-ink mb-4"
            placeholder="Motivo do ajuste"
            multiline
            value={note}
            onChangeText={setNote}
          />
          <TouchableOpacity onPress={adjust} className="bg-primary rounded-xl py-4 items-center mb-3">
            <Text className="text-white font-bold">Salvar ajuste</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAdjustModal(false)}>
            <Text className="text-center text-ink-muted">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Screen>
  );
}
