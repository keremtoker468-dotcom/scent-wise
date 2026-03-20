const { ImageResponse } = require('@vercel/og');

module.exports = async function handler(req) {
  const { searchParams } = new URL(req.url, 'https://scent-wise.com');
  const title = searchParams.get('title') || 'ScentWise';
  const brand = searchParams.get('brand') || '';
  const rating = searchParams.get('rating') || '';
  const accords = searchParams.get('accords') || '';
  const type = searchParams.get('type') || 'perfume'; // perfume, brand, note, blog

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #09090b 0%, #16161a 50%, #0f0f12 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
        },
        children: [
          // Top: logo area
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: '12px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '24px', color: '#c9a96e', fontWeight: 700, letterSpacing: '0.5px' },
                    children: 'ScentWise',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '14px', color: '#a8a29e', marginLeft: '8px' },
                    children: type === 'brand' ? 'Brand Collection' : type === 'note' ? 'Fragrance Note' : type === 'blog' ? 'Blog' : 'Fragrance Profile',
                  },
                },
              ],
            },
          },
          // Middle: title + brand
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' },
              children: [
                brand ? {
                  type: 'div',
                  props: {
                    style: { fontSize: '20px', color: '#a8a29e' },
                    children: brand,
                  },
                } : null,
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: title.length > 40 ? '42px' : '52px',
                      fontWeight: 700,
                      color: '#f0ece4',
                      lineHeight: 1.2,
                      maxWidth: '900px',
                    },
                    children: title,
                  },
                },
                rating ? {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' },
                    children: [
                      { type: 'div', props: { style: { fontSize: '22px', color: '#c9a96e', fontWeight: 700 }, children: `${rating}/5` } },
                      { type: 'div', props: { style: { fontSize: '16px', color: '#a8a29e' }, children: 'Community Rating' } },
                    ],
                  },
                } : null,
              ].filter(Boolean),
            },
          },
          // Bottom: accords or tagline
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
              children: [
                accords ? {
                  type: 'div',
                  props: {
                    style: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
                    children: accords.split(',').slice(0, 5).map(a => ({
                      type: 'div',
                      props: {
                        style: {
                          background: 'rgba(201,169,110,0.12)',
                          border: '1px solid rgba(201,169,110,0.25)',
                          color: '#c9a96e',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '14px',
                        },
                        children: a.trim(),
                      },
                    })),
                  },
                } : {
                  type: 'div',
                  props: {
                    style: { fontSize: '16px', color: '#a8a29e' },
                    children: 'AI-Powered Fragrance Advisor — 75,000+ Perfumes',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: '16px', color: '#a8a29e' },
                    children: 'scent-wise.com',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
    }
  );
};

module.exports.config = {
  runtime: 'edge',
};
