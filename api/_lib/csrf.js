// CSRF protection via Origin/Referer header validation.
// Modern browsers always send Origin on cross-origin POST requests.
// Falls back to X-Requested-With custom header check for browsers/extensions
// that strip Origin and Referer (custom headers can't be sent cross-origin
// without CORS preflight, so their presence proves same-origin).
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

  // Fallback: X-Requested-With header (can't be set cross-origin without CORS preflight)
  if (req.headers['x-requested-with'] === 'ScentWise') return true;

  // No Origin, Referer, or custom header — reject
  return false;
}

function validateContentType(req) {
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) return true;
  const ct = (req.headers['content-type'] || '').toLowerCase();
  return ct.includes('application/json');
}

// Returns true if body size exceeds limit. Default 1MB.
function isBodyTooLarge(req, maxBytes = 1048576) {
  const cl = parseInt(req.headers['content-length'], 10);
  if (!isNaN(cl) && cl > maxBytes) return true;
  if (typeof req.body === 'string' && Buffer.byteLength(req.body) > maxBytes) return true;
  if (Buffer.isBuffer(req.body) && req.body.length > maxBytes) return true;
  return false;
}

module.exports = { validateOrigin, validateContentType, isBodyTooLarge };
