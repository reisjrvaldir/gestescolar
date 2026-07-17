// Entrada serverless da Vercel — compilada nativamente pelo @vercel/node.
// (O deploy via Git não tem o api/index.js do esbuild, que é gitignored.)
import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../src/api/app';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (q: IncomingMessage, s: ServerResponse) => void)(req, res);
}
