
// ═══════════════ TOAST NOTIFICATIONS ═══════════════
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✓', error: '✕', info: '✦' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = icons[type] || icons.info;
  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = message;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = function() { toast.remove(); };
  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'toastOut .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// ═══════════════ CONFIG ═══════════════
const API_URL = '/api/recommend';
let LEMON_URL = ''; // Dynamically created via /api/create-checkout

// ═══════════════ EMAIL CAPTURE ═══════════════
async function captureEmail(e) {
  e.preventDefault();
  const input = document.getElementById('hp-email-input');
  const btn = document.getElementById('hp-email-btn');
  const email = input ? input.value.trim() : '';
  if (!email) return false;

  if (btn) { btn.disabled = true; btn.textContent = 'Subscribing...'; }
  if (input) input.disabled = true;

  try {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ email })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      showToast(d.error || 'Could not subscribe. Please try again.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Subscribe Free'; }
      if (input) input.disabled = false;
      return false;
    }
  } catch {
    showToast('Network error — please check your connection.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Subscribe Free'; }
    if (input) input.disabled = false;
    return false;
  }

  if (typeof gtag === 'function') gtag('event', 'email_captured', { method: 'newsletter' });
  if (btn) btn.textContent = 'Subscribed!';
  if (input) { input.value = ''; input.placeholder = 'Thank you!'; }
  showToast('You\'re on the list! Check your inbox for a welcome email.', 'success');
  return false;
}

// ═══════════════ FUNNEL ANALYTICS ═══════════════
function trackFunnel(step, data) {
  if (typeof gtag !== 'function') return;
  gtag('event', step, data || {});
}

// ═══════════════ MOBILE MODE SWITCHER ═══════════════
function openModeSwitcher() {
  const overlay = document.getElementById('mode-switcher-overlay');
  const optionsEl = document.getElementById('mode-switch-options');
  if (!overlay || !optionsEl) return;
  const allModes = [
    {id:'chat',name:'AI Advisor',desc:'Ask anything about fragrances',i:'💬'},
    {id:'explore',name:'Explore Database',desc:'Search 75,000+ perfumes',i:'🧪'},
    {id:'photo',name:'Photo Style Scan',desc:'Upload a photo, get matched scents',i:'📸'},
    {id:'zodiac',name:'Zodiac Match',desc:'Fragrances aligned with your stars',i:'🔮'},
    {id:'music',name:'Music Match',desc:'Your music taste reveals your scent',i:'🎶'},
    {id:'style',name:'Style Match',desc:'Scents that match your wardrobe',i:'🪞'},
    {id:'dupe',name:'Dupe Finder',desc:'Find affordable alternatives to pricey scents',i:'🔄'},
    {id:'celeb',name:'Celebrity Collections',desc:'See what the icons wear',i:'💫'}
  ];
  optionsEl.innerHTML = allModes.map(m =>
    `<div class="ms-option ${CP===m.id?'ms-active':''}" onclick="goFromSwitcher('${m.id}')">
      <div class="ms-icon">${m.i}</div>
      <div class="ms-info">
        <div class="ms-name">${m.name}</div>
        <div class="ms-desc">${m.desc}</div>
      </div>
      ${CP===m.id?'<div class="ms-check">&#10003;</div>':''}
    </div>`
  ).join('');
  overlay.classList.add('active');
}

function closeModeSwitcher() {
  const overlay = document.getElementById('mode-switcher-overlay');
  if (overlay) overlay.classList.remove('active');
}

function goFromSwitcher(id) {
  closeModeSwitcher();
  go(id);
}

// ═══════════════ DATABASE ENGINE ═══════════════
const _CM = {F:'Fresh',L:'Floral',O:'Oriental',W:'Woody',S:'Sweet',A:'Aromatic',Q:'Aquatic',U:'Fruity',M:'Musky',P:'Warm Spicy','':''};
const _GM = {M:'Male',F:'Female',U:'Unisex','':''};

// Lazy-loaded database arrays — populated by loadDB()
let SI = [];
let RD = [];
const RL = {};
let _dbLoaded = false;
let _dbLoadPromise = null;

function _decodeDB() {
  return new Promise(resolve => {
    if (typeof _SI !== 'undefined' && SI.length === 0) {
      SI = _SI.map(s => {
        const p = s.split('|');
        return p[0] + '|' + (_SB[+p[1]]||'') + '|' + (_CM[p[2]]||p[2]) + '|' + (_GM[p[3]]||p[3]);
      });
    }
    // Yield to main thread between SI and RD processing
    setTimeout(() => {
      if (typeof _RD !== 'undefined' && RD.length === 0) {
        RD = _RD.map(e => {
          const o = {n:e[0], b:_RB[e[1]]||'', c:_CM[e[2]]||e[2], g:_GM[e[3]]||e[3], r:e[4], a:(e[5]||[]).map(i=>_RA[i]).join(', ')};
          if (e[6]) o.t = e[6];
          if (e[7]) o.o = e[7];
          if (e[8]) o.l = e[8];
          return o;
        });
        RD.forEach(p => { RL[(p.n+'|'+p.b).toLowerCase()] = p; });
      }
      _dbLoaded = true;
      resolve();
    }, 0);
  });
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function loadDB() {
  if (_dbLoaded) return Promise.resolve();
  if (_dbLoadPromise) return _dbLoadPromise;
  _dbLoadPromise = Promise.all([
    _loadScript('/perfumes.js'),
    _loadScript('/perfumes-rich.js')
  ]).then(() => _decodeDB())
    .catch(err => { console.error('Failed to load perfume data:', err); _dbLoaded = true; });
  return _dbLoadPromise;
}

function find(name, brand) {
  if (!name) return null;
  const key = (name + '|' + (brand||'')).toLowerCase();
  if (RL[key]) return RL[key];
  const nl = name.toLowerCase();
  for (const k in RL) {
    if (k.startsWith(nl + '|')) return RL[k];
  }
  return null;
}

function searchDB(query, limit) {
  limit = limit || 50;
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return [];
  const results = [];
  for (let i = 0; i < SI.length && results.length < limit; i++) {
    const entry = SI[i].toLowerCase();
    if (terms.every(t => entry.includes(t))) {
      const parts = SI[i].split('|');
      const key = (parts[0] + '|' + parts[1]).toLowerCase();
      const rich = RL[key];
      results.push({
        name: parts[0], brand: parts[1], category: parts[2], gender: parts[3],
        ...(rich ? {notes: rich.t, accords: rich.a, rating: rich.r, concentration: rich.o, longevity: rich.l} : {})
      });
    }
  }
  return results;
}

function findSimilar(name, brand, limit) {
  limit = limit || 10;
  const key = (name + '|' + brand).toLowerCase();
  const src = RL[key];
  if (!src || !src.a) return [];
  const srcAccords = src.a.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (!srcAccords.length) return [];
  const scored = [];
  RD.forEach(p => {
    if ((p.n + '|' + p.b).toLowerCase() === key) return;
    const pa = (p.a || '').toLowerCase().split(',').map(s => s.trim());
    const overlap = srcAccords.filter(a => pa.includes(a)).length;
    if (overlap >= 2) scored.push({...p, score: overlap});
  });
  scored.sort((a, b) => b.score - a.score || (b.r||0) - (a.r||0));
  return scored.slice(0, limit);
}

function getContext(query) {
  const results = searchDB(query, 20);
  if (!results.length) {
    const terms = query.toLowerCase().split(/\s+/);
    for (const t of terms) {
      if (t.length > 3) {
        const r = searchDB(t, 10);
        if (r.length) results.push(...r);
      }
    }
  }
  if (!results.length) return '';
  const lines = results.slice(0, 15).map(r => {
    let s = `${r.name} by ${r.brand}`;
    if (r.category) s += ` | ${r.category}`;
    if (r.gender) s += ` | ${r.gender}`;
    if (r.notes) s += ` | Notes: ${r.notes}`;
    if (r.accords) s += ` | Accords: ${r.accords}`;
    if (r.rating) s += ` | Rating: ${r.rating}/5`;
    return s;
  });
  return '\n\nRelevant perfumes from database:\n' + lines.join('\n');
}

// ═══════════════ SUBSCRIPTION (cookie-based) ═══════════════
let isOwner = false;
let isPaid = false;
let currentTier = 'free';
let userEmail = '';
let aiUsage = 0;
let freeUsed = 0;
const MAX_PAID = 500;
const FREE_LIMIT = 3;

async function checkTier() {
  try {
    const r = await fetch('/api/check-tier', { credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } });
    const d = await r.json();
    currentTier = d.tier || 'free';
    isOwner = currentTier === 'owner';
    isPaid = isOwner || currentTier === 'premium';
    if (d.email) userEmail = d.email;
    if (typeof d.usage === 'number') aiUsage = d.usage;
    if (typeof d.freeUsed === 'number') freeUsed = d.freeUsed;
  } catch { currentTier = 'free'; isOwner = false; isPaid = false; userEmail = ''; }
}

function canUseAI() {
  if (isOwner) return true;
  if (isPaid) return aiUsage < MAX_PAID;
  return freeUsed < FREE_LIMIT;
}

function hasFreeTrialLeft() {
  return !isPaid && !isOwner && freeUsed < FREE_LIMIT;
}

function trackUsage(serverUsage) {
  if (isOwner) return;
  if (typeof serverUsage === 'number') { aiUsage = serverUsage; return; }
  aiUsage++;
}

function trackFreeUsage(used) {
  if (typeof used === 'number') freeUsed = used;
  else freeUsed++;
  trackFunnel('free_trial_used', { queries_used: freeUsed, queries_remaining: FREE_LIMIT - freeUsed });
}

// ═══════════════ USER SCENT PROFILE ═══════════════
let scentProfile = null;
let profileLoading = false;
let profileLoaded = false;

async function loadScentProfile(force) {
  if (profileLoading) return scentProfile;
  if (profileLoaded && !force) return scentProfile;
  profileLoading = true;
  try {
    const r = await fetch('/api/check-tier?action=profile', { credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } });
    if (r.ok) {
      const d = await r.json();
      scentProfile = d.hasProfile ? d.profile : null;
    }
  } catch { scentProfile = null; }
  profileLoading = false;
  profileLoaded = true;
  return scentProfile;
}

async function resetScentProfile() {
  try {
    const r = await fetch('/api/check-tier?action=profile', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'ScentWise' }
    });
    if (r.ok) {
      scentProfile = null;
      profileLoaded = false;
      showToast('Scent profile reset successfully.', 'success');
      const el = document.getElementById('page-account');
      if (el) r_account(el);
    } else {
      showToast('Failed to reset profile.', 'error');
    }
  } catch {
    showToast('Failed to reset profile.', 'error');
  }
}

// ═══════════════ SCENT FEEDBACK (Like/Dislike) ═══════════════
const _ratedMsgs = new Set(); // track rated message indices to prevent double-rating
const _likedFrags = new Set(); // track individually liked/disliked fragrances

async function likeFragrance(name, liked, btnEl) {
  const key = name.toLowerCase();

  // Toggle: if already liked/disliked in the same way, undo it
  const currentState = _likedFrags.has(key + '_up') ? 'up' : _likedFrags.has(key + '_down') ? 'down' : null;
  const newAction = liked ? 'up' : 'down';

  if (currentState === newAction) {
    // Undo — remove the like/dislike
    _likedFrags.delete(key + '_' + currentState);
    if (btnEl) {
      btnEl.style.color = 'rgba(201,169,110,.4)';
      btnEl.innerHTML = '&#9825;';
      btnEl.title = 'Love this fragrance';
      // Re-show the X button if it was hidden
      const xBtn = btnEl.nextElementSibling;
      if (xBtn && xBtn.tagName === 'BUTTON') xBtn.style.display = '';
    }
    // Send opposite feedback to undo in the profile
    liked = !liked;
  } else {
    // Clear any previous state
    _likedFrags.delete(key + '_up');
    _likedFrags.delete(key + '_down');
    _likedFrags.add(key + '_' + newAction);
    if (btnEl) {
      btnEl.style.color = liked ? '#f56565' : 'rgba(201,169,110,.4)';
      btnEl.style.opacity = '1';
      btnEl.title = liked ? 'Click again to unlike' : 'Not for you';
      btnEl.innerHTML = liked ? '&#9829;' : '&#9825;';
    }
  }

  // Find the AI text context — search all assistant messages for this fragrance
  let aiText = '';
  for (let i = chatMsgs.length - 1; i >= 0; i--) {
    if (chatMsgs[i].role === 'assistant' && chatMsgs[i].content.includes('**' + name + '**')) {
      aiText = chatMsgs[i].content;
      break;
    }
  }
  // Fallback: check mode results
  if (!aiText) {
    for (const r of [photoRes, zodiacRes, musicRes, styleRes, dupeRes]) {
      if (r && r.includes('**' + name + '**')) { aiText = r; break; }
    }
  }

  try {
    await fetch('/api/check-tier?action=profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      body: JSON.stringify({ fragranceName: name, aiText: aiText.slice(0, 3000), liked })
    });
  } catch {}
  profileLoaded = false;
  loadScentProfile();
}

async function likeFragranceCard(name, brand, btnEl) {
  const key = name.toLowerCase();
  const wasLiked = _likedFrags.has(key + '_up');

  if (wasLiked) {
    // Toggle off — unlike
    _likedFrags.delete(key + '_up');
    if (btnEl) {
      btnEl.innerHTML = '&#9825;';
      btnEl.style.color = 'rgba(201,169,110,.35)';
      btnEl.style.transform = 'scale(1.3)';
      setTimeout(() => { btnEl.style.transform = 'scale(1)'; }, 200);
    }
  } else {
    // Like
    _likedFrags.add(key + '_up');
    if (btnEl) {
      btnEl.innerHTML = '&#9829;';
      btnEl.style.color = '#f56565';
      btnEl.style.transform = 'scale(1.3)';
      setTimeout(() => { btnEl.style.transform = 'scale(1)'; }, 200);
    }
  }

  // Build context from the card's perfume data (notes, accords, category)
  let aiText = `**${name}** by ${brand}`;
  // Look up rich data from the decoded RL map
  const rlKey = (name + '|' + brand).toLowerCase();
  if (typeof RL !== 'undefined' && RL[rlKey]) {
    const d = RL[rlKey];
    if (d.t) aiText += `. Notes: ${d.t}`;
    if (d.a) aiText += `. Accords: ${d.a}`;
    if (d.c) aiText += `. Category: ${d.c}`;
  }

  try {
    await fetch('/api/check-tier?action=profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      body: JSON.stringify({ fragranceName: name, aiText, liked: !wasLiked })
    });
  } catch {}
  profileLoaded = false;
  loadScentProfile();
}

async function rateScentMsg(msgIdx, liked) {
  const msg = chatMsgs[msgIdx];
  if (!msg || msg.role !== 'assistant') return;
  const key = msgIdx + '_' + (liked ? 'up' : 'down');
  if (_ratedMsgs.has(msgIdx + '_up') || _ratedMsgs.has(msgIdx + '_down')) return; // already rated
  _ratedMsgs.add(key);

  // Extract all bold fragrance names from this message
  const names = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(msg.content)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && name.length < 80 && !name.startsWith('Oops') && !name.startsWith('Something')) names.push(name);
  }
  if (!names.length) { _ratedMsgs.delete(key); return; }

  // Update UI immediately
  const btnWrap = document.getElementById('fb-' + msgIdx);
  if (btnWrap) btnWrap.innerHTML = `<span style="color:var(--td);font-size:11px">${liked ? 'Noted — you liked these!' : 'Got it — noted your preference'}</span>`;

  // Send each fragrance as feedback
  for (const name of names) {
    try {
      await fetch('/api/check-tier?action=profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
        body: JSON.stringify({ fragranceName: name, aiText: msg.content, liked })
      });
    } catch {}
  }
  // Refresh profile data
  profileLoaded = false;
  loadScentProfile();
}

function feedbackHTML(msgIdx) {
  // Only show on assistant messages that contain fragrance recommendations (bold names)
  const msg = chatMsgs[msgIdx];
  if (!msg || msg.role !== 'assistant') return '';
  if (!/\*\*[^*]{3,}\*\*/.test(msg.content)) return ''; // no bold fragrance names
  if (msg.content.startsWith('**Oops!**') || msg.content.startsWith('**Something went wrong') || msg.content.startsWith('**Connection issue')) return '';
  if (_ratedMsgs.has(msgIdx + '_up') || _ratedMsgs.has(msgIdx + '_down')) {
    const liked = _ratedMsgs.has(msgIdx + '_up');
    return `<div id="fb-${msgIdx}" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)"><span style="color:var(--td);font-size:11px">${liked ? 'Noted — you liked these!' : 'Got it — noted your preference'}</span></div>`;
  }
  return `<div id="fb-${msgIdx}" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:10px">
    <span style="color:var(--td);font-size:11px">Did you like these recommendations?</span>
    <button onclick="rateScentMsg(${msgIdx},true)" style="background:none;border:1px solid rgba(201,169,110,.2);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;color:var(--g);display:flex;align-items:center;gap:4px" title="I liked these">&#128077; Yes</button>
    <button onclick="rateScentMsg(${msgIdx},false)" style="background:none;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;color:var(--td);display:flex;align-items:center;gap:4px" title="Not for me">&#128078; No</button>
  </div>`;
}

// Mode feedback for non-chat AI results (photo, zodiac, music, style, dupe)
const _ratedModes = new Set();

function _getModeRes(modeId) {
  if (modeId === 'photo') return photoRes;
  if (modeId === 'zodiac') return zodiacRes;
  if (modeId === 'music') return musicRes;
  if (modeId === 'style') return styleRes;
  if (modeId === 'dupe') return dupeRes;
  return '';
}

