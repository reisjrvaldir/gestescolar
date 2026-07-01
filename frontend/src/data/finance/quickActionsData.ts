// Ações rápidas do módulo financeiro — mock/estrutura.
// Cada ação tem um `key` que o handler da página usa para decidir a rota/ação.

export type QuickActionIcon =
  | 'expense' | 'charge' | 'batch' | 'payment'
  | 'pix' | 'import' | 'export' | 'delinquency';

export interface QuickAction {
  key: string;
  title: string;
  description: string;
  icon: QuickActionIcon;
}

export const quickActionsData: QuickAction[] = [
  { key: 'nova-despesa', title: 'Nova despesa', description: 'Registrar despesa da escola', icon: 'expense' },
  { key: 'nova-cobranca', title: 'Nova cobrança', description: 'Criar cobrança de mensalidade', icon: 'charge' },
  { key: 'cobranca-lote', title: 'Enviar cobrança em lote', description: 'Enviar PIX para vários responsáveis', icon: 'batch' },
  { key: 'registrar-pagamento', title: 'Registrar pagamento', description: 'Registrar pagamento recebido', icon: 'payment' },
  { key: 'gerar-pix', title: 'Gerar PIX', description: 'Gerar código PIX personalizado', icon: 'pix' },
  { key: 'importar-despesas', title: 'Importar despesas', description: 'Importar despesas de planilha', icon: 'import' },
  { key: 'exportar-relatorio', title: 'Exportar relatório', description: 'Exportar dados financeiros', icon: 'export' },
  { key: 'ver-inadimplentes', title: 'Ver inadimplentes', description: 'Listar alunos inadimplentes', icon: 'delinquency' },
];
