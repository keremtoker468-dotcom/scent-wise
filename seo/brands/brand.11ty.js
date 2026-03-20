class BrandPage {
  data() {
    return {
      pagination: {
        data: 'brands',
        size: 1,
        alias: 'brand'
      },
      permalink: data => `brands/${data.brand.slug}/index.html`,
      layout: 'brand.njk',
      eleventyComputed: {
        title: data => `${data.brand.name} Perfumes`,
        description: data => `Explore ${data.brand.perfumes.length} top-rated ${data.brand.name} fragrances. Average rating: ${data.brand.avgRating}/5. Signature accords: ${data.brand.topAccords.join(', ')}.`,
        name: data => data.brand.name,
        slug: data => data.brand.slug,
        brandItems: data => data.brand.perfumes,
        avgRating: data => data.brand.avgRating,
        topAccords: data => data.brand.topAccords
      }
    };
  }

  render() {
    return '';
  }
}

module.exports = BrandPage;
