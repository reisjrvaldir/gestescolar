import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';

interface Message {
  id: string; subject: string; body: string; created_at: string; read_at?: string | null;
  sender_name: string; recipient_name: string; student_name?: string;
}
interface Contact { id: string; name: string; role: string }

const ROLE_LABEL: Record<string, string> = {
  school_admin: 'Gestão', financial: 'Financeiro', teacher: 'Professor',
  coordinator: 'Coordenação', guardian: 'Responsável',
};

export default function TeacherChat() {
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<Message | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { load(); }, [box]);

  async function load() {
    setLoading(true);
    try { setMessages((await api.get<{ data: Message[] }>(`/api/messages?box=${box}`)).data ?? []); } catch {}
    setLoading(false);
  }

  async function openCompose() {
    setComposeOpen(true);
    if (contacts.length === 0) {
      try { setContacts((await api.get<{ data: Contact[] }>('/api/messages/contacts')).data ?? []); } catch {}
    }
  }

  async function openMessage(m: Message) {
    setReading(m);
    if (box === 'inbox' && !m.read_at) {
      try { await api.patch(`/api/messages/${m.id}/read`, {}); } catch {}
    }
  }

  async function send() {
    if (!recipient || !subject.trim() || !body.trim()) {
      Alert.alert('Preencha destinatário, assunto e mensagem.');
      return;
    }
    setSending(true);
    try {
      await api.post('/api/messages', { recipient_id: recipient.id, subject: subject.trim(), body: body.trim() });
      setComposeOpen(false);
      setRecipient(null); setSubject(''); setBody('');
      Alert.alert('Mensagem enviada!');
      if (box === 'sent') load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      title="Mensagens"
      right={
        <TouchableOpacity onPress={openCompose} className="flex-row items-center gap-1 bg-primary rounded-lg px-3 py-1.5">
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text className="text-white text-sm font-semibold">Nova</Text>
        </TouchableOpacity>
      }
    >
      <View className="flex-row gap-2 mb-4">
        {(['inbox', 'sent'] as const).map(b => (
          <TouchableOpacity
            key={b}
            onPress={() => setBox(b)}
            className={`flex-1 py-2 rounded-lg items-center border ${box === b ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
          >
            <Text className={box === b ? 'text-white font-bold text-sm' : 'text-ink-muted text-sm'}>
              {b === 'inbox' ? 'Recebidas' : 'Enviadas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1A56DB" className="mt-8" />
      ) : messages.length === 0 ? (
        <View className="items-center mt-10">
          <Ionicons name="mail-outline" size={40} color="#9CA3AF" />
          <Text className="text-ink-muted text-center mt-2">Nenhuma mensagem.</Text>
        </View>
      ) : (
        messages.map(m => {
          const who = box === 'inbox' ? m.sender_name : m.recipient_name;
          const unread = box === 'inbox' && !m.read_at;
          return (
            <TouchableOpacity key={m.id} onPress={() => openMessage(m)}>
              <View className={`rounded-xl border px-4 py-3 mb-2 ${unread ? 'bg-primary-soft/30 border-primary/30' : 'bg-surface border-border'}`}>
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className={`text-sm ${unread ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{who}</Text>
                  <Text className="text-ink-subtle text-xs">
                    {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </Text>
                </View>
                <Text className={`text-sm ${unread ? 'font-semibold text-ink' : 'text-ink-muted'}`} numberOfLines={1}>{m.subject}</Text>
                <Text className="text-ink-subtle text-xs mt-0.5" numberOfLines={1}>{m.body}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* Leitura */}
      <Modal visible={!!reading} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-canvas">
          <View className="flex-row items-center gap-3 px-4 py-3 bg-surface border-b border-border">
            <TouchableOpacity onPress={() => setReading(null)}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text className="text-ink font-bold flex-1" numberOfLines={1}>{reading?.subject}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text className="text-ink-muted text-sm mb-1">De: {reading?.sender_name}</Text>
            <Text className="text-ink-muted text-sm mb-1">Para: {reading?.recipient_name}</Text>
            {reading?.student_name && <Text className="text-ink-muted text-sm mb-1">Aluno: {reading.student_name}</Text>}
            <Text className="text-ink-subtle text-xs mb-4">
              {reading && new Date(reading.created_at).toLocaleString('pt-BR')}
            </Text>
            <Text className="text-ink text-base leading-6">{reading?.body}</Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Compor */}
      <Modal visible={composeOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-canvas">
          <View className="flex-row items-center gap-3 px-4 py-3 bg-surface border-b border-border">
            <TouchableOpacity onPress={() => setComposeOpen(false)}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text className="text-ink font-bold flex-1">Nova mensagem</Text>
            <TouchableOpacity onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color="#1A56DB" /> : <Text className="text-primary font-bold">Enviar</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text className="text-ink text-sm font-medium mb-1">Destinatário</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {contacts.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setRecipient(c)}
                    className={`px-3 py-2 rounded-lg border ${recipient?.id === c.id ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                  >
                    <Text className={recipient?.id === c.id ? 'text-white text-sm font-semibold' : 'text-ink text-sm'}>{c.name}</Text>
                    <Text className={recipient?.id === c.id ? 'text-white/70 text-xs' : 'text-ink-subtle text-xs'}>{ROLE_LABEL[c.role] ?? c.role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text className="text-ink text-sm font-medium mb-1">Assunto</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-ink mb-3"
              placeholder="Assunto" value={subject} onChangeText={setSubject}
            />
            <Text className="text-ink text-sm font-medium mb-1">Mensagem</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-ink"
              placeholder="Escreva sua mensagem…" multiline numberOfLines={6}
              style={{ minHeight: 140, textAlignVertical: 'top' }}
              value={body} onChangeText={setBody}
            />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
