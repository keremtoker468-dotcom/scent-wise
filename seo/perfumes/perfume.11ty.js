class PerfumePage {
  data() {
    return {
      pagination: {
        data: 'perfumes',
        size: 1,
        alias: 'perfume'
      },
      permalink: data => `perfumes/${data.perfume.slug}/index.html`,
      layout: 'perfume.njk',
      eleventyComputed: {
        title: data => `${data.perfume.name} by ${data.perfume.brand}`,
        description: data => {
          const p = data.perfume;
          return `${p.name} by ${p.brand} — ${p.category} fragrance for ${p.gender}. Rating: ${p.rating}/5.${p.accords.length ? ' Key accords: ' + p.accords.slice(0, 5).join(', ') + '.' : ''}`;
        },
        name: data => data.perfume.name,
        brand: data => data.perfume.brand,
        slug: data => data.perfume.slug,
        category: data => data.perfume.category,
        gender: data => data.perfume.gender,
        rating: data => data.perfume.rating,
        notes: data => data.perfume.notes,
        concentration: data => data.perfume.concentration,
        longevity: data => data.perfume.longevity,
        accords: data => data.perfume.accords
      }
    };
  }

  render() {
    return '';
  }
}

module.exports = PerfumePage;
