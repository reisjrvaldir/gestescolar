import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Invoice {
  id: string; student_name?: string; amount: number;
  due_date: string; status: string; reference_month?: string;
}

const STATUS_TONE: Record<string, any> = { pending: 'warning', overdue: 'danger', paid: 'success' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', overdue: 'Atrasado', paid: 'Pago' };

export default function GuardianFaturas() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overdueTotal, setOverdueTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    api.get<{ data: { pending_invoices?: Invoice[]; overdue_total?: number } }>('/api/dashboard/stats')
      .then((r) => {
        setInvoices(r.data?.pending_invoices ?? []);
        setOverdueTotal(r.data?.overdue_total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Screen title="Faturas"><ActivityIndicator color="#1A56DB" className="mt-8" /></Screen>
  );

  return (
    <Screen title="Faturas">
      {overdueTotal > 0 && (
        <View className="flex-row items-center gap-2 rounded-2xl border border-danger/20 bg-danger-soft p-4 mb-3">
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <Text className="text-danger text-sm flex-1">Total em atraso: {fmt(overdueTotal)}</Text>
        </View>
      )}

      {invoices.length === 0 ? (
        <View className="items-center mt-8">
          <Ionicons name="checkmark-circle-outline" size={40} color="#16A34A" />
          <Text className="text-ink-muted text-center mt-2">Nenhuma fatura pendente.</Text>
        </View>
      ) : (
        invoices.map((inv) => (
          <Card key={inv.id}>
            <View className="flex-row items-start justify-between mb-1">
              <Text className="text-ink font-semibold flex-1 mr-2">{inv.student_name ?? 'Mensalidade'}</Text>
              <Badge label={STATUS_LABEL[inv.status] ?? inv.status} tone={STATUS_TONE[inv.status] ?? 'neutral'} />
            </View>
            <Text className="text-ink text-xl font-bold">{fmt(inv.amount)}</Text>
            <Text className="text-ink-muted text-sm">Vencimento: {new Date(inv.due_date).toLocaleDateString('pt-BR')}</Text>
            <Text className="text-ink-subtle text-xs mt-2">
              Pague pelo portal web ou fale com a secretaria para 2ª via / PIX.
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
