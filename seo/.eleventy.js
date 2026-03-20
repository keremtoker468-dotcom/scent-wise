module.exports = function (eleventyConfig) {
  // Slugify filter
  eleventyConfig.addFilter('slugify', function (str) {
    return (str || '')
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  });

  // Slice filter for arrays
  eleventyConfig.addFilter('slice', function (arr, start, end) {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(start, end);
  });

  // Truncate filter
  eleventyConfig.addFilter('truncate', function (str, len) {
    if (!str || str.length <= len) return str;
    return str.slice(0, len).replace(/\s+\S*$/, '') + '...';
  });

  // Current year shortcode
  eleventyConfig.addFilter('currentYear', function () {
    return new Date().getFullYear();
  });

  // Lower case filter
  eleventyConfig.addFilter('lower', function (str) {
    return (str || '').toLowerCase();
  });

  return {
    dir: {
      input: '.',
      includes: '_includes',
      data: '_data',
      output: '_site'
    },
    templateFormats: ['njk', '11ty.js'],
    htmlTemplateEngine: 'njk'
  };
};
