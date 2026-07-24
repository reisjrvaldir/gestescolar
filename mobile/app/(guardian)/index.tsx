import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { useMe, useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Child { id: string; name: string; class_name?: string; registration_number?: string }

export default function GuardianHome() {
  const me = useMe();
  const { signOut } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Child[] }>('/api/guardian/children')
      .then(r => setChildren(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Meus Filhos">
      <Card>
        <Text className="text-ink-muted text-sm">Bem-vindo(a), {me?.name?.split(' ')[0]} 👋</Text>
        <Text className="text-ink-muted text-xs mt-0.5">{me?.school_name}</Text>
      </Card>

      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : children.length === 0
          ? <Text className="text-ink-muted text-center mt-8">Nenhum aluno vinculado.</Text>
          : children.map(c => (
            <Card key={c.id}>
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-primary-soft items-center justify-center">
                  <Text className="text-primary font-bold">{c.name[0]}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-ink font-bold">{c.name}</Text>
                  {c.class_name && <Text className="text-ink-muted text-xs">{c.class_name}</Text>}
                </View>
              </View>
            </Card>
          ))
      }

      <TouchableOpacity onPress={signOut} className="mt-6">
        <Text className="text-center text-danger text-sm">Sair da conta</Text>
      </TouchableOpacity>
    </Screen>
  );
}
