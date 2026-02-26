const { verifyOwnerToken } = require('./_lib/owner-token');
const { parseCookies } = require('./_lib/usage');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Authenticate via sw_owner cookie (timing-safe), not query params
  const ownerKey = process.env.OWNER_KEY;
  if (!ownerKey) return res.status(401).json({ error: 'Unauthorized' });

  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies.sw_owner || !verifyOwnerToken(cookies.sw_owner, ownerKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
  const config = {
    LEMONSQUEEZY_API_KEY: lsApiKey ? 'set' : 'MISSING',
    SUBSCRIPTION_SECRET: process.env.SUBSCRIPTION_SECRET ? 'set' : 'MISSING',
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID || 'not set',
    LEMONSQUEEZY_PRODUCT_ID: process.env.LEMONSQUEEZY_PRODUCT_ID || 'not set',
    LEMONSQUEEZY_VARIANT_ID: process.env.LEMONSQUEEZY_VARIANT_ID ? 'set' : 'MISSING',
    OWNER_KEY: 'set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
    VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
  };

  // Test the LemonSqueezy API key
  let apiTest = 'skipped';
  if (lsApiKey) {
    try {
      const r = await fetch('https://api.lemonsqueezy.com/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${lsApiKey}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        }
      });
      if (r.ok) {
        apiTest = 'OK — API key is valid';
      } else {
        const body = await r.text().catch(() => '');
        apiTest = `FAILED — HTTP ${r.status}: ${body.substring(0, 200)}`;
      }
    } catch (err) {
      apiTest = `ERROR — ${err.message}`;
    }
  }

  // Test the orders API endpoint (same one login uses)
  let ordersTest = 'skipped';
  if (lsApiKey) {
    try {
      const oUrl = `https://api.lemonsqueezy.com/v1/orders?page[size]=1`;
      const oRes = await fetch(oUrl, {
        headers: {
          'Authorization': `Bearer ${lsApiKey}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        }
      });
      if (oRes.ok) {
        const oData = await oRes.json();
        const count = oData.meta?.page?.total || 0;
        ordersTest = `OK — ${count} total orders in store`;
      } else {
        const oBody = await oRes.text().catch(() => '');
        ordersTest = `FAILED — HTTP ${oRes.status}: ${oBody.substring(0, 200)}`;
      }
    } catch (err) {
      ordersTest = `ERROR — ${err.message}`;
    }
  }

  // Test the customers API endpoint (same query as email login uses)
  let customersTest = 'skipped';
  if (lsApiKey) {
    try {
      const storeId = process.env.LEMONSQUEEZY_STORE_ID;
      let cUrl = `https://api.lemonsqueezy.com/v1/customers?page[size]=1`;
      if (storeId) cUrl += `&filter[store_id]=${storeId}`;
      const cRes = await fetch(cUrl, {
        headers: {
          'Authorization': `Bearer ${lsApiKey}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        }
      });
      if (cRes.ok) {
        const cData = await cRes.json();
        const count = cData.meta?.page?.total || 0;
        customersTest = `OK — ${count} total customers (store_id filter: ${storeId || 'none'})`;
      } else {
        const cBody = await cRes.text().catch(() => '');
        customersTest = `FAILED — HTTP ${cRes.status}: ${cBody.substring(0, 200)}`;
      }
    } catch (err) {
      customersTest = `ERROR — ${err.message}`;
    }
  }

  return res.status(200).json({ config, apiKeyTest: apiTest, ordersApiTest: ordersTest, customersApiTest: customersTest });
};
