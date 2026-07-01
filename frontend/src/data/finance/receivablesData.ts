// A receber (mensalidades que ainda vão entrar) — mock.
// Integração futura: GET /api/invoices?status=pending. Origem: mensalidades dos alunos.

export type ReceivableStatus = 'open' | 'paid' | 'overdue';

export interface Receivable {
  id: string;
  studentName: string;
  guardianName: string;
  reference: string;   // ex.: 'Mai/2025'
  dueDate: string;     // ISO
  amount: number;
  status: ReceivableStatus;
}

export const receivablesData: Receivable[] = [
  { id: 'r1', studentName: 'Ana Clara Silva', guardianName: 'Juliana Silva', reference: 'Mai/2025', dueDate: '2025-06-10', amount: 980, status: 'open' },
  { id: 'r2', studentName: 'Pedro Henrique', guardianName: 'Marcos Souza', reference: 'Mai/2025', dueDate: '2025-06-10', amount: 980, status: 'open' },
  { id: 'r3', studentName: 'Luiza Santos', guardianName: 'Carolina Santos', reference: 'Mai/2025', dueDate: '2025-06-10', amount: 980, status: 'open' },
  { id: 'r4', studentName: 'Miguel Oliveira', guardianName: 'Fernanda Oliveira', reference: 'Mai/2025', dueDate: '2025-06-10', amount: 980, status: 'open' },
  { id: 'r5', studentName: 'João Gabriel', guardianName: 'Rafael Pereira', reference: 'Mai/2025', dueDate: '2025-06-10', amount: 980, status: 'open' },
];
