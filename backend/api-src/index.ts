import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../src/api/app';

function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (q: IncomingMessage, s: ServerResponse) => void)(req, res);
}

module.exports = handler;
