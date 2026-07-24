import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

interface OpenEntry { id: string; clock_in: string }

export function ClockButton() {
  const [open, setOpen] = useState<OpenEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    loadOpen();
    return () => clearInterval(t);
  }, []);

  async function loadOpen() {
    setLoading(true);
    try {
      const r = await api.get<{ data: OpenEntry | null }>('/api/timeclock/open');
      setOpen(r.data ?? null);
    } catch { setOpen(null); }
    setLoading(false);
  }

  const isClockedIn = !!open;

  async function handleClock() {
    const label = isClockedIn ? 'Registrar saída' : 'Registrar entrada';
    Alert.alert(label, `Confirmar ${isClockedIn ? 'saída' : 'entrada'} agora?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          setClocking(true);
          try {
            await api.post(isClockedIn ? '/api/timeclock/clock-out' : '/api/timeclock/clock-in', {});
            await loadOpen();
          } catch (e: any) {
            Alert.alert('Erro', e?.message ?? 'Não foi possível registrar o ponto');
          } finally {
            setClocking(false);
          }
        },
      },
    ]);
  }

  const nextLabel = isClockedIn ? 'Registrar Saída' : 'Registrar Entrada';
  const color = isClockedIn ? '#DC2626' : '#16A34A';
  const softColor = isClockedIn ? '#FEE2E2' : '#DCFCE7';

  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <View className="items-center py-6">
      <Text className="text-ink-muted text-sm capitalize">{dateStr}</Text>
      <Text className="text-ink text-5xl font-bold mt-1 mb-6" style={{ fontVariant: ['tabular-nums'] }}>{timeStr}</Text>

      {loading ? (
        <ActivityIndicator color="#1A56DB" size="large" />
      ) : (
        <TouchableOpacity
          onPress={handleClock}
          disabled={clocking}
          style={{ backgroundColor: softColor, width: 176, height: 176, borderRadius: 88, borderWidth: 4, borderColor: color }}
          className="items-center justify-center"
        >
          {clocking
            ? <ActivityIndicator color={color} size="large" />
            : (
              <>
                <Ionicons name={isClockedIn ? 'log-out-outline' : 'log-in-outline'} size={44} color={color} />
                <Text style={{ color, fontWeight: '700', marginTop: 6, fontSize: 15 }}>{nextLabel}</Text>
              </>
            )
          }
        </TouchableOpacity>
      )}

      {isClockedIn && open && (
        <View className="flex-row items-center gap-1.5 mt-5 bg-success-soft rounded-full px-3 py-1.5">
          <Ionicons name="ellipse" size={8} color="#16A34A" />
          <Text className="text-success text-sm font-medium">
            Trabalhando desde {new Date(open.clock_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
      {!isClockedIn && !loading && (
        <Text className="text-ink-muted text-sm mt-5">Você não tem ponto em aberto.</Text>
      )}
    </View>
  );
}
