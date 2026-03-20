class NotePage {
  data() {
    return {
      pagination: {
        data: 'notes',
        size: 1,
        alias: 'note'
      },
      permalink: data => `notes/${data.note.slug}/index.html`,
      layout: 'note.njk',
      eleventyComputed: {
        title: data => `Best ${data.note.name} Perfumes`,
        description: data => `Discover the ${data.note.count} best ${data.note.name.toLowerCase()} perfumes. ${data.note.description.slice(0, 120)}`,
        name: data => data.note.name,
        slug: data => data.note.slug,
        count: data => data.note.count,
        noteItems: data => data.note.perfumes.slice(0, 50),
        noteDescription: data => data.note.description
      }
    };
  }

  render() {
    return '';
  }
}

module.exports = NotePage;
