// User Learning Profile — stores fragrance preferences extracted from interactions in Redis.
// Profile key: "sw_profile:{userId}" where userId is custId (premium), "owner" (owner), or IP (free).
// Profile data is a JSON object with preference signals accumulated over time.

const MAX_PROFILE_SIZE = 8192; // 8KB max stored profile
const PROFILE_TTL = 365 * 24 * 60 * 60; // 1 year TTL
const MAX_LIKED = 30;
const MAX_DISLIKED = 15;
const MAX_HISTORY = 20;

function profileKey(userId) {
  return `sw_profile:${userId}`;
}

// Default empty profile structure
function emptyProfile() {
  return {
    v: 1, // schema version
    likedNotes: [],      // e.g. ["vanilla", "oud", "bergamot"]
    dislikedNotes: [],   // e.g. ["patchouli"]
    likedBrands: [],     // e.g. ["Dior", "Tom Ford"]
    preferredCategories: [], // e.g. ["woody", "oriental"]
    genderPref: null,    // "male", "female", "unisex", or null
    priceRange: null,    // "$", "$$", "$$$", or null
    occasions: [],       // e.g. ["date night", "office", "summer"]
    recentRecs: [],      // last N recommended fragrance names (avoid repeats)
    queryCount: 0,
    lastUpdated: null
  };
}

