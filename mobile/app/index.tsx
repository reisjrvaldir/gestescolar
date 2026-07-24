import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) { router.replace('/login'); return; }

    const role = me.role;
    if (role === 'guardian') router.replace('/(guardian)');
    else if (role === 'teacher') router.replace('/(teacher)');
    else if (role === 'school_admin' || role === 'superadmin') router.replace('/(admin)');
    else router.replace('/(staff)'); // financial, coordinator, outros
  }, [me, loading]);

  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator size="large" color="#1A56DB" />
    </View>
  );
}
