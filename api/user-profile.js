const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { validateOrigin } = require('./_lib/csrf');
const { verifyOwnerToken } = require('./_lib/owner-token');
const { parseCookies } = require('./_lib/usage');
const { getProfile, deleteProfile, emptyProfile } = require('./_lib/user-profile');

function verifyAccess(req) {
  const cookies = parseCookies(req.headers.cookie);
  const ownerKey = process.env.OWNER_KEY;
  if (ownerKey && cookies.sw_owner) {
    if (verifyOwnerToken(cookies.sw_owner, ownerKey)) {
      return { authorized: true, tier: 'owner', userId: 'owner' };
    }
  }
  const subSecret = process.env.SUBSCRIPTION_SECRET;
  if (subSecret && cookies.sw_sub) {
    try {
      const decoded = JSON.parse(Buffer.from(cookies.sw_sub, 'base64').toString());
      const { token, subId, custId } = decoded;
      if (token && subId && custId) {
        const expected = crypto.createHmac('sha256', subSecret).update(subId + ':' + custId).digest('hex');
        if (Buffer.byteLength(token) === Buffer.byteLength(expected) &&
            crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
          return { authorized: true, tier: 'premium', userId: `${custId}` };
        }
      }
    } catch {}
  }
  return { authorized: false, tier: 'free', userId: null };
}

module.exports = async function handler(req, res) {
  if (!validateOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  const rl = await rateLimit(`profile:${ip}`, 10, 60000);
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const access = verifyAccess(req);
  const profileUserId = access.authorized ? access.userId : ip;

  if (req.method === 'GET') {
    // Get user's scent profile
    try {
      const profile = await getProfile(profileUserId);
      return res.status(200).json({
        profile,
        hasProfile: profile.queryCount > 0
      });
    } catch {
      return res.status(200).json({ profile: emptyProfile(), hasProfile: false });
    }
  }

  if (req.method === 'DELETE') {
    // Reset/delete user's scent profile
    try {
      await deleteProfile(profileUserId);
      return res.status(200).json({ success: true, message: 'Scent profile reset successfully.' });
    } catch {
      return res.status(500).json({ error: 'Failed to reset profile.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
