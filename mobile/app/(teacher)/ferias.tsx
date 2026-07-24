import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = { folga: 'Folga', licenca: 'Licença', ferias: 'Férias' };
const STATUS_TONE: Record<string, any> = { pending: 'warning', approved: 'success', rejected: 'danger' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada' };

interface LeaveRequest { id: string; type: string; start_date: string; end_date: string; reason?: string; status: string; decision_note?: string }

export default function TeacherFerias() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: 'ferias', start_date: '', end_date: '', reason: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setItems((await api.get<{ data: LeaveRequest[] }>('/api/leave-requests')).data ?? []); } catch {}
    setLoading(false);
  }

  async function submit() {
    if (!form.start_date || !form.end_date) { Alert.alert('Preencha as datas'); return; }
    setSaving(true);
    try {
      await api.post('/api/leave-requests', form);
      setModalOpen(false);
      setForm({ type: 'ferias', start_date: '', end_date: '', reason: '' });
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível enviar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Férias e Folgas">
      <TouchableOpacity
        onPress={() => setModalOpen(true)}
        className="bg-primary rounded-xl py-3 items-center mb-4"
      >
        <Text className="text-white font-bold">+ Nova solicitação</Text>
      </TouchableOpacity>

      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-4" />
        : items.length === 0
          ? <Text className="text-ink-muted text-center mt-8">Nenhuma solicitação.</Text>
          : items.map(r => (
            <Card key={r.id}>
              <View className="flex-row items-start justify-between">
                <Text className="text-ink font-semibold">{TYPE_LABELS[r.type] ?? r.type}</Text>
                <Badge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? 'neutral'} />
              </View>
              <Text className="text-ink-muted text-sm mt-1">
                {new Date(r.start_date).toLocaleDateString('pt-BR')} → {new Date(r.end_date).toLocaleDateString('pt-BR')}
              </Text>
              {r.reason ? <Text className="text-ink-muted text-xs mt-1">{r.reason}</Text> : null}
              {r.decision_note ? <Text className="text-ink-subtle text-xs mt-1 italic">Nota: {r.decision_note}</Text> : null}
            </Card>
          ))
      }

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-canvas p-6">
          <Text className="text-ink text-xl font-bold mb-4">Nova solicitação</Text>

          <Text className="text-ink text-sm font-medium mb-1">Tipo</Text>
          <View className="flex-row gap-2 mb-4">
            {(['ferias', 'folga', 'licenca'] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg items-center border ${form.type === t ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
              >
                <Text className={form.type === t ? 'text-white font-bold text-sm' : 'text-ink-muted text-sm'}>{TYPE_LABELS[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-ink text-sm font-medium mb-1">Data início *</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-ink mb-3"
            placeholder="AAAA-MM-DD"
            value={form.start_date}
            onChangeText={v => setForm(f => ({ ...f, start_date: v }))}
          />
          <Text className="text-ink text-sm font-medium mb-1">Data fim *</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-ink mb-3"
            placeholder="AAAA-MM-DD"
            value={form.end_date}
            onChangeText={v => setForm(f => ({ ...f, end_date: v }))}
          />
          <Text className="text-ink text-sm font-medium mb-1">Motivo (opcional)</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-ink mb-4"
            placeholder="Descreva o motivo"
            multiline
            numberOfLines={3}
            value={form.reason}
            onChangeText={v => setForm(f => ({ ...f, reason: v }))}
          />

          <TouchableOpacity onPress={submit} disabled={saving} className={`bg-primary rounded-xl py-4 items-center mb-3 ${saving ? 'opacity-60' : ''}`}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Enviar solicitação</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalOpen(false)}>
            <Text className="text-center text-ink-muted">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Screen>
  );
}
