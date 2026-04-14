// Runtime validation for critical secrets — warns on startup if secrets are weak.
// This doesn't block operation but logs loudly to catch configuration mistakes.

const MIN_SECRET_LENGTH = 32; // Minimum 32 chars for HMAC-SHA256 secrets
let validated = false;

function validateSecrets() {
  if (validated) return;
  validated = true;

  const checks = [
    { name: 'SUBSCRIPTION_SECRET', value: process.env.SUBSCRIPTION_SECRET },
    { name: 'OWNER_KEY', value: process.env.OWNER_KEY },
    { name: 'LEMONSQUEEZY_WEBHOOK_SECRET', value: process.env.LEMONSQUEEZY_WEBHOOK_SECRET }
  ];

  for (const { name, value } of checks) {
    if (!value) continue; // Missing secrets are caught elsewhere
    if (value.length < MIN_SECRET_LENGTH) {
      console.error(`[SECURITY WARNING] ${name} is too short (${value.length} chars). Use at least ${MIN_SECRET_LENGTH} chars. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
    }
    // Check for common weak patterns
    if (/^(test|secret|password|123|abc|changeme)/i.test(value)) {
      console.error(`[SECURITY WARNING] ${name} appears to be a placeholder/weak secret. Replace it with a cryptographically random value.`);
    }
  }
}

module.exports = { validateSecrets };
