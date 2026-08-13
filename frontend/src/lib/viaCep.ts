// Consulta CEP via ViaCEP (público, sem chave).
// Retorna null se o CEP não existir ou a rede falhar — nunca lança.

export interface CepLookup {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function normalizeCep(input: string): string {
  return (input ?? '').replace(/\D/g, '').slice(0, 8);
}

export function formatCep(input: string): string {
  const d = normalizeCep(input);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function lookupCep(cep: string): Promise<CepLookup | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      street: String(data.logradouro ?? ''),
      neighborhood: String(data.bairro ?? ''),
      city: String(data.localidade ?? ''),
      state: String(data.uf ?? ''),
    };
  } catch {
    return null;
  }
}
