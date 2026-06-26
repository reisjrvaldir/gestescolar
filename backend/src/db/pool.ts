/**
 * Pool de conexões otimizado para ambiente serverless (Vercel).
 *
 * Usa @neondatabase/serverless com WebSocket — muito mais rápido que pg.Pool
 * em cold-starts (estabelece conexão via WS ao invés de TCP por handshake).
 *
 * A API (.query, .connect, transactions) é compatível com pg.Pool, então
 * o código existente em withTenant continua funcionando.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Em Node.js runtime (Vercel functions), precisamos polyfill do WebSocket.
// Em Edge runtime o WebSocket é nativo — esse import vira no-op.
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const isDbConfigured = Boolean(connectionString);
