import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Invoice { id: string; description: string; amount: number; due_date: string; status: string; pix_code?: string; payment_url?: string }

const STATUS_TONE: Record<string, any> = { paid: 'success', pending: 'warning', overdue: 'danger', cancelled: 'neutral' };
const STATUS_LABEL: Record<string, string> = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado' };

export default function GuardianFaturas() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Invoice[] }>('/api/guardian/invoices')
      .then(r => setInvoices(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyPix(code: string) {
    Alert.alert('Código PIX', code, [{ text: 'OK' }]);
  }

  function openPayment(url: string) {
    Linking.openURL(url);
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Screen title="Faturas">
      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : invoices.length === 0
          ? <Text className="text-ink-muted text-center mt-8">Nenhuma fatura encontrada.</Text>
          : invoices.map(inv => (
            <Card key={inv.id}>
              <View className="flex-row items-start justify-between mb-1">
                <Text className="text-ink font-semibold flex-1 mr-2">{inv.description}</Text>
                <Badge label={STATUS_LABEL[inv.status] ?? inv.status} tone={STATUS_TONE[inv.status] ?? 'neutral'} />
              </View>
              <Text className="text-ink text-xl font-bold">{fmt(inv.amount)}</Text>
              <Text className="text-ink-muted text-sm">Venc: {new Date(inv.due_date).toLocaleDateString('pt-BR')}</Text>
              {inv.status === 'pending' || inv.status === 'overdue' ? (
                <View className="flex-row gap-2 mt-3">
                  {inv.pix_code && (
                    <TouchableOpacity onPress={() => copyPix(inv.pix_code!)} className="flex-1 border border-primary rounded-xl py-2 items-center">
                      <Text className="text-primary font-semibold text-sm">📋 Copiar PIX</Text>
                    </TouchableOpacity>
                  )}
                  {inv.payment_url && (
                    <TouchableOpacity onPress={() => openPayment(inv.payment_url!)} className="flex-1 bg-primary rounded-xl py-2 items-center">
                      <Text className="text-white font-semibold text-sm">Pagar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </Card>
          ))
      }
    </Screen>
  );
}
