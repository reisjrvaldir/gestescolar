import { api } from '@/lib/api';

/** Baixa o blob autenticado e dispara o download no navegador — sem
 *  persistir o PDF em disco/estado, some da memória assim que o usuário
 *  salva o arquivo. */
async function downloadPdf(path: string, filename: string): Promise<void> {
  const blob = await api.getBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const documentsService = {
  declaration(studentId: string, type: 'matricula' | 'conclusao', studentName: string) {
    const label = type === 'conclusao' ? 'declaracao-conclusao' : 'declaracao-matricula';
    return downloadPdf(`/documents/students/${studentId}/declaration?type=${type}`, `${label}-${studentName}.pdf`);
  },
  transferForm(studentId: string, studentName: string) {
    return downloadPdf(`/documents/students/${studentId}/transfer`, `ficha-transferencia-${studentName}.pdf`);
  },
  transcript(studentId: string, studentName: string) {
    return downloadPdf(`/documents/students/${studentId}/transcript`, `historico-escolar-${studentName}.pdf`);
  },
  incomeReport(year: number, guardianId?: string) {
    const qs = guardianId ? `?year=${year}&guardian_id=${guardianId}` : `?year=${year}`;
    return downloadPdf(`/documents/income-report${qs}`, `informe-rendimentos-${year}.pdf`);
  },
};
