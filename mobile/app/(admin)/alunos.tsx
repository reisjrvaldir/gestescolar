import { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Student { id: string; name: string; registration_number?: string; class_name?: string; status: string }

export default function AdminAlunos() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Student[] }>('/api/students')
      .then(r => { setStudents(r.data ?? []); setFiltered(r.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function search(q: string) {
    setQuery(q);
    setFiltered(students.filter(s => s.name.toLowerCase().includes(q.toLowerCase())));
  }

  return (
    <Screen title="Alunos">
      <TextInput
        className="bg-surface border border-border rounded-xl px-4 py-2.5 text-ink mb-3"
        placeholder="Buscar aluno…"
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
              {s.class_name && <Text className="text-ink-muted text-xs">{s.class_name}</Text>}
            </View>
            <Badge label={s.status === 'active' ? 'Ativo' : 'Inativo'} tone={s.status === 'active' ? 'success' : 'neutral'} />
          </View>
        ))
      }
      {!loading && filtered.length === 0 && <Text className="text-ink-muted text-center mt-8">Nenhum aluno encontrado.</Text>}
    </Screen>
  );
}