async function rateScentMode(modeId, liked) {
  if (_ratedModes.has(modeId)) return;
  _ratedModes.add(modeId);
  const resultText = _getModeRes(modeId);

  const btnWrap = document.getElementById('mfb-' + modeId);
  if (btnWrap) btnWrap.innerHTML = `<span style="color:var(--td);font-size:11px">${liked ? 'Noted — you liked these!' : 'Got it — noted your preference'}</span>`;

  const names = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(resultText)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && name.length < 80 && !name.startsWith('Oops') && !name.startsWith('Something')) names.push(name);
  }
  for (const name of names) {
    try {
      await fetch('/api/check-tier?action=profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
        body: JSON.stringify({ fragranceName: name, aiText: resultText, liked })
      });
    } catch {}
  }
  profileLoaded = false;
  loadScentProfile();
}

function modeFeedbackHTML(modeId, resultText) {
  if (!resultText || !/\*\*[^*]{3,}\*\*/.test(resultText)) return '';
  if (_ratedModes.has(modeId)) {
    return `<div id="mfb-${modeId}" style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)"><span style="color:var(--td);font-size:11px">Thanks for your feedback!</span></div>`;
  }
  return `<div id="mfb-${modeId}" style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:10px">
    <span style="color:var(--td);font-size:11px">Like these picks?</span>
    <button onclick="rateScentMode('${modeId}',true)" style="background:none;border:1px solid rgba(201,169,110,.2);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;color:var(--g);display:flex;align-items:center;gap:4px">&#128077; Yes</button>
    <button onclick="rateScentMode('${modeId}',false)" style="background:none;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;color:var(--td);display:flex;align-items:center;gap:4px">&#128078; No</button>
  </div>`;
}

function renderProfileCard() {
  if (!scentProfile || scentProfile.queryCount === 0) {
    return `<div class="glass-panel" style="margin-bottom:18px">
      <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:10px;text-transform:uppercase">Scent Profile</p>
      <p style="color:var(--td);font-size:13px;line-height:1.6;margin-bottom:14px">Your scent profile will build automatically as you use ScentWise. The AI learns your preferences from your conversations and recommends accordingly.</p>
      <button class="btn-o btn-sm" onclick="openScentQuiz()" style="width:100%;text-align:center;font-size:12px">Take Scent Profile Quiz</button>
    </div>`;
  }
  const p = scentProfile;
  let tags = '';
  if (p.likedNotes && p.likedNotes.length) tags += `<div style="margin-bottom:10px"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Favorite Notes</span><div style="display:flex;flex-wrap:wrap;gap:6px">${p.likedNotes.map(n => `<span class="tag" style="font-size:11px">${esc(n)}</span>`).join('')}</div></div>`;
  if (p.dislikedNotes && p.dislikedNotes.length) tags += `<div style="margin-bottom:10px"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Dislikes</span><div style="display:flex;flex-wrap:wrap;gap:6px">${p.dislikedNotes.map(n => `<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(220,80,80,.12);color:#e88;border:1px solid rgba(220,80,80,.15)">${esc(n)}</span>`).join('')}</div></div>`;
  if (p.likedBrands && p.likedBrands.length) tags += `<div style="margin-bottom:10px"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Preferred Brands</span><div style="display:flex;flex-wrap:wrap;gap:6px">${p.likedBrands.map(b => `<span class="tag" style="font-size:11px">${esc(b)}</span>`).join('')}</div></div>`;
  if (p.preferredCategories && p.preferredCategories.length) tags += `<div style="margin-bottom:10px"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Categories</span><div style="display:flex;flex-wrap:wrap;gap:6px">${p.preferredCategories.map(c => `<span class="tag" style="font-size:11px">${esc(c)}</span>`).join('')}</div></div>`;
  let meta = '';
  if (p.genderPref) meta += `<span style="color:var(--td);font-size:12px">Gender: <strong style="color:var(--t)">${esc(p.genderPref)}</strong></span> `;
  if (p.priceRange) meta += `<span style="color:var(--td);font-size:12px">Budget: <strong style="color:var(--t)">${esc(p.priceRange)}</strong></span> `;
  if (p.intensityPref) meta += `<span style="color:var(--td);font-size:12px">Intensity: <strong style="color:var(--t)">${esc(p.intensityPref)}</strong></span> `;
  if (p.occasions && p.occasions.length) meta += `<span style="color:var(--td);font-size:12px">Occasions: <strong style="color:var(--t)">${p.occasions.map(esc).join(', ')}</strong></span>`;

  // Skin chemistry & wearability section
  let skinSection = '';
  if (p.skinChemistry || (p.wearContext && p.wearContext.length)) {
    let skinTags = '';
    if (p.skinChemistry) {
      const sc = p.skinChemistry;
      const skinLabels = [];
      if (sc.tendency) skinLabels.push({ label: sc.tendency.replace(/-/g, ' '), color: 'var(--g)' });
      if (sc.climate) skinLabels.push({ label: sc.climate.replace(/-/g, ' '), color: 'var(--t)' });
      if (sc.longevityOnSkin) skinLabels.push({ label: sc.longevityOnSkin.replace(/-/g, ' '), color: 'var(--t)' });
      if (skinLabels.length) {
        skinTags += `<div style="margin-bottom:10px"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Skin Chemistry</span><div style="display:flex;flex-wrap:wrap;gap:6px">${skinLabels.map(s => `<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(201,169,110,.08);color:${s.color};border:1px solid rgba(201,169,110,.12)">${esc(s.label)}</span>`).join('')}</div></div>`;
      }
    }
    if (p.wearContext && p.wearContext.length) {
      skinTags += `<div style="margin-bottom:10px"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Wear Context</span><div style="display:flex;flex-wrap:wrap;gap:6px">${p.wearContext.map(w => `<span class="tag" style="font-size:11px">${esc(w.replace(/-/g, ' '))}</span>`).join('')}</div></div>`;
    }
    skinSection = `<div style="padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">${skinTags}</div>`;
  }

  return `<div class="glass-panel" style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;margin:0">Scent Profile</p>
      <span style="color:var(--td);font-size:11px">${p.queryCount} interaction${p.queryCount !== 1 ? 's' : ''} learned</span>
    </div>
    ${tags}
    ${meta ? `<div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">${meta}</div>` : ''}
    ${skinSection}
    ${p.recentRecs && p.recentRecs.length ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)"><span style="color:var(--td);font-size:11px;display:block;margin-bottom:6px">Recently Recommended</span><p style="color:var(--t);font-size:12px;line-height:1.6;margin:0">${p.recentRecs.slice(0, 8).map(esc).join(' &middot; ')}</p></div>` : ''}
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-o btn-sm" onclick="openScentQuiz()" style="flex:1;text-align:center;font-size:12px">${p.skinChemistry ? 'Update Quiz' : 'Take Quiz'}</button>
      <button class="btn-o btn-sm" onclick="resetScentProfile()" style="flex:1;text-align:center;font-size:12px">Reset Profile</button>
    </div>
  </div>`;
}

// ═══════════════ SCENT PROFILE QUIZ ═══════════════
function openScentQuiz() {
  // Pre-fill from existing profile if available
  const sc = scentProfile?.skinChemistry || {};
  const wc = scentProfile?.wearContext || [];
  const ip = scentProfile?.intensityPref || '';

  const overlay = document.createElement('div');
  overlay.id = 'scent-quiz-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
  overlay.innerHTML = `<div style="background:var(--d2);border:1px solid rgba(201,169,110,.12);border-radius:20px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3 style="color:var(--g);font-size:16px;font-weight:600;margin:0">Scent Profile Quiz</h3>
      <button onclick="closeScentQuiz()" style="background:none;border:none;color:var(--td);font-size:20px;cursor:pointer;padding:4px">&times;</button>
    </div>
    <p style="color:var(--td);font-size:13px;line-height:1.6;margin-bottom:20px">Help the AI understand your skin and style. This takes 30 seconds and makes recommendations much more accurate.</p>

    <div style="margin-bottom:18px">
      <p style="color:var(--t);font-size:13px;font-weight:500;margin-bottom:8px">How do perfumes usually change on your skin?</p>
      <div id="sq-tendency" style="display:flex;flex-wrap:wrap;gap:6px">
        ${['sweeter','sharper','powdery','stay-true','disappear-quickly'].map(v => `<button class="sq-pill${sc.tendency === v ? ' sq-sel' : ''}" data-val="${v}" onclick="sqSelect('sq-tendency','${v}',false)" style="font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,169,110,.15);background:${sc.tendency === v ? 'rgba(201,169,110,.15)' : 'transparent'};color:${sc.tendency === v ? 'var(--g)' : 'var(--td)'};cursor:pointer">${v.replace(/-/g, ' ')}</button>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:18px">
      <p style="color:var(--t);font-size:13px;font-weight:500;margin-bottom:8px">What's your typical climate?</p>
      <div id="sq-climate" style="display:flex;flex-wrap:wrap;gap:6px">
        ${['hot-humid','hot-dry','temperate','cold'].map(v => `<button class="sq-pill${sc.climate === v ? ' sq-sel' : ''}" data-val="${v}" onclick="sqSelect('sq-climate','${v}',false)" style="font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,169,110,.15);background:${sc.climate === v ? 'rgba(201,169,110,.15)' : 'transparent'};color:${sc.climate === v ? 'var(--g)' : 'var(--td)'};cursor:pointer">${v.replace(/-/g, ' ')}</button>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:18px">
      <p style="color:var(--t);font-size:13px;font-weight:500;margin-bottom:8px">How long do perfumes typically last on you?</p>
      <div id="sq-longevity" style="display:flex;flex-wrap:wrap;gap:6px">
        ${['2-4-hours','4-8-hours','8-plus-hours','varies'].map(v => `<button class="sq-pill${sc.longevityOnSkin === v ? ' sq-sel' : ''}" data-val="${v}" onclick="sqSelect('sq-longevity','${v}',false)" style="font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,169,110,.15);background:${sc.longevityOnSkin === v ? 'rgba(201,169,110,.15)' : 'transparent'};color:${sc.longevityOnSkin === v ? 'var(--g)' : 'var(--td)'};cursor:pointer">${v.replace(/-/g, ' ').replace('plus', '+')}</button>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:18px">
      <p style="color:var(--t);font-size:13px;font-weight:500;margin-bottom:8px">What do you want from your fragrance? <span style="color:var(--td);font-weight:400">(pick all that apply)</span></p>
      <div id="sq-wear" style="display:flex;flex-wrap:wrap;gap:6px">
        ${['compliment-getter','office-safe','date-night','signature-scent','everyday-casual'].map(v => `<button class="sq-pill${wc.includes(v) ? ' sq-sel' : ''}" data-val="${v}" onclick="sqSelect('sq-wear','${v}',true)" style="font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,169,110,.15);background:${wc.includes(v) ? 'rgba(201,169,110,.15)' : 'transparent'};color:${wc.includes(v) ? 'var(--g)' : 'var(--td)'};cursor:pointer">${v.replace(/-/g, ' ')}</button>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:22px">
      <p style="color:var(--t);font-size:13px;font-weight:500;margin-bottom:8px">How strong do you want your scent?</p>
      <div id="sq-intensity" style="display:flex;flex-wrap:wrap;gap:6px">
        ${[{v:'soft',l:'Intimate (close to skin)'},{v:'moderate',l:'Moderate'},{v:'strong',l:'Room-filler'}].map(o => `<button class="sq-pill${ip === o.v ? ' sq-sel' : ''}" data-val="${o.v}" onclick="sqSelect('sq-intensity','${o.v}',false)" style="font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,169,110,.15);background:${ip === o.v ? 'rgba(201,169,110,.15)' : 'transparent'};color:${ip === o.v ? 'var(--g)' : 'var(--td)'};cursor:pointer">${o.l}</button>`).join('')}
      </div>
    </div>

    <button class="btn" onclick="submitScentQuiz()" style="width:100%;font-size:14px">Save Profile</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeScentQuiz(); });
}

function sqSelect(groupId, val, multi) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const btns = group.querySelectorAll('.sq-pill');
  if (multi) {
    // Toggle the clicked button
    btns.forEach(b => {
      if (b.dataset.val === val) {
        const selected = b.classList.toggle('sq-sel');
        b.style.background = selected ? 'rgba(201,169,110,.15)' : 'transparent';
        b.style.color = selected ? 'var(--g)' : 'var(--td)';
      }
    });
  } else {
    // Single select — deselect others
    btns.forEach(b => {
      const isSel = b.dataset.val === val;
      b.classList.toggle('sq-sel', isSel);
      b.style.background = isSel ? 'rgba(201,169,110,.15)' : 'transparent';
      b.style.color = isSel ? 'var(--g)' : 'var(--td)';
    });
  }
}

function getQuizSelection(groupId, multi) {
  const group = document.getElementById(groupId);
  if (!group) return multi ? [] : null;
  const selected = group.querySelectorAll('.sq-sel');
  if (multi) return Array.from(selected).map(b => b.dataset.val);
  return selected.length ? selected[0].dataset.val : null;
}

async function submitScentQuiz() {
  const quiz = {
    tendency: getQuizSelection('sq-tendency', false),
    climate: getQuizSelection('sq-climate', false),
    longevityOnSkin: getQuizSelection('sq-longevity', false),
    wearContext: getQuizSelection('sq-wear', true),
    projectionPref: getQuizSelection('sq-intensity', false)
  };

  try {
    const r = await fetch('/api/check-tier?action=profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      body: JSON.stringify({ quiz })
    });
    if (r.ok) {
      const d = await r.json();
      if (d.profile) scentProfile = d.profile;
      showToast('Scent profile updated!', 'success');
      closeScentQuiz();
      // Re-render account page if visible
      const el = document.getElementById('page-account');
      if (el && CP === 'account') r_account(el);
    } else {
      showToast('Failed to save quiz.', 'error');
    }
  } catch {
    showToast('Failed to save quiz.', 'error');
  }
}

function closeScentQuiz() {
  const overlay = document.getElementById('scent-quiz-overlay');
  if (overlay) overlay.remove();
}

async function unlockPaid() {
  if (LEMON_URL) {
    window.location.href = LEMON_URL;
    return;
  }
  // Show loading state on all subscribe buttons
  const btns = document.querySelectorAll('[data-subscribe-btn]');
  btns.forEach(b => { b._prev = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="dot" style="margin-right:4px"></span><span class="dot" style="animation-delay:.2s;margin-right:4px"></span><span class="dot" style="animation-delay:.4s"></span>'; });
  try {
    const r = await fetch('/api/create-checkout', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } });
    const d = await r.json();
    if (d.url) {
      LEMON_URL = d.url;
      if (typeof gtag === 'function') gtag('event', 'begin_checkout', { currency: 'USD', value: 2.99, items: [{ item_name: 'ScentWise Premium', price: 2.99 }] });
      window.location.href = d.url;
    } else {
      showToast(d.error || 'Could not start checkout. Please try again.', 'error');
      btns.forEach(b => { b.disabled = false; b.innerHTML = b._prev || 'Subscribe Now'; });
    }
  } catch {
    showToast('Could not start checkout. Please try again.', 'error');
    btns.forEach(b => { b.disabled = false; b.innerHTML = b._prev || 'Subscribe Now'; });
  }
}

async function loginOwner(key) {
  try {
    const r = await fetch('/api/owner-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ key })
    });
    const d = await r.json();
    if (d.success) { isOwner = true; isPaid = true; currentTier = 'owner'; return true; }
  } catch {}
  return false;
}

async function logoutOwner() {
  try {
    await fetch('/api/owner-auth', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } });
  } catch {}
  isOwner = false; isPaid = false; currentTier = 'free'; go(CP);
}

async function activateSubscription(orderId, silent) {
  try {
    const r = await fetch('/api/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ orderId })
    });
    const d = await r.json();
    if (d.success) { isPaid = true; currentTier = d.tier || 'premium'; if (d.email) userEmail = d.email; go(CP); return true; }
    if (!silent) {
      if (r.status === 429) {
        showToast('Too many attempts. Please wait a minute and try again.', 'error');
      } else {
        showToast(d.error || 'Could not verify your order. Double-check the order number from your LemonSqueezy confirmation email, or try logging in with your email instead.', 'error', 6000);
      }
    }
  } catch (err) {
    console.error('Subscription activation error:', err);
    if (!silent) showToast('Network error — please check your connection and try again.', 'error');
  }
  return false;
}

function showPaywall() {
  trackFunnel('paywall_shown', { trial_remaining: FREE_LIMIT - freeUsed, tier: currentTier || 'free' });
  const trialLeft = FREE_LIMIT - freeUsed;
  const trialBanner = trialLeft > 0
    ? `<div style="color:var(--g);font-size:13px;margin-bottom:20px;padding:12px 18px;background:var(--gl);border:1px solid rgba(201,169,110,.1);border-radius:var(--r-sm);display:flex;align-items:center;gap:8px;justify-content:center"><span style="font-size:16px">✦</span> You have <strong>${trialLeft} free quer${trialLeft === 1 ? 'y' : 'ies'}</strong> remaining</div>`
    : `<div style="color:var(--td);font-size:13px;margin-bottom:20px;padding:12px 18px;background:rgba(255,255,255,.02);border:1px solid var(--d4);border-radius:var(--r-sm)">You've used all ${FREE_LIMIT} free queries. Subscribe for unlimited access!</div>`;
  return `<div class="paywall fi">
    <div style="font-size:48px;margin-bottom:20px;position:relative">✦</div>
    <h3 class="fd" style="font-size:28px">Unlock <span class="gg">ScentWise AI</span></h3>
    <p style="color:var(--td);margin:14px 0 24px;line-height:1.7;font-size:14px;position:relative">
      AI-powered fragrance recommendations — chat advisor, style scanning, zodiac matching, music matching & more.
    </p>
    ${trialBanner}
    <div style="font-size:36px;font-weight:700;margin-bottom:6px;position:relative"><span class="gg">$2.99</span><span style="font-size:16px;color:var(--td);font-weight:400">/month</span></div>
    <p style="color:var(--td);font-size:12px;margin-bottom:28px;position:relative">500 AI queries/month · Cancel anytime</p>
    <a href="#" onclick="unlockPaid(); return false;" class="btn" data-subscribe-btn style="display:inline-block;text-decoration:none;cursor:pointer;padding:16px 40px;font-size:16px;position:relative">Subscribe Now</a>
    <p style="margin-top:20px;font-size:12px;color:var(--td);position:relative">Already subscribed? <a onclick="go('account')" style="color:var(--g);cursor:pointer;text-decoration:underline;font-weight:500">Log in here</a></p>
  </div>`;
}

