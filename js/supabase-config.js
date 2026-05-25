// =============================================
//  GESTESCOLAR SaaS – SUPABASE CONFIG
//  Fase 2.2: Conexao com banco de dados real
// =============================================

const SUPABASE_URL = 'https://exqkzqmpbfakrjqinvnf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6nGu3by4NOGBExiit87rMQ_nzYuJoSu';

// Storage seguro para iOS Safari (localStorage bloqueado em modo privado)
const _safeStorage = (() => {
  const mem = {};
  const tryLocal = () => {
    try { localStorage.setItem('__test__', '1'); localStorage.removeItem('__test__'); return true; } catch(e) { return false; }
  };
  const useLocal = tryLocal();
  return {
    getItem(k)    { try { return useLocal ? localStorage.getItem(k)    : (mem[k] ?? null); } catch(e) { return mem[k] ?? null; } },
    setItem(k, v) { try { if (useLocal) localStorage.setItem(k, v);    else mem[k] = v; } catch(e) { mem[k] = v; } },
    removeItem(k) { try { if (useLocal) localStorage.removeItem(k);    else delete mem[k]; } catch(e) { delete mem[k]; } },
  };
})();

// Inicializar cliente Supabase com storage resistente ao ITP do Safari iOS
// PERSIST SESSION = FALSE: tokens ficam só em memória. Ao recarregar/fechar a aba,
// a sessão Supabase morre e o usuário é obrigado a logar de novo. Combinado com
// o check em app.js (ges_session validado contra getSession), garante que nunca
// haja "entrada fantasma" sem credenciais.
// detectSessionInUrl segue true: necessário para fluxo de recuperação de senha
// (link de e-mail injeta access_token no hash da URL).
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: _safeStorage,
        storageKey: 'ges_sb_auth',
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: true,
      },
    })
  : null;

if (supabaseClient) {
  console.log('[GestEscolar] Supabase client inicializado com sucesso.');
} else {
  console.error('[GestEscolar] ERRO: Biblioteca Supabase nao carregada. Verifique o CDN.');
}
