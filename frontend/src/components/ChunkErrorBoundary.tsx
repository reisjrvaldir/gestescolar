import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Tela branca depois de horas com a aba aberta: o navegador tenta baixar um
 * chunk JS (ex.: MessagesPage-abc123.js) que existia no deploy antigo, mas o
 * servidor já serve outro hash desde o deploy mais recente — o import()
 * dinâmico do React Router falha com 404 e React não tem pra onde ir.
 *
 * Recarregar a página resolve (busca o index.html novo, que aponta pros
 * hashes certos) — então detectamos esse erro específico e recarregamos
 * sozinhos, uma vez. Se acontecer de novo logo em seguida (não era isso),
 * paramos de tentar e mostramos uma tela de erro com botão manual, pra não
 * entrar em loop infinito de reload.
 */
const RELOAD_FLAG = 'ges_chunk_reload_once';

function isChunkLoadError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? '');
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(msg);
}

interface State { error: Error | null }

export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  componentDidMount() {
    // Chegou até aqui sem cair no catch → o app carregou os chunks certos.
    // Libera a tentativa de auto-reload pra próxima vez que isso acontecer.
    sessionStorage.removeItem(RELOAD_FLAG);
  }

  render() {
    if (this.state.error) {
      if (isChunkLoadError(this.state.error) && sessionStorage.getItem(RELOAD_FLAG)) {
        // Auto-reload já disparado (ver componentDidCatch) — essa tela só
        // pisca por um instante enquanto a navegação acontece.
        return null;
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
          <div className="card w-full max-w-md p-7 text-center">
            <h1 className="text-lg font-bold text-ink">Algo deu errado</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Não foi possível carregar esta página. Isso costuma resolver recarregando.
            </p>
            <button
              className="btn-primary mt-5 w-full justify-center"
              onClick={() => { sessionStorage.removeItem(RELOAD_FLAG); window.location.reload(); }}
            >
              <RefreshCw size={15} /> Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