function promptActivate() {
  const raw = prompt('Enter your LemonSqueezy order ID to activate your subscription:');
  if (raw && raw.trim()) {
    const orderId = raw.trim().replace(/^#/, '').replace(/[^\d]/g, '');
    if (orderId) activateSubscription(orderId);
    else showToast('Please enter a valid numeric order ID (e.g. 2944561).', 'error');
  }
}

// ═══════════════ EMAIL LOGIN ═══════════════
async function loginWithEmail(email) {
  if (!email || !email.trim()) return false;
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email.trim() })
    });
    const d = await r.json();
    if (d.success) { isPaid = true; currentTier = d.tier || 'premium'; userEmail = d.email || email.trim(); go(CP); return true; }
    if (r.status === 404) {
      showToast('No subscription found for this email. Make sure you\'re using the same email from your LemonSqueezy purchase.', 'error', 6000);
    } else if (r.status === 429) {
      showToast('Too many login attempts. Please wait a minute and try again.', 'error');
    } else {
      showToast(d.error || 'Could not verify your subscription. Please try again or use your order ID.', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Network error — please check your connection and try again.', 'error');
  }
  return false;
}

function doEmailLogin() {
  const inp = document.getElementById('login-email');
  if (!inp || !inp.value.trim()) return;
  const btn = document.getElementById('login-btn');
  const wrap = document.getElementById('login-status');
  const bar = document.getElementById('login-progress');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="dot" style="margin-right:6px"></span><span class="dot" style="animation-delay:.2s;margin-right:6px"></span><span class="dot" style="animation-delay:.4s"></span>'; }
  if (wrap) { wrap.style.display = 'block'; }
  if (bar) { bar.style.display = 'block'; }
  if (inp) { inp.disabled = true; }
  loginWithEmail(inp.value).finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Log In'; } if (wrap) { wrap.style.display = 'none'; } if (bar) { bar.style.display = 'none'; } if (inp) { inp.disabled = false; } });
}

function doLogout() {
  fetch('/api/owner-auth', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Requested-With': 'ScentWise' } }).catch(() => {});
  isOwner = false; isPaid = false; currentTier = 'free'; userEmail = ''; go('home');
}

// ═══════════════ LEMONSQUEEZY CHECKOUT EVENTS ═══════════════
function setupLemonSqueezy() {
  if (typeof window.createLemonSqueezy === 'function') window.createLemonSqueezy();
  if (window.LemonSqueezy) {
    window.LemonSqueezy.Setup({
      eventHandler: async function(event) {
        if (event.event === 'Checkout.Success') {
          if (typeof gtag === 'function') gtag('event', 'purchase', { currency: 'USD', value: 2.99, transaction_id: event.data?.order?.data?.id || event.data?.order?.id || event.data?.id || '', items: [{ item_name: 'ScentWise Premium', price: 2.99 }] });
          const orderId = event.data?.order?.data?.id || event.data?.order?.id || event.data?.id;
          if (orderId) {
            let ok = await activateSubscription(String(orderId), true);
            if (!ok) {
              for (let i = 0; i < 3 && !ok; i++) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
                ok = await activateSubscription(String(orderId), true);
              }
            }
            if (!ok) { await checkTier(); go(CP); }
          } else {
            // Fallback: re-check tier (webhook may have processed)
            await checkTier();
            if (isPaid) go(CP);
          }
        }
      }
    });
  }
}
setupLemonSqueezy();

// ═══════════════ AI CALLS ═══════════════
async function aiCall(mode, payload) {
  if (!canUseAI()) {
    if (!isPaid && freeUsed >= FREE_LIMIT) return 'You\'ve used all 3 free queries. Subscribe to ScentWise Premium for unlimited AI recommendations!';
    return 'Please subscribe to use AI features.';
  }
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise'},
      credentials: 'same-origin',
      body: JSON.stringify({mode, ...payload})
    });
    if (r.status === 403) {
      const d = await r.json().catch(()=>({}));
      if (d.freeUsed !== undefined) { trackFreeUsage(d.freeUsed); go(CP); return 'You\'ve used all 3 free queries. Subscribe to ScentWise Premium for unlimited AI recommendations!'; }
      isPaid = false; currentTier = 'free'; go(CP); return 'Your session has expired. Please reactivate your subscription.';
    }
    if (r.status === 429) { const d = await r.json().catch(()=>({})); if (d.usage) trackUsage(d.usage); return d.error || 'Our AI is a bit busy right now. Please try again in a few seconds.'; }
    if (!r.ok) throw new Error(r.status >= 500 ? 'ai_unavailable' : 'request_failed');
    const d = await r.json();
    if (typeof d.freeUsed === 'number') trackFreeUsage(d.freeUsed);
    else if (typeof d.usage === 'number') trackUsage(d.usage);
    else if (isPaid) trackUsage();
    if (d.profileActive) scentProfile = scentProfile || { queryCount: d.profileQueryCount };
    if (typeof gtag === 'function') gtag('event', 'ai_recommendation', { mode: mode, tier: currentTier || 'free' });
    return d.result || 'No response. Try again.';
  } catch (e) {
    if (e.message === 'ai_unavailable') return '**Oops!** Our AI is temporarily unavailable. Please try again in a moment.';
    if (e.message === 'request_failed') return '**Something went wrong.** Please try again.';
    if (e.message === 'Failed to fetch' || e.message.includes('network')) return '**Connection issue.** Check your internet and try again.';
    return '**Something went wrong.** Please try again in a moment.';
  }
}

// ═══════════════ IMAGE HELPER (Bing + Unsplash) ═══════════════
const _imgCache = {};
async function fetchImg(query, n, name, brand) {
  n = n || 1;
  const ck = name ? 'img_' + name + '_' + (brand || '') : 'img_' + query + '_' + n;
  if (_imgCache[ck]) return _imgCache[ck];
  try { const cached = sessionStorage.getItem(ck); if (cached) { _imgCache[ck] = JSON.parse(cached); return _imgCache[ck]; } } catch {}
  try {
    const url = name
      ? '/api/img?name=' + encodeURIComponent(name) + '&brand=' + encodeURIComponent(brand || '')
      : '/api/img?q=' + encodeURIComponent(query) + '&n=' + n;
    const r = await fetch(url, { headers: { 'X-Requested-With': 'ScentWise' } });
    if (!r.ok) return [];
    const imgs = await r.json();
    _imgCache[ck] = imgs;
    try { sessionStorage.setItem(ck, JSON.stringify(imgs)); } catch {}
    return imgs;
  } catch { return []; }
}


function loadResultImages(container) {
  if (!container) return;
  const frags = container.querySelectorAll('strong[data-frag]');
  frags.forEach(el => {
    const name = el.getAttribute('data-frag');
    if (!name || name.length > 60 || el.dataset.imgLoaded) return;
    el.dataset.imgLoaded = '1';
    // Build a smarter query: look up the fragrance in the database for brand/category
    let query = name + ' fragrance';
    const key = name.toLowerCase().trim();
    const match = typeof _SI !== 'undefined' && _SI.find(p => (p.name || p.n || '').toLowerCase() === key);
    if (match) {
      const brand = match.brand || match.b || '';
      const cat = match.category || match.c || '';
      if (brand) query = name + ' ' + brand + ' fragrance';
      else if (cat && CAT_IMG_QUERIES[cat]) query = CAT_IMG_QUERIES[cat];
    }
    const brand = match ? (match.brand || match.b || '') : '';
    fetchImg(query, 1, name, brand).then(imgs => {
      if (imgs[0]) {
        const img = document.createElement('img');
        img.className = 'result-img';
        img.src = imgs[0].thumb;
        img.alt = name;
        img.loading = 'lazy';
        img.onload = function() { this.classList.add('loaded'); };
        img.onerror = function() { this.remove(); };
        el.parentElement.insertBefore(img, el.nextSibling);
      }
    });
  });
}

