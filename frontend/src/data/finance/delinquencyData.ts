// Inadimplência (mensalidades não pagas e em atraso) — mock.
// Integração futura: GET /api/invoices?status=overdue.

export interface Delinquent {
  id: string;
  studentName: string;
  guardianName: string;
  plan: string;
  reference: string;   // ex.: 'Mai/2025'
  dueDate: string;     // ISO
  daysLate: number;
  amount: number;
}

export const delinquencyData: Delinquent[] = [
  { id: 'd1', studentName: 'Lucas Martins', guardianName: 'Juliana Martins', plan: 'Integral', reference: 'Mai/2025', dueDate: '2025-05-10', daysLate: 30, amount: 1250 },
  { id: 'd2', studentName: 'Beatriz Lima', guardianName: 'Rafael Lima', plan: 'Integral', reference: 'Mai/2025', dueDate: '2025-05-10', daysLate: 30, amount: 1250 },
  { id: 'd3', studentName: 'Isabela Rocha', guardianName: 'Camila Rocha', plan: 'Integral', reference: 'Mai/2025', dueDate: '2025-05-10', daysLate: 30, amount: 1250 },
  { id: 'd4', studentName: 'Enzo Ferreira', guardianName: 'Patrícia Ferreira', plan: 'Integral', reference: 'Mai/2025', dueDate: '2025-05-10', daysLate: 30, amount: 1250 },
  { id: 'd5', studentName: 'Maria Eduarda', guardianName: 'Ana Paula Costa', plan: 'Integral', reference: 'Mai/2025', dueDate: '2025-05-10', daysLate: 30, amount: 1250 },
];
