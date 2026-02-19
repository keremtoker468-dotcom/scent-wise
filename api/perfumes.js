const path = require('path');
const fs = require('fs');

let cachedData = null;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Cache the file read in memory across warm invocations
  if (!cachedData) {
    const filePath = path.join(process.cwd(), 'public', 'perfumes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Extract the array from "const SI=[...];"
    const match = content.match(/const SI\s*=\s*(\[[\s\S]*\]);?/);
    if (match) {
      cachedData = match[1];
    }
  }

  if (!cachedData) {
    return res.status(500).json({ error: 'Perfume data not found' });
  }

  // Immutable cache for 1 day (data rarely changes)
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).end(cachedData);
};
