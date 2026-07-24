import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { api } from '@/lib/api';

interface LastEntry { type: 'in' | 'out'; time: string }

export function ClockButton() {
  const [last, setLast] = useState<LastEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    loadLast();
    return () => clearInterval(t);
  }, []);

  async function loadLast() {
    setLoading(true);
    try {
      const r = await api.get<{ data: any[] }>('/api/timeclock?limit=1');
      const entry = r.data?.[0];
      if (entry) setLast({ type: entry.type, time: entry.clocked_at });
    } catch {}
    setLoading(false);
  }

  async function handleClock() {
    const type = last?.type === 'in' ? 'out' : 'in';
    const label = type === 'in' ? 'Registrar entrada' : 'Registrar saída';
    Alert.alert(label, `Confirmar ${type === 'in' ? 'entrada' : 'saída'} agora?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          setClocking(true);
          try {
            await api.post('/api/timeclock/clock-in', { type });
            await loadLast();
          } catch (e: any) {
            Alert.alert('Erro', e?.message ?? 'Não foi possível registrar o ponto');
          } finally {
            setClocking(false);
          }
        },
      },
    ]);
  }

  const isIn = last?.type === 'in';
  const nextLabel = isIn ? 'Registrar Saída' : 'Registrar Entrada';
  const color = isIn ? '#DC2626' : '#16A34A';
  const softColor = isIn ? '#FEE2E2' : '#DCFCE7';

  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <View className="items-center py-6">
      <Text className="text-ink-muted text-sm capitalize">{dateStr}</Text>
      <Text className="text-ink text-5xl font-bold font-mono mt-1 mb-6">{timeStr}</Text>

      {loading ? (
        <ActivityIndicator color="#1A56DB" size="large" />
      ) : (
        <TouchableOpacity
          onPress={handleClock}
          disabled={clocking}
          style={{ backgroundColor: softColor, width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: color }}
          className="items-center justify-center"
        >
          {clocking
            ? <ActivityIndicator color={color} size="large" />
            : (
              <>
                <Text style={{ fontSize: 36 }}>{isIn ? '🚪' : '👋'}</Text>
                <Text style={{ color, fontWeight: '700', marginTop: 4 }}>{nextLabel}</Text>
              </>
            )
          }
        </TouchableOpacity>
      )}

      {last && (
        <Text className="text-ink-muted text-sm mt-4">
          Último registro: {last.type === 'in' ? 'Entrada' : 'Saída'} às{' '}
          {new Date(last.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
}
