/**
 * 11ty data file — generates note/accord pages.
 * Groups top perfumes by their dominant accords.
 */
const perfumesData = require('./perfumes');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generate pages for all accords with 3+ perfumes
const TARGET_NOTES = null; // null = auto-discover all accords

module.exports = function () {
  const perfumes = perfumesData();
  const noteMap = {};

  // Auto-discover all accords from the perfume database
  for (const p of perfumes) {
    for (const a of p.accords) {
      const key = a.toLowerCase();
      if (!noteMap[key]) {
        const name = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        noteMap[key] = {
          name,
          slug: slugify(key),
          perfumes: [],
          description: getNoteDescription(key)
        };
      }
      noteMap[key].perfumes.push(p);
    }
  }

  return Object.values(noteMap)
    .filter(n => n.perfumes.length >= 3)
    .map(n => {
      n.perfumes.sort((a, b) => b.rating - a.rating);
      n.perfumes = n.perfumes.slice(0, 50); // cap at 50 per page
      n.url = `/notes/${n.slug}/`;
      n.count = n.perfumes.length;
      return n;
    })
    .sort((a, b) => b.count - a.count);
};

function getNoteDescription(note) {
  const descriptions = {
    vanilla: 'Warm, sweet, and universally loved — vanilla is one of the most popular fragrance notes worldwide. It adds depth and comfort to any perfume.',
    oud: 'Prized in Middle Eastern perfumery, oud (agarwood) delivers rich, complex, woody-animalic notes. A luxury ingredient with centuries of history.',
    amber: 'A warm, resinous accord that evokes golden warmth. Amber perfumes are cozy, enveloping, and perfect for cooler weather.',
    musky: 'Soft, sensual, and skin-like — musk notes create an intimate, clean aura. A foundation of modern perfumery.',
    woody: 'Sandalwood, cedar, vetiver, and more. Woody fragrances ground compositions with earthy sophistication.',
    rose: 'The queen of flowers in perfumery. Rose spans from fresh and dewy to deep and velvety, with thousands of variations.',
    citrus: 'Bright, uplifting, and energizing. Citrus notes like bergamot, lemon, and orange open fragrances with sparkling freshness.',
    fresh: 'Clean, airy, and invigorating — fresh fragrances feel like a cool breeze. Perfect for everyday wear and warmer climates.',
    floral: 'The heart of perfumery. Floral fragrances capture the essence of blooming gardens in endless combinations.',
    sweet: 'Gourmand and indulgent — sweet fragrances feature sugar, praline, and dessert-like notes that captivate the senses.',
    aromatic: 'Herbal, green, and invigorating. Aromatic fragrances feature lavender, sage, rosemary, and other botanical notes.',
    aquatic: 'Ocean-inspired freshness with marine, ozone, and water-like accords. Modern and clean-wearing.',
    leather: 'Smoky, animalic, and refined. Leather notes add a distinctive edge of luxury and rebellion.',
    fruity: 'Juicy and playful — fruity notes like peach, apple, and berries add a youthful, vibrant character.',
    patchouli: 'Earthy, rich, and slightly sweet. Patchouli is a versatile base note beloved in niche and mainstream perfumery.',
    lavender: 'Calming and aromatic, lavender bridges the gap between fresh and herbal. A pillar of fougere fragrances.',
    cinnamon: 'Warm and spicy with a sweet edge. Cinnamon adds an exotic, festive quality to fragrances.',
    coffee: 'Rich, roasted, and addictive. Coffee notes bring a gourmand depth that appeals to modern fragrance lovers.',
    tobacco: 'Smooth, warm, and slightly sweet. Tobacco notes evoke vintage elegance and comfort.',
    coconut: 'Tropical and creamy — coconut notes transport you to sun-soaked beaches and add a luxurious creaminess.',
    cherry: 'Juicy, sweet, and slightly tart. Cherry notes range from bright Maraschino to dark, boozy amarena.',
    chocolate: 'Decadent and rich. Chocolate notes bring a gourmand sophistication to fragrance compositions.',
    caramel: 'Buttery, sweet, and indulgent. Caramel notes add a warm, dessert-like quality.',
    honey: 'Golden, warm, and slightly animalic. Honey notes add natural sweetness with depth.',
    smoky: 'Incense, birch tar, and fire. Smoky notes add mystery and intensity to compositions.',
    powdery: 'Soft, elegant, and nostalgic. Powdery fragrances evoke classic beauty and refined femininity.',
    iris: 'Sophisticated and buttery with a cool, suede-like quality. Iris is a hallmark of luxury perfumery.',
    violet: 'Sweet, green, and powdery. Violet notes are delicate yet distinctive, with a retro charm.',
    'warm spicy': 'Pepper, clove, nutmeg, and cardamom. Warm spices add exotic heat and complexity.',
    soapy: 'Clean, fresh, and comforting. Soapy fragrances evoke freshly laundered linens and daily rituals.',
    'fresh spicy': 'A vibrant blend of crisp freshness and pepper-like spice. Fresh spicy accords add energy and sophistication.',
    'white floral': 'Jasmine, tuberose, and gardenia — lush, creamy, and intoxicating. White florals are the heart of many iconic perfumes.',
    green: 'Leafy, grassy, and herbal. Green notes evoke freshly cut stems, dewy gardens, and natural vitality.',
    earthy: 'Rich soil, vetiver, and forest floor. Earthy accords ground fragrances with raw, natural depth.',
    balsamic: 'Warm, resinous, and slightly sweet. Balsamic notes like benzoin and Peru balsam add rich depth.',
    animalic: 'Primal, skin-like, and provocative. Animalic notes add an intimate, sensual dimension to fragrances.',
    mossy: 'Damp forest undergrowth and oakmoss. Mossy accords are the foundation of classic chypre perfumery.',
    'yellow floral': 'Bright, sunny florals like ylang-ylang and mimosa. Warm and radiant with a honeyed character.',
    'soft spicy': 'Gentle warmth without the bite. Soft spices like cardamom and pink pepper add subtle complexity.',
    herbal: 'Sage, thyme, and basil. Herbal notes bring a fresh, medicinal, garden-like quality to compositions.',
    almond: 'Sweet, nutty, and slightly bitter. Almond notes add a gourmand warmth reminiscent of marzipan.',
    ozonic: 'Clean, airy, and atmospheric. Ozonic notes evoke the smell of air after a thunderstorm.',
    nutty: 'Warm and comforting — hazelnut, walnut, and pistachio. Nutty notes add a gourmand sophistication.',
    aldehydic: 'Sparkling, soapy, and effervescent. Aldehydes give fragrances a champagne-like fizz famously used in Chanel No. 5.',
    lactonic: 'Creamy, milky, and skin-like. Lactonic notes evoke warmth and comfort with a subtle sweetness.',
    tropical: 'Exotic fruits, coconut, and warm breezes. Tropical notes transport you to island paradises.',
    rum: 'Boozy, warm, and sweet. Rum accords add a festive, indulgent quality to gourmand fragrances.',
    tuberose: 'Intensely floral, creamy, and narcotic. Tuberose is one of the most powerful flowers in perfumery.',
    cacao: 'Rich, bitter-sweet, and indulgent. Cacao notes bring a sophisticated chocolate depth without the sweetness.',
    anis: 'Licorice-like, sweet, and aromatic. Anise adds a distinctive, slightly medicinal charm.',
    marine: 'Ocean spray, sea salt, and fresh air. Marine notes capture the essence of the coastline.',
    metallic: 'Cool, sharp, and unusual. Metallic notes add an avant-garde, industrial edge to compositions.',
    whiskey: 'Smoky, malty, and warm. Whiskey accords add a sophisticated, boozy depth.',
    salty: 'Sea salt and mineral freshness. Salty notes add an unexpected twist that enhances other accords.',
    conifer: 'Pine, fir, and spruce. Coniferous notes evoke deep forests and crisp mountain air.',
    savory: 'Unexpected and intriguing — cumin, saffron, and kitchen spices in perfumery.',
    camphor: 'Cool, medicinal, and penetrating. Camphor notes add a refreshing, eucalyptus-like quality.'
  };
  return descriptions[note] || note.charAt(0).toUpperCase() + note.slice(1) + ' is a distinctive fragrance accord that adds unique character to perfume compositions.';
}