// ═══════════════ HELPERS ═══════════════
const AMAZON_TAG = 'scentwise20-20';
function amazonLink(name, brand) {
  const q = encodeURIComponent((name || '') + ' ' + (brand || '') + ' perfume');
  return 'https://www.amazon.com/s?k=' + q + '&tag=' + AMAZON_TAG;
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmt(text) {
  let s = esc(text)
    .replace(/\*\*(.+?)\*\*/g, function(_, name) {
      if (name.startsWith('Oops') || name.startsWith('Something') || name.startsWith('Connection')) {
        return `<strong style="color:var(--g)" data-frag="${name}">${name}</strong>`;
      }
      const key = name.toLowerCase();
      const isLiked = _likedFrags.has(key + '_up');
      const heartColor = isLiked ? '#f56565' : 'rgba(201,169,110,.4)';
      const heartChar = isLiked ? '&#9829;' : '&#9825;';
      const heartTitle = isLiked ? 'Click to unlike' : 'Love this fragrance';
      const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const byMatch = name.match(/^(.+?)\s+by\s+(.+)$/i);
      const fragName = byMatch ? byMatch[1] : name;
      const fragBrand = byMatch ? byMatch[2] : '';
      const amzUrl = amazonLink(fragName, fragBrand);
      return `<strong style="color:var(--g)" data-frag="${name}">${name}</strong><span class="frag-actions" style="display:inline-flex;gap:2px;margin-left:4px;vertical-align:middle"><button onclick="likeFragrance('${safeName}',true,this)" title="${heartTitle}" style="background:none;border:none;cursor:pointer;font-size:14px;color:${heartColor};padding:0 2px;line-height:1;transition:color .2s;opacity:${isLiked ? '1' : '.6'}" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='${isLiked ? '1' : '.6'}'">${heartChar}</button>${!isLiked ? `<button onclick="likeFragrance('${safeName}',false,this.previousElementSibling);this.style.display='none'" title="Not for me" style="background:none;border:none;cursor:pointer;font-size:12px;color:rgba(255,255,255,.25);padding:0 2px;line-height:1;opacity:.5;transition:opacity .2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.5'">&#10005;</button>` : ''}<a href="${amzUrl}" target="_blank" rel="noopener noreferrer" title="Shop on Amazon" style="display:inline-flex;align-items:center;font-size:11px;color:#f90;padding:0 4px;text-decoration:none;opacity:.7;transition:opacity .2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.7'">&#128722; Amazon</a></span>`;
    })
    .replace(/\n/g, '<br>');

  // Render blind buy risk badges
  s = s.replace(/(?:BLIND BUY RISK|Blind Buy Risk|Risk)[:\s]*(?:<br>)?[\s]*(Low[- ]risk blind buy)/gi,
    '<span style="display:inline-block;margin:4px 0;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(72,187,120,.12);color:#48bb78;border:1px solid rgba(72,187,120,.18)">$1</span>');
  s = s.replace(/(?:BLIND BUY RISK|Blind Buy Risk|Risk)[:\s]*(?:<br>)?[\s]*((?:Medium risk|Only buy if)[^<]{0,80})/gi,
    '<span style="display:inline-block;margin:4px 0;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(236,201,75,.12);color:#ecc94b;border:1px solid rgba(236,201,75,.18)">$1</span>');
  s = s.replace(/(?:BLIND BUY RISK|Blind Buy Risk|Risk)[:\s]*(?:<br>)?[\s]*(Test first[^<]{0,60})/gi,
    '<span style="display:inline-block;margin:4px 0;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(245,101,101,.12);color:#f56565;border:1px solid rgba(245,101,101,.18)">$1</span>');

  // Render score lines as visual badges
  s = s.replace(/(?:SCORES|Scores)?[:\s]*(?:<br>)?[\s]*(?:Longevity[:\s]*(\d)\/5\s*\|?\s*Projection[:\s]*(\d)\/5\s*\|?\s*Uniqueness[:\s]*(\d)\/5\s*\|?\s*Versatility[:\s]*(\d)\/5)/gi,
    function(_, lon, proj, uniq, vers) {
      const badge = (label, score) => {
        const pct = (parseInt(score) / 5) * 100;
        const color = parseInt(score) >= 4 ? '#48bb78' : parseInt(score) >= 3 ? '#ecc94b' : '#f56565';
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);margin:2px">
          <span style="color:var(--td)">${label}</span>
          <span style="display:inline-block;width:32px;height:4px;border-radius:2px;background:rgba(255,255,255,.08);position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${color};border-radius:2px"></span></span>
          <span style="color:${color};font-weight:600">${score}</span>
        </span>`;
      };
      return `<div style="display:flex;flex-wrap:wrap;gap:2px;margin:6px 0">${badge('Longevity',lon)}${badge('Projection',proj)}${badge('Uniqueness',uniq)}${badge('Versatility',vers)}</div>`;
    });

  // Style "WHY IT MATCHES YOU" / "MATCHES YOUR PROFILE" sections
  s = s.replace(/(?:WHY IT MATCHES YOU|WHY THIS MATCHES|MATCHES YOUR PROFILE|Why it matches you)[:\s]*(?:<br>)?[\s]*([^<]{10,200}?)(?=<br><br>|<br>(?:BLIND|SIMILAR|SCORES|Blind|Similar|Scores|\d\.))/gi,
    '<div style="margin:4px 0;padding:6px 10px;border-left:2px solid rgba(201,169,110,.3);background:rgba(201,169,110,.04);border-radius:0 8px 8px 0;font-size:12px;color:var(--t);line-height:1.5">$1</div>');

  // Style "SIMILAR TO" comparisons
  s = s.replace(/(?:SIMILAR TO|Similar to|Comparable to)[:\s]*(?:<br>)?[\s]*([^<]{10,150}?)(?=<br>|$)/gi,
    '<span style="display:inline-block;margin:2px 0;font-size:12px;color:var(--td);font-style:italic">$1</span>');

  // Add retry button to error messages
  if (text.startsWith('**Oops!**') || text.startsWith('**Something went wrong') || text.startsWith('**Connection issue')) {
    s += '<br><button onclick="retryLast()" class="btn-o btn-sm" style="margin-top:10px">Try Again</button>';
  }
  return s;
}

const CAT_IMG_QUERIES = {
  'Fresh':'fresh citrus perfume light','Floral':'floral rose perfume elegant','Oriental':'oriental amber perfume luxury',
  'Woody':'woody dark perfume oud','Sweet':'sweet vanilla perfume warm','Aromatic':'aromatic herbs perfume green',
  'Aquatic':'aquatic ocean perfume blue','Fruity':'fruity colorful perfume bright','Musky':'musky sensual perfume dark',
  'Warm Spicy':'spicy cinnamon perfume warm'
};

const _PC_PALETTE = ['#1e2d40','#2d1e40','#1e402d','#402d1e','#401e2d','#2d401e','#1e3840','#38201e'];
function _pcBg(n) { return _PC_PALETTE[(n||' ').charCodeAt(0) % _PC_PALETTE.length]; }

function perfCard(p) {
  if (!p) return '';
  const cat = esc(p.category||p.c||'');
  const name = esc(p.name||p.n);
  const brand = esc(p.brand||p.b||'');
  const letter = (p.name||p.n||'?').charAt(0).toUpperCase();
  const bg = _pcBg(p.name||p.n||'');
  const safeName = name.replace(/'/g, "\\'");
  const key = name.toLowerCase();
  const isLiked = _likedFrags.has(key + '_up');
  const heartColor = isLiked ? '#f56565' : 'rgba(201,169,110,.35)';
  const heartChar = isLiked ? '&#9829;' : '&#9825;';
  return `<div class="pcard" data-cat="${cat}" data-name="${name}" data-brand="${brand}">
    <div style="display:flex;gap:14px">
      <div class="pc-thumb" style="background:${bg}"><span class="pc-letter">${letter}</span></div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:600;font-size:14px">${name}</span>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
            <span style="color:var(--td);font-size:12px">${esc(p.brand||p.b)}</span>
            <button onclick="event.stopPropagation();likeFragranceCard('${safeName}','${brand.replace(/'/g, "\\'")}',this)" title="${isLiked ? 'Click to unlike' : 'Love this fragrance'}" style="background:none;border:none;cursor:pointer;font-size:16px;color:${heartColor};padding:2px;line-height:1;transition:color .2s,transform .2s" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">${heartChar}</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${cat ? `<span class="tag" style="font-size:10px;padding:3px 10px">${cat}</span>` : ''}
          ${p.gender||p.g ? `<span class="tag" style="font-size:10px;padding:3px 10px;background:rgba(133,193,233,.06);color:#85c1e9;border-color:rgba(133,193,233,.1)">${esc(p.gender||p.g)}</span>` : ''}
          ${p.rating||p.r ? `<span class="tag" style="font-size:10px;padding:3px 10px;background:rgba(232,168,124,.06);color:#e8a87c;border-color:rgba(232,168,124,.1)">★ ${p.rating||p.r}</span>` : ''}
        </div>
        ${p.notes||p.t ? `<p class="note">Notes: ${esc(p.notes||p.t)}</p>` : ''}
        ${p.accords||p.a ? `<p class="note">Accords: ${esc(p.accords||p.a)}</p>` : ''}
        <a href="${amazonLink(p.name||p.n, p.brand||p.b)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:8px;font-size:11px;font-weight:600;color:#f90;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.15);text-decoration:none;transition:all .2s" onmouseover="this.style.background='rgba(255,153,0,.15)'" onmouseout="this.style.background='rgba(255,153,0,.08)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Shop on Amazon</a>
      </div>
    </div>
  </div>`;
}

function loadExploreImages() {
  document.querySelectorAll('.pcard[data-cat]:not([data-img-loaded])').forEach(el => {
    el.dataset.imgLoaded = '1';
    const name = el.dataset.name || '';
    const brand = el.dataset.brand || '';
    const cat = el.dataset.cat;
    // Use name + brand for specific results; fall back to category-based query
    const q = (name && brand) ? name + ' ' + brand + ' perfume' : (CAT_IMG_QUERIES[cat] || 'perfume bottle luxury');
    fetchImg(q, 1, name, brand).then(imgs => {
      if (imgs[0]) {
        const thumb = el.querySelector('.pc-thumb');
        if (thumb) {
          const img = document.createElement('img');
          img.src = imgs[0].thumb;
          img.alt = el.dataset.name || '';
          img.className = 'pc-thumb-img';
          img.loading = 'lazy';
          img.onload = function() { this.classList.add('loaded'); };
          img.onerror = function() { this.remove(); };
          thumb.appendChild(img);
        }
      }
    });
  });
}


// ═══════════════ 101 CELEBRITIES ═══════════════
const CELEBS = [
  {name:"Rihanna",img:"🎤",frags:["Love, Don't Be Shy|Kilian","Oud Silk Mood|Maison Francis Kurkdjian","Tobacco Vanille|Tom Ford"]},
  {name:"David Beckham",img:"⚽",frags:["Dior Homme Intense|Dior","Silver Mountain Water|Creed","Bleu de Chanel|Chanel"]},
  {name:"Zendaya",img:"🎬",frags:["Idôle|Lancôme","Black Opium|YSL","Flowerbomb|Viktor&Rolf"]},
  {name:"Johnny Depp",img:"🏴‍☠️",frags:["Sauvage|Dior","Sauvage Elixir|Dior"]},
  {name:"Ariana Grande",img:"🎀",frags:["Cloud|Ariana Grande","R.E.M.|Ariana Grande","God Is A Woman|Ariana Grande"]},
  {name:"Brad Pitt",img:"🎞️",frags:["Chanel No. 5|Chanel","Le Labo Santal 33|Le Labo"]},
  {name:"Beyoncé",img:"👑",frags:["Love, Don't Be Shy|Kilian","Soleil Blanc|Tom Ford","Coco Mademoiselle|Chanel"]},
  {name:"Harry Styles",img:"🎸",frags:["Bleu de Chanel|Chanel","Tobacco Vanille|Tom Ford","Mémoire d'une Odeur|Gucci"]},
  {name:"Jennifer Aniston",img:"🌟",frags:["Chanel No. 5|Chanel","Neroli Portofino|Tom Ford"]},
  {name:"Travis Scott",img:"🔥",frags:["Sauvage|Dior","Aventus|Creed","Oud Wood|Tom Ford"]},
  {name:"Billie Eilish",img:"💚",frags:["Eilish|Billie Eilish","Glossier You|Glossier","Another 13|Le Labo"]},
  {name:"Ryan Reynolds",img:"🎭",frags:["Armani Code|Giorgio Armani","Bleu de Chanel|Chanel"]},
  {name:"Dua Lipa",img:"🦋",frags:["Libre|YSL","Crystal Noir|Versace","Alien|Mugler"]},
  {name:"The Weeknd",img:"🌙",frags:["Tuscan Leather|Tom Ford","Fahrenheit|Dior","Angels' Share|Kilian"]},
  {name:"Taylor Swift",img:"🎵",frags:["Flowerbomb|Viktor&Rolf","Santal Blush|Tom Ford","Santal 33|Le Labo"]},
  {name:"Drake",img:"🦉",frags:["Aventus|Creed","Tobacco Vanille|Tom Ford","Baccarat Rouge 540|Maison Francis Kurkdjian"]},
  {name:"Margot Robbie",img:"💎",frags:["Gabrielle|Chanel","Mon Guerlain|Guerlain"]},
  {name:"LeBron James",img:"🏀",frags:["Aventus|Creed","Oud Wood|Tom Ford"]},
  {name:"Gigi Hadid",img:"🌸",frags:["Bal d'Afrique|Byredo","Daisy|Marc Jacobs","Soleil Blanc|Tom Ford"]},
  {name:"Cristiano Ronaldo",img:"⚽",frags:["CR7|Cristiano Ronaldo","Acqua di Gio|Giorgio Armani","Invictus|Paco Rabanne"]},
  {name:"Kendall Jenner",img:"🦄",frags:["Santal 33|Le Labo","Gypsy Water|Byredo"]},
  {name:"Jay-Z",img:"💰",frags:["Tom Ford Noir|Tom Ford","Green Irish Tweed|Creed","Scent of Peace|Bond No. 9"]},
  {name:"Hailey Bieber",img:"☀️",frags:["Mixed Emotions|Byredo","Dedcool 01|Dedcool","Lust in Paradise|Ex Nihilo"]},
  {name:"Justin Bieber",img:"🎤",frags:["Aventus|Creed","Sauvage|Dior","Grey Vetiver|Tom Ford"]},
  {name:"Selena Gomez",img:"💜",frags:["Daisy|Marc Jacobs","Cloud|Ariana Grande"]},
  {name:"Kanye West",img:"🐻",frags:["Aventus|Creed","Santal 33|Le Labo","Jazz Club|Maison Margiela"]},
  {name:"Timothée Chalamet",img:"🎬",frags:["Bleu de Chanel|Chanel","Thé Noir 29|Le Labo"]},
  {name:"Scarlett Johansson",img:"🖤",frags:["The One|Dolce & Gabbana","Black Orchid|Tom Ford"]},
  {name:"Post Malone",img:"🍺",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Tobacco Vanille|Tom Ford"]},
  {name:"Emma Watson",img:"📖",frags:["Trésor Midnight Rose|Lancôme","Coco Mademoiselle|Chanel"]},
  {name:"Bad Bunny",img:"🐰",frags:["Sauvage|Dior","Le Male|Jean Paul Gaultier","1 Million|Paco Rabanne"]},
  {name:"Chris Hemsworth",img:"⚡",frags:["Man Wood Essence|Bvlgari","Boss Bottled|Hugo Boss"]},
  {name:"Lady Gaga",img:"🌈",frags:["Black Orchid|Tom Ford","Flowerbomb|Viktor&Rolf"]},
  {name:"ASAP Rocky",img:"🏁",frags:["Bal d'Afrique|Byredo","Tobacco Vanille|Tom Ford","Jazz Club|Maison Margiela"]},
  {name:"Jennie Kim",img:"🖤",frags:["Chanel No. 5 L'Eau|Chanel","Gypsy Water|Byredo","Coco Mademoiselle|Chanel"]},
  {name:"David Harbour",img:"🧊",frags:["Oud Wood|Tom Ford","Viking|Creed"]},
  {name:"Rosé",img:"🌹",frags:["Tiffany & Co EDP|Tiffany","Mon Paris|YSL"]},
  {name:"Jacob Elordi",img:"🔥",frags:["Bleu de Chanel|Chanel","Noir Extreme|Tom Ford"]},
  {name:"Sydney Sweeney",img:"🌊",frags:["My Way|Giorgio Armani","La Vie Est Belle|Lancôme"]},
  {name:"Michael B. Jordan",img:"🥊",frags:["Aventus|Creed","Coach for Men|Coach"]},
  {name:"Bella Hadid",img:"✨",frags:["Côte d'Azur|Oribe","Mojave Ghost|Byredo","Dedcool 01|Dedcool"]},
  {name:"Tom Holland",img:"🕷️",frags:["Bleu de Chanel|Chanel","Acqua di Gio|Giorgio Armani"]},
  {name:"Olivia Rodrigo",img:"💔",frags:["Glossier You|Glossier","Cloud|Ariana Grande"]},
  {name:"Idris Elba",img:"🎩",frags:["Oud Wood|Tom Ford","Aventus|Creed"]},
  {name:"Megan Fox",img:"🔥",frags:["Armani Privé|Giorgio Armani","Alien|Mugler","Black Orchid|Tom Ford"]},
  {name:"Jason Momoa",img:"🌊",frags:["Acqua di Gio Profumo|Giorgio Armani","Layton|Parfums de Marly"]},
  {name:"Cardi B",img:"💅",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Good Girl|Carolina Herrera"]},
  {name:"Chris Evans",img:"🛡️",frags:["Bleu de Chanel|Chanel","Aventus|Creed"]},
  {name:"Kim Kardashian",img:"💋",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Crystal Gardenia|KKW","Santal 33|Le Labo"]},
  {name:"Tom Cruise",img:"✈️",frags:["Green Irish Tweed|Creed","Black Afgano|Nasomatto"]},
  {name:"Natalie Portman",img:"🎬",frags:["Miss Dior|Dior","Chanel No. 5|Chanel"]},
  {name:"Leonardo DiCaprio",img:"🏆",frags:["Acqua di Gio|Giorgio Armani","Green Irish Tweed|Creed"]},
  {name:"Angelina Jolie",img:"🖤",frags:["Mon Guerlain|Guerlain","Shalimar|Guerlain"]},
  {name:"Will Smith",img:"🌟",frags:["Creed Aventus|Creed","Dior Homme|Dior"]},
  {name:"Charlize Theron",img:"💛",frags:["J'adore|Dior","Chanel No. 5|Chanel"]},
  {name:"Robert Downey Jr.",img:"🦾",frags:["Oud Wood|Tom Ford","Aventus|Creed"]},
  {name:"Jennifer Lopez",img:"💃",frags:["Glow|Jennifer Lopez","Promise|Jennifer Lopez","Still|Jennifer Lopez"]},
  {name:"Zayn Malik",img:"🎤",frags:["Versace Eros|Versace","Bleu de Chanel|Chanel"]},
  {name:"Kylie Jenner",img:"👄",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Santal 33|Le Labo","Delina|Parfums de Marly"]},
  {name:"Keanu Reeves",img:"🎯",frags:["Acqua di Gio|Giorgio Armani","Oud Wood|Tom Ford"]},
  {name:"Nicole Kidman",img:"🌺",frags:["Chanel No. 5|Chanel","J'adore|Dior"]},
  {name:"George Clooney",img:"🎩",frags:["Casamorati 1888|Xerjoff","Green Irish Tweed|Creed"]},
  {name:"Anne Hathaway",img:"🌟",frags:["Lancôme Idôle|Lancôme","Coco Mademoiselle|Chanel"]},
  {name:"Pedro Pascal",img:"🌵",frags:["Bleu de Chanel|Chanel","Terre d'Hermès|Hermès"]},
  {name:"Florence Pugh",img:"🌻",frags:["Glossier You|Glossier","Jo Malone Wood Sage|Jo Malone"]},
  {name:"Oscar Isaac",img:"🎭",frags:["Oud Wood|Tom Ford","Tuscan Leather|Tom Ford"]},
  {name:"Ana de Armas",img:"💎",frags:["J'adore|Dior","Estée Lauder Beautiful|Estée Lauder"]},
  {name:"Austin Butler",img:"🕺",frags:["Noir Extreme|Tom Ford","Sauvage Elixir|Dior"]},
  {name:"Anya Taylor-Joy",img:"♟️",frags:["Flowerbomb Nectar|Viktor&Rolf","Black Opium|YSL"]},
  {name:"Henry Cavill",img:"⚔️",frags:["Chanel Allure Homme Sport|Chanel","Aventus|Creed"]},
  {name:"Doja Cat",img:"🐱",frags:["Delina|Parfums de Marly","Baccarat Rouge 540|Maison Francis Kurkdjian"]},
  {name:"SZA",img:"🎵",frags:["Kayali Vanilla 28|Kayali","Another 13|Le Labo"]},
  {name:"Jenna Ortega",img:"🖤",frags:["Cloud|Ariana Grande","Glossier You|Glossier"]},
  {name:"Paul Mescal",img:"🎭",frags:["Santal 33|Le Labo","Terre d'Hermès|Hermès"]},
  {name:"Ice Spice",img:"🍊",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Cloud|Ariana Grande"]},
  {name:"Jungkook",img:"💜",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Libre|YSL","Bleu de Chanel|Chanel"]},
  {name:"Blackpink Lisa",img:"🌸",frags:["Celine Black Tie|Celine","Miss Dior|Dior"]},
  {name:"V (Taehyung)",img:"🐯",frags:["Blanche|Byredo","Bois d'Argent|Dior"]},
  {name:"Jimin",img:"🩰",frags:["Mojave Ghost|Byredo","Santal 33|Le Labo"]},
  {name:"Neymar",img:"⚽",frags:["1 Million|Paco Rabanne","Invictus|Paco Rabanne"]},
  {name:"Lewis Hamilton",img:"🏎️",frags:["Oud Wood|Tom Ford","Aventus|Creed"]},
  {name:"Mbappe",img:"⚽",frags:["Sauvage|Dior","Y EDP|YSL"]},
  {name:"Elon Musk",img:"🚀",frags:["Terre d'Hermès|Hermès","Creed Aventus|Creed"]},
  {name:"Oprah Winfrey",img:"🌟",frags:["Beautiful|Estée Lauder","Chanel No. 5|Chanel"]},
  {name:"Sandra Bullock",img:"🎬",frags:["Kai|Kai","Le Labo Rose 31|Le Labo"]},
  {name:"Matthew McConaughey",img:"🤙",frags:["Dolce & Gabbana The One|D&G","Sauvage|Dior"]},
  {name:"Victoria Beckham",img:"🖤",frags:["Santal 33|Le Labo","Baccarat Rouge 540|Maison Francis Kurkdjian"]},
  {name:"Priyanka Chopra",img:"✨",frags:["Trussardi Donna|Trussardi","Bulgari Omnia|Bvlgari"]},
  {name:"Shakira",img:"💃",frags:["S by Shakira|Shakira","Dance|Shakira"]},
  {name:"Pharrell Williams",img:"🎹",frags:["Girl|Comme des Garcons","Bleu de Chanel|Chanel"]},
  {name:"Lizzo",img:"🎵",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Good Girl|Carolina Herrera"]},
  {name:"Lana Del Rey",img:"🌊",frags:["Chanel No. 5|Chanel","Black Opium|YSL","Replica By the Fireplace|Maison Margiela"]},
  {name:"Tyler, The Creator",img:"🌼",frags:["French Waltz|Matiere Premiere","Santal 33|Le Labo","Tobacco Vanille|Tom Ford"]},
  {name:"Frank Ocean",img:"🌊",frags:["Comme des Garcons 2|CDG","Terre d'Hermès|Hermès"]},
  {name:"Daniel Craig",img:"🍸",frags:["Aventus|Creed","Tom Ford Noir|Tom Ford"]},
  {name:"Salma Hayek",img:"🌹",frags:["Opium|YSL","Black Orchid|Tom Ford"]},
  {name:"Chris Pratt",img:"⭐",frags:["Bleu de Chanel|Chanel","Sauvage|Dior"]},
  {name:"Lupita Nyong'o",img:"💜",frags:["Lancôme La Vie Est Belle|Lancôme","J'adore|Dior"]},
  {name:"Lenny Kravitz",img:"🎸",frags:["Oud Wood|Tom Ford","Jazz Club|Maison Margiela","Tobacco Vanille|Tom Ford"]},
  {name:"Sabrina Carpenter",img:"🎀",frags:["Cloud|Ariana Grande","Mon Paris|YSL","Delina|Parfums de Marly"]},
  {name:"Chappell Roan",img:"🌈",frags:["Glossier You|Glossier","Replica Bubble Bath|Maison Margiela"]}
];

// ═══════════════ ZODIAC DATA ═══════════════
const ZODIAC = [
  {sign:'Aries',symbol:'♈',dates:'Mar 21 – Apr 19',emoji:'🔥'},
  {sign:'Taurus',symbol:'♉',dates:'Apr 20 – May 20',emoji:'🌹'},
  {sign:'Gemini',symbol:'♊',dates:'May 21 – Jun 20',emoji:'🌬️'},
  {sign:'Cancer',symbol:'♋',dates:'Jun 21 – Jul 22',emoji:'🌊'},
  {sign:'Leo',symbol:'♌',dates:'Jul 23 – Aug 22',emoji:'👑'},
  {sign:'Virgo',symbol:'♍',dates:'Aug 23 – Sep 22',emoji:'🌿'},
  {sign:'Libra',symbol:'♎',dates:'Sep 23 – Oct 22',emoji:'⚖️'},
  {sign:'Scorpio',symbol:'♏',dates:'Oct 23 – Nov 21',emoji:'🦂'},
  {sign:'Sagittarius',symbol:'♐',dates:'Nov 22 – Dec 21',emoji:'🏹'},
  {sign:'Capricorn',symbol:'♑',dates:'Dec 22 – Jan 19',emoji:'⛰️'},
  {sign:'Aquarius',symbol:'♒',dates:'Jan 20 – Feb 18',emoji:'🌌'},
  {sign:'Pisces',symbol:'♓',dates:'Feb 19 – Mar 20',emoji:'🧜‍♀️'}
];

const GENRES = [
  {name:'Hip-Hop / Rap',emoji:'🎤',desc:'Bold, confident, street-smart'},
  {name:'R&B / Soul',emoji:'🎶',desc:'Smooth, sensual, warm'},
  {name:'Pop',emoji:'🎵',desc:'Fresh, fun, versatile'},
  {name:'Rock / Alternative',emoji:'🎸',desc:'Edgy, raw, independent'},
  {name:'Electronic / EDM',emoji:'🎧',desc:'Futuristic, energetic, bold'},
  {name:'Jazz / Blues',emoji:'🎷',desc:'Sophisticated, deep, timeless'},
  {name:'Classical',emoji:'🎻',desc:'Elegant, refined, complex'},
  {name:'Country',emoji:'🤠',desc:'Earthy, authentic, warm'},
  {name:'Indie / Folk',emoji:'🍂',desc:'Natural, artistic, unique'},
  {name:'Latin / Reggaeton',emoji:'💃',desc:'Passionate, vibrant, warm'},
  {name:'K-Pop',emoji:'💜',desc:'Trendy, sweet, playful'},
  {name:'Metal / Punk',emoji:'🤘',desc:'Intense, dark, powerful'}
];

const STYLES = [
  {name:'Streetwear',emoji:'🧢',desc:'Urban, bold, hype culture'},
  {name:'Minimalist',emoji:'🤍',desc:'Clean, simple, refined'},
  {name:'Preppy / Classic',emoji:'👔',desc:'Polished, traditional, smart'},
  {name:'Bohemian',emoji:'🌻',desc:'Free-spirited, earthy, artistic'},
  {name:'Sporty / Athleisure',emoji:'🏃',desc:'Active, fresh, dynamic'},
  {name:'Goth / Dark',emoji:'🖤',desc:'Mysterious, dark, dramatic'},
  {name:'Luxury / High Fashion',emoji:'👑',desc:'Opulent, statement, exclusive'},
  {name:'Casual / Everyday',emoji:'👕',desc:'Relaxed, comfortable, easygoing'},
  {name:'Vintage / Retro',emoji:'🎞️',desc:'Nostalgic, unique, timeless'},
  {name:'Edgy / Punk',emoji:'⚡',desc:'Rebellious, raw, bold'},
  {name:'Romantic / Feminine',emoji:'🌹',desc:'Soft, elegant, graceful'},
  {name:'Techwear / Futuristic',emoji:'🤖',desc:'Modern, functional, sci-fi'}
];

const DUPES = [
  {name:'Baccarat Rouge 540',emoji:'🌹',desc:'MFK · ~$325'},
  {name:'Aventus',emoji:'🍍',desc:'Creed · ~$445'},
  {name:'Lost Cherry',emoji:'🍒',desc:'Tom Ford · ~$390'},
  {name:'Oud Wood',emoji:'🪵',desc:'Tom Ford · ~$285'},
  {name:'Bleu de Chanel',emoji:'💎',desc:'Chanel · ~$165'},
  {name:'Black Opium',emoji:'☕',desc:'YSL · ~$140'},
  {name:'Delina',emoji:'🌸',desc:'Parfums de Marly · ~$335'},
  {name:'Santal 33',emoji:'🪘',desc:'Le Labo · ~$310'},
  {name:'La Vie Est Belle',emoji:'✨',desc:'Lancôme · ~$105'},
  {name:'Sauvage',emoji:'🌵',desc:'Dior · ~$115'},
  {name:'Tobacco Vanille',emoji:'🍂',desc:'Tom Ford · ~$285'},
  {name:'Good Girl',emoji:'👠',desc:'Carolina Herrera · ~$110'}
];

// ═══════════════ STATE ═══════════════
// sessionStorage helpers for chat persistence
function _ss(k) { try { return JSON.parse(sessionStorage.getItem('sw_'+k)); } catch { return null; } }
function _ssw(k,v) { try { sessionStorage.setItem('sw_'+k, JSON.stringify(v)); } catch {} }

let CP = 'home';
let chatMsgs = _ss('chatMsgs') || [], chatLoad = false;
let photoB64 = null, photoPrev = null, photoRes = _ss('photoRes') || '', photoLoad = false;
let selZ = _ss('selZ'), zodiacRes = _ss('zodiacRes') || '', zodiacLoad = false, zodiacChat = _ss('zodiacChat') || [], zodiacChatLoad = false;
let selM = _ss('selM'), musicRes = _ss('musicRes') || '', musicLoad = false, musicChat = _ss('musicChat') || [], musicChatLoad = false;
let selS = _ss('selS'), styleRes = _ss('styleRes') || '', styleLoad = false, styleChat = _ss('styleChat') || [], styleChatLoad = false;
let selD = _ss('selD'), dupeRes = _ss('dupeRes') || '', dupeLoad = false, dupeChat = _ss('dupeChat') || [], dupeChatLoad = false;
let photoChat = _ss('photoChat') || [], photoChatLoad = false;
let celebQ = '';
let expQ = '', expFilter = 'all', expResults = [];
const cache = {};

// Birthday to zodiac sign converter
function bdayToZodiac(input) {
  const s = input.trim().toLowerCase();
  let m, d;

  // DD/MM, DD.MM, DD-MM
  const p = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})/);
  if (p) { d = parseInt(p[1]); m = parseInt(p[2]); }

  // Month name + day (e.g. "March 15", "15 March", "15 march 1995")
  if (!m) {
    const months = {jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
    for (const [k,v] of Object.entries(months)) {
      if (s.includes(k)) { m = v; const dm = s.match(/\d+/); if (dm) d = parseInt(dm[0]); break; }
    }
  }

  if (!m || !d || d < 1 || d > 31 || m < 1 || m > 12) return null;

  // Use m*100+d for clean range comparisons
  const n = m * 100 + d;
  if (n >= 321 && n <= 419) return 'Aries';
  if (n >= 420 && n <= 520) return 'Taurus';
  if (n >= 521 && n <= 620) return 'Gemini';
  if (n >= 621 && n <= 722) return 'Cancer';
  if (n >= 723 && n <= 822) return 'Leo';
  if (n >= 823 && n <= 922) return 'Virgo';
  if (n >= 923 && n <= 1022) return 'Libra';
  if (n >= 1023 && n <= 1121) return 'Scorpio';
  if (n >= 1122 && n <= 1221) return 'Sagittarius';
  if (n >= 1222 || n <= 119) return 'Capricorn';
  if (n >= 120 && n <= 218) return 'Aquarius';
  if (n >= 219 && n <= 320) return 'Pisces';
  return null;
}

// Reusable follow-up chat UI
function followUpHTML(chatArr, loadingFlag, inputId, sendFn, placeholder) {
  return `<div style="margin-top:24px;border-top:1px solid rgba(255,255,255,.04);padding-top:20px">
    <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:14px;text-transform:uppercase">Ask a follow-up</p>
    ${chatArr.map(m=>`<div class="cb fi ${m.role==='user'?'cb-u':'cb-a'}" style="margin-bottom:10px">
      ${m.role==='assistant'?'<div style="color:var(--g);font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1.2px;text-transform:uppercase">ScentWise AI</div>':''}
      ${fmt(m.content)}
    </div>`).join('')}
    ${loadingFlag?'<div class="cb cb-a fi" style="display:flex;gap:8px;padding:16px 20px;margin-bottom:10px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span></div>':''}
    <div class="inp-row" style="margin-top:10px">
      <label for="${inputId}" class="sr-only">${placeholder}</label>
      <input type="text" id="${inputId}" placeholder="${placeholder}" onkeydown="if(event.key==='Enter')${sendFn}()" autocomplete="off">
      <button class="btn btn-sm" onclick="${sendFn}()" ${loadingFlag?'disabled':''} aria-label="Send follow-up">Send</button>
    </div>
  </div>`;
}

// ═══════════════ NAV ═══════════════
const NI = [
  {id:'home',l:'Home',i:'✦'},{id:'explore',l:'Explore',i:'🧪'},{id:'chat',l:'AI Advisor',i:'💬'},
  {id:'photo',l:'Style Scan',i:'📸'},{id:'zodiac',l:'Zodiac',i:'🔮'},{id:'music',l:'Music',i:'🎶'},
  {id:'style',l:'Style',i:'🪞'},{id:'dupe',l:'Dupes',i:'🔄'},{id:'celeb',l:'Celebs',i:'💫'},{id:'account',l:'Account',i:'👤'}
];
// Mobile bottom bar (core tabs)
const MNI = [
  {id:'home',l:'Home',i:'✦'},{id:'explore',l:'Explore',i:'🧪'},{id:'chat',l:'AI',i:'💬'},
  {id:'_modes',l:'Modes',i:'✧'},{id:'account',l:'Account',i:'👤'}
];
// All switchable modes (for the pill bar)
const MODES = [
  {id:'chat',l:'AI Advisor',i:'💬'},{id:'explore',l:'Explore',i:'🧪'},
  {id:'photo',l:'Photo Scan',i:'📸'},{id:'zodiac',l:'Zodiac',i:'🔮'},
  {id:'music',l:'Music',i:'🎶'},{id:'style',l:'Style',i:'🪞'},
  {id:'dupe',l:'Dupe Finder',i:'🔄'},{id:'celeb',l:'Celebs',i:'💫'}
];

function rNav() {
  document.getElementById('nav').innerHTML = NI.map(n =>
    `<a class="ni ${CP===n.id?'na':''}" onclick="go('${n.id}')" role="tab" tabindex="0" aria-selected="${CP===n.id}" aria-label="${n.l}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();go('${n.id}')}">${n.i} ${n.l}</a>`
  ).join('');
  const mobEl = document.getElementById('mob-nav');
  if (mobEl) {
    const modePages = ['photo','zodiac','music','style','dupe','celeb'];
    mobEl.innerHTML = MNI.map(n => {
      if (n.id === '_modes') {
        const isOnMode = modePages.includes(CP);
        return `<div class="mob-ni ${isOnMode?'mob-na':''}" onclick="openModeSwitcher()" role="tab" tabindex="0" aria-label="Switch discovery mode" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModeSwitcher()}"><span aria-hidden="true">${n.i}</span><span>${n.l}</span></div>`;
      }
      return `<div class="mob-ni ${CP===n.id?'mob-na':''}" onclick="go('${n.id}')" role="tab" tabindex="0" aria-selected="${CP===n.id}" aria-label="${n.l}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();go('${n.id}')}"><span aria-hidden="true">${n.i}</span><span>${n.l}</span></div>`;
    }).join('');
  }
  rModeBar();
}

