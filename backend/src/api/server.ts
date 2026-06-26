import { app } from './app';
import { isDbConfigured } from '../db/pool';

// Servidor local (dev). Em produção a Vercel usa api/index.ts (serverless).
const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`[API] GestEscolar backend na porta ${port} (db=${isDbConfigured})`);
});
