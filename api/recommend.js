export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { mode, messages, imageBase64, imageMime, prompt } = req.body;

    // Try models in order - if one hits rate limit, fall back to next
    const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

    let body;
    if (mode === 'photo' && imageBase64) {
      body = {
        contents: [{
          parts: [
            { inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } },
            { text: prompt || 'Analyze this photo and recommend fragrances based on the style, clothing, and aesthetic.' }
          ]
        }],
        systemInstruction: { parts: [{ text: PHOTO_SYSTEM }] },
        generationConfig: { maxOutputTokens: 1200, temperature: 0.8 }
      };
    } else {
      const contents = (messages || []).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      body = {
        contents,
        systemInstruction: { parts: [{ text: CHAT_SYSTEM }] },
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
      };
    }

    let lastError = null;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Retry up to 2 times per model
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (response.ok) {
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
            return res.status(200).json({ result: text });
          }

          if (response.status === 429) {
            lastError = `Rate limited on ${model}`;
            console.log(`429 on ${model}, attempt ${attempt + 1}`);
            break; // Try next model
          }

          const errText = await response.text();
          lastError = errText;
          console.error(`Error on ${model}:`, errText);
          break;

        } catch (fetchErr) {
          lastError = fetchErr.message;
          console.error(`Fetch error on ${model}:`, fetchErr.message);
        }
      }
    }

    return res.status(429).json({
      error: 'AI service temporarily busy. Please wait a moment and try again.',
      details: lastError
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const CHAT_SYSTEM = `You are ScentWise AI — the world's most knowledgeable fragrance advisor. You help people discover their perfect scent through deep expertise in perfumery.

Your knowledge spans:
- Thousands of fragrances across all price ranges, from niche (Maison Francis Kurkdjian, Tom Ford, Amouage, Xerjoff) to designer (Dior, Chanel, Versace, YSL) to affordable (Zara, Al Rehab, Lattafa)
- Notes, accords, longevity, sillage, projection for major fragrances
- Seasonal recommendations, occasion-based picks, layering advice
- Dupe/clone alternatives (e.g., Aventus to Club De Nuit Intense Man, BR540 to Cloud)
- Zodiac-based recommendations tied to personality traits
- Music taste to fragrance connections
- Celebrity fragrance associations
- Budget-conscious alternatives

Response style:
- Always recommend specific fragrances by name with brand
- Include price range when possible
- Mention key notes and accords
- Be conversational, passionate, and knowledgeable
- Format with clear structure using line breaks
- Keep responses concise but informative (3-5 fragrance recommendations per question)
- Never reference Fragrantica — use general fragrance community knowledge`;

const PHOTO_SYSTEM = `You are a style-to-fragrance expert at ScentWise. Analyze the uploaded photo and recommend fragrances based on:

1. Overall Style — clothing, accessories, aesthetic vibe
2. Color Palette — dominant colors in their look
3. Energy/Mood — the overall impression and personality

Based on your analysis, recommend 5 specific fragrances with:
- Fragrance name and brand
- WHY it matches their style
- Key notes
- Approximate price range

Focus entirely on style, clothing, accessories, and overall aesthetic energy. Never comment on physical features or body. Be specific and creative in your connections between fashion and fragrance.

Never reference Fragrantica — use general fragrance expertise.`;