async function redisGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const resp = await fetch(`${url}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch {
    return null;
  }
}

async function redisSet(key, value, ttl) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_PROFILE_SIZE) return false;

    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['SET', key, json],
        ['EXPIRE', key, ttl]
      ])
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function redisDel(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const resp = await fetch(`${url}/DEL/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// Get user profile from Redis
async function getProfile(userId) {
  if (!userId) return emptyProfile();
  const key = profileKey(userId);
  const stored = await redisGet(key);
  if (!stored) return emptyProfile();
  // Migrate old schema versions if needed
  return { ...emptyProfile(), ...stored };
}

// Save user profile to Redis
async function saveProfile(userId, profile) {
  if (!userId) return false;
  const key = profileKey(userId);
  profile.lastUpdated = new Date().toISOString();
  return redisSet(key, profile, PROFILE_TTL);
}

// Delete user profile from Redis
async function deleteProfile(userId) {
  if (!userId) return false;
  const key = profileKey(userId);
  return redisDel(key);
}

// Add unique items to an array with a max cap, most recent first
function addUnique(arr, items, max) {
  const set = new Set(arr.map(s => s.toLowerCase()));
  for (const item of items) {
    const lower = item.toLowerCase().trim();
    if (lower && !set.has(lower)) {
      arr.unshift(item.trim());
      set.add(lower);
    }
  }
  return arr.slice(0, max);
}

// Extract preference signals from user message + AI response using simple heuristics.
// This avoids an extra Gemini call — we parse patterns from the conversation.
function extractPreferences(userMsg, aiResponse) {
  const prefs = {
    likedNotes: [],
    dislikedNotes: [],
    likedBrands: [],
    preferredCategories: [],
    genderPref: null,
    priceRange: null,
    occasions: [],
    recommendedFragrances: []
  };

  const userLower = (userMsg || '').toLowerCase();
  const aiLower = (aiResponse || '').toLowerCase();

  // Extract notes the user explicitly mentions liking
  const likePatterns = /(?:i (?:love|like|enjoy|prefer|adore|want)|looking for|into|fan of|obsessed with)\s+([^.!?\n]{3,60})/gi;
  let match;
  while ((match = likePatterns.exec(userMsg)) !== null) {
    const fragment = match[1].toLowerCase();
    const noteWords = extractNoteWords(fragment);
    prefs.likedNotes.push(...noteWords);
  }

  // Extract notes the user dislikes
  const dislikePatterns = /(?:i (?:don'?t like|hate|dislike|can'?t stand|avoid)|not a fan of|too much)\s+([^.!?\n]{3,60})/gi;
  while ((match = dislikePatterns.exec(userMsg)) !== null) {
    const fragment = match[1].toLowerCase();
    const noteWords = extractNoteWords(fragment);
    prefs.dislikedNotes.push(...noteWords);
  }

  // Extract fragrance names from AI response (bolded names)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  while ((match = boldPattern.exec(aiResponse)) !== null) {
    const name = match[1].trim();
    if (name.length > 2 && name.length < 80) {
      prefs.recommendedFragrances.push(name);
    }
  }

  // Extract brands from AI response
  const brandPattern = /\*\*[^*]+\*\*\s*by\s+([A-Z][a-zA-Zé&'. -]+)/g;
  while ((match = brandPattern.exec(aiResponse)) !== null) {
    prefs.likedBrands.push(match[1].trim());
  }

  // Detect gender preference from user message
  if (/\b(?:masculine|for (?:men|him|guys)|men'?s)\b/i.test(userMsg)) prefs.genderPref = 'male';
  else if (/\b(?:feminine|for (?:women|her|ladies)|women'?s)\b/i.test(userMsg)) prefs.genderPref = 'female';
  else if (/\b(?:unisex|gender.?neutral|for (?:anyone|both|everyone))\b/i.test(userMsg)) prefs.genderPref = 'unisex';

  // Detect price range
  if (/\b(?:budget|cheap|affordable|under \$\d{2}\b|inexpensive)\b/i.test(userMsg)) prefs.priceRange = '$';
  else if (/\b(?:mid.?range|moderate|reasonable)\b/i.test(userMsg)) prefs.priceRange = '$$';
  else if (/\b(?:luxury|expensive|high.?end|niche|premium|splurge)\b/i.test(userMsg)) prefs.priceRange = '$$$';

  // Detect occasion/context
  const occasionMap = {
    'date night': /\bdate\s*(?:night)?\b/i,
    'office': /\b(?:office|work|professional|business)\b/i,
    'summer': /\b(?:summer|hot weather|beach|tropical)\b/i,
    'winter': /\b(?:winter|cold weather|cozy|cold)\b/i,
    'casual': /\b(?:casual|everyday|daily|daytime)\b/i,
    'evening': /\b(?:evening|night out|clubbing|party)\b/i,
    'formal': /\b(?:formal|special occasion|wedding|event)\b/i,
    'sport': /\b(?:sport|gym|workout|active)\b/i
  };
  for (const [occasion, pattern] of Object.entries(occasionMap)) {
    if (pattern.test(userMsg)) prefs.occasions.push(occasion);
  }

  // Detect category preferences from both user and AI text
  const categories = ['woody', 'oriental', 'floral', 'fresh', 'citrus', 'aquatic', 'gourmand', 'spicy', 'musky', 'aromatic', 'chypre', 'fougere', 'leather', 'amber', 'powdery', 'green', 'fruity'];
  for (const cat of categories) {
    if (userLower.includes(cat)) {
      prefs.preferredCategories.push(cat);
    }
  }

  return prefs;
}

// Common fragrance notes for matching
const KNOWN_NOTES = [
  'vanilla', 'oud', 'bergamot', 'sandalwood', 'musk', 'amber', 'cedar', 'rose',
  'jasmine', 'lavender', 'patchouli', 'vetiver', 'tonka', 'tobacco', 'leather',
  'citrus', 'lemon', 'orange', 'grapefruit', 'neroli', 'ylang', 'tuberose',
  'iris', 'violet', 'peony', 'magnolia', 'lily', 'gardenia', 'saffron',
  'cardamom', 'cinnamon', 'pepper', 'ginger', 'nutmeg', 'clove',
  'coconut', 'chocolate', 'coffee', 'caramel', 'honey', 'almond',
  'apple', 'pear', 'peach', 'raspberry', 'strawberry', 'cherry', 'fig',
  'mint', 'eucalyptus', 'pine', 'incense', 'myrrh', 'frankincense',
  'sea salt', 'marine', 'aquatic', 'ozonic', 'clean', 'fresh',
  'woody', 'smoky', 'earthy', 'powdery', 'creamy', 'sweet', 'spicy', 'floral', 'fruity'
];

function extractNoteWords(text) {
  const found = [];
  const lower = text.toLowerCase();
  for (const note of KNOWN_NOTES) {
    if (lower.includes(note)) found.push(note);
  }
  return found;
}

// Update profile with new preference signals from an interaction
function updateProfile(profile, prefs) {
  if (prefs.likedNotes.length) {
    profile.likedNotes = addUnique(profile.likedNotes, prefs.likedNotes, MAX_LIKED);
  }
  if (prefs.dislikedNotes.length) {
    profile.dislikedNotes = addUnique(profile.dislikedNotes, prefs.dislikedNotes, MAX_DISLIKED);
  }
  if (prefs.likedBrands.length) {
    profile.likedBrands = addUnique(profile.likedBrands, prefs.likedBrands, 15);
  }
  if (prefs.preferredCategories.length) {
    profile.preferredCategories = addUnique(profile.preferredCategories, prefs.preferredCategories, 10);
  }
  if (prefs.genderPref) {
    profile.genderPref = prefs.genderPref;
  }
  if (prefs.priceRange) {
    profile.priceRange = prefs.priceRange;
  }
  if (prefs.occasions.length) {
    profile.occasions = addUnique(profile.occasions, prefs.occasions, 8);
  }
  if (prefs.recommendedFragrances.length) {
    profile.recentRecs = addUnique(profile.recentRecs, prefs.recommendedFragrances, MAX_HISTORY);
  }
  profile.queryCount++;
  return profile;
}

// Build a profile context string to inject into the system prompt
function buildProfilePrompt(profile) {
  if (!profile || profile.queryCount === 0) return '';

  const parts = [];
  parts.push('\n\n[User Scent Profile — learned from previous interactions]');

  if (profile.likedNotes.length) {
    parts.push(`Preferred notes: ${profile.likedNotes.join(', ')}`);
  }
  if (profile.dislikedNotes.length) {
    parts.push(`Dislikes: ${profile.dislikedNotes.join(', ')}`);
  }
  if (profile.likedBrands.length) {
    parts.push(`Favorite brands: ${profile.likedBrands.join(', ')}`);
  }
  if (profile.preferredCategories.length) {
    parts.push(`Preferred categories: ${profile.preferredCategories.join(', ')}`);
  }
  if (profile.genderPref) {
    parts.push(`Gender preference: ${profile.genderPref}`);
  }
  if (profile.priceRange) {
    parts.push(`Price range: ${profile.priceRange}`);
  }
  if (profile.occasions.length) {
    parts.push(`Common occasions: ${profile.occasions.join(', ')}`);
  }
  if (profile.recentRecs.length) {
    parts.push(`Previously recommended (try to suggest new options): ${profile.recentRecs.slice(0, 10).join(', ')}`);
  }

  parts.push('Use this profile to personalize recommendations. Prioritize their preferred notes and avoid disliked ones. Suggest new fragrances they haven\'t seen before when possible.');

  return parts.join('\n');
}

// Apply explicit user feedback (like/dislike) on a fragrance recommendation.
// fragranceName: the bold name from the AI response (e.g. "Bleu de Chanel")
// aiText: the full AI response text that contained this fragrance
// liked: true = user liked it, false = user disliked it
function applyFeedback(profile, fragranceName, aiText, liked) {
  if (!fragranceName) return profile;

  // Extract notes mentioned near this fragrance in the AI response
  const nameLower = fragranceName.toLowerCase();
  const aiLower = (aiText || '').toLowerCase();

  // Find the section about this fragrance (look for text around the bold name)
  const idx = aiLower.indexOf(nameLower);
  let section = aiText || '';
  if (idx >= 0) {
    // Grab ~300 chars around the fragrance mention
    const start = Math.max(0, idx - 50);
    const end = Math.min(aiLower.length, idx + 300);
    section = aiLower.slice(start, end);
  }

  // Extract notes from the section
  const notes = extractNoteWords(section);
  // Extract brand (pattern: "by Brand")
  const brandMatch = new RegExp('\\*\\*' + fragranceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*\\*\\s*by\\s+([A-Z][a-zA-Zé&\'. -]+)', 'i').exec(aiText || '');
  const brand = brandMatch ? brandMatch[1].trim() : null;

  if (liked) {
    // Boost liked notes and brand
    if (notes.length) profile.likedNotes = addUnique(profile.likedNotes, notes, MAX_LIKED);
    if (brand) profile.likedBrands = addUnique(profile.likedBrands, [brand], 15);
    // Remove from disliked if user now likes these notes
    if (notes.length) {
      const likedSet = new Set(notes.map(n => n.toLowerCase()));
      profile.dislikedNotes = profile.dislikedNotes.filter(n => !likedSet.has(n.toLowerCase()));
    }
  } else {
    // Add notes to disliked
    if (notes.length) profile.dislikedNotes = addUnique(profile.dislikedNotes, notes, MAX_DISLIKED);
    // Remove from liked if user now dislikes
    if (notes.length) {
      const dislikedSet = new Set(notes.map(n => n.toLowerCase()));
      profile.likedNotes = profile.likedNotes.filter(n => !dislikedSet.has(n.toLowerCase()));
    }
    // Remove brand from liked if disliked
    if (brand) {
      profile.likedBrands = profile.likedBrands.filter(b => b.toLowerCase() !== brand.toLowerCase());
    }
  }

  return profile;
}

module.exports = {
  getProfile,
  saveProfile,
  deleteProfile,
  extractPreferences,
  updateProfile,
  buildProfilePrompt,
  applyFeedback,
  emptyProfile
};