function rModeBar() {
  const bar = document.getElementById('mode-bar');
  const inner = document.getElementById('mode-bar-inner');
  if (!bar || !inner) return;
  const isModePage = MODES.some(m => m.id === CP);
  bar.style.display = isModePage ? '' : 'none';
  if (!isModePage) return;
  inner.innerHTML = MODES.map(m =>
    `<div class="mode-pill ${CP===m.id?'mp-active':''}" onclick="go('${m.id}')"><span class="mp-icon">${m.i}</span>${m.l}</div>`
  ).join('');
  // Auto-scroll active pill into view
  setTimeout(() => {
    const active = inner.querySelector('.mp-active');
    if (active) active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }, 50);
}

const PAGE_TITLES = {
  home: 'ScentWise — AI Fragrance Advisor | Personalized Perfume Recommendations',
  explore: 'Explore 75,000+ Fragrances — ScentWise',
  chat: 'AI Fragrance Advisor — ScentWise',
  photo: 'Photo Style Scan — ScentWise',
  zodiac: 'Zodiac Fragrance Match — ScentWise',
  music: 'Music to Fragrance Match — ScentWise',
  style: 'Style Match — ScentWise',
  dupe: 'Dupe Finder — ScentWise',
  celeb: 'Celebrity Fragrances — ScentWise',
  account: 'Account — ScentWise',
  admin: 'Admin — ScentWise'
};

function go(p) {
  document.querySelectorAll('[id^="page-"]').forEach(e => e.classList.add('hidden'));
  CP = p;
  // Update page title for SEO and accessibility
  document.title = PAGE_TITLES[p] || PAGE_TITLES.home;
  // Hide/show SPA nav/footer FIRST (before rNav, so a rNav crash can't leave them visible)
  const navW = document.querySelector('.nav-w');
  const mobNav = document.querySelector('.mob-nav');
  const modeBar = document.getElementById('mode-bar');
  const footer = document.getElementById('site-footer');
  const blogNav = document.querySelector('nav[aria-label]');
  if (p === 'home') {
    if (navW) navW.style.display = 'none';
    if (mobNav) mobNav.style.display = 'none';
    if (modeBar) modeBar.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (blogNav) blogNav.style.display = 'none';
    document.body.style.paddingBottom = '0';
  } else {
    // Remove the early-hide stylesheet injected by inline script
    var hpHide = document.getElementById('hp-hide');
    if (hpHide) hpHide.remove();
    if (navW) navW.style.display = '';
    if (mobNav) mobNav.style.display = '';
    if (footer) footer.style.display = '';
    if (blogNav) blogNav.style.display = '';
    document.body.style.paddingBottom = '';
    if (window._hpScrollHandler) {
      window.removeEventListener('scroll', window._hpScrollHandler);
      window._hpScrollHandler = null;
    }
  }
  try { rNav(); } catch(err) { console.error('rNav error:', err); }
  // Render the page (r_* functions set innerHTML directly, no need to clear first)
  const e = document.getElementById('page-' + p);
  if (e) {
    e.classList.remove('hidden');
    try { window['r_' + p](e); } catch(err) { console.error('Page render error:', p, err); }
  }
  window.scrollTo({top:0,behavior:'smooth'});
  initSwipe();
}

// Swipe between modes on mobile
let _swTx=0,_swTy=0,_swActive=false,_swEl=null;
function initSwipe(){
  const isMode = MODES.some(m=>m.id===CP);
  if(!isMode){_swActive=false;return;}
  _swActive=true;
}
document.addEventListener('touchstart',function(e){
  if(!_swActive)return;
  // Skip swipe on interactive/scrollable elements
  const t=e.target;
  if(t.closest&&(t.closest('input,textarea,select,.mode-bar,.chat-msgs,a,button,[contenteditable]')))return;
  _swEl=t;
  _swTx=e.touches[0].clientX;
  _swTy=e.touches[0].clientY;
},{passive:true});
document.addEventListener('touchend',function(e){
  if(!_swActive||!_swEl)return;
  _swEl=null;
  const dx=e.changedTouches[0].clientX-_swTx;
  const dy=e.changedTouches[0].clientY-_swTy;
  if(Math.abs(dx)<80||Math.abs(dy)>Math.abs(dx)*0.6)return;
  const ci=MODES.findIndex(m=>m.id===CP);
  if(ci===-1)return;
  if(dx<0&&ci<MODES.length-1)go(MODES[ci+1].id);
  if(dx>0&&ci>0)go(MODES[ci-1].id);
},{passive:true});

