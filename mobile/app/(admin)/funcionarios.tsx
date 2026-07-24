import { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Staff { id: string; name: string; email: string; role_type?: string; status: string }
const ROLE_LABELS: Record<string, string> = {
  school_admin: 'Gestor', financial: 'Financeiro', teacher: 'Professor', coordinator: 'Coordenação',
};

export default function AdminFuncionarios() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filtered, setFiltered] = useState<Staff[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Staff[] }>('/api/staff')
      .then(r => { setStaff(r.data ?? []); setFiltered(r.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function search(q: string) {
    setQuery(q);
    setFiltered(staff.filter(s => s.name.toLowerCase().includes(q.toLowerCase())));
  }

  return (
    <Screen title="Equipe">
      <TextInput
        className="bg-surface border border-border rounded-xl px-4 py-2.5 text-ink mb-3"
        placeholder="Buscar funcionário…"
        value={query}
        onChangeText={search}
      />
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : filtered.map(s => (
          <View key={s.id} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-3 mb-1.5">
            <View className="w-9 h-9 rounded-full bg-primary-soft items-center justify-center mr-3">
              <Text className="text-primary font-bold text-sm">{s.name[0]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-ink font-medium">{s.name}</Text>
              <Text className="text-ink-muted text-xs">{ROLE_LABELS[s.role_type ?? ''] ?? s.role_type}</Text>
            </View>
            <Badge label={s.status === 'active' ? 'Ativo' : 'Inativo'} tone={s.status === 'active' ? 'success' : 'neutral'} />
          </View>
        ))
      }
    </Screen>
  );
}
