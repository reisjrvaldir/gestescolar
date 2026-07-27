import type { FieldValues, UseFormSetError, Path } from 'react-hook-form';
import { ApiError } from '@/lib/api';

/**
 * Aplica erros de campo vindos do backend (ApiError.errors) ao formulário RHF.
 * Retorna true se havia erros de campo; false se o erro foi genérico.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(err instanceof ApiError) || !err.errors) return false;
  let first = true;
  for (const [field, message] of Object.entries(err.errors)) {
    setError(field as Path<T>, { type: 'server', message }, { shouldFocus: first });
    first = false;
  }
  return true;
}
