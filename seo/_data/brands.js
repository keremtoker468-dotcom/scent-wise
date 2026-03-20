/**
 * 11ty data file — generates brand index pages from perfume data.
 * Groups top perfumes by brand, returns top 50 brands.
 */
const perfumesData = require('./perfumes');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = function () {
  const perfumes = perfumesData();
  const brandMap = {};

  for (const p of perfumes) {
    if (!brandMap[p.brand]) {
      brandMap[p.brand] = {
        name: p.brand,
        slug: slugify(p.brand),
        perfumes: [],
        avgRating: 0,
        topAccords: {}
      };
    }
    brandMap[p.brand].perfumes.push(p);
    for (const a of p.accords) {
      brandMap[p.brand].topAccords[a] = (brandMap[p.brand].topAccords[a] || 0) + 1;
    }
  }

  // Calculate avg ratings and sort accords
  const brands = Object.values(brandMap).map(b => {
    b.avgRating = +(b.perfumes.reduce((s, p) => s + p.rating, 0) / b.perfumes.length).toFixed(1);
    b.topAccords = Object.entries(b.topAccords)
      .sort((a, c) => c[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);
    b.perfumes.sort((a, c) => c.rating - a.rating);
    b.url = `/brands/${b.slug}/`;
    return b;
  });

  // Top 50 brands by number of perfumes in our top-500 list
  return brands
    .sort((a, b) => b.perfumes.length - a.perfumes.length)
    .slice(0, 50);
};
