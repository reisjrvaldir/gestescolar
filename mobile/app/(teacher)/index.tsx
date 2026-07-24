import { View, Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { useMe, useAuth } from '@/context/AuthContext';

export default function TeacherHome() {
  const me = useMe();
  const { signOut } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <Screen title="Início">
      <Card>
        <Text className="text-ink-muted text-sm">{greeting} 👋</Text>
        <Text className="text-ink text-xl font-bold mt-1">{me?.name?.split(' ')[0]}</Text>
        <Text className="text-ink-muted text-sm mt-0.5">{me?.school_name}</Text>
      </Card>

      <Text className="text-ink-subtle text-xs font-semibold uppercase tracking-wide mb-2 mt-2">
        Acesso rápido
      </Text>
      <Card>
        <Text className="text-ink text-sm">Use as abas abaixo para navegar entre Ponto, Chamada, Notas, Jornada, Férias e Chat.</Text>
      </Card>

      <View className="mt-4">
        <Text
          onPress={signOut}
          className="text-center text-danger text-sm"
        >
          Sair da conta
        </Text>
      </View>
    </Screen>
  );
}
