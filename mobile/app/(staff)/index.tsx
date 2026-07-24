import { View, Text, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { useMe, useAuth } from '@/context/AuthContext';

export default function StaffHome() {
  const me = useMe();
  const { signOut } = useAuth();
  return (
    <Screen title="Início">
      <Card>
        <Text className="text-ink-muted text-sm">Olá, {me?.name?.split(' ')[0]} 👋</Text>
        <Text className="text-ink-muted text-xs mt-0.5">{me?.school_name}</Text>
      </Card>
      <Text className="text-ink-subtle text-xs mt-2 mb-2">Use as abas abaixo para registrar ponto e solicitar férias.</Text>
      <TouchableOpacity onPress={signOut} className="mt-4">
        <Text className="text-center text-danger text-sm">Sair da conta</Text>
      </TouchableOpacity>
    </Screen>
  );
}
