// A build padrão do pdfkit lê os arquivos .afm de fonte do disco em runtime
// (fs.readFileSync relativo a __dirname). Isso quebra ao empacotar com esbuild
// num único arquivo (Vercel serverless): o __dirname do bundle não é mais a
// pasta node_modules/pdfkit, e os .afm não são copiados — dá ENOENT em
// produção mesmo com o build local passando. A build "standalone" (voltada
// a bundlers/browser) embute as métricas das fontes padrão como dados JS,
// sem tocar o filesystem — é a única variante seguro de empacotar aqui.
// @ts-ignore — sem @types para o subpath; a API é idêntica à do pacote principal.
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';

export interface SchoolHeader {
  name: string;
  legal_name?: string | null;
  cnpj?: string | null;
}

/**
 * Monta um PDF A4 simples (cabeçalho da escola + título + conteúdo + rodapé
 * de emissão) e devolve o buffer pronto para `res.send()`.
 *
 * Gerado sob demanda, nunca persistido em disco/banco — reduz a superfície
 * de dados sensíveis em repouso. Quem chama decide se registra a emissão
 * em audit_logs (ver backend/src/api/routes/documents.ts).
 */
export function buildDocument(
  school: SchoolHeader,
  title: string,
  render: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc: PDFKit.PDFDocument = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111')
      .text(school.legal_name || school.name, { align: 'center' });
    if (school.cnpj) {
      doc.font('Helvetica').fontSize(9).fillColor('#555')
        .text(`CNPJ: ${school.cnpj}`, { align: 'center' });
    }
    doc.moveDown(0.3);
    doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#DDD').stroke();
    doc.moveDown(1.2);

    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111')
      .text(title.toUpperCase(), { align: 'center' });
    doc.moveDown(1.5);

    doc.font('Helvetica').fontSize(11).fillColor('#000');
    render(doc);

    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y < bottom - 50) doc.y = bottom - 50;
    else doc.addPage();
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor('#888')
      .text(`Documento emitido eletronicamente pelo GestEscolar em ${new Date().toLocaleString('pt-BR')}.`,
        { align: 'center' });

    doc.end();
  });
}

/** Formata CPF (11 dígitos) como 000.000.000-00; devolve como veio se não bater o tamanho. */
export function formatCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf ?? '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(cnpj: string | null | undefined): string {
  const d = (cnpj ?? '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj ?? '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
