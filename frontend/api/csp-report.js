export const config = {
  api: { bodyParser: { sizeLimit: '100kb' } },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(String(req.body ?? '{}'));
    const report = body?.['csp-report'] ?? body;
    console.log('[CSP-Report]', new Date().toISOString(), JSON.stringify(report));
  } catch (_) {}
  res.status(204).end();
}