// ═══════════════ HOME ═══════════════
function r_home(el) {
  const perfumeCount = SI.length ? (Math.ceil(SI.length/5000)*5000).toLocaleString() : '75,000';
  const celebCount = CELEBS.length;
  el.innerHTML = `<div class="hp-grain">
  <!-- Homepage Nav -->
  <nav class="hp-nav" id="hp-nav">
    <div class="hp-nav-logo" onclick="go('home')">Scent<span>Wise</span></div>
    <div class="hp-nav-links">
      <a onclick="document.getElementById('hp-discover').scrollIntoView({behavior:'smooth'})">Discover</a>
      <a onclick="document.getElementById('hp-how').scrollIntoView({behavior:'smooth'})">How It Works</a>
      <a onclick="document.getElementById('hp-pricing').scrollIntoView({behavior:'smooth'})">Pricing</a>
      <a onclick="document.getElementById('hp-celebrities').scrollIntoView({behavior:'smooth'})">Collections</a>
      <a class="hp-nav-cta" onclick="go('chat')">Try Free</a>
    </div>
    <div class="hp-nav-toggle" onclick="this.classList.toggle('open');var l=this.closest('.hp-nav').querySelector('.hp-nav-links');l.style.display=this.classList.contains('open')?'flex':'none';this.setAttribute('aria-expanded',this.classList.contains('open'))" role="button" tabindex="0" aria-label="Toggle navigation menu" aria-expanded="false" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <span></span><span></span><span></span>
    </div>
  </nav>
  <!-- Hero -->
  <section class="hp-hero">
    <div class="hp-hero-eyebrow">Fragrance Discovery, Reimagined</div>
    <h1>Find the scent that <em>feels like you</em></h1>
    <p class="hp-hero-sub">Not another quiz. We match fragrances to your zodiac, music taste, personal style, and photos — from a collection of ${perfumeCount}+ scents.</p>
    <div class="hp-hero-actions">
      <button class="hp-btn-primary" onclick="go('chat')">Start Discovering</button>
      <button class="hp-btn-ghost" onclick="document.getElementById('hp-discover').scrollIntoView({behavior:'smooth'})">See How It Works</button>
    </div>
    <div class="hp-hero-stats">
      <div class="hp-hero-stat"><div class="num">${perfumeCount}+</div><div class="label">Fragrances</div></div>
      <div class="hp-hero-stat"><div class="num">6</div><div class="label">Discovery Modes</div></div>
      <div class="hp-hero-stat"><div class="num">2,500</div><div class="label">Curated Top Picks</div></div>
    </div>
  </section>
  <!-- Divider -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <!-- Discovery Modes -->
  <section class="hp-section" id="hp-discover">
    <div class="hp-section-kicker hp-reveal">Ways to Discover</div>
    <div class="hp-section-heading hp-reveal">Every person has a <em>signature scent</em> waiting. We help you find yours.</div>
    <p class="hp-section-copy hp-reveal">Six distinct paths to fragrance discovery — each one analyzes a different dimension of who you are.</p>
    <div class="hp-modes-layout">
      <div class="hp-mode-item featured hp-reveal" onclick="go('chat')">
        <div>
          <div class="hp-mode-number">01</div>
          <div class="hp-mode-name">Ask the Expert</div>
          <div class="hp-mode-desc">Have a conversation with our fragrance advisor. Describe what you're looking for — an occasion, a mood, a memory — and get curated recommendations with tasting notes, pricing, and alternatives.</div>
          <div class="hp-mode-tag">Conversation → Recommendations</div>
        </div>
        <div class="hp-mode-visual">
          <div class="hp-mode-visual-circle">
            <div class="hp-mode-visual-icon">✦</div>
            <div class="hp-mode-visual-ring"></div>
          </div>
        </div>
      </div>
      <div class="hp-mode-item hp-reveal" onclick="go('zodiac')">
        <div class="hp-mode-number">02</div>
        <div class="hp-mode-name">Zodiac Match</div>
        <div class="hp-mode-desc">Enter your birthday and discover fragrances aligned with your celestial profile and elemental energy.</div>
        <div class="hp-mode-tag">Birthday → Scent</div>
      </div>
      <div class="hp-mode-item hp-reveal" onclick="go('photo')">
        <div class="hp-mode-number">03</div>
        <div class="hp-mode-name">Photo Style Scan</div>
        <div class="hp-mode-desc">Upload any photo — your outfit, your room, a place you love — and we'll read the aesthetic to match fragrances.</div>
        <div class="hp-mode-tag">Photo → Scent</div>
      </div>
      <div class="hp-mode-item hp-reveal" onclick="go('music')">
        <div class="hp-mode-number">04</div>
        <div class="hp-mode-name">Music Match</div>
        <div class="hp-mode-desc">Tell us what you listen to. Your sonic taste reveals more about your fragrance preferences than you'd think.</div>
        <div class="hp-mode-tag">Genres → Scent</div>
      </div>
      <div class="hp-mode-item hp-reveal" onclick="go('style')">
        <div class="hp-mode-number">05</div>
        <div class="hp-mode-name">Style Match</div>
        <div class="hp-mode-desc">Your wardrobe speaks volumes. Describe your fashion sense and we'll find scents that complete the picture.</div>
        <div class="hp-mode-tag">Fashion → Scent</div>
      </div>
      <div class="hp-mode-item hp-reveal" onclick="go('dupe')">
        <div class="hp-mode-number">06</div>
        <div class="hp-mode-name">Dupe Finder</div>
        <div class="hp-mode-desc">Love an expensive fragrance? We'll find affordable alternatives that smell just like the original.</div>
        <div class="hp-mode-tag">Fragrance → Dupes</div>
      </div>
      <div class="hp-mode-item hp-reveal" onclick="go('celeb')">
        <div class="hp-mode-number">07</div>
        <div class="hp-mode-name">Celebrity Collections</div>
        <div class="hp-mode-desc">Explore the signature fragrances of icons — from athletes to actors, musicians to moguls.</div>
        <div class="hp-mode-tag">Browse → Discover</div>
      </div>
    </div>
  </section>
  <!-- Divider -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <!-- How It Works -->
  <section class="hp-section" id="hp-how">
    <div class="hp-section-kicker hp-reveal">How It Works</div>
    <div class="hp-section-heading hp-reveal">Three steps to your <em>perfect match</em></div>
    <p class="hp-section-copy hp-reveal">No samples, no guesswork, no department store pressure. Just intelligent recommendations.</p>
    <div class="hp-steps">
      <div class="hp-step hp-reveal">
        <div class="hp-step-num">01</div>
        <div class="hp-step-title">Choose Your Path</div>
        <div class="hp-step-text">Pick from six discovery modes — zodiac, music, style, photo, celebrity, or just tell us what you're in the mood for.</div>
      </div>
      <div class="hp-step hp-reveal">
        <div class="hp-step-num">02</div>
        <div class="hp-step-title">Get Matched</div>
        <div class="hp-step-text">Our engine cross-references your input against ${perfumeCount}+ fragrance profiles including notes, accords, seasons, and ratings.</div>
      </div>
      <div class="hp-step hp-reveal">
        <div class="hp-step-num">03</div>
        <div class="hp-step-title">Discover & Explore</div>
        <div class="hp-step-text">Receive curated picks with detailed breakdowns — top notes, longevity, occasions, price range, and where to buy.</div>
      </div>
    </div>
  </section>
  <!-- Pricing -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-section" id="hp-pricing">
    <div class="hp-section-kicker hp-reveal">Simple Pricing</div>
    <div class="hp-section-heading hp-reveal">Start free. <em>Upgrade when you're ready.</em></div>
    <p class="hp-section-copy hp-reveal">Browse 75,000+ fragrances and celebrity collections for free. Unlock AI-powered recommendations when you want more.</p>
    <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-top:40px;max-width:720px;margin-left:auto;margin-right:auto">
      <div class="hp-reveal" style="flex:1;min-width:280px;max-width:340px;border:1px solid var(--d4);border-radius:var(--r);padding:36px 28px;background:rgba(255,255,255,.02);text-align:center">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--td);margin-bottom:12px">Free</div>
        <div style="font-size:36px;font-weight:700;margin-bottom:6px">$0</div>
        <div style="color:var(--td);font-size:13px;margin-bottom:24px">Forever free</div>
        <ul style="text-align:left;list-style:none;padding:0;margin:0 0 28px;font-size:14px;color:var(--t);line-height:2.2">
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Search 75,000+ fragrances</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Celebrity collections (101 icons)</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> 3 free AI queries to try</li>
          <li style="display:flex;align-items:center;gap:8px;color:var(--d5)"><span>&#10005;</span> AI Chat, Photo, Zodiac, Music, Style</li>
          <li style="display:flex;align-items:center;gap:8px;color:var(--d5)"><span>&#10005;</span> Dupe Finder</li>
        </ul>
        <button class="hp-btn-ghost" onclick="go('explore')" style="width:100%;padding:14px">Explore Database</button>
      </div>
      <div class="hp-reveal" style="flex:1;min-width:280px;max-width:340px;border:2px solid var(--g);border-radius:var(--r);padding:36px 28px;background:var(--gl);text-align:center;position:relative">
        <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--g);color:var(--bg);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:4px 16px;border-radius:20px">Most Popular</div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--g);margin-bottom:12px">Premium</div>
        <div style="font-size:36px;font-weight:700;margin-bottom:6px"><span class="gg">$2.99</span><span style="font-size:16px;color:var(--td);font-weight:400">/month</span></div>
        <div style="color:var(--td);font-size:13px;margin-bottom:24px">Cancel anytime</div>
        <ul style="text-align:left;list-style:none;padding:0;margin:0 0 28px;font-size:14px;color:var(--t);line-height:2.2">
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Everything in Free</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> AI Chat Advisor</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Photo, Zodiac, Music & Style Match</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Dupe Finder</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> 500 AI queries/month</li>
        </ul>
        <button class="hp-btn-primary" onclick="unlockPaid()" data-subscribe-btn style="width:100%;padding:14px">Get Premium</button>
      </div>
    </div>
  </section>
  <!-- Email Capture -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-section" id="hp-newsletter">
    <div class="hp-section-kicker hp-reveal">Stay in the Loop</div>
    <div class="hp-section-heading hp-reveal">Get fragrance tips & <em>exclusive picks</em></div>
    <p class="hp-section-copy hp-reveal">Join our newsletter for weekly scent recommendations, new release alerts, and subscriber-only content.</p>
    <form id="hp-email-form" class="hp-reveal" onsubmit="return captureEmail(event)" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:32px;max-width:520px;margin-left:auto;margin-right:auto">
      <input type="email" id="hp-email-input" placeholder="Enter your email" required style="flex:1;min-width:220px;padding:14px 18px;background:var(--d3);border:1px solid var(--d4);color:var(--t);border-radius:var(--r);font-family:'DM Sans';font-size:14px;outline:none">
      <button type="submit" class="hp-btn-primary" id="hp-email-btn" style="padding:14px 28px;white-space:nowrap">Subscribe Free</button>
    </form>
    <p class="hp-reveal" style="color:var(--d5);font-size:11px;margin-top:12px;text-align:center">No spam. Unsubscribe anytime.</p>
  </section>
  <!-- Quote -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-quote-section">
    <div class="hp-quote-mark hp-reveal">"</div>
    <div class="hp-quote-text hp-reveal">Fragrance is the most intense form of memory. The right scent doesn't just complement who you are — it becomes part of your identity.</div>
    <div class="hp-quote-attr hp-reveal">— The Philosophy Behind ScentWise</div>
  </section>
  <!-- Celebrities -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-celeb-section" id="hp-celebrities">
    <div class="hp-celeb-inner">
      <div class="hp-section-kicker hp-reveal">Celebrity Collections</div>
      <div class="hp-section-heading hp-reveal">What the <em>icons</em> wear</div>
      <p class="hp-section-copy hp-reveal">Explore the fragrance wardrobes of cultural icons and find out what your favourites reach for.</p>
      <div class="hp-celeb-scroll">
        ${['Rihanna','David Beckham','Zendaya','Johnny Depp','Ariana Grande','Cristiano Ronaldo','Beyoncé','Drake','LeBron James','Taylor Swift','Kendall Jenner','Travis Scott'].map(name => {
          const c = CELEBS.find(x => x.name === name);
          return c ? `<div class="hp-celeb-card" onclick="go('celeb')" role="button" tabindex="0" onkeydown="if(event.key==='Enter')go('celeb')" aria-label="${c.name} — ${c.frags.length} fragrances"><div class="hp-celeb-emoji" aria-hidden="true">${c.img}</div><div class="hp-celeb-name">${c.name}</div><div class="hp-celeb-count">${c.frags.length} fragrance${c.frags.length !== 1 ? 's' : ''}</div></div>` : '';
        }).join('')}
      </div>
    </div>
  </section>
  <!-- Final CTA -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-cta-section">
    <div class="hp-cta-heading hp-reveal">Ready to find <em>your scent?</em></div>
    <p class="hp-cta-sub hp-reveal">Start with a free conversation. No sign-up required — just tell us what you're looking for.</p>
    <div class="hp-reveal">
      <button class="hp-btn-primary" onclick="go('chat')" style="font-size:1rem;padding:1rem 3rem">Start Free Discovery</button>
    </div>
  </section>
  <!-- Homepage Footer -->
  <footer class="hp-footer">
    <div class="hp-footer-inner">
      <div class="hp-footer-logo">Scent<span>Wise</span></div>
      <div class="hp-footer-links">
        <a href="/blog/">Blog</a>
        <a href="/terms.html">Terms</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/refund.html">Refunds</a>
        <a href="mailto:scentwise.com@gmail.com">Contact</a>
      </div>
    </div>
    <div class="hp-footer-copy">© 2026 ScentWise. All rights reserved.</div>
  </footer>
  </div>`;
  // Initialize reveal animations for homepage
  setTimeout(() => {
    // Enable reveal animations (content is visible by default without .hp-anim)
    const grain = el.querySelector('.hp-grain');
    if (grain) grain.classList.add('hp-anim');
    const reveals = document.querySelectorAll('.hp-reveal');
    if ('IntersectionObserver' in window) {
      const hpObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 80);
            hpObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
      reveals.forEach(el => hpObserver.observe(el));
      // Fallback: force-reveal any elements still hidden after 2s
      setTimeout(() => { reveals.forEach(el => { if (!el.classList.contains('visible')) el.classList.add('visible'); }); }, 2000);
    } else {
      // No IntersectionObserver: reveal all immediately
      reveals.forEach(el => el.classList.add('visible'));
    }
    // Homepage nav scroll effect (throttled with rAF for better INP)
    const hpNav = document.getElementById('hp-nav');
    if (hpNav) {
      let _hpScrollTick = false;
      window._hpScrollHandler = () => {
        if (!_hpScrollTick) {
          _hpScrollTick = true;
          requestAnimationFrame(() => {
            hpNav.classList.toggle('scrolled', window.scrollY > 60);
            _hpScrollTick = false;
          });
        }
      };
      window.addEventListener('scroll', window._hpScrollHandler, {passive: true});
    }
  }, 50);
}

