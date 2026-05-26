/**
 * Declarações de globais browser - GestEscolar SaaS
 *
 * Os arquivos JS são carregados via <script> em ordem,
 * cada um adicionando seu objeto ao escopo global.
 *
 * Apenas declaramos aqui globais SEM definição no projeto (ex: supabaseClient
 * vem de CDN). Objetos definidos com `const Foo = {}` em arquivos .js do
 * projeto (Auth, DB, Plans, Router, Utils) são inferidos automaticamente
 * pelo TypeScript via cross-file analysis quando incluídos no tsconfig.
 */

declare global {
  // Supabase client - vem do CDN, sem definição local
  var supabaseClient: any;

  // Realtime e Onboarding - módulos opcionais não incluídos em todos os builds
  var Realtime: any;
  var Onboarding: any;

  // Singletons globais definidos em outros arquivos .js (não incluídos no checkJs principal)
  // Declarados aqui apenas para que plans.js os reconheça.
  var Auth: any;
  var DB: any;
  var Utils: any;
  var Router: any;
  var LoginPage: any;

  interface Window {
    FeriadosNacionais?: any;
    JornadaUtils?: any;
    AdminAsaasDocs?: any;
    msCrypto?: Crypto;
  }
}

export {};
