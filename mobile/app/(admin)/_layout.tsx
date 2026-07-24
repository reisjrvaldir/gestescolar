import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A56DB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#E5E7EB', height: 60, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <Icon emoji="📊" focused={focused} /> }} />
      <Tabs.Screen name="alunos" options={{ title: 'Alunos', tabBarIcon: ({ focused }) => <Icon emoji="🎓" focused={focused} /> }} />
      <Tabs.Screen name="funcionarios" options={{ title: 'Equipe', tabBarIcon: ({ focused }) => <Icon emoji="👥" focused={focused} /> }} />
      <Tabs.Screen name="financeiro" options={{ title: 'Financeiro', tabBarIcon: ({ focused }) => <Icon emoji="💰" focused={focused} /> }} />
      <Tabs.Screen name="ponto" options={{ title: 'Ponto', tabBarIcon: ({ focused }) => <Icon emoji="⏱️" focused={focused} /> }} />
      <Tabs.Screen name="ferias" options={{ title: 'Férias', tabBarIcon: ({ focused }) => <Icon emoji="🏖️" focused={focused} /> }} />
    </Tabs>
  );
}