// ═══════════════ EXPLORE (FREE — uses local DB) ═══════════════
function r_explore(el) {
  if (!_dbLoaded) {
    el.innerHTML = '<div class="sec fi" style="text-align:center;padding-top:80px"><p style="color:var(--td)">Loading fragrance database...</p></div>';
    loadDB().then(() => { if (CP === 'explore') r_explore(el); });
    return;
  }
  const filters = ['all','Male','Female','Unisex'];
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Explore</span> Database</h2>
      <p>Search ${(Math.ceil(SI.length/5000)*5000).toLocaleString()}+ fragrances — works offline, no subscription needed.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div class="inp-row" style="margin-bottom:14px">
        <label for="exp-inp" class="sr-only">Search fragrances</label>
        <input type="text" id="exp-inp" placeholder="Search by name, brand, category..." value="${esc(expQ)}" onkeydown="if(event.key==='Enter')doExp()" autocomplete="off">
        <button class="btn btn-sm" onclick="doExp()" aria-label="Search fragrances">Search</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${filters.map(f => `<button class="fbtn ${expFilter===f?'ac':''}" onclick="expFilter='${f}';doExp()">${f==='all'?'All':f}</button>`).join('')}
      </div>
    </div>
    <div id="exp-res">
      ${expResults.length ? `<p style="color:var(--td);font-size:12px;margin-bottom:14px;font-weight:500">${expResults.length} results${expResults.length>=100?' (showing first 100)':''}</p>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
          ${expResults.slice(0,100).map(p => perfCard(p)).join('')}
        </div>` : expQ ? '<p style="color:var(--td);text-align:center;margin-top:48px;font-size:14px">No results found. Try a different search term.</p>' : `
        <p style="color:var(--td);font-size:13px;margin-bottom:14px;font-weight:500">Popular searches</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${['Dior Sauvage','Tom Ford','Creed Aventus','Baccarat Rouge','Lattafa','Chanel','Versace Eros','Amouage','Le Labo','Mugler'].map(s =>
            `<div class="fbtn" onclick="document.getElementById('exp-inp').value='${s}';doExp()">${s}</div>`
          ).join('')}
        </div>`}
    </div>
  </div>`;
  if (!expQ) document.getElementById('exp-inp')?.focus();
}

function doExp() {
  const inp = document.getElementById('exp-inp');
  expQ = inp?.value?.trim() || '';
  if (!expQ) { expResults = []; r_explore(document.getElementById('page-explore')); return; }
  let results = searchDB(expQ, 100);
  if (expFilter !== 'all') results = results.filter(r => r.gender === expFilter);
  expResults = results;
  r_explore(document.getElementById('page-explore'));
  setTimeout(loadExploreImages, 100);
}

// ═══════════════ CHAT (PAID) ═══════════════
function r_chat(el) {
  if (!isPaid && !hasFreeTrialLeft() && chatMsgs.length === 0) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  const sugg = ["Best fragrances under $50","Dupe for Baccarat Rouge 540","Build me a 4-season rotation","Compare Aventus vs CDNIM","Best office fragrances","Top 5 winter blind buys"];
  const trialBanner = (!isPaid && hasFreeTrialLeft()) ? `<div style="background:var(--gl);border:1px solid rgba(201,169,110,.15);border-radius:var(--r-sm);padding:10px 16px;margin-bottom:14px;font-size:12px;color:var(--g);display:flex;align-items:center;gap:8px"><span style="font-size:16px">✦</span> Free trial: <strong>${FREE_LIMIT - freeUsed}</strong> of ${FREE_LIMIT} queries remaining</div>` : (!isPaid && freeUsed >= FREE_LIMIT) ? `<div style="background:rgba(255,255,255,.02);border:1px solid var(--d4);border-radius:var(--r-sm);padding:10px 16px;margin-bottom:14px;font-size:12px;color:var(--td)">Free trial used — <a onclick="unlockPaid()" style="color:var(--g);cursor:pointer;text-decoration:underline;font-weight:500">Subscribe for unlimited access</a></div>` : '';
  el.innerHTML = `<div class="chat-wrap fi">
    <div style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <h2 class="fd" style="font-size:28px;font-weight:400"><span class="gg" style="font-weight:600">AI</span> Fragrance Advisor</h2>
        <p style="color:var(--td);font-size:13px;margin-top:6px">Powered by ${SI.length ? (Math.ceil(SI.length/5000)*5000).toLocaleString() : '75,000'}+ perfumes with real notes, accords & ratings</p>
        ${scentProfile && scentProfile.queryCount > 0 ? `<p style="color:var(--g);font-size:11px;margin-top:4px;opacity:.7">Personalized from ${scentProfile.queryCount} interaction${scentProfile.queryCount !== 1 ? 's' : ''}</p>` : ''}
      </div>
      ${chatMsgs.length > 0 ? `<button class="btn-o btn-sm" onclick="chatMsgs=[];_ssw('chatMsgs',[]);r_chat(document.getElementById('page-chat'))" aria-label="Start a new conversation" style="flex-shrink:0;white-space:nowrap">New Chat</button>` : ''}
    </div>
    ${trialBanner}
    <div class="msgs" id="c-msgs">
      ${chatMsgs.length===0?`<div style="display:flex;flex-direction:column;gap:10px;margin-top:24px">
        <p style="color:var(--td);font-size:13px;margin-bottom:4px;font-weight:500">Try asking:</p>
        ${sugg.map((s,i)=>`<div class="card fi stagger-${i+1}" onclick="cSend('${s}')" style="padding:14px 18px;cursor:pointer;font-size:14px">${s}</div>`).join('')}
      </div>`:''}
      ${chatMsgs.map((m,i)=>`<div class="cb fi ${m.role==='user'?'cb-u':'cb-a'}">
        ${m.role==='assistant'?'<div style="color:var(--g);font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1.2px;text-transform:uppercase">ScentWise AI</div>':''}
        ${fmt(m.content)}
        ${m.role==='assistant'?feedbackHTML(i):''}
      </div>`).join('')}
      ${chatLoad?'<div class="cb cb-a fi" style="display:flex;gap:8px;padding:20px 24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span></div>':''}
      <div id="c-end"></div>
    </div>
    <div class="inp-row" style="padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
      <label for="c-inp" class="sr-only">Ask about any fragrance</label>
      <input type="text" id="c-inp" placeholder="Ask about any fragrance..." onkeydown="if(event.key==='Enter')cSend()" autocomplete="off">
      <button class="btn btn-sm" onclick="cSend()" ${chatLoad?'disabled':''} aria-label="Send message">Send</button>
    </div>
  </div>`;
  // Auto-scroll the messages container to the bottom after DOM paints
  requestAnimationFrame(() => {
    const msgsEl = document.getElementById('c-msgs');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  });
  document.getElementById('c-inp')?.focus();
}

async function cSend(text) {
  if (!text) { const i = document.getElementById('c-inp'); text = i?.value; if (i) i.value = ''; }
  if (!text || !text.trim() || chatLoad) return;
  if (!canUseAI()) { chatMsgs.push({role:'user',content:text.trim()}); chatMsgs.push({role:'assistant',content:freeUsed >= FREE_LIMIT ? 'You\'ve used all 3 free queries! Subscribe to ScentWise Premium ($2.99/month) for 500 AI queries/month.' : 'Please subscribe to ScentWise Premium ($2.99/month) to use the AI advisor.'}); _ssw('chatMsgs', chatMsgs); _chatShouldScroll = true; r_chat(document.getElementById('page-chat')); return; }
  text = text.trim();
  chatMsgs.push({role:'user',content:text});
  _ssw('chatMsgs', chatMsgs);
  chatLoad = true;
  r_chat(document.getElementById('page-chat'));

  // Build context from local DB (ensure loaded)
  await loadDB();
  const ctx = getContext(text);
  const sysWithCtx = 'You are ScentWise AI, the world\'s most knowledgeable fragrance advisor, powered by a database of over 75,000 real perfumes with actual notes, accords, and ratings. You ALWAYS give confident, specific recommendations with real fragrance names, notes, and details. You never say you are under development or that your database is not operational. When users mention something about the site or numbers, respond helpfully. Format recommendations clearly with fragrance name, brand, key notes, and why it matches. Keep responses concise but informative. Never apologize for lacking data — you have one of the largest fragrance databases in the world. ' + (ctx || '');
  const apiMsgs = chatMsgs.map(m => ({role:m.role, content: m.role==='user' && m.content===text ? sysWithCtx + '\n\nUser question: ' + m.content : m.content}));
  
  const reply = await aiCall('chat', {messages: apiMsgs});
  chatMsgs.push({role:'assistant',content:reply});
  _ssw('chatMsgs', chatMsgs);
  chatLoad = false;
  r_chat(document.getElementById('page-chat'));
  setTimeout(() => loadResultImages(document.querySelector('.chat-msgs')), 100);
}

function retryLast() {
  // Remove the last error response and resend the last user message
  if (chatMsgs.length >= 2 && chatMsgs[chatMsgs.length - 1].role === 'assistant') {
    const lastUser = chatMsgs[chatMsgs.length - 2];
    chatMsgs.pop(); // remove error assistant msg
    chatMsgs.pop(); // remove last user msg
    _ssw('chatMsgs', chatMsgs);
    cSend(lastUser.content);
  }
}

// ═══════════════ PHOTO (PAID) ═══════════════
function r_photo(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Style</span> Scan</h2>
      <p>Upload a photo and get fragrance recommendations matched to your aesthetic.</p>
    </div>
    ${!photoPrev?`<div class="pdrop" onclick="document.getElementById('pf').click()" ondragover="event.preventDefault();this.style.borderColor='var(--g)'" ondragleave="this.style.borderColor='var(--d4)'" ondrop="event.preventDefault();phFile(event.dataTransfer.files[0])">
      <input type="file" id="pf" accept="image/*" hidden onchange="phFile(this.files[0])">
      <div style="font-size:56px;margin-bottom:20px;opacity:.4">📸</div>
      <p style="font-size:17px;margin-bottom:8px;font-weight:500">Drop a photo here or click to upload</p>
      <p style="color:var(--td);font-size:13px">We'll analyze your style and match fragrances to your vibe</p>
    </div>`:`<div class="glass-panel" style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <img src="${photoPrev}" style="width:200px;height:260px;object-fit:cover;border-radius:var(--r);border:1px solid var(--d4);box-shadow:var(--shadow)">
      <div style="flex:1;min-width:250px">
        ${!photoRes&&!photoLoad?`
          <p style="margin-bottom:18px;color:var(--td);font-size:14px">Photo uploaded. Ready to analyze your style.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" onclick="doPhoto()">Find My Fragrances</button>
            <button class="btn-o btn-sm" onclick="photoReset()">Change Photo</button>
          </div>
        `:photoLoad?`
          <div style="display:flex;align-items:center;gap:10px;padding:24px 0">
            <span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span>
            <span style="color:var(--td);font-size:14px;margin-left:4px">Analyzing your style...</span>
          </div>
        `:`
          <div class="rbox" style="flex-direction:column;align-items:stretch">
            <div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">Your Style Matches</div>
            <div style="line-height:1.8;font-size:14px">${fmt(photoRes)}</div>
            ${modeFeedbackHTML('photo', photoRes)}
            ${followUpHTML(photoChat, photoChatLoad, 'pfu-inp', 'pFollow', 'Ask more about your style matches...')}
          </div>
          <div style="margin-top:18px"><button class="btn-o btn-sm" onclick="photoReset()">Try Another Photo</button></div>
        `}
      </div>
    </div>`}
  </div>`;
}

function phFile(file) {
  if (!file) return;
  // Client-side image compression: resize to max 1200px and compress to JPEG 0.8
  const img = new Image();
  img.onload = () => {
    const MAX = 1200;
    let w = img.width, h = img.height;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else { w = Math.round(w * MAX / h); h = MAX; }
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', 0.8);
    photoPrev = dataUrl;
    photoB64 = dataUrl.split(',')[1];
    photoRes = '';
    r_photo(document.getElementById('page-photo'));
  };
  img.src = URL.createObjectURL(file);
}

async function doPhoto() {
  if (!photoB64 || photoLoad) return;
  photoLoad = true;
  r_photo(document.getElementById('page-photo'));
  photoRes = await aiCall('photo', {imageBase64: photoB64, imageMime: 'image/jpeg'});
  _ssw('photoRes', photoRes);
  photoLoad = false;
  r_photo(document.getElementById('page-photo'));
  setTimeout(() => loadResultImages(document.querySelector('#page-photo .rbox')), 100);
}

function photoReset() { photoB64=null; photoPrev=null; photoRes=''; photoLoad=false; photoChat=[]; photoChatLoad=false; _ssw('photoRes',''); _ssw('photoChat',[]); r_photo(document.getElementById('page-photo')); }

