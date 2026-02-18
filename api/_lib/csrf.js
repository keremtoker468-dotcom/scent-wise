// CSRF protection via Origin/Referer header validation.
// Modern browsers always send Origin on cross-origin POST requests.
function validateOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const host = req.headers['host'];

  if (!host) return false;

  if (origin) {
    try { return new URL(origin).host === host; }
    catch { return false; }
  }

  if (referer) {
    try { return new URL(referer).host === host; }
    catch { return false; }
  }

  // No Origin or Referer — reject
  return false;
}

module.exports = { validateOrigin };
