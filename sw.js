// =============================================
//  GESTESCOLAR – Service Worker (KILL SWITCH)
//  Este SW apenas apaga caches antigos e se desregistra.
//  Todas as requisições passam a ir DIRETO para a rede (sem cache).
// =============================================

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 1. Apaga TODOS os caches (qualquer versão antiga)
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // 2. Assume controle dos clientes ativos
    await self.clients.claim();
    // 3. Desregistra este próprio Service Worker
    await self.registration.unregister();
    // 4. Força reload das páginas abertas para carregar o JS novo
    const clientsList = await self.clients.matchAll({ type: 'window' });
    clientsList.forEach(client => client.navigate(client.url));
  })());
});

// Fetch handler vazio — nada é interceptado, tudo vai direto para a rede
self.addEventListener('fetch', () => {});