async function pFollow() {
  const inp = document.getElementById('pfu-inp');
  if (!inp || !inp.value.trim() || photoChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  photoChat.push({role:'user',content:text});
  photoChatLoad = true; r_photo(document.getElementById('page-photo'));
  const msgs = [{role:'user',content:`Context: I uploaded a style photo and got these fragrance recommendations:\n${photoRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  photoChat.push({role:'assistant',content:reply});
  _ssw('photoChat', photoChat);
  photoChatLoad = false; r_photo(document.getElementById('page-photo'));
}

// ═══════════════ ZODIAC (PAID) ═══════════════
function r_zodiac(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Zodiac</span> Match</h2>
      <p>Select your sign or type your birthday to discover your cosmic scent match.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="bday-inp" placeholder="Type your birthday (e.g. March 15, 15/03)..." style="max-width:320px" onkeydown="if(event.key==='Enter')tryBday()">
        <button class="btn btn-sm" onclick="tryBday()">Find My Sign</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      ${ZODIAC.map((z,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickZ('${z.sign}')" style="text-align:center;padding:18px 12px;${selZ===z.sign?'border-color:var(--g);background:var(--gl)':''}">
        <div style="font-size:30px;margin-bottom:8px">${z.emoji}</div>
        <div style="font-weight:600;font-size:14px">${z.sign}</div>
        <div style="font-size:11px;color:var(--td);margin-top:2px">${z.dates}</div>
      </div>`).join('')}
    </div>
    <div id="z-res" style="margin-top:28px">
      ${zodiacLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Finding your cosmic scents...</span></div>':''}
      ${zodiacRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">${esc((selZ||'').toUpperCase())} Fragrance Matches</div><div style="line-height:1.8;font-size:14px">${fmt(zodiacRes)}</div>
        ${modeFeedbackHTML('zodiac', zodiacRes)}
        ${followUpHTML(zodiacChat, zodiacChatLoad, 'zfu-inp', 'zFollow', 'Ask more about zodiac fragrances...')}
      </div>`:''}
    </div>
  </div>`;
  if (zodiacRes) document.getElementById('zfu-inp')?.focus();
}

function tryBday() {
  const inp = document.getElementById('bday-inp');
  if (!inp || !inp.value.trim()) return;
  const sign = bdayToZodiac(inp.value);
  if (sign) { pickZ(sign); }
  else { showToast('Could not detect your zodiac sign. Try a format like "March 15" or "15/03".', 'error'); }
}

async function pickZ(sign) {
  if (zodiacLoad) return;
  if (sign !== selZ) { zodiacChat = []; zodiacChatLoad = false; }
  selZ = sign;
  const ck = 'z_'+sign;
  if (cache[ck]) { zodiacRes=cache[ck]; r_zodiac(document.getElementById('page-zodiac')); return; }
  zodiacRes=''; zodiacLoad=true; r_zodiac(document.getElementById('page-zodiac'));
  const prompt = `You are ScentWise, a fragrance expert specializing in zodiac-scent matching. Recommend 5 specific fragrances for ${sign}. For each: **bold** name+brand, key notes, why it matches ${sign}'s personality, approximate price. Be creative connecting zodiac traits to scent profiles.`;
  zodiacRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  cache[ck]=zodiacRes; _ssw('selZ',selZ); _ssw('zodiacRes',zodiacRes); zodiacLoad=false; r_zodiac(document.getElementById('page-zodiac'));
  setTimeout(() => loadResultImages(document.getElementById('z-res')), 100);
}

async function zFollow() {
  const inp = document.getElementById('zfu-inp');
  if (!inp || !inp.value.trim() || zodiacChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  zodiacChat.push({role:'user',content:text});
  zodiacChatLoad = true; r_zodiac(document.getElementById('page-zodiac'));
  const msgs = [{role:'user',content:`Context: I asked about ${selZ} zodiac fragrance recommendations and got this:\n${zodiacRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  zodiacChat.push({role:'assistant',content:reply});
  _ssw('zodiacChat', zodiacChat);
  zodiacChatLoad = false; r_zodiac(document.getElementById('page-zodiac'));
}

// ═══════════════ MUSIC (PAID) ═══════════════
function r_music(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Music</span> → Fragrance</h2>
      <p>Your music taste reveals your scent identity. Pick a genre or describe your taste below.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="music-inp" placeholder="Or type your music taste (e.g. lo-fi beats, 90s grunge)..." style="max-width:400px" onkeydown="if(event.key==='Enter')customMusic()">
        <button class="btn btn-sm" onclick="customMusic()">Match</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${GENRES.map((g,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickM('${g.name}')" style="padding:18px;${selM===g.name?'border-color:var(--g);background:var(--gl)':''}">
        <div style="display:flex;align-items:center;gap:12px"><span style="font-size:26px">${g.emoji}</span><div><div style="font-weight:600;font-size:14px">${g.name}</div><div style="font-size:11px;color:var(--td);margin-top:2px">${g.desc}</div></div></div>
      </div>`).join('')}
    </div>
    <div id="m-res" style="margin-top:28px">
      ${musicLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Matching your vibe...</span></div>':''}
      ${musicRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">${esc((selM||'').toUpperCase())} Scent Profile</div><div style="line-height:1.8;font-size:14px">${fmt(musicRes)}</div>
        ${modeFeedbackHTML('music', musicRes)}
        ${followUpHTML(musicChat, musicChatLoad, 'mfu-inp', 'mFollow', 'Ask more about music-inspired fragrances...')}
      </div>`:''}
    </div>
  </div>`;
  if (musicRes) document.getElementById('mfu-inp')?.focus();
}

async function pickM(genre) {
  if (musicLoad) return;
  if (genre !== selM) { musicChat = []; musicChatLoad = false; }
  selM = genre;
  const ck = 'm_'+genre;
  if (cache[ck]) { musicRes=cache[ck]; r_music(document.getElementById('page-music')); return; }
  musicRes=''; musicLoad=true; r_music(document.getElementById('page-music'));
  const prompt = `You are ScentWise, a fragrance expert. Recommend 5 fragrances that capture the mood and aesthetic of ${genre} music. For each: **bold** name+brand, explain the music-scent connection, key notes, price range. Be creative.`;
  musicRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  cache[ck]=musicRes; _ssw('selM',selM); _ssw('musicRes',musicRes); musicLoad=false; r_music(document.getElementById('page-music'));
  setTimeout(() => loadResultImages(document.getElementById('m-res')), 100);
}

async function customMusic() {
  const inp = document.getElementById('music-inp');
  if (!inp || !inp.value.trim() || musicLoad) return;
  const taste = inp.value.trim(); inp.value = '';
  musicChat = []; musicChatLoad = false;
  selM = taste;
  musicRes=''; musicLoad=true; r_music(document.getElementById('page-music'));
  const prompt = `You are ScentWise, a fragrance expert. The user describes their music taste as: "${taste}". Recommend 5 fragrances that capture this musical vibe. For each: **bold** name+brand, explain the music-scent connection, key notes, price range. Be creative and specific to their taste.`;
  musicRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  _ssw('selM',selM); _ssw('musicRes',musicRes);
  musicLoad=false; r_music(document.getElementById('page-music'));
  setTimeout(() => loadResultImages(document.getElementById('m-res')), 100);
}

async function mFollow() {
  const inp = document.getElementById('mfu-inp');
  if (!inp || !inp.value.trim() || musicChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  musicChat.push({role:'user',content:text});
  musicChatLoad = true; r_music(document.getElementById('page-music'));
  const msgs = [{role:'user',content:`Context: I asked about "${selM}" music-fragrance matching and got this:\n${musicRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  musicChat.push({role:'assistant',content:reply});
  _ssw('musicChat', musicChat);
  musicChatLoad = false; r_music(document.getElementById('page-music'));
}

// ═══════════════ STYLE (PAID) ═══════════════
function r_style(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Style</span> Match</h2>
      <p>Your clothing style says everything about your ideal scent. Pick a style or describe yours.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="style-inp" placeholder="Describe your style (e.g. dark academia, Y2K, cottagecore)..." style="max-width:400px" onkeydown="if(event.key==='Enter')customStyle()">
        <button class="btn btn-sm" onclick="customStyle()">Match</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${STYLES.map((s,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickSt('${s.name}')" style="padding:18px;${selS===s.name?'border-color:var(--g);background:var(--gl)':''}">
        <div style="display:flex;align-items:center;gap:12px"><span style="font-size:26px">${s.emoji}</span><div><div style="font-weight:600;font-size:14px">${s.name}</div><div style="font-size:11px;color:var(--td);margin-top:2px">${s.desc}</div></div></div>
      </div>`).join('')}
    </div>
    <div id="s-res" style="margin-top:28px">
      ${styleLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Curating your scent wardrobe...</span></div>':''}
      ${styleRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">${esc((selS||'').toUpperCase())} Fragrance Picks</div><div style="line-height:1.8;font-size:14px">${fmt(styleRes)}</div>
        ${modeFeedbackHTML('style', styleRes)}
        ${followUpHTML(styleChat, styleChatLoad, 'sfu-inp', 'sFollow', 'Ask more about style-matched fragrances...')}
      </div>`:''}
    </div>
  </div>`;
  if (styleRes) document.getElementById('sfu-inp')?.focus();
}

async function pickSt(style) {
  if (styleLoad) return;
  if (style !== selS) { styleChat = []; styleChatLoad = false; }
  selS = style;
  const ck = 's_'+style;
  if (cache[ck]) { styleRes=cache[ck]; r_style(document.getElementById('page-style')); return; }
  styleRes=''; styleLoad=true; r_style(document.getElementById('page-style'));
  const prompt = `You are ScentWise, a fragrance expert. Recommend 5 fragrances for the ${style} clothing style. For each: **bold** name+brand, explain WHY it matches this fashion style, key notes, price range. Include both premium and budget options.`;
  styleRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  cache[ck]=styleRes; _ssw('selS',selS); _ssw('styleRes',styleRes); styleLoad=false; r_style(document.getElementById('page-style'));
  setTimeout(() => loadResultImages(document.getElementById('s-res')), 100);
}

async function customStyle() {
  const inp = document.getElementById('style-inp');
  if (!inp || !inp.value.trim() || styleLoad) return;
  const desc = inp.value.trim(); inp.value = '';
  styleChat = []; styleChatLoad = false;
  selS = desc;
  styleRes=''; styleLoad=true; r_style(document.getElementById('page-style'));
  const prompt = `You are ScentWise, a fragrance expert. The user describes their personal style as: "${desc}". Recommend 5 fragrances that perfectly match this aesthetic. For each: **bold** name+brand, explain WHY it matches their style, key notes, price range. Include both premium and budget options.`;
  styleRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  _ssw('selS',selS); _ssw('styleRes',styleRes);
  styleLoad=false; r_style(document.getElementById('page-style'));
  setTimeout(() => loadResultImages(document.getElementById('s-res')), 100);
}

async function sFollow() {
  const inp = document.getElementById('sfu-inp');
  if (!inp || !inp.value.trim() || styleChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  styleChat.push({role:'user',content:text});
  styleChatLoad = true; r_style(document.getElementById('page-style'));
  const msgs = [{role:'user',content:`Context: I asked about "${selS}" style fragrance matching and got this:\n${styleRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  styleChat.push({role:'assistant',content:reply});
  _ssw('styleChat', styleChat);
  styleChatLoad = false; r_style(document.getElementById('page-style'));
}

// ═══════════════ DUPE FINDER (PAID) ═══════════════
function r_dupe(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Dupe</span> Finder</h2>
      <p>Find affordable alternatives that smell just like your favorite expensive fragrances.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="dupe-inp" placeholder="Type any fragrance name (e.g. Baccarat Rouge 540)..." style="max-width:400px" onkeydown="if(event.key==='Enter')customDupe()">
        <button class="btn btn-sm" onclick="customDupe()">Find Dupes</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${DUPES.map((d,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickD('${d.name.replace(/'/g,"\\'")}')" style="padding:18px;${selD===d.name?'border-color:var(--g);background:var(--gl)':''}">
        <div style="display:flex;align-items:center;gap:12px"><span style="font-size:26px">${d.emoji}</span><div><div style="font-weight:600;font-size:14px">${d.name}</div><div style="font-size:11px;color:var(--td);margin-top:2px">${d.desc}</div></div></div>
      </div>`).join('')}
    </div>
    <div id="d-res" style="margin-top:28px">
      ${dupeLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Finding affordable alternatives...</span></div>':''}
      ${dupeRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">DUPES FOR ${esc((selD||'').toUpperCase())}</div><div style="line-height:1.8;font-size:14px">${fmt(dupeRes)}</div>
        ${modeFeedbackHTML('dupe', dupeRes)}
        ${followUpHTML(dupeChat, dupeChatLoad, 'dfu-inp', 'dFollow', 'Ask more about these dupes...')}
      </div>`:''}
    </div>
  </div>`;
  if (dupeRes) document.getElementById('dfu-inp')?.focus();
}

async function pickD(frag) {
  if (dupeLoad) return;
  if (frag !== selD) { dupeChat = []; dupeChatLoad = false; }
  selD = frag;
  const ck = 'd_'+frag;
  if (cache[ck]) { dupeRes=cache[ck]; r_dupe(document.getElementById('page-dupe')); return; }
  dupeRes=''; dupeLoad=true; r_dupe(document.getElementById('page-dupe'));
  const prompt = `You are ScentWise, a fragrance expert specializing in affordable alternatives and dupes. The user wants cheaper alternatives to **${frag}**. Find exactly 5 dupes/alternatives that smell similar. For each dupe:\n1. **Bold** the name + brand\n2. Approximate retail price\n3. How similar it smells to the original\n4. Key notes it shares with the original\n5. Key differences from the original\n6. Where to buy (e.g. Amazon, FragranceNet, brand site)\n\nStart with a brief 1-sentence description of the original fragrance's scent profile, then list the 5 alternatives from cheapest to most expensive. Focus on fragrances under $80 when possible.`;
  dupeRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  cache[ck]=dupeRes; _ssw('selD',selD); _ssw('dupeRes',dupeRes); dupeLoad=false; r_dupe(document.getElementById('page-dupe'));
  setTimeout(() => loadResultImages(document.getElementById('d-res')), 100);
}

async function customDupe() {
  const inp = document.getElementById('dupe-inp');
  if (!inp || !inp.value.trim() || dupeLoad) return;
  const frag = inp.value.trim(); inp.value = '';
  dupeChat = []; dupeChatLoad = false;
  selD = frag;
  dupeRes=''; dupeLoad=true; r_dupe(document.getElementById('page-dupe'));
  const prompt = `You are ScentWise, a fragrance expert specializing in affordable alternatives and dupes. The user wants cheaper alternatives to **${frag}**. Find exactly 5 dupes/alternatives that smell similar. For each dupe:\n1. **Bold** the name + brand\n2. Approximate retail price\n3. How similar it smells to the original\n4. Key notes it shares with the original\n5. Key differences from the original\n6. Where to buy (e.g. Amazon, FragranceNet, brand site)\n\nStart with a brief 1-sentence description of the original fragrance's scent profile, then list the 5 alternatives from cheapest to most expensive. Focus on fragrances under $80 when possible. If you don't recognize the fragrance name, say so and suggest what the user might have meant.`;
  dupeRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  _ssw('selD',selD); _ssw('dupeRes',dupeRes);
  dupeLoad=false; r_dupe(document.getElementById('page-dupe'));
  setTimeout(() => loadResultImages(document.getElementById('d-res')), 100);
}

async function dFollow() {
  const inp = document.getElementById('dfu-inp');
  if (!inp || !inp.value.trim() || dupeChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  dupeChat.push({role:'user',content:text});
  dupeChatLoad = true; r_dupe(document.getElementById('page-dupe'));
  const msgs = [{role:'user',content:`Context: I asked for dupes/alternatives for "${selD}" and got this:\n${dupeRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  dupeChat.push({role:'assistant',content:reply});
  _ssw('dupeChat', dupeChat);
  dupeChatLoad = false; r_dupe(document.getElementById('page-dupe'));
}

// ═══════════════ CELEBRITIES (FREE) ═══════════════
function r_celeb(el) {
  if (!_dbLoaded) {
    el.innerHTML = '<div class="sec fi" style="text-align:center;padding-top:80px"><p style="color:var(--td)">Loading fragrance data...</p></div>';
    loadDB().then(() => { if (CP === 'celeb') r_celeb(el); });
    return;
  }
  const q = celebQ.toLowerCase();
  const f = q ? CELEBS.filter(c => c.name.toLowerCase().includes(q)) : CELEBS;
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Celebrity</span> Fragrances</h2>
      <p>Discover what ${CELEBS.length} celebrities actually wear.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <input type="search" id="celeb-s" placeholder="Search celebrities..." value="${esc(celebQ)}" oninput="celebQ=this.value;r_celeb(document.getElementById('page-celeb'))" style="max-width:400px">
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
      ${f.map(c=>`<div class="pcard" style="padding:22px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:var(--gl);border:1px solid rgba(201,169,110,.1);display:flex;align-items:center;justify-content:center;font-size:22px">${c.img}</div>
          <h3 style="font-size:16px;font-weight:600">${esc(c.name)}</h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${c.frags.map(k=>{
            const[n,b]=k.split('|');
            const p=find(n,b||'');
            return`<div style="background:var(--d2);border-radius:var(--r-sm);padding:12px 14px;font-size:13px;border:1px solid rgba(255,255,255,.02)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                <span style="color:var(--g);font-size:11px">◈</span>
                <strong>${esc(n)}</strong>
                ${b?` <span style="color:var(--td)">— ${esc(b)}</span>`:''}
                ${p?.r?` <span style="color:#e8a87c;font-size:11px;margin-left:auto">★ ${p.r}</span>`:''}
              </div>
              ${p?.a?`<p class="note" style="margin-left:19px">Accords: ${esc(p.a)}</p>`:''}
              ${p?.t?`<p class="note" style="margin-left:19px">Notes: ${esc(p.t)}</p>`:''}
              <a href="${amazonLink(n, b||'')}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:4px;margin:6px 0 0 19px;padding:3px 10px;border-radius:7px;font-size:10px;font-weight:600;color:#f90;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.12);text-decoration:none;transition:background .2s" onmouseover="this.style.background='rgba(255,153,0,.15)'" onmouseout="this.style.background='rgba(255,153,0,.08)'">Shop on Amazon</a>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>
    ${!f.length?`<p style="text-align:center;color:var(--td);margin-top:48px;font-size:14px">No match for "${esc(celebQ)}"</p>`:''}
  </div>`;
}

// ═══════════════ ACCOUNT PAGE ═══════════════
function r_account(el) {
  if (isPaid) {
    // Show profile for logged-in users
    el.innerHTML = `<div class="sec fi" style="max-width:500px;margin:48px auto">
      <div style="text-align:center;padding:36px 0">
        <div style="width:88px;height:88px;border-radius:24px;background:var(--gl);border:1px solid rgba(201,169,110,.15);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;box-shadow:var(--glow)">${isOwner ? '👑' : '✦'}</div>
        <h2 class="fd" style="font-size:30px;margin-bottom:6px">Your Account</h2>
        <p style="color:var(--td);font-size:14px">${isOwner ? 'Owner Access' : 'Premium Member'}</p>
      </div>
      <div class="glass-panel" style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:var(--td);font-size:13px">Status</span>
          <span class="tag">${isOwner ? '👑 Owner' : '✦ Premium'}</span>
        </div>
        ${userEmail ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:var(--td);font-size:13px">Email</span>
          <span style="font-size:14px">${esc(userEmail)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
          <span style="color:var(--td);font-size:13px">AI Queries</span>
          <span style="font-size:14px">${isOwner ? 'Unlimited' : aiUsage + ' / ' + MAX_PAID + ' this month'}</span>
        </div>
      </div>
      ${renderProfileCard()}
      <button class="btn-o" onclick="doLogout()" style="width:100%;text-align:center">Log Out</button>
    </div>`;
    // Load profile asynchronously and re-render once
    if (!profileLoaded && !profileLoading) {
      loadScentProfile().then(() => {
        const profEl = document.getElementById('page-account');
        if (profEl && CP === 'account') r_account(profEl);
      });
    }
  } else {
    // Show login form for non-premium users
    el.innerHTML = `<div class="sec fi" style="max-width:460px;margin:48px auto">
      <div style="text-align:center;margin-bottom:36px">
        <div style="width:72px;height:72px;border-radius:20px;background:var(--gl);border:1px solid rgba(201,169,110,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px">👤</div>
        <h2 class="fd" style="font-size:30px;margin-bottom:8px">Log In</h2>
        <p style="color:var(--td);font-size:14px">Access your ScentWise Premium subscription.</p>
      </div>
      <div class="glass-panel" style="margin-bottom:18px">
        <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:14px;text-transform:uppercase">Log in with email</p>
        <p style="color:var(--td);font-size:13px;margin-bottom:18px;line-height:1.6">Enter the email you used when subscribing. We'll find your subscription automatically.</p>
        <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email" onkeydown="if(event.key==='Enter')doEmailLogin()" style="margin-bottom:14px">
        <button class="btn" id="login-btn" onclick="doEmailLogin()" style="width:100%">Log In</button>
        <div id="login-progress" style="display:none;margin-top:12px;height:3px;border-radius:2px;background:var(--d4);overflow:hidden"><div style="width:40%;height:100%;background:var(--g);border-radius:2px;animation:progressSlide 1.5s ease-in-out infinite"></div></div>
        <div id="login-status" style="display:none;text-align:center;margin-top:10px;color:var(--td);font-size:13px"><span class="dot" style="margin-right:4px"></span><span class="dot" style="animation-delay:.2s;margin-right:4px"></span><span class="dot" style="animation-delay:.4s;margin-right:4px"></span> Checking your subscription...</div>
      </div>
      <div class="glass-panel" style="margin-bottom:18px">
        <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:14px;text-transform:uppercase">Have an order ID?</p>
        <p style="color:var(--td);font-size:13px;margin-bottom:18px;line-height:1.6">Enter your LemonSqueezy order number to activate your subscription.</p>
        <div class="inp-row">
          <input type="text" id="order-id-input" placeholder="e.g. 2944561" onkeydown="if(event.key==='Enter')doOrderActivate()">
          <button class="btn btn-sm" id="order-activate-btn" onclick="doOrderActivate()">Activate</button>
        </div>
        <div id="order-progress" style="display:none;margin-top:12px;height:3px;border-radius:2px;background:var(--d4);overflow:hidden"><div style="width:40%;height:100%;background:var(--g);border-radius:2px;animation:progressSlide 1.5s ease-in-out infinite"></div></div>
      </div>
      <div style="text-align:center">
        <p style="color:var(--td);font-size:13px">Don't have an account? <a href="#" onclick="unlockPaid(); return false;" style="color:var(--g);text-decoration:underline;font-weight:500">Subscribe for $2.99/month</a></p>
      </div>
    </div>`;
    document.getElementById('login-email')?.focus();
  }
}

function doOrderActivate() {
  const inp = document.getElementById('order-id-input');
  if (!inp || !inp.value.trim()) return;
  const orderId = inp.value.trim().replace(/^#/, '').replace(/[^\d]/g, '');
  if (!orderId) { showToast('Please enter a valid numeric order ID.', 'error'); return; }
  const btn = document.getElementById('order-activate-btn');
  const bar = document.getElementById('order-progress');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="dot" style="margin-right:4px"></span><span class="dot" style="animation-delay:.2s;margin-right:4px"></span><span class="dot" style="animation-delay:.4s"></span>'; }
  if (bar) { bar.style.display = 'block'; }
  if (inp) { inp.disabled = true; }
  activateSubscription(orderId).finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Activate'; } if (bar) { bar.style.display = 'none'; } if (inp) { inp.disabled = false; } });
}

// ═══════════════ OWNER LOGIN PAGE ═══════════════
function r_admin(el) {
  if (isOwner) {
    el.innerHTML = `<div class="sec fi" style="max-width:460px;margin:64px auto;text-align:center">
      <div style="width:72px;height:72px;border-radius:20px;background:var(--gl);border:1px solid rgba(201,169,110,.15);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;box-shadow:var(--glow)">👑</div>
      <h2 class="fd" style="font-size:28px;margin-bottom:8px">Owner Access Active</h2>
      <p style="color:var(--td);margin-bottom:28px">You are logged in as the owner with unlimited access.</p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn" onclick="go('home')">Go to Home</button>
        <button class="btn-o" onclick="logoutOwner();window.history.replaceState({},'','/');go('home')">Logout</button>
      </div>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="sec fi" style="max-width:460px;margin:64px auto">
    <div style="text-align:center;margin-bottom:36px">
      <div style="width:72px;height:72px;border-radius:20px;background:var(--gl);border:1px solid rgba(201,169,110,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px">🔐</div>
      <h2 class="fd" style="font-size:28px;margin-bottom:8px">Owner Login</h2>
      <p style="color:var(--td);font-size:14px">Enter your owner key to access the admin panel.</p>
    </div>
    <div class="glass-panel">
      <div style="margin-bottom:16px">
        <input type="password" id="admin-key" placeholder="Owner key" onkeydown="if(event.key==='Enter')doAdminLogin()">
      </div>
      <div id="admin-err" style="color:#e74c3c;font-size:13px;margin-bottom:12px;display:none"></div>
      <button class="btn" onclick="doAdminLogin()" id="admin-btn" style="width:100%">Login</button>
    </div>
    <p style="text-align:center;margin-top:20px"><a onclick="window.history.replaceState({},'','/');go('home')" style="color:var(--td);cursor:pointer;font-size:13px;transition:color .2s" onmouseover="this.style.color='var(--g)'" onmouseout="this.style.color='var(--td)'">← Back to home</a></p>
  </div>`;
  document.getElementById('admin-key')?.focus();
}

async function doAdminLogin() {
  const inp = document.getElementById('admin-key');
  const err = document.getElementById('admin-err');
  const btn = document.getElementById('admin-btn');
  if (!inp || !inp.value.trim()) return;
  btn.disabled = true; btn.textContent = 'Logging in...';
  err.style.display = 'none';
  try {
    const r = await fetch('/api/owner-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ key: inp.value.trim() })
    });
    const d = await r.json();
    if (d.success) {
      isOwner = true; isPaid = true; currentTier = 'owner';
      window.history.replaceState({}, '', '/');
      go('home');
      return;
    }
    err.textContent = d.error || 'Invalid key.';
  } catch (e) {
    err.textContent = 'Network error. Please try again.';
  }
  err.style.display = 'block';
  btn.disabled = false; btn.textContent = 'Login';
  inp.value = '';
  inp.focus();
}

// ═══════════════ INIT ═══════════════
rNav();

// Check if ?admin is in URL before first render
const _initParams = new URLSearchParams(window.location.search);
const _wantAdmin = _initParams.has('admin');

go(_wantAdmin ? 'admin' : 'home');

// Database loads on-demand when user navigates to explore/chat/celeb pages

// Initialize auth from server-side cookies
(async function() {
  const prevTier = currentTier;
  await checkTier();
  // Load scent profile in background (non-blocking)
  loadScentProfile();
  // Handle payment return — verify order with retry for LS API propagation delay
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id') || params.get('orderId');
  if (orderId) {
    let activated = await activateSubscription(orderId, true);
    if (!activated) {
      // LemonSqueezy may not have the order ready yet — retry with delays
      for (let attempt = 0; attempt < 3 && !activated; attempt++) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        activated = await activateSubscription(orderId, true);
      }
      if (!activated) {
        // All retries failed — show a helpful message
        showToast('We couldn\'t verify your order yet. This can take a minute after purchase. Try logging in with your email on the Account page.', 'info', 8000);
      }
    }
    window.history.replaceState({}, '', window.location.pathname);
  }
  // Only re-render if auth state actually changed (avoids wasteful double-render on homepage)
  if (currentTier !== prevTier || orderId) {
    go(CP);
  }
})();
