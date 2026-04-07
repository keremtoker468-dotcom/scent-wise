const { rateLimit, getClientIp } = require('./_lib/rate-limit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getClientIp(req);
  const rl = await rateLimit(`csp:${ip}`, 10, 60000);
  if (!rl.allowed) return res.status(429).end();

  try {
    const report = req.body?.['csp-report'] || req.body;
    if (report) {
      console.log('[CSP Violation]', {
        blockedUri: report['blocked-uri'] || report.blockedURL,
        directive: report['violated-directive'] || report.effectiveDirective,
        source: report['source-file'] || report.sourceFile,
        line: report['line-number'] || report.lineNumber
      });
    }
  } catch { /* ignore malformed reports */ }

  return res.status(204).end();
};
