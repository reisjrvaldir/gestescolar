// Contas a pagar (despesas da escola) — mock.
// Integração futura: GET /api/expenses. Alimenta o card "Despesas do mês".

export type PayableStatus = 'pending' | 'paid' | 'overdue';

export interface Payable {
  id: string;
  dueDate: string;   // ISO 'yyyy-mm-dd'
  description: string;
  category: string;
  amount: number;
  status: PayableStatus;
}

export const payablesData: Payable[] = [
  { id: 'p1', dueDate: '2025-05-30', description: 'Aluguel da unidade', category: 'Infraestrutura', amount: 6000, status: 'pending' },
  { id: 'p2', dueDate: '2025-05-30', description: 'Folha de pagamento', category: 'Pessoal', amount: 32450, status: 'pending' },
  { id: 'p3', dueDate: '2025-05-31', description: 'Fornecedor - Alimentos', category: 'Materiais', amount: 4250, status: 'pending' },
  { id: 'p4', dueDate: '2025-06-01', description: 'Internet - Link dedicado', category: 'Serviços', amount: 450, status: 'pending' },
  { id: 'p5', dueDate: '2025-06-02', description: 'Material didático', category: 'Materiais', amount: 2100, status: 'pending' },
];
