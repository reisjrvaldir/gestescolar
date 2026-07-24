import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface Invoice { id: string; student_name?: string; description: string; amount: number; due_date: string; status: string }
const STATUS_TONE: Record<string, any> = { paid: 'success', pending: 'warning', overdue: 'danger', cancelled: 'neutral' };
const STATUS_LABEL: Record<string, string> = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado' };

export default function AdminFinanceiro() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    api.get<{ data: Invoice[] }>('/api/invoices?limit=50')
      .then(r => setInvoices(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totals = invoices.reduce((acc, inv) => {
    if (inv.status === 'paid') acc.paid += inv.amount;
    if (inv.status === 'pending' || inv.status === 'overdue') acc.pending += inv.amount;
    return acc;
  }, { paid: 0, pending: 0 });

  return (
    <Screen title="Financeiro">
      <View className="flex-row gap-3 mb-3">
        <View className="flex-1 bg-success-soft border border-success/20 rounded-2xl p-3">
          <Text className="text-success text-xs font-semibold">Recebido</Text>
          <Text className="text-success font-bold text-base mt-1">{fmt(totals.paid)}</Text>
        </View>
        <View className="flex-1 bg-warning-soft border border-warning/20 rounded-2xl p-3">
          <Text className="text-warning text-xs font-semibold">Pendente</Text>
          <Text className="text-warning font-bold text-base mt-1">{fmt(totals.pending)}</Text>
        </View>
      </View>

      {loading
        ? <ActivityIndicator color="#1A56DB" className="mt-8" />
        : invoices.map(inv => (
          <View key={inv.id} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-3 mb-1.5">
            <View className="flex-1">
              <Text className="text-ink font-medium text-sm" numberOfLines={1}>{inv.student_name ?? inv.description}</Text>
              <Text className="text-ink-muted text-xs">{new Date(inv.due_date).toLocaleDateString('pt-BR')}</Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-ink font-semibold text-sm">{fmt(inv.amount)}</Text>
              <Badge label={STATUS_LABEL[inv.status] ?? inv.status} tone={STATUS_TONE[inv.status] ?? 'neutral'} />
            </View>
          </View>
        ))
      }
    </Screen>
  );
}
