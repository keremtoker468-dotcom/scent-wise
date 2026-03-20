/**
 * 11ty data file — extracts top perfumes from the main ScentWise database.
 * Reads perfumes-rich.js and decodes the compact format into full objects.
 */
const fs = require('fs');
const path = require('path');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = function () {
  // Load and evaluate the rich data file
  const richPath = path.join(__dirname, '../../public/perfumes-rich.js');
  const richContent = fs.readFileSync(richPath, 'utf8');

  // Extract arrays using regex (they're global const declarations)
  const brandMatch = richContent.match(/const _RB=(\[[\s\S]*?\]);/);
  const accordMatch = richContent.match(/const _RA=(\[[\s\S]*?\]);/);
  const dataMatch = richContent.match(/const _RD=(\[[\s\S]*?\]);/);

  if (!brandMatch || !accordMatch || !dataMatch) {
    throw new Error('Could not parse perfumes-rich.js');
  }

  const _RB = JSON.parse(brandMatch[1]);
  const _RA = JSON.parse(accordMatch[1]);

  // _RD is a large array of arrays — parse carefully
  // Each entry: [name, brandIndex, category, gender, rating, accordIndices[], notes, concentration, longevity]
  const _RD = JSON.parse(dataMatch[1]);

  const _CM = { F: 'Fresh', L: 'Floral', O: 'Oriental', W: 'Woody', S: 'Sweet', A: 'Aromatic', Q: 'Aquatic', U: 'Fruity', M: 'Musky', P: 'Warm Spicy', '': '' };
  const _GM = { M: 'Male', F: 'Female', U: 'Unisex', '': '' };

  // Decode all perfumes
  const allPerfumes = _RD.map(e => ({
    name: e[0],
    brand: _RB[e[1]] || '',
    category: _CM[e[2]] || e[2],
    gender: _GM[e[3]] || e[3],
    rating: e[4] || 0,
    accords: (e[5] || []).map(i => _RA[i]).filter(Boolean),
    notes: e[6] || '',
    concentration: e[7] || '',
    longevity: e[8] || ''
  }));

  // Sort by rating (highest first), then take top 2000
  const top = allPerfumes
    .filter(p => p.rating >= 3.5 && p.name && p.brand)
    .sort((a, b) => b.rating - a.rating);

  const seen = new Set();
  const unique = [];
  for (const p of top) {
    const key = slugify(p.name + ' ' + p.brand);
    if (!seen.has(key)) {
      seen.add(key);
      p.slug = key;
      p.url = `/perfumes/${key}/`;
      unique.push(p);
    }
    if (unique.length >= 2000) break;
  }

  return unique;
};
