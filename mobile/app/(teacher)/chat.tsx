import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/lib/api';
import { useMe } from '@/context/AuthContext';

interface Conversation { id: string; other_name: string; last_message?: string; updated_at: string }
interface Message { id: string; sender_name: string; content: string; created_at: string; is_mine: boolean }

export default function TeacherChat() {
  const me = useMe();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => { loadConvs(); }, []);

  async function loadConvs() {
    setLoading(true);
    try { setConvs((await api.get<{ data: Conversation[] }>('/api/messages/conversations')).data ?? []); } catch {}
    setLoading(false);
  }

  async function openConv(c: Conversation) {
    setSelected(c);
    setLoading(true);
    try { setMessages((await api.get<{ data: Message[] }>(`/api/messages/${c.id}`)).data ?? []); } catch {}
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd(), 100);
  }

  async function send() {
    if (!text.trim() || !selected) return;
    setSending(true);
    try {
      await api.post('/api/messages', { conversation_id: selected.id, content: text.trim() });
      setText('');
      const msgs = (await api.get<{ data: Message[] }>(`/api/messages/${selected.id}`)).data ?? [];
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd(), 100);
    } catch {}
    setSending(false);
  }

  if (selected) return (
    <KeyboardAvoidingView className="flex-1 bg-canvas" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="bg-surface border-b border-border px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => setSelected(null)}>
          <Text className="text-primary text-sm">← Voltar</Text>
        </TouchableOpacity>
        <Text className="text-ink font-bold flex-1">{selected.other_name}</Text>
      </View>
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item: m }) => (
              <View className={`max-w-[75%] ${m.is_mine ? 'self-end' : 'self-start'}`}>
                <View className={`rounded-2xl px-3 py-2 ${m.is_mine ? 'bg-primary' : 'bg-surface border border-border'}`}>
                  <Text className={m.is_mine ? 'text-white' : 'text-ink'}>{m.content}</Text>
                </View>
                <Text className="text-ink-subtle text-[10px] mt-0.5 px-1">
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          />
        )
      }
      <View className="flex-row items-center px-3 py-2 bg-surface border-t border-border gap-2">
        <TextInput
          className="flex-1 bg-canvas border border-border rounded-full px-4 py-2 text-ink"
          placeholder="Digite uma mensagem…"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          onPress={send}
          disabled={sending || !text.trim()}
          className={`bg-primary rounded-full w-10 h-10 items-center justify-center ${(!text.trim() || sending) ? 'opacity-50' : ''}`}
        >
          <Text className="text-white text-lg">↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Screen title="Chat">
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : convs.length === 0
          ? <Text className="text-ink-muted text-center mt-8">Nenhuma conversa ainda.</Text>
          : convs.map(c => (
            <TouchableOpacity key={c.id} onPress={() => openConv(c)}>
              <View className="bg-surface border border-border rounded-xl px-4 py-3 mb-2">
                <Text className="text-ink font-semibold">{c.other_name}</Text>
                {c.last_message && <Text className="text-ink-muted text-sm mt-0.5" numberOfLines={1}>{c.last_message}</Text>}
              </View>
            </TouchableOpacity>
          ))
      }
    </Screen>
  );
}
