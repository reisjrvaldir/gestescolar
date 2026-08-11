// Tipos de arquivo permitidos com seus magic bytes (assinatura binária).
// Validar no backend porque o campo mime_type vem do cliente e pode ser forjado.

const SIGNATURES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],               // %PDF
  'image/jpeg':      [0xff, 0xd8, 0xff],                      // JPEG SOI
  'image/png':       [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  'image/webp':      [0x52, 0x49, 0x46, 0x46],                // RIFF (header WebP)
};

// Bytes 8–11 de um arquivo WebP válido: 'W','E','B','P'
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

function stripDataUri(input: string): string {
  const i = input.indexOf('base64,');
  return i !== -1 ? input.slice(i + 7) : input;
}

/**
 * Verifica se os magic bytes do arquivo base64 correspondem ao mime_type declarado.
 * Retorna false se o tipo não for suportado ou a assinatura não bater.
 */
export function validateMagicBytes(base64Data: string, mimeType: string): boolean {
  const sig = SIGNATURES[mimeType];
  if (!sig) return false;

  const raw = stripDataUri(base64Data);
  // 16 bytes raw precisam de ceil(16/3)*4 = 24 chars base64
  const bytes = Buffer.from(raw.slice(0, 24), 'base64');

  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }

  if (mimeType === 'image/webp') {
    // WebP: após o cabeçalho RIFF (bytes 0–3) + tamanho (bytes 4–7),
    // os bytes 8–11 devem ser 'WEBP'.
    for (let i = 0; i < 4; i++) {
      if (bytes[8 + i] !== WEBP_MARKER[i]) return false;
    }
  }

  return true;
}
