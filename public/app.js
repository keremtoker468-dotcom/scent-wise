
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
      if (btn) { btn.disabled = false; btn.textContent = 'Join the list'; }
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
    {id:'chat',name:'AI Advisor',desc:'Ask anything about fragrances'},
    {id:'explore',name:'Explore Database',desc:'Search 75,000+ perfumes'},
    {id:'photo',name:'Photo Style Scan',desc:'Upload a photo, get matched scents'},
    {id:'zodiac',name:'Zodiac Match',desc:'Fragrances aligned with your stars'},
    {id:'music',name:'Music Match',desc:'Your music taste reveals your scent'},
    {id:'style',name:'Style Match',desc:'Scents that match your wardrobe'},
    {id:'dupe',name:'Dupe Finder',desc:'Find affordable alternatives to pricey scents'},
    {id:'celeb',name:'Celebrity Collections',desc:'See what the icons wear'}
  ];
  optionsEl.innerHTML = allModes.map(m =>
    `<div class="ms-option ${CP===m.id?'ms-active':''}" onclick="goFromSwitcher('${m.id}')">
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
let _expDebounce = null;

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
let emailGiven = false;       // set by /api/check-tier and /api/recommend (sw_email cookie on server)
let _lastTeaser = false;      // side-channel: aiCall sets this so callers can persist it with the response
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
    if (typeof d.emailGiven === 'boolean') emailGiven = d.emailGiven;
  } catch { currentTier = 'free'; isOwner = false; isPaid = false; userEmail = ''; emailGiven = false; }
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
  if (typeof serverUsage === 'number') aiUsage = serverUsage;
  else aiUsage++;
  try { updateTrialMeter(); } catch {}
}

function trackFreeUsage(used) {
  if (typeof used === 'number') freeUsed = used;
  else freeUsed++;
  trackFunnel('free_trial_used', { queries_used: freeUsed, queries_remaining: FREE_LIMIT - freeUsed });
  try { updateTrialMeter(); } catch {}
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
// Persist liked fragrances to localStorage
function _saveCollection() {
  try { localStorage.setItem('sw_collection', JSON.stringify([..._likedFrags])); } catch {}
}
function _loadCollection() {
  try { const d = JSON.parse(localStorage.getItem('sw_collection')); if (Array.isArray(d)) d.forEach(k => _likedFrags.add(k)); } catch {}
}
_loadCollection();

function _getCollectionItems() {
  const items = [];
  for (const k of _likedFrags) {
    if (!k.endsWith('_up')) continue;
    const name = k.slice(0, -3);
    // Try to find rich data
    const p = find(name, '');
    items.push({ name: p ? p.n : name, brand: p ? p.b : '', data: p });
  }
  return items;
}

function removeFromCollection(name) {
  const key = name.toLowerCase() + '_up';
  _likedFrags.delete(key);
  _saveCollection();
  const el = document.getElementById('page-account');
  if (el && CP === 'account') r_account(el);
}

function exportCollection() {
  const items = _getCollectionItems();
  if (items.length === 0) { showToast('Collection is empty', 'info'); return; }
  const text = 'My ScentWise Collection\n' + '='.repeat(30) + '\n\n'
    + items.map((item, i) => `${i + 1}. ${item.name}${item.brand ? ' by ' + item.brand : ''}`).join('\n')
    + '\n\nDiscover your perfect scent at scent-wise.com';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Collection copied to clipboard!', 'success'));
  } else {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    showToast('Collection copied to clipboard!', 'success');
  }
}

function _renderCollection() {
  const items = _getCollectionItems();
  if (items.length === 0) return '';
  return `<div class="glass-panel" style="margin-top:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;margin:0">My Collection (${items.length})</p>
      <button onclick="exportCollection()" style="background:var(--gl,rgba(201,169,110,.08));border:1px solid rgba(201,169,110,.15);color:var(--g);padding:5px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s" title="Copy collection to clipboard">Export</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${items.map(item => {
        const safeName = esc(item.name).replace(/'/g, "\\'");
        const cmpN = esc(item.name).replace(/'/g, '&#39;');
        const cmpB = esc(item.brand || '').replace(/'/g, '&#39;');
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--c3);border-radius:10px">
          <span style="color:#f56565;font-size:16px">&#9829;</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.name)}</div>
            ${item.brand ? `<div style="font-size:11px;color:var(--td)">${esc(item.brand)}</div>` : ''}
          </div>
          <a href="${amazonLink(item.name, item.brand)}" target="_blank" rel="noopener noreferrer" style="color:#f90;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap">Amazon</a>
          <button type="button" class="cmp-btn" data-cmp-name="${cmpN}" data-cmp-brand="${cmpB}" title="Add to compare" style="background:var(--gl);border:1px solid rgba(201,169,110,.22);color:var(--gd);font-size:11px;font-weight:600;padding:5px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;font-family:inherit">+ Compare</button>
          <button onclick="removeFromCollection('${safeName}')" style="background:none;border:none;color:var(--td);cursor:pointer;font-size:16px;padding:0 4px" title="Remove">&times;</button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

async function likeFragrance(name, liked, btnEl) {
  const key = name.toLowerCase();

  // Toggle: if already liked/disliked in the same way, undo it
  const currentState = _likedFrags.has(key + '_up') ? 'up' : _likedFrags.has(key + '_down') ? 'down' : null;
  const newAction = liked ? 'up' : 'down';

  if (currentState === newAction) {
    // Undo — remove the like/dislike
    _likedFrags.delete(key + '_' + currentState);
    _saveCollection();
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
    _saveCollection();
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
    _saveCollection();
    if (btnEl) {
      btnEl.innerHTML = '&#9825;';
      btnEl.style.color = 'rgba(201,169,110,.35)';
      btnEl.style.transform = 'scale(1.3)';
      setTimeout(() => { btnEl.style.transform = 'scale(1)'; }, 200);
    }
  } else {
    // Like
    _likedFrags.add(key + '_up');
    _saveCollection();
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

const _CRUMB_LABELS = {
  chat: 'AI Chat',
  photo: 'Photo Style Scan',
  zodiac: 'Zodiac Match',
  music: 'Music Match',
  style: 'Style Match',
  dupe: 'Dupe Finder',
  celeb: 'Celebrity Collections',
  explore: 'Explore Database',
  account: 'Account',
  admin: 'Admin',
};
function crumbsHTML(id) {
  const label = _CRUMB_LABELS[id];
  if (!label) return '';
  return `<nav class="crumbs" aria-label="Breadcrumb">
    <button type="button" onclick="go('home')" aria-label="Back to home">Home</button>
    <span class="sep" aria-hidden="true">›</span>
    <span class="here" aria-current="page">${label}</span>
  </nav>`;
}
window.crumbsHTML = crumbsHTML;

function refineLast(modeId) {
  const cfg = {
    photo:  { inp: 'pfu-inp', fn: 'pFollow' },
    zodiac: { inp: 'zfu-inp', fn: 'zFollow' },
    music:  { inp: 'mfu-inp', fn: 'mFollow' },
    style:  { inp: 'sfu-inp', fn: 'sFollow' },
    dupe:   { inp: 'dfu-inp', fn: 'dFollow' },
    celeb:  { inp: 'cfu-inp', fn: 'cFollow' },
  }[modeId];
  if (!cfg) return;
  const inp = document.getElementById(cfg.inp);
  if (!inp) return;
  inp.value = 'Show me 3 more picks in a similar direction, but with a slightly different mood or price range.';
  const fn = window[cfg.fn];
  if (typeof fn === 'function') fn();
}
window.refineLast = refineLast;

function modeFeedbackHTML(modeId, resultText) {
  if (!resultText || !/\*\*[^*]{3,}\*\*/.test(resultText)) return '';
  if (_ratedModes.has(modeId)) {
    return `<div id="mfb-${modeId}" style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)"><span style="color:var(--td);font-size:11px">Thanks for your feedback!</span></div>`;
  }
  return `<div id="mfb-${modeId}" style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:10px">
    <span style="color:var(--td);font-size:11px">Like these picks?</span>
    <button onclick="rateScentMode('${modeId}',true)" style="background:none;border:1px solid rgba(201,169,110,.25);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;color:var(--gd);font-weight:500">Yes</button>
    <button onclick="rateScentMode('${modeId}',false)" style="background:none;border:1px solid rgba(120,95,40,.12);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;color:var(--td);font-weight:500">No</button>
    <button onclick="refineLast('${modeId}')" style="margin-left:auto;background:var(--gl);border:1px solid rgba(201,169,110,.25);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:12px;color:var(--gd);font-weight:500">More like this →</button>
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

// Open the Lemon Squeezy checkout. We previously used the LS overlay
// (LS.Url.Open) for the in-page experience, but its close button is
// unreliable on Safari/mobile — users got stuck with no way back.
//
// Mobile gets a top-level redirect: the system back button is the most
// intuitive escape on a phone, and tab switchers are buried on iOS.
// Desktop gets a new tab so the original ScentWise session stays open.
// In both cases, redirect_url=...?order_id={order_id} auto-activates
// the subscription when the user returns from a successful payment.
function openLemonCheckout(url) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (isMobile) {
    window.location.href = url;
    return false;
  }
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) window.location.href = url; // popup blocked — last resort
  return false;
}

async function unlockPaid() {
  if (LEMON_URL) {
    openLemonCheckout(LEMON_URL);
    return;
  }
  // Show loading state on all subscribe buttons
  const btns = document.querySelectorAll('[data-subscribe-btn]');
  btns.forEach(b => { b._prev = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="dot" style="margin-right:4px"></span><span class="dot" style="animation-delay:.2s;margin-right:4px"></span><span class="dot" style="animation-delay:.4s"></span>'; });
  try {
    const r = await fetch('/api/create-checkout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' }, body: '{}' });
    const d = await r.json();
    if (d.url && /^https:\/\/[^/]*lemonsqueezy\.com(\/|$)/.test(d.url)) {
      LEMON_URL = d.url;
      if (typeof gtag === 'function') gtag('event', 'begin_checkout', { currency: 'USD', value: 2.99, items: [{ item_name: 'ScentWise Premium', price: 2.99 }] });
      openLemonCheckout(d.url);
      // Reset button state — overlay closes in-page so buttons need to re-enable
      setTimeout(() => btns.forEach(b => { b.disabled = false; b.innerHTML = b._prev || 'Subscribe Now'; }), 800);
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
    ? `<div class="ph-trial"><span style="font-size:14px">✦</span> You have <strong>${trialLeft} free quer${trialLeft === 1 ? 'y' : 'ies'}</strong> left — or unlock everything below.</div>`
    : `<div class="ph-trial" style="color:var(--td);background:rgba(255,255,255,.4);border-color:var(--d4)">Free trial complete. Subscribe for unlimited access.</div>`;
  return `<div class="paywall-hero fi">
    <div class="ph-pitch">
      <div class="ph-kicker">ScentWise Premium</div>
      <h2 class="ph-head">Here's what <em>Premium</em> sees.</h2>
      <p class="ph-sub">Unlimited AI advice, scent-by-scent breakdowns, dupes, zodiac, music &amp; style scans — every mode unlocked, every recommendation sharper than the last.</p>
      ${trialBanner}
      <div class="ph-price-row">
        <div class="ph-price"><span class="ph-curr">$</span>2<span class="ph-cents">.99</span><span class="ph-period">/month</span></div>
      </div>
      <ul class="ph-perks">
        <li>500 AI queries / month</li>
        <li>All 6 discovery modes</li>
        <li>Dupe finder &amp; photo scan</li>
        <li>Zodiac, music &amp; style match</li>
        <li>Personal scent profile memory</li>
        <li>Unlimited database browsing</li>
      </ul>
      <a href="#" onclick="unlockPaid(); return false;" class="btn ph-cta" data-subscribe-btn>Unlock Premium</a>
      <div class="ph-badges">
        <span class="ph-badge"><span class="ph-badge-i">30s</span> Cancel anytime</span>
        <span class="ph-badge"><span class="ph-badge-i">SSL</span> Secured by Lemon Squeezy</span>
      </div>
      <p class="ph-proof"><strong>75,000+</strong> fragrances · <strong>101</strong> icons · <strong>6</strong> AI modes · trusted by fragrance explorers worldwide</p>
      <p class="ph-login">Already subscribed? <a onclick="go('account')">Log in with your email</a> · <a href="/refund.html" target="_blank" rel="noopener">Refund policy</a></p>
    </div>
    <div class="ph-preview" aria-hidden="true">
      <div class="ph-preview-label">A Premium recommendation</div>
      <div class="ph-preview-card">
        <div class="ph-preview-frag">
          <div class="ph-preview-frag-name">Bleu de Chanel Parfum</div>
          <div class="ph-preview-frag-brand">by Chanel</div>
          <div class="ph-preview-frag-notes">Top: grapefruit, mint · Heart: ginger, iris · Base: sandalwood, amber</div>
          <div class="ph-preview-frag-why">Matches your fresh-woody lean with a smoky edge. Office-safe but confident enough for dinner — projects 4–6 hours, lasts 8+.</div>
          <div class="ph-preview-scores">
            <span class="ph-preview-score">Longevity 5/5</span>
            <span class="ph-preview-score">Projection 4/5</span>
            <span class="ph-preview-score">Versatility 5/5</span>
          </div>
        </div>
        <div class="ph-preview-frag ph-preview-masked">
          <div class="ph-preview-frag-name">████████ ██████████</div>
          <div class="ph-preview-frag-brand">by ████████</div>
          <div class="ph-preview-frag-notes">████: ██████████, ████ · █████: ██████, ████</div>
          <div class="ph-preview-frag-why">███████ ████ ██████████ ███ ██████████ ████████ ██ █████ ██ ████████</div>
        </div>
        <div class="ph-preview-mask"><span class="ph-preview-mask-text">+ 4 more picks unlocked</span></div>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin:24px auto 8px;max-width:1040px">
    <p style="color:var(--td);font-size:12px;margin-bottom:12px;letter-spacing:.04em">Not ready? Keep exploring — free forever</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
      <button type="button" onclick="go('explore')" class="ghost-btn" aria-label="Browse the perfume database — free">Browse Database</button>
      <button type="button" onclick="go('celeb')" class="ghost-btn" aria-label="Browse celebrity fragrance collections — free">Celebrity Picks</button>
      <button type="button" onclick="go('home')" class="ghost-btn" aria-label="Return to home">Go Home</button>
    </div>
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
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    showToast('Please enter a valid email address.', 'error');
    return false;
  }
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: trimmed })
    });
    const d = await r.json();
    if (d.success) {
      isPaid = true; currentTier = d.tier || 'premium'; userEmail = d.email || trimmed;
      showToast('✦ Logged in as ' + userEmail + '. Premium unlocked.', 'success', 5000);
      go('chat');
      return true;
    }
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
            if (ok) {
              showToast('✦ Welcome to ScentWise Premium! All AI features unlocked.', 'success', 6000);
              go('chat');
            } else {
              await checkTier();
              if (isPaid) { showToast('✦ Premium activated.', 'success'); go('chat'); }
              else go(CP);
            }
          } else {
            // Fallback: re-check tier (webhook may have processed)
            await checkTier();
            if (isPaid) { showToast('✦ Premium activated.', 'success'); go('chat'); }
          }
        }
      }
    });
  }
}
setupLemonSqueezy();

// ═══════════════ AI CALLS ═══════════════
async function aiCall(mode, payload) {
  _lastTeaser = false;
  if (!canUseAI()) {
    if (!isPaid && freeUsed >= FREE_LIMIT) return 'You\'ve used your free AI queries. Subscribe to ScentWise Premium for unlimited AI recommendations!';
    return 'Please subscribe to use AI features.';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return '**You\'re offline.** AI recommendations need an internet connection. Please reconnect and try again.';
  }
  const aborter = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timeoutId = aborter ? setTimeout(() => aborter.abort(), 45000) : null;
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise'},
      credentials: 'same-origin',
      body: JSON.stringify({mode, ...payload}),
      signal: aborter ? aborter.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (r.status === 403) {
      const d = await r.json().catch(()=>({}));
      if (d.freeUsed !== undefined) {
        trackFreeUsage(d.freeUsed);
        go(CP);
        if (d.freeUsed >= FREE_LIMIT) {
          try { openPaywallModal('server_403'); } catch {}
        }
        return 'You\'ve used your free AI queries. Subscribe to ScentWise Premium for unlimited AI recommendations!';
      }
      isPaid = false; currentTier = 'free'; go(CP); return 'Your session has expired. Please reactivate your subscription.';
    }
    if (r.status === 429) {
      const d = await r.json().catch(()=>({}));
      if (d.usage) trackUsage(d.usage);
      if (d.reason === 'ip_daily_cap') {
        return '**This network has been very busy today.** It looks like a lot of people on your connection (Wi‑Fi, office, or mobile carrier) have been trying ScentWise. Please try again in a few hours — or [go Premium](javascript:unlockPaid()) for unlimited queries with no network caps.';
      }
      return d.error || 'Our AI is a bit busy right now. Please try again in a few seconds.';
    }
    if (!r.ok) throw new Error(r.status >= 500 ? 'ai_unavailable' : 'request_failed');
    const d = await r.json();
    if (typeof d.freeUsed === 'number') trackFreeUsage(d.freeUsed);
    else if (typeof d.usage === 'number') trackUsage(d.usage);
    else if (isPaid) trackUsage();
    if (typeof d.emailGiven === 'boolean') emailGiven = d.emailGiven;
    _lastTeaser = !!d.teaser;
    if (d.profileActive) scentProfile = scentProfile || { queryCount: d.profileQueryCount };
    if (typeof gtag === 'function') gtag('event', 'ai_recommendation', { mode: mode, tier: currentTier || 'free' });
    if (typeof window._swAiResponses === 'number') window._swAiResponses++;
    // When the server returns a teaser payload (query 2 or 3 with no
    // email yet), auto-pop the gate modal once the result has rendered.
    // Delay lets the 2 visible picks + blur paint first so users see
    // what they're about to unlock before the modal interrupts.
    if (d.teaser && !isPaid && !isOwner && !emailGiven) {
      setTimeout(() => { try { openEmailGate('auto_teaser'); } catch {} }, 900);
    }
    return d.result || 'No response. Try again.';
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    if (e.name === 'AbortError') return '**Taking too long.** Our AI didn\'t respond in time. Please try again.';
    if (e.message === 'ai_unavailable') return '**Oops!** Our AI is temporarily unavailable. Please try again in a moment.';
    if (e.message === 'request_failed') return '**Something went wrong.** Please try again.';
    if (e.message === 'Failed to fetch' || (e.message && e.message.includes('network'))) return '**Connection issue.** Check your internet and try again.';
    return '**Something went wrong.** Please try again in a moment.';
  }
}

// ═══════════════ IMAGE HELPER (Bing + Unsplash) ═══════════════
const _imgCache = {};
const _imgCacheKeys = []; // Track insertion order for eviction
const _IMG_CACHE_MAX = 200;

function _scrollToRes(sel) {
  requestAnimationFrame(() => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const navHeight = 70;
    const targetY = window.scrollY + rect.top - navHeight;
    if (rect.top > 0 && rect.top < window.innerHeight * 0.85) return;
    window.scrollTo({top: Math.max(0, targetY), behavior: 'smooth'});
  });
}

function _renderKeepScroll(renderFn) {
  const y = window.scrollY;
  renderFn();
  window.scrollTo({top: y, behavior: 'instant'});
}

function _evictImgCache() {
  while (_imgCacheKeys.length > _IMG_CACHE_MAX) {
    const old = _imgCacheKeys.shift();
    delete _imgCache[old];
    try { localStorage.removeItem(old); } catch {}
  }
}

async function fetchImg(query, n, name, brand) {
  n = n || 1;
  const ck = name ? 'img_' + name + '_' + (brand || '') : 'img_' + query + '_' + n;
  if (_imgCache[ck]) return _imgCache[ck];
  try { const cached = localStorage.getItem(ck); if (cached) { _imgCache[ck] = JSON.parse(cached); return _imgCache[ck]; } } catch {}
  try {
    const url = name
      ? '/api/img?name=' + encodeURIComponent(name) + '&brand=' + encodeURIComponent(brand || '')
      : '/api/img?q=' + encodeURIComponent(query) + '&n=' + n;
    const r = await fetch(url, { headers: { 'X-Requested-With': 'ScentWise' } });
    if (!r.ok) return [];
    const imgs = await r.json();
    _imgCache[ck] = imgs;
    _imgCacheKeys.push(ck);
    _evictImgCache();
    try { localStorage.setItem(ck, JSON.stringify(imgs)); } catch (e) {
      // localStorage quota exceeded — drop oldest keys and retry once
      try {
        for (let i = 0; i < 20 && _imgCacheKeys.length; i++) {
          const old = _imgCacheKeys.shift();
          delete _imgCache[old];
          localStorage.removeItem(old);
        }
        localStorage.setItem(ck, JSON.stringify(imgs));
      } catch {}
    }
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
      if (imgs[0] && imgs[0].thumb) {
        const img = document.createElement('img');
        img.className = 'result-img';
        img.src = imgs[0].thumb;
        img.alt = name;
        img.loading = 'lazy';
        img.onload = function() { this.classList.add('loaded'); };
        img.onerror = function() { this.remove(); };
        // Walk forward from the fragrance name and skip over the inline
        // action buttons (heart, Amazon, Compare) plus their <br>s. The
        // image lands BELOW the action row and ABOVE the description text,
        // instead of getting wedged between the name and the heart icon.
        let anchor = el.nextSibling;
        let safety = 8;
        while (anchor && safety-- > 0 && anchor.nodeType === 1 && /^(SPAN|BR)$/i.test(anchor.tagName)) {
          const isActionSpan = anchor.tagName === 'SPAN' && anchor.querySelector && anchor.querySelector('a[href*="amazon"], button.cmp-btn, .frag-actions');
          anchor = anchor.nextSibling;
          if (isActionSpan) break; // stop right after the Amazon/Compare row
        }
        el.parentElement.insertBefore(img, anchor);
      }
    });
  });
}

// ═══════════════ HELPERS ═══════════════
const _AMZ_GEO = (function() {
  const STORES = {
    de: { domain: 'amazon.de',     tag: 'scentwisede20-21' },
    fr: { domain: 'amazon.fr',     tag: 'scentwisede0e-21' },
    es: { domain: 'amazon.es',     tag: 'scentwised09f-21' },
    it: { domain: 'amazon.it',     tag: 'scentwisede09-21' },
    uk: { domain: 'amazon.co.uk',  tag: 'scentwiseuk-21'  },
    be: { domain: 'amazon.com.be', tag: 'scentwisebe-21'  },
    us: { domain: 'amazon.com',    tag: 'scentwise20-20'  }
  };
  // 1. Timezone wins — most reliable proxy for physical location
  let tz = '';
  try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase(); } catch (e) {}
  const TZ_MAP = {
    'europe/paris': 'fr', 'europe/monaco': 'fr',
    'europe/berlin': 'de', 'europe/vienna': 'de', 'europe/zurich': 'de', 'europe/luxembourg': 'de',
    'europe/madrid': 'es',
    'europe/rome': 'it',
    'europe/london': 'uk', 'europe/dublin': 'uk',
    'europe/brussels': 'be', 'europe/amsterdam': 'be'
  };
  if (TZ_MAP[tz]) return STORES[TZ_MAP[tz]];
  // 2. Fall back to all preferred languages (not just primary)
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || 'en']).map(l => String(l).toLowerCase());
  for (const lang of langs) {
    if (lang === 'nl-be' || lang === 'fr-be') return STORES.be;
    if (lang === 'en-gb' || lang === 'cy-gb')  return STORES.uk;
    if (lang.startsWith('de')) return STORES.de;
    if (lang.startsWith('fr')) return STORES.fr;
    if (lang.startsWith('es')) return STORES.es;
    if (lang.startsWith('it')) return STORES.it;
    if (lang.startsWith('nl')) return STORES.be;
  }
  return STORES.us;
})();
function amazonLink(name, brand) {
  const q = encodeURIComponent((name || '') + ' ' + (brand || '') + ' perfume');
  return 'https://www.' + _AMZ_GEO.domain + '/s?k=' + q + '&tag=' + _AMZ_GEO.tag;
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _isLikelyFragrance(name) {
  const lower = name.toLowerCase();
  // Has "by Brand" pattern — almost certainly a fragrance
  if (/\sby\s/i.test(name)) return true;
  // Common non-fragrance keywords (clothing, accessories, body parts, general items)
  const nonFrag = /\b(jacket|shirt|jeans|pants|dress|skirt|shoes|boots|sneakers|belt|bag|hat|cap|scarf|sunglasses|watch|ring|necklace|bracelet|earrings|coat|sweater|hoodie|blazer|cardigan|flats|heels|sandals|socks|shorts|leggings|vest|tie|gloves|trousers|blouse|tank top|t-shirt|tee|polo|denim|chinos|loafers|oxfords|mules|clutch|tote|backpack|wallet|beanie|hair|makeup|lipstick|eyeshadow|mascara|foundation|concealer|eyeliner|blush)\b/i;
  if (nonFrag.test(lower)) return false;
  // Section headers / labels the AI sometimes bolds — never a fragrance
  const sectionish = /^(notes?|top notes?|heart notes?|base notes?|why|why it matches|matches your profile|blind buy|risk|similar( to)?|scores?|longevity|projection|uniqueness|versatility|tip|note|p\.?s\.?|warning|verdict|summary|conclusion|alternatives?|bonus|extra|profile)[:\s]*$/i;
  if (sectionish.test(name.trim())) return false;
  // Check local DB for match
  if (typeof RL !== 'undefined') {
    for (const k in RL) {
      if (k.startsWith(lower + '|') || k.includes('|') && k.split('|')[0] === lower) return true;
    }
  }
  // Without "by Brand", we can't build a reliable Amazon search URL — bail
  // and render as plain bold so we don't drop links in random places.
  return false;
}

// ═══════════════ HARD PAYWALL MODAL (free trial exhausted) ═══════════════
// Shown when the user has used all FREE_LIMIT queries. Overlays the current
// screen with a Premium CTA so the subscription prompt can't be missed.
// Modal-vs-search arbitration: if the user is actively using the global
// search overlay, defer the paywall/email gate until they close it (queued
// in _pendingModal and flushed by closeGlobalSearch).
function _searchOverlayOpen() {
  const ov = document.getElementById('gs-overlay');
  return !!(ov && ov.classList.contains('open'));
}
let _pendingModal = null; // { type: 'paywall'|'email_gate', trigger }
function _queueModal(type, trigger) {
  // Paywall supersedes email gate; don't downgrade a queued paywall.
  if (_pendingModal && _pendingModal.type === 'paywall' && type === 'email_gate') return;
  _pendingModal = { type, trigger };
}
function _flushPendingModal() {
  const p = _pendingModal;
  if (!p) return;
  _pendingModal = null;
  if (p.type === 'paywall') { try { openPaywallModal(p.trigger); } catch {} }
  else if (p.type === 'email_gate') { try { openEmailGate(p.trigger); } catch {} }
}
let _paywallOpen = false;
function openPaywallModal(trigger) {
  if (_paywallOpen) return;
  if (isPaid || isOwner) return;
  if (_searchOverlayOpen()) { _queueModal('paywall', trigger); return; }
  _paywallOpen = true;
  try { _closeEmailGate(); } catch {}
  try { trackFunnel('paywall_modal_shown', { free_used: freeUsed, trigger: trigger || 'auto' }); } catch {}
  if (typeof gtag === 'function') gtag('event', 'paywall_modal_shown', { trigger: trigger || 'auto' });
  const overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.id = 'sw-paywall-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'sw-pw-title');
  overlay.innerHTML = `<div class="gate-card">
    <button type="button" class="gate-close" aria-label="Close" onclick="closePaywallModal()">&#215;</button>
    <div class="gate-kicker">&#10022; Free trial complete</div>
    <h3 id="sw-pw-title">You've used your <em>3 free queries</em></h3>
    <p class="gate-sub">Go Premium to keep your AI advisor — unlimited style scans, dupes, zodiac matches, and scent-profile memory, all for less than a coffee.</p>
    <div class="gate-choices" style="grid-template-columns:1fr">
      <div class="gate-choice is-premium">
        <span class="gate-choice-badge">Best value</span>
        <div class="gate-choice-title">&#10022; ScentWise Premium</div>
        <div class="gate-choice-price"><strong>$2.99/mo</strong> &middot; cancel anytime</div>
        <ul>
          <li><span class="check">&#10003;</span> <strong>500</strong> AI queries per month</li>
          <li><span class="check">&#10003;</span> All 6 discovery modes, no limits</li>
          <li><span class="check">&#10003;</span> Dupe finder, photo &amp; style scan</li>
          <li><span class="check">&#10003;</span> Personal scent-profile memory</li>
        </ul>
        <button type="button" class="gate-btn-premium" onclick="paywallGoPremium()">Go Premium &rarr;</button>
      </div>
    </div>
    <button type="button" class="gate-skip" onclick="closePaywallModal()">Maybe later</button>
    <p class="gate-priv">Already subscribed? <a onclick="closePaywallModal(); go('account')">Log in with your email</a> &middot; <a href="/refund.html" target="_blank" rel="noopener">Refund policy</a></p>
  </div>`;
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closePaywallModal();
  });
  document.body.appendChild(overlay);
}

function closePaywallModal() {
  const ov = document.getElementById('sw-paywall-modal');
  if (ov) ov.remove();
  _paywallOpen = false;
}

function paywallGoPremium() {
  try { trackFunnel('paywall_modal_go_premium', { free_used: freeUsed }); } catch {}
  if (typeof gtag === 'function') gtag('event', 'paywall_modal_go_premium');
  closePaywallModal();
  try { unlockPaid(); } catch {}
}

// ═══════════════ EMAIL GATE (post-query-1 soft capture) ═══════════════
// Gate policy: 1 full free response, then 2 more teased unless the user drops their
// email. Email unlocks the next 2 at full fidelity; the hard paywall still kicks in
// at FREE_LIMIT. Backed server-side by the sw_email HMAC cookie via /api/subscribe.
let _gateOpen = false;
function openEmailGate(trigger) {
  if (_gateOpen) return;
  if (isPaid || isOwner || emailGiven) return;
  if (_searchOverlayOpen()) { _queueModal('email_gate', trigger); return; }
  _gateOpen = true;
  trackFunnel('email_gate_shown', { free_used: freeUsed, trigger: trigger || 'auto' });
  const overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.id = 'sw-email-gate';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'sw-gate-title');
  overlay.innerHTML = `<div class="gate-card">
    <button type="button" class="gate-close" aria-label="Close" onclick="skipEmailGate()">&#215;</button>
    <div class="gate-kicker">&#10022; You're seeing 2 of your picks</div>
    <h3 id="sw-gate-title">Unlock the rest of your <em>matches</em></h3>
    <p class="gate-sub">Pick how you want to see the full list — notes, scores, dupes. No credit card for the free option.</p>
    <div class="gate-choices">
      <div class="gate-choice is-email">
        <div class="gate-choice-title">&#9993;&#65039; Share your email</div>
        <div class="gate-choice-price"><strong>Free</strong> &middot; 2 more picks</div>
        <ul>
          <li><span class="check">&#10003;</span> Full detail on remaining free picks</li>
          <li><span class="check">&#10003;</span> Weekly curated drops</li>
          <li><span class="check">&#10003;</span> Unsubscribe anytime</li>
        </ul>
        <form id="sw-gate-form" onsubmit="return submitEmailGate(event)">
          <input type="email" id="sw-gate-email" placeholder="you@example.com" required aria-label="Your email" autocomplete="email">
          <button type="submit" class="gate-btn-primary" id="sw-gate-btn">Unlock with Email</button>
          <div class="gate-err" id="sw-gate-err" aria-live="polite"></div>
        </form>
      </div>
      <div class="gate-choice is-premium">
        <span class="gate-choice-badge">Best value</span>
        <div class="gate-choice-title">&#10022; Go Premium</div>
        <div class="gate-choice-price"><strong>$2.99/mo</strong> &middot; cancel anytime</div>
        <ul>
          <li><span class="check">&#10003;</span> Unlock <strong>everything</strong> instantly</li>
          <li><span class="check">&#10003;</span> 500 AI queries per month</li>
          <li><span class="check">&#10003;</span> All 7 discovery modes, no limits</li>
        </ul>
        <button type="button" class="gate-btn-premium" onclick="gateGoPremium()">Go Premium &rarr;</button>
      </div>
    </div>
    <button type="button" class="gate-skip" onclick="skipEmailGate()">Maybe later &mdash; continue with the limited view</button>
    <p class="gate-priv">Privacy-first. We'll only email scent drops &mdash; see our <a href="/privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p>
  </div>`;
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) skipEmailGate();
  });
  document.body.appendChild(overlay);
  setTimeout(() => { const inp = document.getElementById('sw-gate-email'); if (inp) inp.focus(); }, 80);
}

function _closeEmailGate() {
  const ov = document.getElementById('sw-email-gate');
  if (ov) ov.remove();
  _gateOpen = false;
}

function skipEmailGate() {
  trackFunnel('email_gate_skipped', { free_used: freeUsed });
  _closeEmailGate();
}

function gateGoPremium() {
  trackFunnel('email_gate_go_premium', { free_used: freeUsed });
  if (typeof gtag === 'function') gtag('event', 'email_gate_go_premium', { free_used: freeUsed });
  _closeEmailGate();
  try { unlockPaid(); } catch {}
}

async function submitEmailGate(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('sw-gate-email');
  const btn = document.getElementById('sw-gate-btn');
  const err = document.getElementById('sw-gate-err');
  const email = input ? input.value.trim() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (err) err.textContent = 'Please enter a valid email address.';
    return false;
  }
  if (err) err.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Unlocking…'; }
  try {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ScentWise' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, action: 'gate' })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (err) err.textContent = d.error || 'Something went wrong. Please try again.';
      if (btn) { btn.disabled = false; btn.textContent = 'Unlock My Matches'; }
      return false;
    }
    emailGiven = true;
    trackFunnel('email_gate_submitted', { free_used: freeUsed });
    if (typeof gtag === 'function') gtag('event', 'email_captured', { method: 'gate' });
    showToast('Unlocked — your next picks will be shown in full.', 'success');
    _closeEmailGate();
  } catch {
    if (err) err.textContent = 'Network error — please try again.';
    if (btn) { btn.disabled = false; btn.textContent = 'Unlock My Matches'; }
  }
  return false;
}

// Split an AI response at the 3rd (or later) numbered fragrance marker so the
// first 2 picks render clearly and the rest gets blurred behind a CTA.
function _splitTeaser(text) {
  if (!text) return { visible: '', hidden: '' };
  // Match the start of a 3+ numbered item on its own line: "\n3. ", "\n10. ", etc.
  const m = text.match(/\n\s*(?:[3-9]|[1-9]\d+)\.\s/);
  if (!m) return { visible: text, hidden: '' };
  const cut = m.index;
  return { visible: text.slice(0, cut), hidden: text.slice(cut + 1) };
}

function fmtAi(text, isTeaser) {
  if (!isTeaser) return fmt(text);
  const { visible, hidden } = _splitTeaser(text);
  if (!hidden) return fmt(visible);
  const cta = `<div class="teaser-cta">
    <div class="teaser-kicker">&#10022; 3 more picks locked</div>
    <div class="teaser-title">Drop your email to see the rest</div>
    <div class="teaser-sub">The full breakdown — notes, scores, dupes — for your remaining matches. No spam, unsubscribe anytime.</div>
    <button type="button" class="teaser-btn" onclick="openEmailGate('teaser')">Unlock Full Picks</button>
    <button type="button" class="teaser-skip" onclick="unlockPaid()">Or go Premium for unlimited access</button>
  </div>`;
  return fmt(visible) + `<div class="teaser-locked"><div class="teaser-blur" aria-hidden="true">${fmt(hidden)}</div>${cta}</div>`;
}

function fmt(text) {
  const _seenFrags = new Set();
  let s = esc(text)
    .replace(/\*\*(.+?)\*\*/g, function(_, name) {
      if (name.startsWith('Oops') || name.startsWith('Something') || name.startsWith('Connection')) {
        return `<strong style="color:var(--g)">${name}</strong>`;
      }
      if (!_isLikelyFragrance(name)) {
        return `<strong style="color:var(--g)">${name}</strong>`;
      }
      const key = name.toLowerCase();
      if (_seenFrags.has(key)) {
        return `<strong style="color:var(--g)" data-frag="${name}">${name}</strong>`;
      }
      _seenFrags.add(key);
      const isLiked = _likedFrags.has(key + '_up');
      const heartColor = isLiked ? '#f56565' : 'rgba(201,169,110,.4)';
      const heartChar = isLiked ? '&#9829;' : '&#9825;';
      const heartTitle = isLiked ? 'Click to unlike' : 'Love this fragrance';
      const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const byMatch = name.match(/^(.+?)\s+by\s+(.+)$/i);
      const fragName = byMatch ? byMatch[1] : name;
      const fragBrand = byMatch ? byMatch[2] : '';
      const amzUrl = amazonLink(fragName, fragBrand);
      const cmpDataName = fragName.replace(/"/g, '&quot;').replace(/'/g, "&#39;");
      const cmpDataBrand = fragBrand.replace(/"/g, '&quot;').replace(/'/g, "&#39;");
      return `<strong style="color:var(--g)" data-frag="${name}">${name}</strong><span class="frag-actions" style="display:inline-flex;gap:2px;margin-left:4px;vertical-align:middle"><button onclick="likeFragrance('${safeName}',true,this)" title="${heartTitle}" style="background:none;border:none;cursor:pointer;font-size:18px;color:${heartColor};padding:6px;line-height:1;transition:color .2s;opacity:${isLiked ? '1' : '.6'}" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='${isLiked ? '1' : '.6'}'">${heartChar}</button>${!isLiked ? `<button onclick="likeFragrance('${safeName}',false,this.previousElementSibling);this.style.display='none'" title="Not for me" style="background:none;border:none;cursor:pointer;font-size:15px;color:rgba(255,255,255,.25);padding:6px;line-height:1;opacity:.5;transition:opacity .2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.5'">&#10005;</button>` : ''}</span><br><span style="display:inline-flex;flex-wrap:wrap;gap:6px;margin:6px 0;align-items:center"><a href="${amzUrl}" target="_blank" rel="noopener noreferrer" title="Shop on Amazon" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#f90;padding:8px 14px;border-radius:10px;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.15);text-decoration:none;transition:background .2s;min-height:36px" onmouseover="this.style.background='rgba(255,153,0,.18)'" onmouseout="this.style.background='rgba(255,153,0,.08)'">Shop on Amazon</a><button type="button" class="cmp-btn" data-cmp-name="${cmpDataName}" data-cmp-brand="${cmpDataBrand}" title="Add to compare" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--gd);padding:8px 14px;border-radius:10px;background:var(--gl);border:1px solid rgba(201,169,110,.22);cursor:pointer;transition:background .2s;min-height:36px;font-family:inherit" onmouseover="this.style.background='rgba(201,169,110,.18)'" onmouseout="this.style.background='var(--gl)'">+ Compare</button></span>`;
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

  // Fallback: Add Amazon links for numbered recommendations without bold formatting
  // Matches patterns like: "1. Fragrance Name by Brand —" or "1. Fragrance Name by Brand -"
  s = s.replace(/(\d+\.\s+)(?!<strong)([A-Z][^<\n—\-]{2,60}?)\s+by\s+([A-Z][^<\n—\-]{2,40}?)(\s*[—\-])/g, function(_, num, fragName, brand, dash) {
    const fallbackKey = (fragName.trim() + '|' + brand.trim()).toLowerCase();
    if (_seenFrags.has(fallbackKey)) {
      return num + '<strong style="color:var(--g)">' + fragName + '</strong> by ' + brand + dash;
    }
    _seenFrags.add(fallbackKey);
    const url = amazonLink(fragName.trim(), brand.trim());
    const cmpN = fragName.trim().replace(/"/g, '&quot;').replace(/'/g, "&#39;");
    const cmpB = brand.trim().replace(/"/g, '&quot;').replace(/'/g, "&#39;");
    return num + '<strong style="color:var(--g)">' + fragName + '</strong> by ' + brand + ' <a href="' + url + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#f90;padding:8px 14px;margin-left:4px;border-radius:10px;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.12);text-decoration:none;transition:background .2s;min-height:36px" onmouseover="this.style.background=\'rgba(255,153,0,.18)\'" onmouseout="this.style.background=\'rgba(255,153,0,.08)\'">Amazon</a> <button type="button" class="cmp-btn" data-cmp-name="' + cmpN + '" data-cmp-brand="' + cmpB + '" title="Add to compare" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--gd);padding:8px 14px;margin-left:2px;border-radius:10px;background:var(--gl);border:1px solid rgba(201,169,110,.22);cursor:pointer;transition:background .2s;min-height:36px;font-family:inherit" onmouseover="this.style.background=\'rgba(201,169,110,.18)\'" onmouseout="this.style.background=\'var(--gl)\'">+ Compare</button>' + dash;
  });

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
  const gender = esc(p.gender||p.g||'');
  const rating = p.rating||p.r;
  const notes = p.notes||p.t;
  const accords = p.accords||p.a;
  return `<div class="pcard" data-cat="${cat}" data-name="${name}" data-brand="${brand}">
    <div class="pc-top">
      <div class="pc-thumb" style="background:${bg}"><span class="pc-letter">${letter}</span></div>
      <div class="pc-head">
        <div class="pc-title-row">
          <div class="pc-title">
            <div class="pc-name">${name}</div>
            ${brand ? `<div class="pc-brand">${brand}</div>` : ''}
          </div>
          <button class="heart-btn" data-heart-name="${safeName}" data-heart-brand="${brand.replace(/'/g, "&#39;")}" title="${isLiked ? 'Saved — click to remove' : 'Save to favorites'}" aria-pressed="${isLiked}" style="color:${heartColor}">${heartChar}</button>
        </div>
        <div class="pc-meta">
          ${cat ? `<span class="pc-chip">${cat}</span>` : ''}
          ${gender ? `<span class="pc-chip pc-chip-soft">${gender}</span>` : ''}
          ${rating ? `<span class="pc-chip pc-chip-rating" aria-label="Rating ${rating} out of 5">★ ${rating}</span>` : ''}
        </div>
      </div>
    </div>
    ${notes ? `<div class="pc-row"><span class="pc-label">Notes</span><span class="pc-value">${esc(notes)}</span></div>` : ''}
    ${accords ? `<div class="pc-row"><span class="pc-label">Accords</span><span class="pc-value">${esc(accords)}</span></div>` : ''}
    <div class="pc-profile-wrap" data-profile-name="${safeName}" data-profile-brand="${brand.replace(/'/g, "&#39;")}"></div>
    <div class="pc-actions">
      <a class="pc-btn pc-btn-shop" href="${amazonLink(p.name||p.n, p.brand||p.b)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Shop on Amazon</a>
      <button class="pc-btn pc-btn-compare cmp-btn" data-cmp-name="${safeName}" data-cmp-brand="${brand.replace(/'/g, "&#39;")}">+ Compare</button>
      <button class="pc-btn pc-btn-profile prof-btn" data-prof-name="${safeName}" data-prof-brand="${brand.replace(/'/g, "&#39;")}" type="button">Scent profile</button>
    </div>
  </div>`;
}

function loadCelebImages(container) {
  if (!container) return;
  const rows = container.querySelectorAll('.celeb-frag:not([data-img-loaded])');
  rows.forEach(row => {
    row.dataset.imgLoaded = '1';
    const name = row.dataset.celebName || '';
    const brand = row.dataset.celebBrand || '';
    if (!name) return;
    fetchImg(name + ' ' + brand + ' perfume', 1, name, brand).then(imgs => {
      if (!imgs || !imgs[0] || !imgs[0].thumb) return;
      const thumb = row.querySelector('.celeb-thumb');
      if (!thumb) return;
      const img = document.createElement('img');
      img.src = imgs[0].thumb;
      img.alt = name;
      img.loading = 'lazy';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s';
      img.onload = function() { this.style.opacity = '1'; };
      img.onerror = function() { this.remove(); };
      thumb.appendChild(img);
    });
  });
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
      if (imgs[0] && imgs[0].thumb) {
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
  {name:"Rihanna",img:"R",frags:["Love, Don't Be Shy|Kilian","Oud Silk Mood|Maison Francis Kurkdjian","Tobacco Vanille|Tom Ford"]},
  {name:"David Beckham",img:"D",frags:["Dior Homme Intense|Dior","Silver Mountain Water|Creed","Bleu de Chanel|Chanel"]},
  {name:"Zendaya",img:"Z",frags:["Idôle|Lancôme","Black Opium|YSL","Flowerbomb|Viktor&Rolf"]},
  {name:"Johnny Depp",img:"J",frags:["Sauvage|Dior","Sauvage Elixir|Dior"]},
  {name:"Ariana Grande",img:"A",frags:["Cloud|Ariana Grande","R.E.M.|Ariana Grande","God Is A Woman|Ariana Grande"]},
  {name:"Brad Pitt",img:"B",frags:["Chanel No. 5|Chanel","Le Labo Santal 33|Le Labo"]},
  {name:"Beyoncé",img:"B",frags:["Love, Don't Be Shy|Kilian","Soleil Blanc|Tom Ford","Coco Mademoiselle|Chanel"]},
  {name:"Harry Styles",img:"H",frags:["Bleu de Chanel|Chanel","Tobacco Vanille|Tom Ford","Mémoire d'une Odeur|Gucci"]},
  {name:"Jennifer Aniston",img:"J",frags:["Chanel No. 5|Chanel","Neroli Portofino|Tom Ford"]},
  {name:"Travis Scott",img:"T",frags:["Sauvage|Dior","Aventus|Creed","Oud Wood|Tom Ford"]},
  {name:"Billie Eilish",img:"B",frags:["Eilish|Billie Eilish","Glossier You|Glossier","Another 13|Le Labo"]},
  {name:"Ryan Reynolds",img:"R",frags:["Armani Code|Giorgio Armani","Bleu de Chanel|Chanel"]},
  {name:"Dua Lipa",img:"D",frags:["Libre|YSL","Crystal Noir|Versace","Alien|Mugler"]},
  {name:"The Weeknd",img:"T",frags:["Tuscan Leather|Tom Ford","Fahrenheit|Dior","Angels' Share|Kilian"]},
  {name:"Taylor Swift",img:"T",frags:["Flowerbomb|Viktor&Rolf","Santal Blush|Tom Ford","Santal 33|Le Labo"]},
  {name:"Drake",img:"D",frags:["Aventus|Creed","Tobacco Vanille|Tom Ford","Baccarat Rouge 540|Maison Francis Kurkdjian"]},
  {name:"Margot Robbie",img:"M",frags:["Gabrielle|Chanel","Mon Guerlain|Guerlain"]},
  {name:"LeBron James",img:"L",frags:["Aventus|Creed","Oud Wood|Tom Ford"]},
  {name:"Gigi Hadid",img:"G",frags:["Bal d'Afrique|Byredo","Daisy|Marc Jacobs","Soleil Blanc|Tom Ford"]},
  {name:"Cristiano Ronaldo",img:"C",frags:["CR7|Cristiano Ronaldo","Acqua di Gio|Giorgio Armani","Invictus|Paco Rabanne"]},
  {name:"Kendall Jenner",img:"K",frags:["Santal 33|Le Labo","Gypsy Water|Byredo"]},
  {name:"Jay-Z",img:"J",frags:["Tom Ford Noir|Tom Ford","Green Irish Tweed|Creed","Scent of Peace|Bond No. 9"]},
  {name:"Hailey Bieber",img:"H",frags:["Mixed Emotions|Byredo","Dedcool 01|Dedcool","Lust in Paradise|Ex Nihilo"]},
  {name:"Justin Bieber",img:"J",frags:["Aventus|Creed","Sauvage|Dior","Grey Vetiver|Tom Ford"]},
  {name:"Selena Gomez",img:"S",frags:["Daisy|Marc Jacobs","Cloud|Ariana Grande"]},
  {name:"Kanye West",img:"K",frags:["Aventus|Creed","Santal 33|Le Labo","Jazz Club|Maison Margiela"]},
  {name:"Timothée Chalamet",img:"T",frags:["Bleu de Chanel|Chanel","Thé Noir 29|Le Labo"]},
  {name:"Scarlett Johansson",img:"S",frags:["The One|Dolce & Gabbana","Black Orchid|Tom Ford"]},
  {name:"Post Malone",img:"P",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Tobacco Vanille|Tom Ford"]},
  {name:"Emma Watson",img:"E",frags:["Trésor Midnight Rose|Lancôme","Coco Mademoiselle|Chanel"]},
  {name:"Bad Bunny",img:"B",frags:["Sauvage|Dior","Le Male|Jean Paul Gaultier","1 Million|Paco Rabanne"]},
  {name:"Chris Hemsworth",img:"C",frags:["Man Wood Essence|Bvlgari","Boss Bottled|Hugo Boss"]},
  {name:"Lady Gaga",img:"L",frags:["Black Orchid|Tom Ford","Flowerbomb|Viktor&Rolf"]},
  {name:"ASAP Rocky",img:"A",frags:["Bal d'Afrique|Byredo","Tobacco Vanille|Tom Ford","Jazz Club|Maison Margiela"]},
  {name:"Jennie Kim",img:"J",frags:["Chanel No. 5 L'Eau|Chanel","Gypsy Water|Byredo","Coco Mademoiselle|Chanel"]},
  {name:"David Harbour",img:"D",frags:["Oud Wood|Tom Ford","Viking|Creed"]},
  {name:"Rosé",img:"R",frags:["Tiffany & Co EDP|Tiffany","Mon Paris|YSL"]},
  {name:"Jacob Elordi",img:"J",frags:["Bleu de Chanel|Chanel","Noir Extreme|Tom Ford"]},
  {name:"Sydney Sweeney",img:"S",frags:["My Way|Giorgio Armani","La Vie Est Belle|Lancôme"]},
  {name:"Michael B. Jordan",img:"M",frags:["Aventus|Creed","Coach for Men|Coach"]},
  {name:"Bella Hadid",img:"B",frags:["Côte d'Azur|Oribe","Mojave Ghost|Byredo","Dedcool 01|Dedcool"]},
  {name:"Tom Holland",img:"T",frags:["Bleu de Chanel|Chanel","Acqua di Gio|Giorgio Armani"]},
  {name:"Olivia Rodrigo",img:"O",frags:["Glossier You|Glossier","Cloud|Ariana Grande"]},
  {name:"Idris Elba",img:"I",frags:["Oud Wood|Tom Ford","Aventus|Creed"]},
  {name:"Megan Fox",img:"M",frags:["Armani Privé|Giorgio Armani","Alien|Mugler","Black Orchid|Tom Ford"]},
  {name:"Jason Momoa",img:"J",frags:["Acqua di Gio Profumo|Giorgio Armani","Layton|Parfums de Marly"]},
  {name:"Cardi B",img:"C",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Good Girl|Carolina Herrera"]},
  {name:"Chris Evans",img:"C",frags:["Bleu de Chanel|Chanel","Aventus|Creed"]},
  {name:"Kim Kardashian",img:"K",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Crystal Gardenia|KKW","Santal 33|Le Labo"]},
  {name:"Tom Cruise",img:"T",frags:["Green Irish Tweed|Creed","Black Afgano|Nasomatto"]},
  {name:"Natalie Portman",img:"N",frags:["Miss Dior|Dior","Chanel No. 5|Chanel"]},
  {name:"Leonardo DiCaprio",img:"L",frags:["Acqua di Gio|Giorgio Armani","Green Irish Tweed|Creed"]},
  {name:"Angelina Jolie",img:"A",frags:["Mon Guerlain|Guerlain","Shalimar|Guerlain"]},
  {name:"Will Smith",img:"W",frags:["Creed Aventus|Creed","Dior Homme|Dior"]},
  {name:"Charlize Theron",img:"C",frags:["J'adore|Dior","Chanel No. 5|Chanel"]},
  {name:"Robert Downey Jr.",img:"R",frags:["Oud Wood|Tom Ford","Aventus|Creed"]},
  {name:"Jennifer Lopez",img:"J",frags:["Glow|Jennifer Lopez","Promise|Jennifer Lopez","Still|Jennifer Lopez"]},
  {name:"Zayn Malik",img:"Z",frags:["Versace Eros|Versace","Bleu de Chanel|Chanel"]},
  {name:"Kylie Jenner",img:"K",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Santal 33|Le Labo","Delina|Parfums de Marly"]},
  {name:"Keanu Reeves",img:"K",frags:["Acqua di Gio|Giorgio Armani","Oud Wood|Tom Ford"]},
  {name:"Nicole Kidman",img:"N",frags:["Chanel No. 5|Chanel","J'adore|Dior"]},
  {name:"George Clooney",img:"G",frags:["Casamorati 1888|Xerjoff","Green Irish Tweed|Creed"]},
  {name:"Anne Hathaway",img:"A",frags:["Lancôme Idôle|Lancôme","Coco Mademoiselle|Chanel"]},
  {name:"Pedro Pascal",img:"P",frags:["Bleu de Chanel|Chanel","Terre d'Hermès|Hermès"]},
  {name:"Florence Pugh",img:"F",frags:["Glossier You|Glossier","Jo Malone Wood Sage|Jo Malone"]},
  {name:"Oscar Isaac",img:"O",frags:["Oud Wood|Tom Ford","Tuscan Leather|Tom Ford"]},
  {name:"Ana de Armas",img:"A",frags:["J'adore|Dior","Estée Lauder Beautiful|Estée Lauder"]},
  {name:"Austin Butler",img:"A",frags:["Noir Extreme|Tom Ford","Sauvage Elixir|Dior"]},
  {name:"Anya Taylor-Joy",img:"A",frags:["Flowerbomb Nectar|Viktor&Rolf","Black Opium|YSL"]},
  {name:"Henry Cavill",img:"H",frags:["Chanel Allure Homme Sport|Chanel","Aventus|Creed"]},
  {name:"Doja Cat",img:"D",frags:["Delina|Parfums de Marly","Baccarat Rouge 540|Maison Francis Kurkdjian"]},
  {name:"SZA",img:"S",frags:["Kayali Vanilla 28|Kayali","Another 13|Le Labo"]},
  {name:"Jenna Ortega",img:"J",frags:["Cloud|Ariana Grande","Glossier You|Glossier"]},
  {name:"Paul Mescal",img:"P",frags:["Santal 33|Le Labo","Terre d'Hermès|Hermès"]},
  {name:"Ice Spice",img:"I",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Cloud|Ariana Grande"]},
  {name:"Jungkook",img:"J",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Libre|YSL","Bleu de Chanel|Chanel"]},
  {name:"Blackpink Lisa",img:"B",frags:["Celine Black Tie|Celine","Miss Dior|Dior"]},
  {name:"V (Taehyung)",img:"V",frags:["Blanche|Byredo","Bois d'Argent|Dior"]},
  {name:"Jimin",img:"J",frags:["Mojave Ghost|Byredo","Santal 33|Le Labo"]},
  {name:"Neymar",img:"N",frags:["1 Million|Paco Rabanne","Invictus|Paco Rabanne"]},
  {name:"Lewis Hamilton",img:"L",frags:["Oud Wood|Tom Ford","Aventus|Creed"]},
  {name:"Mbappe",img:"M",frags:["Sauvage|Dior","Y EDP|YSL"]},
  {name:"Elon Musk",img:"E",frags:["Terre d'Hermès|Hermès","Creed Aventus|Creed"]},
  {name:"Oprah Winfrey",img:"O",frags:["Beautiful|Estée Lauder","Chanel No. 5|Chanel"]},
  {name:"Sandra Bullock",img:"S",frags:["Kai|Kai","Le Labo Rose 31|Le Labo"]},
  {name:"Matthew McConaughey",img:"M",frags:["Dolce & Gabbana The One|D&G","Sauvage|Dior"]},
  {name:"Victoria Beckham",img:"V",frags:["Santal 33|Le Labo","Baccarat Rouge 540|Maison Francis Kurkdjian"]},
  {name:"Priyanka Chopra",img:"P",frags:["Trussardi Donna|Trussardi","Bulgari Omnia|Bvlgari"]},
  {name:"Shakira",img:"S",frags:["S by Shakira|Shakira","Dance|Shakira"]},
  {name:"Pharrell Williams",img:"P",frags:["Girl|Comme des Garcons","Bleu de Chanel|Chanel"]},
  {name:"Lizzo",img:"L",frags:["Baccarat Rouge 540|Maison Francis Kurkdjian","Good Girl|Carolina Herrera"]},
  {name:"Lana Del Rey",img:"L",frags:["Chanel No. 5|Chanel","Black Opium|YSL","Replica By the Fireplace|Maison Margiela"]},
  {name:"Tyler, The Creator",img:"T",frags:["French Waltz|Matiere Premiere","Santal 33|Le Labo","Tobacco Vanille|Tom Ford"]},
  {name:"Frank Ocean",img:"F",frags:["Comme des Garcons 2|CDG","Terre d'Hermès|Hermès"]},
  {name:"Daniel Craig",img:"D",frags:["Aventus|Creed","Tom Ford Noir|Tom Ford"]},
  {name:"Salma Hayek",img:"S",frags:["Opium|YSL","Black Orchid|Tom Ford"]},
  {name:"Chris Pratt",img:"C",frags:["Bleu de Chanel|Chanel","Sauvage|Dior"]},
  {name:"Lupita Nyong'o",img:"L",frags:["Lancôme La Vie Est Belle|Lancôme","J'adore|Dior"]},
  {name:"Lenny Kravitz",img:"L",frags:["Oud Wood|Tom Ford","Jazz Club|Maison Margiela","Tobacco Vanille|Tom Ford"]},
  {name:"Sabrina Carpenter",img:"S",frags:["Cloud|Ariana Grande","Mon Paris|YSL","Delina|Parfums de Marly"]},
  {name:"Chappell Roan",img:"C",frags:["Glossier You|Glossier","Replica Bubble Bath|Maison Margiela"]}
];

// ═══════════════ ZODIAC DATA ═══════════════
const ZODIAC = [
  {sign:'Aries',symbol:'♈',dates:'Mar 21 – Apr 19'},
  {sign:'Taurus',symbol:'♉',dates:'Apr 20 – May 20'},
  {sign:'Gemini',symbol:'♊',dates:'May 21 – Jun 20'},
  {sign:'Cancer',symbol:'♋',dates:'Jun 21 – Jul 22'},
  {sign:'Leo',symbol:'♌',dates:'Jul 23 – Aug 22'},
  {sign:'Virgo',symbol:'♍',dates:'Aug 23 – Sep 22'},
  {sign:'Libra',symbol:'♎',dates:'Sep 23 – Oct 22'},
  {sign:'Scorpio',symbol:'♏',dates:'Oct 23 – Nov 21'},
  {sign:'Sagittarius',symbol:'♐',dates:'Nov 22 – Dec 21'},
  {sign:'Capricorn',symbol:'♑',dates:'Dec 22 – Jan 19'},
  {sign:'Aquarius',symbol:'♒',dates:'Jan 20 – Feb 18'},
  {sign:'Pisces',symbol:'♓',dates:'Feb 19 – Mar 20'}
];

const GENRES = [
  {name:'Hip-Hop / Rap',desc:'Bold, confident, street-smart'},
  {name:'R&B / Soul',desc:'Smooth, sensual, warm'},
  {name:'Pop',desc:'Fresh, fun, versatile'},
  {name:'Rock / Alternative',desc:'Edgy, raw, independent'},
  {name:'Electronic / EDM',desc:'Futuristic, energetic, bold'},
  {name:'Jazz / Blues',desc:'Sophisticated, deep, timeless'},
  {name:'Classical',desc:'Elegant, refined, complex'},
  {name:'Country',desc:'Earthy, authentic, warm'},
  {name:'Indie / Folk',desc:'Natural, artistic, unique'},
  {name:'Latin / Reggaeton',desc:'Passionate, vibrant, warm'},
  {name:'K-Pop',desc:'Trendy, sweet, playful'},
  {name:'Metal / Punk',desc:'Intense, dark, powerful'}
];

const STYLES = [
  {name:'Streetwear',desc:'Urban, bold, hype culture'},
  {name:'Minimalist',desc:'Clean, simple, refined'},
  {name:'Preppy / Classic',desc:'Polished, traditional, smart'},
  {name:'Bohemian',desc:'Free-spirited, earthy, artistic'},
  {name:'Sporty / Athleisure',desc:'Active, fresh, dynamic'},
  {name:'Goth / Dark',desc:'Mysterious, dark, dramatic'},
  {name:'Luxury / High Fashion',desc:'Opulent, statement, exclusive'},
  {name:'Casual / Everyday',desc:'Relaxed, comfortable, easygoing'},
  {name:'Vintage / Retro',desc:'Nostalgic, unique, timeless'},
  {name:'Edgy / Punk',desc:'Rebellious, raw, bold'},
  {name:'Romantic / Feminine',desc:'Soft, elegant, graceful'},
  {name:'Techwear / Futuristic',desc:'Modern, functional, sci-fi'}
];

const DUPES = [
  {name:'Baccarat Rouge 540',desc:'MFK · ~$325'},
  {name:'Aventus',desc:'Creed · ~$445'},
  {name:'Lost Cherry',desc:'Tom Ford · ~$390'},
  {name:'Oud Wood',desc:'Tom Ford · ~$285'},
  {name:'Bleu de Chanel',desc:'Chanel · ~$165'},
  {name:'Black Opium',desc:'YSL · ~$140'},
  {name:'Delina',desc:'Parfums de Marly · ~$335'},
  {name:'Santal 33',desc:'Le Labo · ~$310'},
  {name:'La Vie Est Belle',desc:'Lancôme · ~$105'},
  {name:'Sauvage',desc:'Dior · ~$115'},
  {name:'Tobacco Vanille',desc:'Tom Ford · ~$285'},
  {name:'Good Girl',desc:'Carolina Herrera · ~$110'}
];

// ═══════════════ STATE ═══════════════
// localStorage helpers for chat persistence (survives tab close for return visits)
function _ss(k) { try { return JSON.parse(localStorage.getItem('sw_'+k)); } catch { try { return JSON.parse(sessionStorage.getItem('sw_'+k)); } catch { return null; } } }
function _ssw(k,v) { try { localStorage.setItem('sw_'+k, JSON.stringify(v)); } catch { try { sessionStorage.setItem('sw_'+k, JSON.stringify(v)); } catch {} } }

let CP = 'home';
let chatMsgs = _ss('chatMsgs') || [], chatLoad = false, _chatShouldScroll = false, _chatScrollToLast = false;
let photoB64 = null, photoPrev = null, photoRes = _ss('photoRes') || '', photoLoad = false;
let selZ = _ss('selZ'), zodiacRes = _ss('zodiacRes') || '', zodiacLoad = false, zodiacChat = _ss('zodiacChat') || [], zodiacChatLoad = false;
let selM = _ss('selM'), musicRes = _ss('musicRes') || '', musicLoad = false, musicChat = _ss('musicChat') || [], musicChatLoad = false;
let selS = _ss('selS'), styleRes = _ss('styleRes') || '', styleLoad = false, styleChat = _ss('styleChat') || [], styleChatLoad = false;
let selD = _ss('selD'), dupeRes = _ss('dupeRes') || '', dupeLoad = false, dupeChat = _ss('dupeChat') || [], dupeChatLoad = false;
let photoChat = _ss('photoChat') || [], photoChatLoad = false;
// Per-mode teaser flags: persisted alongside the response so reloads keep the blur in place.
let photoTeaser = _ss('photoTeaser') || false;
let zodiacTeaser = _ss('zodiacTeaser') || false;
let musicTeaser = _ss('musicTeaser') || false;
let styleTeaser = _ss('styleTeaser') || false;
let dupeTeaser = _ss('dupeTeaser') || false;
let celebQ = '';
let expQ = '', expFilter = 'all', expResults = [];
let _compareList = []; // max 3 perfumes for comparison
const _CMP_KEY = 'sw_compare_v1';
try { const d = JSON.parse(localStorage.getItem(_CMP_KEY)); if (Array.isArray(d)) _compareList = d.slice(0, 3).map(x => ({ name: String(x.name||''), brand: String(x.brand||''), data: null })); } catch {}
function _saveCompareList() { try { localStorage.setItem(_CMP_KEY, JSON.stringify(_compareList.map(c => ({name:c.name, brand:c.brand})))); } catch {} }
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
      ${m.role==='assistant' ? fmtAi(m.content, !!m.teaser) : fmt(m.content)}
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
  {id:'home',l:'Home'},{id:'explore',l:'Explore'},{id:'chat',l:'AI Advisor'},
  {id:'photo',l:'Style Scan'},{id:'zodiac',l:'Zodiac'},{id:'music',l:'Music'},
  {id:'style',l:'Style'},{id:'dupe',l:'Dupes'},{id:'celeb',l:'Celebs'},
  {id:'account',l:'Profile'}
];
// Mobile bottom bar (core tabs)
const MNI = [
  {id:'home',l:'Home'},{id:'explore',l:'Explore'},{id:'chat',l:'AI'},
  {id:'_modes',l:'Modes'},{id:'account',l:'Profile'}
];
// All switchable modes (for the pill bar)
const MODES = [
  {id:'chat',l:'AI Advisor'},{id:'explore',l:'Explore'},
  {id:'photo',l:'Photo Scan'},{id:'zodiac',l:'Zodiac'},
  {id:'music',l:'Music'},{id:'style',l:'Style'},
  {id:'dupe',l:'Dupe Finder'},{id:'celeb',l:'Celebs'}
];

function rNav() {
  document.getElementById('nav').innerHTML = NI.map(n =>
    `<a href="#" class="ni ${CP===n.id?'na':''}" onclick="event.preventDefault();go('${n.id}')" role="tab" tabindex="0" aria-selected="${CP===n.id}" aria-label="${n.l}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();go('${n.id}')}">${n.l}</a>`
  ).join('');
  const mobEl = document.getElementById('mob-nav');
  if (mobEl) {
    const modePages = ['photo','zodiac','music','style','dupe','celeb'];
    mobEl.innerHTML = MNI.map(n => {
      if (n.id === '_modes') {
        const isOnMode = modePages.includes(CP);
        return `<div class="mob-ni ${isOnMode?'mob-na':''}" onclick="openModeSwitcher()" role="tab" tabindex="0" aria-label="Switch discovery mode" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModeSwitcher()}"><span>${n.l}</span></div>`;
      }
      return `<div class="mob-ni ${CP===n.id?'mob-na':''}" onclick="go('${n.id}')" role="tab" tabindex="0" aria-selected="${CP===n.id}" aria-label="${n.l}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();go('${n.id}')}"><span>${n.l}</span></div>`;
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
    `<div class="mode-pill ${CP===m.id?'mp-active':''}" onclick="go('${m.id}')">${m.l}</div>`
  ).join('');
  // Auto-scroll active pill into view (horizontal only, no vertical page scroll)
  setTimeout(() => {
    const active = inner.querySelector('.mp-active');
    if (active && inner.scrollTo) {
      const pillLeft = active.offsetLeft;
      const pillWidth = active.offsetWidth;
      const containerWidth = inner.offsetWidth;
      inner.scrollTo({left: pillLeft - containerWidth / 2 + pillWidth / 2, behavior: 'smooth'});
    }
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
  account: 'Your Profile — ScentWise',
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
  try { updateTrialMeter(); } catch {}
}

// ═══════════════ HERO → CHAT HANDOFF ═══════════════
function heroStart(q) {
  const text = (q || '').trim();
  go('chat');
  if (!text) return;
  // Wait a tick for r_chat() to render, then populate + send
  setTimeout(() => {
    const inp = document.getElementById('c-inp');
    if (inp) inp.value = text;
    try { cSend(text); } catch (e) { console.error('heroStart send failed', e); }
  }, 60);
}
window.heroStart = heroStart;

// Rotate short placeholder prompts on the home hero input so first-time
// visitors see the full range of things they can ask — far better than a
// single static example.
const HERO_PLACEHOLDERS = [
  'Try: a beach day, my first date, Tom Ford but cheaper...',
  'Try: something for a rainy Sunday in a bookstore...',
  'Try: Tom Ford but under $60...',
  'Try: smells like a cozy sweater...',
  'Try: first-date scent, not too loud...',
  'Try: office-safe but not boring...',
  'Try: what would a villain wear?',
  'Try: warm, spicy, winter evenings...',
  'Try: summer, linen shirt, iced coffee...'
];
let _heroPhIdx = 0, _heroPhTimer = null;
function startHeroPlaceholderRotation() {
  const el = document.getElementById('hp-hero-q');
  if (!el) return;
  if (_heroPhTimer) clearInterval(_heroPhTimer);
  _heroPhTimer = setInterval(() => {
    // Stop rotating once the user engages with the field
    if (el !== document.activeElement && !el.value) {
      _heroPhIdx = (_heroPhIdx + 1) % HERO_PLACEHOLDERS.length;
      el.placeholder = HERO_PLACEHOLDERS[_heroPhIdx];
    }
  }, 3200);
}
window.startHeroPlaceholderRotation = startHeroPlaceholderRotation;

// ═══════════════ GLOBAL SEARCH OVERLAY ═══════════════
let _gsActive = -1, _gsResults = [], _gsDebounce = null;
function openGlobalSearch() {
  const ov = document.getElementById('gs-overlay');
  if (!ov) return;
  ov.classList.add('open');
  // Kick off DB load if needed
  if (!_dbLoaded) loadDB().then(() => { if (ov.classList.contains('open')) renderGlobalSearch(); });
  setTimeout(() => document.getElementById('gs-input')?.focus(), 40);
}
function closeGlobalSearch() {
  const ov = document.getElementById('gs-overlay');
  if (!ov) return;
  ov.classList.remove('open');
  const inp = document.getElementById('gs-input');
  if (inp) inp.value = '';
  _gsResults = []; _gsActive = -1;
  try { _flushPendingModal && _flushPendingModal(); } catch {}
}
function renderGlobalSearch() {
  const body = document.getElementById('gs-body');
  const inp = document.getElementById('gs-input');
  if (!body || !inp) return;
  const q = (inp.value || '').trim();
  if (!q) {
    body.innerHTML = `<div class="gs-hint">Start typing to search. Press Enter to open the full results page.</div>
      <div style="padding:0 18px 14px">
        <div style="font-size:11px;color:var(--td);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:10px">Popular searches</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${['Dior Sauvage','Baccarat Rouge 540','Tom Ford','Creed Aventus','Lattafa','Chanel No 5'].map(s => `<button class="fbtn" onclick="document.getElementById('gs-input').value='${s}';renderGlobalSearch()">${s}</button>`).join('')}
        </div>
      </div>`;
    return;
  }
  if (!_dbLoaded) { body.innerHTML = `<div class="gs-hint">Loading fragrance database…</div>`; return; }
  _gsResults = searchDB(q, 8) || [];
  if (_gsResults.length === 0) {
    body.innerHTML = `<div class="gs-hint">No matches for "${esc(q)}". Try a different name or brand.</div>`;
    return;
  }
  _gsActive = 0;
  body.innerHTML = _gsResults.map((p, i) => {
    const name = esc(p.name || p.n);
    const brand = esc(p.brand || p.b || '');
    const cat = esc(p.category || p.c || '');
    const letter = (p.name || p.n || '?').charAt(0).toUpperCase();
    return `<button class="gs-row ${i===0?'active':''}" data-gs-idx="${i}" onclick="pickGlobalSearchResult(${i})">
      <div class="gs-row-letter">${letter}</div>
      <div class="gs-row-meta">
        <div class="gs-row-name">${name}</div>
        <div class="gs-row-sub">${brand}${brand && cat ? ' · ' : ''}${cat}</div>
      </div>
      ${p.gender || p.g ? `<span class="gs-row-tag">${esc(p.gender || p.g)}</span>` : ''}
    </button>`;
  }).join('') + `<div class="gs-footer"><span>${_gsResults.length} of ${(SI && SI.length || 0).toLocaleString()}</span><span>Press Enter for all results</span></div>`;
}
function pickGlobalSearchResult(i) {
  const p = _gsResults[i];
  if (!p) return;
  const name = p.name || p.n;
  closeGlobalSearch();
  expQ = name;
  go('explore');
  setTimeout(() => { try { doExp(); } catch {} }, 80);
}
function gsKeyNav(e) {
  if (!_gsResults.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _gsActive = Math.min(_gsActive + 1, _gsResults.length - 1); _gsUpdateActive(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _gsActive = Math.max(_gsActive - 1, 0); _gsUpdateActive(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (_gsActive >= 0) pickGlobalSearchResult(_gsActive);
    else {
      const q = document.getElementById('gs-input')?.value?.trim();
      if (q) { closeGlobalSearch(); expQ = q; go('explore'); setTimeout(() => { try { doExp(); } catch {} }, 80); }
    }
  }
}
function _gsUpdateActive() {
  document.querySelectorAll('.gs-row').forEach((r, i) => r.classList.toggle('active', i === _gsActive));
  const el = document.querySelector('.gs-row.active');
  if (el && el.scrollIntoView) el.scrollIntoView({block: 'nearest'});
}
window.openGlobalSearch = openGlobalSearch;
window.closeGlobalSearch = closeGlobalSearch;
window.renderGlobalSearch = renderGlobalSearch;
window.pickGlobalSearchResult = pickGlobalSearchResult;

function _bindGlobalSearchInput() {
  const inp = document.getElementById('gs-input');
  if (!inp || inp._gsBound) return;
  inp._gsBound = true;
  inp.addEventListener('input', () => { clearTimeout(_gsDebounce); _gsDebounce = setTimeout(renderGlobalSearch, 120); });
  inp.addEventListener('keydown', gsKeyNav);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bindGlobalSearchInput);
} else {
  _bindGlobalSearchInput();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const ov = document.getElementById('gs-overlay');
    if (ov && ov.classList.contains('open')) { e.preventDefault(); closeGlobalSearch(); }
  } else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
    e.preventDefault();
    openGlobalSearch();
  }
});

// ═══════════════ TRIAL METER IN NAV ═══════════════
function updateTrialMeter() {
  const el = document.getElementById('nav-trial-meter');
  if (!el) return;
  if (isOwner) {
    el.style.display = '';
    el.className = 'nav-meter paid';
    el.textContent = 'Owner · Unlimited';
    return;
  }
  if (isPaid) {
    el.style.display = '';
    el.className = 'nav-meter paid';
    el.textContent = `Premium · ${Math.max(0, MAX_PAID - aiUsage)} of ${MAX_PAID} left`;
    return;
  }
  const left = Math.max(0, FREE_LIMIT - freeUsed);
  el.style.display = '';
  el.className = 'nav-meter' + (left === 0 ? ' spent' : '');
  el.textContent = left === 0 ? 'Free trial used · Upgrade' : `${left} of ${FREE_LIMIT} free AI queries left`;
  el.onclick = left === 0 ? () => { try { unlockPaid(); } catch {} } : null;
  el.style.cursor = left === 0 ? 'pointer' : 'default';
}
window.updateTrialMeter = updateTrialMeter;

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

// Delegated click handler for heart buttons and compare buttons on perfume cards
document.addEventListener('click', function(e) {
  const heart = e.target.closest('.heart-btn');
  if (heart) {
    e.stopPropagation();
    const name = heart.dataset.heartName;
    const brand = (heart.dataset.heartBrand || '').replace(/&#39;/g, "'");
    if (name) likeFragranceCard(name, brand, heart);
    return;
  }
  const cmp = e.target.closest('.cmp-btn');
  if (cmp) {
    e.stopPropagation();
    const name = cmp.dataset.cmpName;
    const brand = (cmp.dataset.cmpBrand || '').replace(/&#39;/g, "'");
    if (name) addToCompare(name, brand);
    return;
  }
  const prof = e.target.closest('.prof-btn');
  if (prof) {
    e.stopPropagation();
    const name = prof.dataset.profName;
    const brand = (prof.dataset.profBrand || '').replace(/&#39;/g, "'");
    if (name) togglePerfCardProfile(prof, name, brand);
    return;
  }
});

async function togglePerfCardProfile(btn, name, brand) {
  const card = btn.closest('.celeb-frag, .pcard');
  if (!card) return;
  const wrap = card.querySelector('.pc-profile-wrap');
  if (!wrap) return;
  if (wrap.dataset.open === '1') {
    wrap.style.display = 'none';
    wrap.dataset.open = '0';
    btn.textContent = 'Scent profile';
    return;
  }
  if (wrap.dataset.loaded === '1') {
    wrap.style.display = '';
    wrap.dataset.open = '1';
    btn.textContent = 'Hide profile';
    return;
  }
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Loading…';
  wrap.style.display = '';
  wrap.innerHTML = '<div style="font-size:12px;color:var(--td);padding:8px 0"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span> <span style="margin-left:6px">Fetching scent profile…</span></div>';
  try {
    const info = await fetchScentProfile(name, brand);
    wrap.innerHTML = renderProfileBadges(info) || '<div style="font-size:12px;color:var(--td);padding:6px 0">Details unavailable.</div>';
    wrap.dataset.loaded = '1';
    wrap.dataset.open = '1';
    btn.textContent = 'Hide profile';
  } catch {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--td);padding:6px 0">Could not load profile.</div>';
    btn.textContent = orig;
  } finally {
    btn.disabled = false;
  }
}

// ═══════════════ FRAGRANCE COMPARISON ═══════════════
function addToCompare(name, brand) {
  const key = (name + '|' + brand).toLowerCase();
  if (_compareList.some(c => (c.name + '|' + c.brand).toLowerCase() === key)) {
    showToast('Already in compare list', 'info');
    return;
  }
  if (_compareList.length >= 3) {
    showToast('Max 3 fragrances — remove one first', 'info');
    return;
  }
  const p = find(name, brand);
  _compareList.push({ name, brand, data: p });
  _saveCompareList();
  _renderCompareBar();
  showToast(`${name} added to compare`, 'success');
}

function removeFromCompare(idx) {
  _compareList.splice(idx, 1);
  _saveCompareList();
  _renderCompareBar();
}

function clearCompare() {
  _compareList = [];
  _saveCompareList();
  _renderCompareBar();
}

function _renderCompareBar() {
  let bar = document.getElementById('compare-bar');
  if (_compareList.length === 0) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'compare-bar';
    bar.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--glass,var(--d2));border:1px solid rgba(201,169,110,.25);border-radius:16px;padding:12px 18px;display:flex;align-items:center;gap:12px;z-index:1000;box-shadow:var(--shadow-lg,0 14px 40px rgba(74,56,24,.18));max-width:calc(100vw - 24px);flex-wrap:wrap;backdrop-filter:blur(12px)';
    document.body.appendChild(bar);
  }
  const ck = document.getElementById('cookie-banner');
  if (ck && ck.offsetParent !== null) {
    bar.style.bottom = (ck.offsetHeight + 80) + 'px';
  } else {
    bar.style.bottom = '70px';
  }
  bar.innerHTML = _compareList.map((c, i) =>
    `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--d3);border:1px solid rgba(201,169,110,.18);border-radius:8px;font-size:12px;color:var(--t)">
      <span style="font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span>
      <button onclick="removeFromCompare(${i})" style="background:none;border:none;color:var(--td);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" aria-label="Remove ${esc(c.name)} from compare">&times;</button>
    </div>`
  ).join('') +
  `<button onclick="showComparison()" class="btn btn-sm" style="font-size:12px;padding:8px 16px;white-space:nowrap" ${_compareList.length < 2 ? 'disabled style="opacity:.5;font-size:12px;padding:8px 16px;white-space:nowrap"' : ''}>Compare ${_compareList.length}/3</button>
   <button onclick="clearCompare()" style="background:none;border:none;color:var(--td);cursor:pointer;font-size:18px;padding:0 4px;line-height:1" title="Clear all">&times;</button>`;
}

// ═══════════════ SHARED SCENT PROFILE (scores + blind-buy) ═══════════════
const _PROFILE_CACHE_KEY = 'sw_scent_profiles_v1';
let _profileCache = (() => { try { return JSON.parse(localStorage.getItem(_PROFILE_CACHE_KEY)) || {}; } catch { return {}; } })();
const _profileInflight = {};
function _profileKey(name, brand) { return ((name||'') + '|' + (brand||'')).toLowerCase().trim(); }
function _saveProfileCache() { try { localStorage.setItem(_PROFILE_CACHE_KEY, JSON.stringify(_profileCache)); } catch {} }

async function fetchScentProfile(name, brand) {
  const k = _profileKey(name, brand);
  if (_profileCache[k]) return _profileCache[k];
  if (_profileInflight[k]) return _profileInflight[k];
  const prompt = `For the fragrance "${name}${brand ? ' by ' + brand : ''}":

Return ONLY a JSON object (no markdown, no code fences, no prose) with these exact keys:
{"longevity":1-5,"projection":1-5,"sillage":1-5,"versatility":1-5,"blindBuyRisk":"Low"|"Medium"|"Test first","blindBuyReason":"one short sentence explaining why","gender":"Male/Female/Unisex","concentration":"EDP/EDT/Parfum/etc","accords":"comma separated","notes":"comma separated top/heart/base notes","rating":1-5 or null}

Base scores on community consensus and typical performance. If the fragrance is unknown, use null for all fields.`;
  const p = (async () => {
    try {
      const raw = await aiCall('chat', { messages: [{ role: 'user', content: prompt }] });
      const jsonStr = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      const info = JSON.parse(jsonStr);
      if (!info || typeof info !== 'object') return null;
      _profileCache[k] = info;
      _saveProfileCache();
      return info;
    } catch { return null; }
    finally { delete _profileInflight[k]; }
  })();
  _profileInflight[k] = p;
  return p;
}

function _scoreBadge(label, score) {
  const n = parseInt(score);
  if (!n || n < 1 || n > 5) return '';
  const pct = (n / 5) * 100;
  const color = n >= 4 ? '#3f7a4e' : n >= 3 ? '#9a7a1e' : '#b93b3b';
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;font-size:11px;background:var(--d3);border:1px solid rgba(201,169,110,.18);color:var(--t)">
    <span style="color:var(--td)">${label}</span>
    <span style="display:inline-block;width:32px;height:4px;border-radius:2px;background:rgba(120,95,40,.12);position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${color};border-radius:2px"></span></span>
    <span style="color:${color};font-weight:700">${n}</span>
  </span>`;
}

function _blindBuyBadge(risk, reason) {
  if (!risk) return '';
  const r = String(risk).toLowerCase();
  const palette = r.startsWith('low')
    ? { bg: 'rgba(72,138,85,.12)', bd: 'rgba(72,138,85,.25)', fg: '#3f7a4e' }
    : r.startsWith('med')
      ? { bg: 'rgba(200,150,30,.14)', bd: 'rgba(200,150,30,.28)', fg: '#8a6510' }
      : { bg: 'rgba(185,59,59,.1)', bd: 'rgba(185,59,59,.25)', fg: '#b93b3b' };
  const txt = esc(risk) + (reason ? ' — ' + esc(reason) : '');
  return `<div style="display:inline-block;margin:6px 0;padding:5px 12px;border-radius:12px;font-size:11px;font-weight:600;background:${palette.bg};color:${palette.fg};border:1px solid ${palette.bd}">${txt}</div>`;
}

function renderProfileBadges(info) {
  if (!info) return '';
  const scores = [
    _scoreBadge('Longevity', info.longevity),
    _scoreBadge('Projection', info.projection),
    _scoreBadge('Sillage', info.sillage),
    _scoreBadge('Versatility', info.versatility)
  ].filter(Boolean).join('');
  const bb = _blindBuyBadge(info.blindBuyRisk, info.blindBuyReason);
  if (!scores && !bb) return '<div style="font-size:12px;color:var(--td);padding:6px 0">Details unavailable for this fragrance.</div>';
  return `${scores ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${scores}</div>` : ''}${bb}`;
}

function _cmpHasMissing(p) {
  return !p.a || !p.t || !p.longevity || !p.sillage;
}

function _cmpColHTML(p, idx) {
  const name = esc(p.n || p.name || '');
  const brand = esc(p.b || p.brand || '');
  const gender = esc(p.g || p.gender || '—');
  const rating = p.r || p.rating || '—';
  const notes = esc(p.t || p.notes || '—');
  const accords = esc(p.a || p.accords || '—');
  const conc = esc(p.c || p.concentration || '—');
  const profileHTML = renderProfileBadges({
    longevity: p.longevity, projection: p.projection, sillage: p.sillage,
    versatility: p.versatility, blindBuyRisk: p.blindBuyRisk, blindBuyReason: p.blindBuyReason
  });
  return `<div style="flex:1;min-width:200px;max-width:320px" id="cmp-col-${idx}">
    <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:var(--g)">${name}</div>
    <div style="font-size:12px;color:var(--td);margin-bottom:16px">${brand}</div>
    <div class="cmp-row"><span class="cmp-label">Rating</span><span>${rating !== '—' ? '★ ' + rating : '—'}</span></div>
    <div class="cmp-row"><span class="cmp-label">Gender</span><span>${gender}</span></div>
    <div class="cmp-row"><span class="cmp-label">Type</span><span>${conc}</span></div>
    <div class="cmp-row"><span class="cmp-label">Accords</span><span style="font-size:11px;line-height:1.5" id="cmp-accords-${idx}">${accords}</span></div>
    <div class="cmp-row"><span class="cmp-label">Notes</span><span style="font-size:11px;line-height:1.5" id="cmp-notes-${idx}">${notes}</span></div>
    <div style="margin-top:14px" id="cmp-profile-${idx}">${profileHTML}</div>
    <a href="${amazonLink(p.n||p.name, p.b||p.brand)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:12px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;color:#f90;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.15);text-decoration:none">Shop on Amazon</a>
  </div>`;
}

async function _cmpFillMissing(items) {
  const missing = items.map((p, i) => _cmpHasMissing(p) ? i : -1).filter(i => i >= 0);
  if (!missing.length) return;
  await Promise.all(missing.map(async (itemIdx) => {
    const p = items[itemIdx];
    const n = p.n || p.name;
    const b = p.b || p.brand || '';
    const info = await fetchScentProfile(n, b);
    if (!info) return;
    if (info.gender && !p.g) p.g = info.gender;
    if (info.concentration && !p.c) p.c = info.concentration;
    if (info.accords && !p.a) p.a = info.accords;
    if (info.notes && !p.t) p.t = info.notes;
    if (info.rating && !p.r) p.r = info.rating;
    if (info.longevity) p.longevity = info.longevity;
    if (info.projection) p.projection = info.projection;
    if (info.sillage) p.sillage = info.sillage;
    if (info.versatility) p.versatility = info.versatility;
    if (info.blindBuyRisk) p.blindBuyRisk = info.blindBuyRisk;
    if (info.blindBuyReason) p.blindBuyReason = info.blindBuyReason;
    if (_compareList[itemIdx]) _compareList[itemIdx].data = p;
    const col = document.getElementById('cmp-col-' + itemIdx);
    if (col) col.outerHTML = _cmpColHTML(p, itemIdx);
  }));
}

function showComparison() {
  if (_compareList.length < 2) return;
  const items = _compareList.map(c => c.data || { n: c.name, b: c.brand });
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Show loading indicators for items with missing data
  const hasMissing = items.some(p => _cmpHasMissing(p));
  items.forEach((p, i) => {
    if (_cmpHasMissing(p)) {
      if (!p.a) p.a = '';
      if (!p.t) p.t = '';
    }
  });

  const isMobileCmp = window.innerWidth < 640;
  const separator = isMobileCmp
    ? '<div style="height:1px;background:var(--d4);width:100%"></div>'
    : '<div style="width:1px;background:var(--d4);align-self:stretch;flex-shrink:0"></div>';
  const cols = items.map((p, i) => _cmpColHTML(p, i)).join(separator);

  const loadingBar = hasMissing ? '<div id="cmp-ai-status" style="text-align:center;padding:10px;font-size:12px;color:var(--td)"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span> <span style="margin-left:8px">Fetching missing fragrance info via AI...</span></div>' : '';

  const isMobile = window.innerWidth < 640;
  overlay.innerHTML = `<div style="background:var(--d);border:1px solid rgba(201,169,110,.25);border-radius:20px;padding:${isMobile ? '20px 16px' : '28px'};max-width:900px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-lg,0 14px 40px rgba(74,56,24,.18));color:var(--t)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${isMobile ? '16px' : '24px'}">
      <h3 style="font-size:${isMobile ? '16px' : '18px'};font-weight:600;color:var(--t)">Fragrance Comparison</h3>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--td);cursor:pointer;font-size:22px;line-height:1;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px" aria-label="Close comparison">&times;</button>
    </div>
    ${loadingBar}
    <div style="display:flex;gap:${isMobile ? '16px' : '20px'};${isMobile ? 'flex-direction:column' : 'overflow-x:auto'}">${cols}</div>
  </div>`;
  document.body.appendChild(overlay);

  if (hasMissing) {
    _cmpFillMissing(items).then(() => {
      const status = document.getElementById('cmp-ai-status');
      if (status) status.remove();
    });
  }
}

// ═══════════════ HOME ═══════════════
function r_home(el) {
  const perfumeCount = SI.length ? (Math.ceil(SI.length/5000)*5000).toLocaleString() : '75,000';
  const celebCount = CELEBS.length;
  el.innerHTML = `<div class="hp-grain">
  <!-- Homepage Nav -->
  <nav class="hp-nav" id="hp-nav">
    <a class="hp-nav-logo" href="/" onclick="event.preventDefault();go('home')" aria-label="ScentWise — Home">Scent<span>Wise</span></a>
    <div class="hp-nav-links">
      <a href="#hp-discover" onclick="event.preventDefault();document.getElementById('hp-discover').scrollIntoView({behavior:'smooth'})">Discover</a>
      <a href="#hp-how" onclick="event.preventDefault();document.getElementById('hp-how').scrollIntoView({behavior:'smooth'})">How It Works</a>
      <a href="#hp-profile" onclick="event.preventDefault();document.getElementById('hp-profile').scrollIntoView({behavior:'smooth'})">Profile</a>
      <a href="#hp-pricing" onclick="event.preventDefault();document.getElementById('hp-pricing').scrollIntoView({behavior:'smooth'})">Pricing</a>
      <a href="#hp-celebrities" onclick="event.preventDefault();document.getElementById('hp-celebrities').scrollIntoView({behavior:'smooth'})">Collections</a>
      <a class="hp-nav-cta" href="#" onclick="event.preventDefault();go('chat')">Try Free</a>
    </div>
    <button type="button" class="hp-nav-toggle" onclick="this.classList.toggle('open');var l=this.closest('.hp-nav').querySelector('.hp-nav-links');l.style.display=this.classList.contains('open')?'flex':'none';this.setAttribute('aria-expanded',this.classList.contains('open'))" aria-label="Toggle navigation menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </nav>
  <!-- Hero -->
  <section class="hp-hero">
    <div class="hp-hero-eyebrow">Fragrance Discovery, Reimagined</div>
    <h1>Find the scent that <em>feels like you</em></h1>
    <p class="hp-hero-sub">Describe the mood, occasion, or memory — and we'll match it to real fragrances from a collection of ${perfumeCount}+.</p>
    <form class="hp-hero-input" onsubmit="event.preventDefault();heroStart(this.querySelector('input').value)" role="search">
      <input type="text" id="hp-hero-q" placeholder="Try: a beach day, my first date, Tom Ford but cheaper..." aria-label="Describe what you're looking for" autocomplete="off">
      <button type="submit" class="hp-btn-primary">Find My Scent</button>
    </form>
    <div class="hp-hero-trust" aria-label="Pricing and trial information">
      <span>&#10022; 1 free pick · 2 more with email</span>
      <span aria-hidden="true">·</span>
      <span>No credit card to try</span>
      <span aria-hidden="true">·</span>
      <span>Then <strong>$2.99/mo</strong> · cancel anytime</span>
    </div>
    <div class="hp-hero-features">
      <button type="button" class="hp-feature-chip" onclick="go('photo')" aria-label="Upload a photo and get matched fragrances">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        <span><strong>Scan a photo</strong><em>Your vibe → scent</em></span>
      </button>
      <button type="button" class="hp-feature-chip" onclick="go('style')" aria-label="Match fragrances to your fashion style">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
        <span><strong>Match your style</strong><em>Fashion → scent</em></span>
      </button>
      <button type="button" class="hp-feature-chip" onclick="go('account')" aria-label="Open your Scent Profile" style="background:rgba(201,169,110,.14);border-color:rgba(201,169,110,.5)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/><path d="m19 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>
        <span><strong>Your Profile</strong><em>AI learns your taste</em></span>
      </button>
    </div>
    <div class="hp-hero-subcta">
      <a href="#" onclick="event.preventDefault();go('chat')">Or start a blank chat</a>
      <span aria-hidden="true">·</span>
      <a href="#hp-discover" onclick="event.preventDefault();document.getElementById('hp-discover').scrollIntoView({behavior:'smooth'})">See all discovery modes</a>
      <span aria-hidden="true">·</span>
      <a href="#" onclick="event.preventDefault();go('account')">Your Profile</a>
    </div>
    <div class="hp-hero-stats">
      <div class="hp-hero-stat"><div class="num">${perfumeCount}+</div><div class="label">Fragrances</div></div>
      <div class="hp-hero-stat"><div class="num">6</div><div class="label">Discovery Modes</div></div>
      <div class="hp-hero-stat"><div class="num">2,500</div><div class="label">Curated Top Picks</div></div>
    </div>
  </section>
  <!-- As Featured In -->
  <div style="text-align:center;padding:2.5rem 1.25rem .5rem">
    <div style="display:inline-flex;align-items:center;gap:14px;opacity:.6">
      <span style="font-size:8px;color:var(--hp-gold2);letter-spacing:4px">&#10022;&#10022;</span>
      <span style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:var(--hp-gold2);font-family:var(--hp-sans);font-weight:500">As featured in</span>
      <span style="width:1px;height:16px;background:var(--hp-gold2);opacity:.35"></span>
      <a href="https://cosmeticsbusiness.com/what-are-the-top-ai-fragrance-recommendation-platforms" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:var(--hp-gold);font-family:var(--hp-serif);font-size:17px;font-weight:600;letter-spacing:.5px;transition:opacity .2s" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">Cosmetics Business</a>
      <span style="font-size:8px;color:var(--hp-gold2);letter-spacing:4px">&#10022;&#10022;</span>
    </div>
  </div>
  <!-- Divider -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <!-- Discovery Modes -->
  <section class="hp-section" id="hp-discover">
    <div class="hp-section-kicker hp-reveal">Or Discover Another Way</div>
    <div class="hp-section-heading hp-reveal">Not sure what to ask? <em>Let your life pick.</em></div>
    <p class="hp-section-copy hp-reveal">Six alternative paths — each one reads a different dimension of who you are and matches fragrances to it.</p>
    <div class="hp-modes-layout">
      <button type="button" class="hp-mode-item hp-reveal" onclick="go('zodiac')" aria-label="Zodiac Match — Birthday to Scent">
        <div class="hp-mode-number">01</div>
        <div class="hp-mode-name">Zodiac Match</div>
        <div class="hp-mode-desc">Enter your birthday and discover fragrances aligned with your celestial profile and elemental energy.</div>
        <div class="hp-mode-tag">Birthday → Scent</div>
      </button>
      <button type="button" class="hp-mode-item hp-reveal" onclick="go('photo')" aria-label="Photo Style Scan — Photo to Scent">
        <div class="hp-mode-number">02</div>
        <div class="hp-mode-name">Photo Style Scan</div>
        <div class="hp-mode-desc">Upload any photo — your outfit, your room, a place you love — and we'll read the aesthetic to match fragrances.</div>
        <div class="hp-mode-tag">Photo → Scent</div>
      </button>
      <button type="button" class="hp-mode-item hp-reveal" onclick="go('music')" aria-label="Music Match — Genres to Scent">
        <div class="hp-mode-number">03</div>
        <div class="hp-mode-name">Music Match</div>
        <div class="hp-mode-desc">Tell us what you listen to. Your sonic taste reveals more about your fragrance preferences than you'd think.</div>
        <div class="hp-mode-tag">Genres → Scent</div>
      </button>
      <button type="button" class="hp-mode-item hp-reveal" onclick="go('style')" aria-label="Style Match — Fashion to Scent">
        <div class="hp-mode-number">04</div>
        <div class="hp-mode-name">Style Match</div>
        <div class="hp-mode-desc">Your wardrobe speaks volumes. Describe your fashion sense and we'll find scents that complete the picture.</div>
        <div class="hp-mode-tag">Fashion → Scent</div>
      </button>
      <button type="button" class="hp-mode-item hp-reveal" onclick="go('dupe')" aria-label="Dupe Finder — Find affordable alternatives">
        <div class="hp-mode-number">05</div>
        <div class="hp-mode-name">Dupe Finder</div>
        <div class="hp-mode-desc">Love an expensive fragrance? We'll find affordable alternatives that smell just like the original.</div>
        <div class="hp-mode-tag">Fragrance → Dupes</div>
      </button>
      <button type="button" class="hp-mode-item hp-reveal" onclick="go('celeb')" aria-label="Celebrity Collections — Browse icons">
        <div class="hp-mode-number">06</div>
        <div class="hp-mode-name">Celebrity Collections</div>
        <div class="hp-mode-desc">Explore the signature fragrances of icons — from athletes to actors, musicians to moguls.</div>
        <div class="hp-mode-tag">Browse → Discover</div>
      </button>
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
  <!-- Your Scent Profile -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-section" id="hp-profile">
    <div class="hp-section-kicker hp-reveal">Your Scent Profile</div>
    <div class="hp-section-heading hp-reveal">The AI <em>remembers your taste</em></div>
    <p class="hp-section-copy hp-reveal">Every chat, rating, and quiz builds a living record of the notes you love, the seasons you wear, and the collection you own. Come back tomorrow — it picks up where you left off.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:32px;max-width:960px;margin-left:auto;margin-right:auto">
      <div class="hp-reveal" style="border:1px solid var(--d4);border-radius:var(--r);padding:28px 22px;background:rgba(255,255,255,.02)">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--hp-gold);margin-bottom:10px">Favorite Notes</div>
        <div style="font-size:14px;color:var(--t);line-height:1.55">The top accords you keep coming back to — oud, iris, cedar, tonka — ranked by how often you pick them.</div>
      </div>
      <div class="hp-reveal" style="border:1px solid var(--d4);border-radius:var(--r);padding:28px 22px;background:rgba(255,255,255,.02)">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--hp-gold);margin-bottom:10px">Skin &amp; Climate</div>
        <div style="font-size:14px;color:var(--t);line-height:1.55">Your skin chemistry, the seasons you wear, the occasions you dress for. The AI matches to your context, not a generic list.</div>
      </div>
      <div class="hp-reveal" style="border:1px solid var(--d4);border-radius:var(--r);padding:28px 22px;background:rgba(255,255,255,.02)">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--hp-gold);margin-bottom:10px">Your Collection</div>
        <div style="font-size:14px;color:var(--t);line-height:1.55">Save bottles you own or want. The AI avoids dupes and finds adjacent picks that actually expand your wardrobe.</div>
      </div>
    </div>
    <div class="hp-reveal visible" style="margin-top:32px;text-align:center"><button class="hp-btn-ghost" onclick="go('account')" style="padding:14px 32px">Open Your Profile</button></div>
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
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> 1 free AI pick + 2 more with email</li>
          <li style="display:flex;align-items:center;gap:8px;color:var(--d5)"><span>&#10005;</span> AI Chat, Photo, Zodiac, Music, Style</li>
          <li style="display:flex;align-items:center;gap:8px;color:var(--d5)"><span>&#10005;</span> Dupe Finder</li>
        </ul>
        <button class="hp-btn-ghost" onclick="go('explore')" style="width:100%;padding:14px">Explore Database</button>
      </div>
      <div class="hp-reveal" style="flex:1;min-width:280px;max-width:340px;border:2px solid var(--g);border-radius:var(--r);padding:36px 28px;background:var(--gl);text-align:center;position:relative">
        <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--g);color:var(--bg);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:4px 16px;border-radius:20px">Most Popular</div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--g);margin-bottom:12px">Premium</div>
        <div style="font-size:36px;font-weight:700;margin-bottom:6px"><span class="gg">$2.99</span><span style="font-size:16px;color:var(--td);font-weight:400">/month</span></div>
        <div style="color:var(--td);font-size:13px;margin-bottom:24px">Cancel anytime · <a href="/refund.html" style="color:var(--g);text-decoration:underline">Refund policy</a></div>
        <ul style="text-align:left;list-style:none;padding:0;margin:0 0 28px;font-size:14px;color:var(--t);line-height:2.2">
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Everything in Free</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> AI Chat Advisor</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Photo, Zodiac, Music & Style Match</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> Dupe Finder</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:var(--g)">&#10003;</span> 500 AI queries/month</li>
        </ul>
        <button class="hp-btn-primary" onclick="unlockPaid()" data-subscribe-btn style="width:100%;padding:14px">Get Premium</button>
        <div style="display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;align-items:center;margin-top:14px;color:var(--td);font-size:12px;line-height:1.4">
          <span style="display:inline-flex;align-items:center;gap:5px"><span style="color:var(--g)">&#10003;</span> Cancel anytime</span>
          <span aria-hidden="true" style="opacity:.4">·</span>
          <span style="display:inline-flex;align-items:center;gap:5px"><span style="color:var(--g)">&#10003;</span> 7-day refund</span>
          <span aria-hidden="true" style="opacity:.4">·</span>
          <span style="display:inline-flex;align-items:center;gap:5px"><span style="color:var(--g)">&#10003;</span> Secure checkout</span>
        </div>
      </div>
    </div>
    <p class="hp-reveal" style="text-align:center;color:var(--d5);font-size:11px;margin-top:22px;letter-spacing:.3px">Trusted by fragrance lovers worldwide · Powered by Google Gemini AI</p>
  </section>
  <!-- Email Capture -->
  <div class="hp-divider"><div class="hp-divider-line"></div></div>
  <section class="hp-section" id="hp-newsletter">
    <div class="hp-section-kicker hp-reveal">Stay in the Loop</div>
    <div class="hp-section-heading hp-reveal">Get fragrance tips & <em>exclusive picks</em></div>
    <p class="hp-section-copy hp-reveal">Join our newsletter for weekly scent recommendations, new release alerts, and subscriber-only content.</p>
    <form id="hp-email-form" class="hp-reveal" onsubmit="return captureEmail(event)" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:32px;max-width:520px;margin-left:auto;margin-right:auto">
      <input type="email" id="hp-email-input" placeholder="Enter your email" required style="flex:1;min-width:220px;padding:14px 18px;background:var(--d3);border:1px solid var(--d4);color:var(--t);border-radius:var(--r);font-family:'DM Sans';font-size:14px;outline:none">
      <button type="submit" class="hp-btn-primary" id="hp-email-btn" style="padding:14px 28px;white-space:nowrap">Join the list</button>
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
  // Initialize reveal animations, scroll listener, and placeholder rotation.
  // This is non-critical work — if the user taps the hero form in the first
  // ~300ms, we want their tap handler to run first. requestIdleCallback
  // yields automatically to higher-priority input work, lowering INP on the
  // home→chat path. Fallback to setTimeout for older browsers.
  const _homepageInit = () => {
    const reveals = document.querySelectorAll('.hp-reveal');
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      // Skip animation entirely — content stays visible (default state)
      reveals.forEach(el => el.classList.add('visible'));
      return;
    }
    // Enable reveal animations (content is visible by default without .hp-anim)
    const grain = el.querySelector('.hp-grain');
    if (grain) grain.classList.add('hp-anim');
    if ('IntersectionObserver' in window) {
      const hpObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 60);
            hpObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.01, rootMargin: '0px 0px 200px 0px' });
      reveals.forEach(el => hpObserver.observe(el));
      // Fallback: force-reveal anything still hidden quickly (short safety net)
      setTimeout(() => { reveals.forEach(el => { if (!el.classList.contains('visible')) el.classList.add('visible'); }); }, 400);
    } else {
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
    startHeroPlaceholderRotation();
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(_homepageInit, { timeout: 300 });
  } else {
    setTimeout(_homepageInit, 50);
  }
}

// ═══════════════ EXPLORE (FREE — uses local DB) ═══════════════
function r_explore(el) {
  if (!_dbLoaded) {
    el.innerHTML = '<div class="sec fi" style="text-align:center;padding-top:80px"><div style="display:flex;align-items:center;justify-content:center;gap:10px;color:var(--td)"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="margin-left:4px">Loading fragrance database...</span></div></div>';
    loadDB().then(() => { if (CP === 'explore') r_explore(el); }).catch(() => { el.innerHTML = '<div class="sec fi" style="text-align:center;padding-top:80px"><p style="color:var(--td);margin-bottom:16px">Could not load fragrance database.</p><button class="btn btn-sm" onclick="go(\'explore\')">Retry</button></div>'; });
    return;
  }
  const filters = ['all','Male','Female','Unisex'];
  el.innerHTML = `<div class="sec fi">
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Explore</span> Database</h2>
      <p>Search ${(Math.ceil(SI.length/5000)*5000).toLocaleString()}+ fragrances — works offline, no subscription needed.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div class="inp-row" style="margin-bottom:14px">
        <label for="exp-inp" class="sr-only">Search fragrances</label>
        <input type="text" id="exp-inp" placeholder="Search by name, brand, category..." value="${esc(expQ)}" onkeydown="if(event.key==='Enter'){clearTimeout(_expDebounce);doExp()}" oninput="clearTimeout(_expDebounce);_expDebounce=setTimeout(doExp,300)" autocomplete="off">
        <button class="btn btn-sm" onclick="clearTimeout(_expDebounce);doExp()" aria-label="Search fragrances">Search</button>
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
  if (!expQ) document.getElementById('exp-inp')?.focus({preventScroll: true});
  if (expResults.length) setTimeout(loadExploreImages, 100);
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
    ${crumbsHTML('chat')}
    <div style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <h2 class="fd" style="font-size:28px;font-weight:400"><span class="gg" style="font-weight:600">AI</span> Fragrance Advisor</h2>
        <p style="color:var(--td);font-size:13px;margin-top:6px">Powered by ${SI.length ? (Math.ceil(SI.length/5000)*5000).toLocaleString() : '75,000'}+ perfumes with real notes, accords & ratings</p>
        ${scentProfile && scentProfile.queryCount > 0 ? `<p style="color:var(--g);font-size:11px;margin-top:4px;opacity:.7">Personalized from ${scentProfile.queryCount} interaction${scentProfile.queryCount !== 1 ? 's' : ''}</p>` : ''}
      </div>
      ${chatMsgs.length > 0 ? `<button class="btn-o btn-sm" onclick="chatMsgs=[];_ssw('chatMsgs',[]);r_chat(document.getElementById('page-chat'))" aria-label="Start a new conversation" style="flex-shrink:0;white-space:nowrap">New Chat</button>` : ''}
    </div>
    ${trialBanner}
    <div class="msgs" id="c-msgs" role="log" aria-live="polite" aria-label="Chat messages">
      ${chatMsgs.length===0?`<div style="display:flex;flex-direction:column;gap:10px;margin-top:24px">
        <p style="color:var(--td);font-size:13px;margin-bottom:4px;font-weight:500">Try asking:</p>
        ${sugg.map((s,i)=>`<div class="card fi stagger-${i+1}" onclick="cSend('${s}')" style="padding:14px 18px;cursor:pointer;font-size:14px">${s}</div>`).join('')}
      </div>`:''}
      ${chatMsgs.map((m,i)=>`<div class="cb fi ${m.role==='user'?'cb-u':'cb-a'}">
        ${m.role==='assistant'?'<div style="color:var(--g);font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1.2px;text-transform:uppercase">ScentWise AI</div>':''}
        ${m.role==='assistant' ? fmtAi(m.content, !!m.teaser) : fmt(m.content)}
        ${m.role==='assistant'?feedbackHTML(i):''}
      </div>`).join('')}
      ${chatLoad?'<div class="cb cb-a fi" style="display:flex;gap:8px;padding:20px 24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span></div>':''}
      <div id="c-end"></div>
    </div>
    ${(!isPaid && !isOwner && freeUsed < FREE_LIMIT && chatMsgs.length > 0) ? `<div style="text-align:center;padding:6px 0 2px;font-size:11px;color:var(--g);opacity:.85">✦ ${FREE_LIMIT - freeUsed} free quer${(FREE_LIMIT - freeUsed) === 1 ? 'y' : 'ies'} remaining · <a onclick="unlockPaid()" style="color:var(--g);cursor:pointer;text-decoration:underline;font-weight:600">Go Premium</a></div>` : ''}
    ${(!isPaid && !isOwner && freeUsed >= FREE_LIMIT) ? `<div style="text-align:center;padding:6px 0 2px;font-size:11px;color:var(--td)">Trial ended · <a onclick="unlockPaid()" style="color:var(--g);cursor:pointer;text-decoration:underline;font-weight:600">Subscribe for unlimited access</a></div>` : ''}
    <div class="inp-row" style="padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
      <label for="c-inp" class="sr-only">Ask about any fragrance</label>
      <input type="text" id="c-inp" placeholder="Ask about any fragrance..." onkeydown="if(event.key==='Enter')cSend()" autocomplete="off">
      <button class="btn btn-sm" onclick="cSend()" ${chatLoad?'disabled':''} aria-label="Send message">Send</button>
    </div>
  </div>`;
  // Auto-scroll within chat container only (never scroll the outer page)
  if (_chatShouldScroll || _chatScrollToLast) {
    const scrollToEnd = _chatShouldScroll;
    _chatShouldScroll = false;
    _chatScrollToLast = false;
    requestAnimationFrame(() => {
      const msgsEl = document.getElementById('c-msgs');
      if (!msgsEl) return;
      if (scrollToEnd) {
        msgsEl.scrollTop = msgsEl.scrollHeight;
      } else {
        // AI responded — scroll the last AI bubble into view within the container
        const allAi = msgsEl.querySelectorAll('.cb-a');
        const lastAi = allAi.length > 0 ? allAi[allAi.length - 1] : null;
        if (lastAi) {
          const containerRect = msgsEl.getBoundingClientRect();
          const msgRect = lastAi.getBoundingClientRect();
          const scrollOffset = msgRect.top - containerRect.top + msgsEl.scrollTop;
          msgsEl.scrollTop = scrollOffset;
        } else {
          msgsEl.scrollTop = msgsEl.scrollHeight;
        }
      }
    });
  }
  document.getElementById('c-inp')?.focus({preventScroll: true});
  if (chatMsgs.some(m => m.role === 'assistant')) setTimeout(() => loadResultImages(el), 100);
}

async function cSend(text) {
  if (!text) { const i = document.getElementById('c-inp'); text = i?.value; if (i) i.value = ''; }
  if (!text || !text.trim() || chatLoad) return;
  if (!canUseAI()) {
    chatMsgs.push({role:'user',content:text.trim()});
    chatMsgs.push({role:'assistant',content:freeUsed >= FREE_LIMIT ? 'You\'ve used your free AI queries. Subscribe to ScentWise Premium ($2.99/month) for 500 AI queries/month.' : 'Please subscribe to ScentWise Premium ($2.99/month) to use the AI advisor.'});
    _ssw('chatMsgs', chatMsgs);
    _chatShouldScroll = true;
    r_chat(document.getElementById('page-chat'));
    if (!isPaid && !isOwner && freeUsed >= FREE_LIMIT) {
      try { openPaywallModal('chat_blocked'); } catch {}
    }
    return;
  }
  text = text.trim();
  chatMsgs.push({role:'user',content:text});
  _ssw('chatMsgs', chatMsgs);
  chatLoad = true;
  _chatShouldScroll = true;
  r_chat(document.getElementById('page-chat'));

  // Build context from local DB (ensure loaded)
  await loadDB();
  const ctx = getContext(text);
  const sysWithCtx = 'You are ScentWise AI, the world\'s most knowledgeable fragrance advisor, powered by a database of over 75,000 real perfumes with actual notes, accords, and ratings. You ALWAYS give confident, specific recommendations with real fragrance names, notes, and details. You never say you are under development or that your database is not operational. When users mention something about the site or numbers, respond helpfully. Format recommendations clearly with fragrance name, brand, key notes, and why it matches. Keep responses concise but informative. Never apologize for lacking data — you have one of the largest fragrance databases in the world. ' + (ctx || '');
  const apiMsgs = chatMsgs.map(m => ({role:m.role, content: m.role==='user' && m.content===text ? sysWithCtx + '\n\nUser question: ' + m.content : m.content}));
  
  const reply = await aiCall('chat', {messages: apiMsgs});
  chatMsgs.push({role:'assistant',content:reply,teaser:_lastTeaser});
  _ssw('chatMsgs', chatMsgs);
  chatLoad = false;
  _chatScrollToLast = true;
  _renderKeepScroll(() => r_chat(document.getElementById('page-chat')));
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
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Style</span> Scan</h2>
      <p>Upload a photo and get fragrance recommendations matched to your aesthetic.</p>
    </div>
    <div class="expect-note"><div><strong>How it works:</strong> your photo is analyzed in your browser and sent securely to our AI only for this session — we never store, train on, or share it. Best results: outfits, room aesthetics, or travel shots.</div></div>
    ${!photoPrev?`<div class="pdrop" onclick="document.getElementById('pf').click()" ondragover="event.preventDefault();this.style.borderColor='var(--g)'" ondragleave="this.style.borderColor='var(--d4)'" ondrop="event.preventDefault();phFile(event.dataTransfer.files[0])">
      <input type="file" id="pf" accept="image/*" hidden onchange="phFile(this.files[0])">
      <div style="font-size:11px;letter-spacing:3px;color:var(--g);font-weight:600;margin-bottom:20px;text-transform:uppercase">Upload</div>
      <p style="font-size:17px;margin-bottom:8px;font-weight:500">Drop a photo here or click to upload</p>
      <p style="color:var(--td);font-size:13px">We'll analyze your style and match fragrances to your vibe</p>
    </div>`:`<div class="glass-panel" style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <img src="${photoPrev}" alt="Your uploaded photo for style analysis" style="width:200px;max-width:100%;height:260px;object-fit:cover;border-radius:var(--r);border:1px solid var(--d4);box-shadow:var(--shadow)">
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
            <div style="line-height:1.8;font-size:14px">${fmtAi(photoRes, photoTeaser)}</div>
            ${modeFeedbackHTML('photo', photoRes)}
            ${followUpHTML(photoChat, photoChatLoad, 'pfu-inp', 'pFollow', 'Ask more about your style matches...')}
          </div>
          <div style="margin-top:18px"><button class="btn-o btn-sm" onclick="photoReset()">Try Another Photo</button></div>
        `}
      </div>
    </div>`}
  </div>`;
  if (photoRes) setTimeout(() => loadResultImages(el), 100);
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
  r_photo(document.getElementById('page-photo')); _scrollToRes('#page-photo .glass-panel');
  photoRes = await aiCall('photo', {imageBase64: photoB64, imageMime: 'image/jpeg'});
  photoTeaser = _lastTeaser;
  _ssw('photoRes', photoRes);
  _ssw('photoTeaser', photoTeaser);
  photoLoad = false;
  _renderKeepScroll(() => r_photo(document.getElementById('page-photo')));
  setTimeout(() => loadResultImages(document.querySelector('#page-photo .rbox')), 100);
}

function photoReset() { photoB64=null; photoPrev=null; photoRes=''; photoTeaser=false; photoLoad=false; photoChat=[]; photoChatLoad=false; _ssw('photoRes',''); _ssw('photoTeaser',false); _ssw('photoChat',[]); r_photo(document.getElementById('page-photo')); }

async function pFollow() {
  const inp = document.getElementById('pfu-inp');
  if (!inp || !inp.value.trim() || photoChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  photoChat.push({role:'user',content:text});
  photoChatLoad = true; r_photo(document.getElementById('page-photo')); _scrollToRes('#page-photo .rbox');
  const msgs = [{role:'user',content:`Context: I uploaded a style photo and got these fragrance recommendations:\n${photoRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  photoChat.push({role:'assistant',content:reply,teaser:_lastTeaser});
  _ssw('photoChat', photoChat);
  photoChatLoad = false; _renderKeepScroll(() => r_photo(document.getElementById('page-photo')));
}

// ═══════════════ ZODIAC (PAID) ═══════════════
function r_zodiac(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Zodiac</span> Match</h2>
      <p>Select your sign or type your birthday to discover your cosmic scent match.</p>
    </div>
    <div class="expect-note"><div><strong>Just for fun:</strong> we map the archetypes and elemental themes of each sign (fire, water, earth, air) to fragrance accords. Nothing mystical — think of it as a curated starting point based on your vibe.</div></div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="bday-inp" placeholder="Type your birthday (e.g. March 15, 15/03)..." style="max-width:min(320px,100%);flex:1" onkeydown="if(event.key==='Enter')tryBday()">
        <button class="btn btn-sm" onclick="tryBday()">Find My Sign</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      ${ZODIAC.map((z,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickZ('${z.sign}')" style="text-align:center;padding:18px 12px;${selZ===z.sign?'border-color:var(--g);background:var(--gl)':''}">
        <div style="font-size:28px;margin-bottom:8px;color:var(--gd);line-height:1">${z.symbol}</div>
        <div style="font-weight:600;font-size:14px">${z.sign}</div>
        <div style="font-size:11px;color:var(--td);margin-top:2px">${z.dates}</div>
      </div>`).join('')}
    </div>
    <div id="z-res" role="region" aria-live="polite" aria-label="Zodiac fragrance results" style="margin-top:28px">
      ${zodiacLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Finding your cosmic scents...</span></div>':''}
      ${zodiacRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">${esc((selZ||'').toUpperCase())} Fragrance Matches</div><div style="line-height:1.8;font-size:14px">${fmtAi(zodiacRes, zodiacTeaser)}</div>
        ${modeFeedbackHTML('zodiac', zodiacRes)}
        ${followUpHTML(zodiacChat, zodiacChatLoad, 'zfu-inp', 'zFollow', 'Ask more about zodiac fragrances...')}
      </div>`:''}
    </div>
  </div>`;
  if (zodiacRes) document.getElementById('zfu-inp')?.focus({preventScroll: true});
  if (zodiacRes) setTimeout(() => loadResultImages(el), 100);
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
  zodiacRes=''; zodiacLoad=true; r_zodiac(document.getElementById('page-zodiac')); _scrollToRes('#z-res');
  const prompt = `Match 5 fragrances to a ${sign}. Open with one sentence capturing the essence of this sign — the temperament, the traits that matter for scent. Then deliver picks in your calm, confident advisor voice. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences connecting the scent to specific ${sign} traits (be precise: ruling planet, what they gravitate toward, how they carry themselves), approximate price. Sound like a well-read friend who knows both astrology and perfumery — not a horoscope column.`;
  zodiacRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  zodiacTeaser = _lastTeaser;
  cache[ck]=zodiacRes; _ssw('selZ',selZ); _ssw('zodiacRes',zodiacRes); _ssw('zodiacTeaser',zodiacTeaser); zodiacLoad=false; _renderKeepScroll(() => r_zodiac(document.getElementById('page-zodiac')));
  setTimeout(() => loadResultImages(document.getElementById('z-res')), 100);
}

async function zFollow() {
  const inp = document.getElementById('zfu-inp');
  if (!inp || !inp.value.trim() || zodiacChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  zodiacChat.push({role:'user',content:text});
  zodiacChatLoad = true; r_zodiac(document.getElementById('page-zodiac')); _scrollToRes('#z-res');
  const msgs = [{role:'user',content:`Context: I asked about ${selZ} zodiac fragrance recommendations and got this:\n${zodiacRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  zodiacChat.push({role:'assistant',content:reply,teaser:_lastTeaser});
  _ssw('zodiacChat', zodiacChat);
  zodiacChatLoad = false; _renderKeepScroll(() => r_zodiac(document.getElementById('page-zodiac')));
}

// ═══════════════ MUSIC (PAID) ═══════════════
function r_music(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Music</span> → Fragrance</h2>
      <p>Your music taste reveals your scent identity. Pick a genre or describe your taste below.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="music-inp" placeholder="Or type your music taste (e.g. lo-fi beats, 90s grunge)..." style="max-width:min(400px,100%);flex:1" onkeydown="if(event.key==='Enter')customMusic()">
        <button class="btn btn-sm" onclick="customMusic()">Match</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${GENRES.map((g,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickM('${g.name}')" style="padding:18px;${selM===g.name?'border-color:var(--g);background:var(--gl)':''}">
        <div><div style="font-weight:600;font-size:14px">${g.name}</div><div style="font-size:11px;color:var(--td);margin-top:4px">${g.desc}</div></div>
      </div>`).join('')}
    </div>
    <div id="m-res" role="region" aria-live="polite" aria-label="Music fragrance results" style="margin-top:28px">
      ${musicLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Matching your vibe...</span></div>':''}
      ${musicRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">${esc((selM||'').toUpperCase())} Scent Profile</div><div style="line-height:1.8;font-size:14px">${fmtAi(musicRes, musicTeaser)}</div>
        ${modeFeedbackHTML('music', musicRes)}
        ${followUpHTML(musicChat, musicChatLoad, 'mfu-inp', 'mFollow', 'Ask more about music-inspired fragrances...')}
      </div>`:''}
    </div>
  </div>`;
  if (musicRes) document.getElementById('mfu-inp')?.focus({preventScroll: true});
  if (musicRes) setTimeout(() => loadResultImages(el), 100);
}

async function pickM(genre) {
  if (musicLoad) return;
  if (genre !== selM) { musicChat = []; musicChatLoad = false; }
  selM = genre;
  const ck = 'm_'+genre;
  if (cache[ck]) { musicRes=cache[ck]; r_music(document.getElementById('page-music')); return; }
  musicRes=''; musicLoad=true; r_music(document.getElementById('page-music')); _scrollToRes('#m-res');
  const prompt = `Match 5 fragrances to ${genre} music. Open with one line reading the sonic and sensory character of ${genre} — texture, mood, how it sits in a room. Then deliver picks in your composed, knowledgeable voice. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences drawing the music-to-scent line (specific artists, textures, eras — avoid vague words like "energetic"), price range. Sound like a friend who knows both the music and the fragrances well.`;
  musicRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  musicTeaser = _lastTeaser;
  cache[ck]=musicRes; _ssw('selM',selM); _ssw('musicRes',musicRes); _ssw('musicTeaser',musicTeaser); musicLoad=false; _renderKeepScroll(() => r_music(document.getElementById('page-music')));
  setTimeout(() => loadResultImages(document.getElementById('m-res')), 100);
}

async function customMusic() {
  const inp = document.getElementById('music-inp');
  if (!inp || !inp.value.trim() || musicLoad) return;
  const taste = inp.value.trim(); inp.value = '';
  musicChat = []; musicChatLoad = false;
  selM = taste;
  musicRes=''; musicLoad=true; r_music(document.getElementById('page-music')); _scrollToRes('#m-res');
  const prompt = `The user describes their music taste as: "${taste}". Open with one line reflecting their taste back in sensory terms — show them you understood it. Then match 5 fragrances to this musical world. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences tying the scent to specific elements of their taste (a texture, an era, a lyric, a named artist if given), price range. Warm, precise, confident — no hype, no filler.`;
  musicRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  musicTeaser = _lastTeaser;
  _ssw('selM',selM); _ssw('musicRes',musicRes); _ssw('musicTeaser',musicTeaser);
  musicLoad=false; _renderKeepScroll(() => r_music(document.getElementById('page-music')));
  setTimeout(() => loadResultImages(document.getElementById('m-res')), 100);
}

async function mFollow() {
  const inp = document.getElementById('mfu-inp');
  if (!inp || !inp.value.trim() || musicChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  musicChat.push({role:'user',content:text});
  musicChatLoad = true; r_music(document.getElementById('page-music')); _scrollToRes('#m-res');
  const msgs = [{role:'user',content:`Context: I asked about "${selM}" music-fragrance matching and got this:\n${musicRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  musicChat.push({role:'assistant',content:reply,teaser:_lastTeaser});
  _ssw('musicChat', musicChat);
  musicChatLoad = false; _renderKeepScroll(() => r_music(document.getElementById('page-music')));
}

// ═══════════════ STYLE (PAID) ═══════════════
function r_style(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Style</span> Match</h2>
      <p>Your clothing style says everything about your ideal scent. Pick a style or describe yours.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="style-inp" placeholder="Describe your style (e.g. dark academia, Y2K, cottagecore)..." style="max-width:min(400px,100%);flex:1" onkeydown="if(event.key==='Enter')customStyle()">
        <button class="btn btn-sm" onclick="customStyle()">Match</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${STYLES.map((s,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickSt('${s.name}')" style="padding:18px;${selS===s.name?'border-color:var(--g);background:var(--gl)':''}">
        <div><div style="font-weight:600;font-size:14px">${s.name}</div><div style="font-size:11px;color:var(--td);margin-top:4px">${s.desc}</div></div>
      </div>`).join('')}
    </div>
    <div id="s-res" role="region" aria-live="polite" aria-label="Style match results" style="margin-top:28px">
      ${styleLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Curating your scent wardrobe...</span></div>':''}
      ${styleRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">${esc((selS||'').toUpperCase())} Fragrance Picks</div><div style="line-height:1.8;font-size:14px">${fmtAi(styleRes, styleTeaser)}</div>
        ${modeFeedbackHTML('style', styleRes)}
        ${followUpHTML(styleChat, styleChatLoad, 'sfu-inp', 'sFollow', 'Ask more about style-matched fragrances...')}
      </div>`:''}
    </div>
  </div>`;
  if (styleRes) document.getElementById('sfu-inp')?.focus({preventScroll: true});
  if (styleRes) setTimeout(() => loadResultImages(el), 100);
}

async function pickSt(style) {
  if (styleLoad) return;
  if (style !== selS) { styleChat = []; styleChatLoad = false; }
  selS = style;
  const ck = 's_'+style;
  if (cache[ck]) { styleRes=cache[ck]; r_style(document.getElementById('page-style')); return; }
  styleRes=''; styleLoad=true; r_style(document.getElementById('page-style')); _scrollToRes('#s-res');
  const prompt = `Match 5 fragrances to the "${style}" fashion aesthetic. Open with one sentence reading the mood of this style — fabrics, silhouette, attitude. Then deliver picks in your confident advisor voice. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences connecting the scent to specific style cues (palette, texture, era, the person who wears this well), price range. Mix premium and budget. Tailored, not theatrical.`;
  styleRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  styleTeaser = _lastTeaser;
  cache[ck]=styleRes; _ssw('selS',selS); _ssw('styleRes',styleRes); _ssw('styleTeaser',styleTeaser); styleLoad=false; _renderKeepScroll(() => r_style(document.getElementById('page-style')));
  setTimeout(() => loadResultImages(document.getElementById('s-res')), 100);
}

async function customStyle() {
  const inp = document.getElementById('style-inp');
  if (!inp || !inp.value.trim() || styleLoad) return;
  const desc = inp.value.trim(); inp.value = '';
  styleChat = []; styleChatLoad = false;
  selS = desc;
  styleRes=''; styleLoad=true; r_style(document.getElementById('page-style')); _scrollToRes('#s-res');
  const prompt = `The user describes their personal style as: "${desc}". Open with one sentence reflecting their style back in sensory terms — show them you understood it. Then match 5 fragrances. For each: **bold** name+brand, top/heart/base notes, 2-3 sentences of specific reasoning (what in their description sparked this pick — a word, an item, a mood), price range. Mix premium and budget. Tailored, precise, never generic.`;
  styleRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  styleTeaser = _lastTeaser;
  _ssw('selS',selS); _ssw('styleRes',styleRes); _ssw('styleTeaser',styleTeaser);
  styleLoad=false; _renderKeepScroll(() => r_style(document.getElementById('page-style')));
  setTimeout(() => loadResultImages(document.getElementById('s-res')), 100);
}

async function sFollow() {
  const inp = document.getElementById('sfu-inp');
  if (!inp || !inp.value.trim() || styleChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  styleChat.push({role:'user',content:text});
  styleChatLoad = true; r_style(document.getElementById('page-style')); _scrollToRes('#s-res');
  const msgs = [{role:'user',content:`Context: I asked about "${selS}" style fragrance matching and got this:\n${styleRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  styleChat.push({role:'assistant',content:reply,teaser:_lastTeaser});
  _ssw('styleChat', styleChat);
  styleChatLoad = false; _renderKeepScroll(() => r_style(document.getElementById('page-style')));
}

// ═══════════════ DUPE FINDER — DB SIMILARITY ═══════════════
function _parseNoteWords(noteStr) {
  if (!noteStr) return new Set();
  return new Set(noteStr.toLowerCase().replace(/[;,()]/g,' ').split(/\s+/).filter(w => w.length > 2 && !['and','the','with','for','des','top','mid','base','from','note','notes'].includes(w)));
}

function findDbDupes(fragName) {
  if (!_dbLoaded || RD.length === 0) return null;
  // Find target in RD by best name match
  const fl = fragName.toLowerCase().trim();
  if (fl.length < 3) return null;
  let target = null, bestScore = 0;
  for (const p of RD) {
    const nl = p.n.toLowerCase();
    let s = 0;
    if (nl === fl) { s = 100; }
    else if (nl.startsWith(fl + ' ')) { s = 90 - (nl.length - fl.length); } // "Aventus" -> "Aventus 10th Anniversary"
    else if (nl.startsWith(fl)) { s = 70 - (nl.length - fl.length); }
    else if (fl.length >= 5 && nl.includes(fl)) { s = 60 - (nl.length - fl.length); }
    if (s > bestScore) { bestScore = s; target = p; }
    if (s === 100) break;
  }
  if (!target || bestScore < 40 || !target.a) return null;
  // Parse target accords and notes
  const tAccords = new Set(target.a.split(', ').filter(Boolean));
  if (tAccords.size === 0) return null;
  const tNotes = _parseNoteWords(target.t);
  // Score all other perfumes
  const scored = [];
  for (const p of RD) {
    if (p.n === target.n && p.b === target.b) continue; // skip self
    if (!p.a) continue;
    const pAccords = new Set(p.a.split(', ').filter(Boolean));
    if (pAccords.size === 0) continue;
    // Jaccard similarity on accords
    let inter = 0;
    for (const a of tAccords) if (pAccords.has(a)) inter++;
    const union = tAccords.size + pAccords.size - inter;
    const jaccard = union > 0 ? inter / union : 0;
    // Note word overlap bonus (0-0.15)
    let noteBonus = 0;
    if (tNotes.size > 0 && p.t) {
      const pNotes = _parseNoteWords(p.t);
      let noteInter = 0;
      for (const w of tNotes) if (pNotes.has(w)) noteInter++;
      const noteUnion = tNotes.size + pNotes.size - noteInter;
      noteBonus = noteUnion > 0 ? (noteInter / noteUnion) * 0.15 : 0;
    }
    const score = jaccard + noteBonus;
    if (score > 0.3) scored.push({n:p.n, b:p.b, a:p.a, t:p.t||'', r:p.r, g:p.g, score});
  }
  scored.sort((a,b) => b.score - a.score);
  return { target: {n:target.n, b:target.b, a:target.a, t:target.t||''}, matches: scored.slice(0, 15) };
}

function _buildDupeGrounding(dbResult) {
  if (!dbResult || !dbResult.matches.length) return '';
  const t = dbResult.target;
  let text = `\n\n[DATABASE MATCHES — use these real perfumes from our database as your primary source for recommendations. Prioritize these over your own knowledge. Similarity scores are based on accord & note overlap.]\nOriginal: ${t.n} by ${t.b} | Accords: ${t.a}${t.t ? ' | Notes: '+t.t : ''}\n\nTop matches by similarity:\n`;
  dbResult.matches.forEach((m, i) => {
    text += `${i+1}. ${m.n} by ${m.b} (score: ${(m.score*100).toFixed(0)}%) | Accords: ${m.a}${m.t ? ' | Notes: '+m.t : ''} | Rating: ${m.r}/5\n`;
  });
  return text;
}

// ═══════════════ DUPE FINDER (PAID) ═══════════════
function r_dupe(el) {
  if (!isPaid && !hasFreeTrialLeft()) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  el.innerHTML = `<div class="sec fi">
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Dupe</span> Finder</h2>
      <p>Find affordable alternatives that smell just like your favorite expensive fragrances.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="dupe-inp" placeholder="Type any fragrance name (e.g. Baccarat Rouge 540)..." style="max-width:min(400px,100%);flex:1" onkeydown="if(event.key==='Enter')customDupe()">
        <button class="btn btn-sm" onclick="customDupe()">Find Dupes</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${DUPES.map((d,i)=>`<div class="card fi stagger-${Math.min(i+1,7)}" onclick="pickD('${d.name.replace(/'/g,"\\'")}')" style="padding:18px;${selD===d.name?'border-color:var(--g);background:var(--gl)':''}">
        <div><div style="font-weight:600;font-size:14px">${d.name}</div><div style="font-size:11px;color:var(--td);margin-top:4px">${d.desc}</div></div>
      </div>`).join('')}
    </div>
    <div id="d-res" role="region" aria-live="polite" aria-label="Dupe finder results" style="margin-top:28px">
      ${dupeLoad?'<div style="display:flex;align-items:center;gap:10px;padding:24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="color:var(--td);font-size:14px;margin-left:8px">Finding affordable alternatives...</span></div>':''}
      ${dupeRes?`<div class="rbox fi" style="flex-direction:column;align-items:stretch"><div style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:12px;text-transform:uppercase">DUPES FOR ${esc((selD||'').toUpperCase())}</div><div style="line-height:1.8;font-size:14px">${fmtAi(dupeRes, dupeTeaser)}</div>
        ${modeFeedbackHTML('dupe', dupeRes)}
        ${followUpHTML(dupeChat, dupeChatLoad, 'dfu-inp', 'dFollow', 'Ask more about these dupes...')}
      </div>`:''}
    </div>
  </div>`;
  if (dupeRes) document.getElementById('dfu-inp')?.focus({preventScroll: true});
  if (dupeRes) setTimeout(() => loadResultImages(el), 100);
}

async function pickD(frag) {
  if (dupeLoad) return;
  if (frag !== selD) { dupeChat = []; dupeChatLoad = false; }
  selD = frag;
  const ck = 'd_'+frag;
  if (cache[ck]) { dupeRes=cache[ck]; r_dupe(document.getElementById('page-dupe')); return; }
  dupeRes=''; dupeLoad=true; r_dupe(document.getElementById('page-dupe')); _scrollToRes('#d-res');
  await loadDB();
  const dbResult = findDbDupes(frag);
  const grounding = _buildDupeGrounding(dbResult);
  const prompt = `The user wants affordable dupes for **${frag}**. Start with one precise sentence describing the original's actual scent experience — what spraying it feels like, not just a note list. Then deliver 5 dupes from cheapest to most expensive. Prioritize picks under $80. For each:\n1. **Bold** name + brand\n2. Approximate retail price\n3. How close the match is — be honest. "Dead-on clone", "85% there but lighter", "Same DNA, different personality" — no fake 100% matches.\n4. Key notes it shares with the original\n5. The main difference (what you lose vs. the original — longevity, projection, a specific note)\n6. Where to buy (Amazon, FragranceNet, brand site, etc.)\n\nVoice: warm, specific, confident — a trusted advisor who has smelled all of these. End with one honest line — which dupe you'd personally pick, and why.${grounding}`;
  dupeRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  dupeTeaser = _lastTeaser;
  cache[ck]=dupeRes; _ssw('selD',selD); _ssw('dupeRes',dupeRes); _ssw('dupeTeaser',dupeTeaser); dupeLoad=false; _renderKeepScroll(() => r_dupe(document.getElementById('page-dupe')));
  setTimeout(() => loadResultImages(document.getElementById('d-res')), 100);
}

async function customDupe() {
  const inp = document.getElementById('dupe-inp');
  if (!inp || dupeLoad) return;
  const frag = (inp.value || '').trim();
  if (frag.length < 3) { showToast('Please enter a fragrance name (at least 3 characters).', 'error'); return; }
  if (!/[a-zA-Z]/.test(frag)) { showToast('Please enter a valid fragrance name.', 'error'); return; }
  inp.value = '';
  dupeChat = []; dupeChatLoad = false;
  selD = frag;
  dupeRes=''; dupeLoad=true; r_dupe(document.getElementById('page-dupe')); _scrollToRes('#d-res');
  await loadDB();
  const dbResult = findDbDupes(frag);
  if (!dbResult) {
    showToast(`"${frag}" not found in our 75,000+ database — asking the AI anyway.`, 'info', 4500);
  }
  const grounding = _buildDupeGrounding(dbResult);
  const prompt = `The user wants affordable dupes for **${frag}**. If you don't recognize this name, say so kindly — suggest 2-3 likely fragrances they might've meant and ask which one. Otherwise: start with one precise sentence describing the original's actual scent experience (what spraying it feels like, not just a note list). Then deliver 5 dupes from cheapest to most expensive, prioritizing picks under $80. For each:\n1. **Bold** name + brand\n2. Approximate retail price\n3. How close the match is — be honest. "Dead-on clone", "85% there but lighter", "Same DNA, different personality" — no fake 100% matches.\n4. Key notes it shares with the original\n5. The main difference (what you lose — longevity, projection, a specific note)\n6. Where to buy (Amazon, FragranceNet, brand site, etc.)\n\nVoice: warm, specific, confident — a trusted advisor who has smelled all of these. End with one honest line — which dupe you'd personally pick, and why.${grounding}`;
  dupeRes = await aiCall('chat', {messages:[{role:'user',content:prompt}]});
  dupeTeaser = _lastTeaser;
  _ssw('selD',selD); _ssw('dupeRes',dupeRes); _ssw('dupeTeaser',dupeTeaser);
  dupeLoad=false; _renderKeepScroll(() => r_dupe(document.getElementById('page-dupe')));
  setTimeout(() => loadResultImages(document.getElementById('d-res')), 100);
}

async function dFollow() {
  const inp = document.getElementById('dfu-inp');
  if (!inp || !inp.value.trim() || dupeChatLoad) return;
  const text = inp.value.trim(); inp.value = '';
  dupeChat.push({role:'user',content:text});
  dupeChatLoad = true; r_dupe(document.getElementById('page-dupe')); _scrollToRes('#d-res');
  const msgs = [{role:'user',content:`Context: I asked for dupes/alternatives for "${selD}" and got this:\n${dupeRes}\n\nFollow-up question: ${text}`}];
  const reply = await aiCall('chat', {messages: msgs});
  dupeChat.push({role:'assistant',content:reply,teaser:_lastTeaser});
  _ssw('dupeChat', dupeChat);
  dupeChatLoad = false; _renderKeepScroll(() => r_dupe(document.getElementById('page-dupe')));
}

// ═══════════════ CELEBRITIES (FREE) ═══════════════
let _celebDebounce;

function _celebFragHTML(n, b) {
  const p = find(n, b || '');
  const cbg = _pcBg(n || '');
  const cletter = (n || '?').charAt(0).toUpperCase();
  const safeN = esc(n).replace(/'/g, '&#39;');
  const safeB = esc(b || '').replace(/'/g, '&#39;');
  return `<div class="celeb-frag" data-celeb-name="${esc(n).replace(/"/g, '&quot;')}" data-celeb-brand="${esc(b||'').replace(/"/g, '&quot;')}" style="background:var(--d2);border-radius:var(--r-sm);padding:12px 14px;font-size:13px;border:1px solid rgba(255,255,255,.02)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:3px">
      <div class="celeb-thumb" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;background:${cbg};position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:rgba(255,255,255,.7)">${cletter}</div>
      <strong>${esc(n)}</strong>
      ${b ? ` <span style="color:var(--td)">— ${esc(b)}</span>` : ''}
      ${p?.r ? ` <span style="color:#e8a87c;font-size:11px;margin-left:auto">★ ${p.r}</span>` : ''}
    </div>
    ${p?.a ? `<p class="note" style="margin-left:46px">Accords: ${esc(p.a)}</p>` : ''}
    ${p?.t ? `<p class="note" style="margin-left:46px">Notes: ${esc(p.t)}</p>` : ''}
    <div class="pc-profile-wrap" data-profile-name="${safeN}" data-profile-brand="${safeB}" style="margin:6px 0 0 46px;display:none"></div>
    <div style="display:inline-flex;flex-wrap:wrap;gap:6px;margin:6px 0 0 46px;align-items:center">
      <a href="${amazonLink(n, b||'')}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;color:#f90;background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.12);text-decoration:none;transition:background .2s;min-height:36px" onmouseover="this.style.background='rgba(255,153,0,.15)'" onmouseout="this.style.background='rgba(255,153,0,.08)'">Shop on Amazon</a>
      <button type="button" class="cmp-btn" data-cmp-name="${safeN}" data-cmp-brand="${safeB}" title="Add to compare" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;color:var(--gd);background:var(--gl);border:1px solid rgba(201,169,110,.22);cursor:pointer;transition:background .2s;min-height:36px;font-family:inherit" onmouseover="this.style.background='rgba(201,169,110,.18)'" onmouseout="this.style.background='var(--gl)'">+ Compare</button>
      <button type="button" class="prof-btn" data-prof-name="${safeN}" data-prof-brand="${safeB}" title="Show scent profile" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;color:var(--gd);background:var(--gl);border:1px solid rgba(201,169,110,.22);cursor:pointer;transition:background .2s;min-height:36px;font-family:inherit" onmouseover="this.style.background='rgba(201,169,110,.18)'" onmouseout="this.style.background='var(--gl)'">Scent profile</button>
    </div>
  </div>`;
}

function _celebGridHTML(f) {
  if (!f.length) return `<p style="text-align:center;color:var(--td);margin-top:48px;font-size:14px">No match for "${esc(celebQ)}"</p>`;
  return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
    ${f.map(c => `<div class="pcard" style="padding:22px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="width:48px;height:48px;border-radius:14px;background:var(--gl);border:1px solid rgba(201,169,110,.1);display:flex;align-items:center;justify-content:center;font-size:22px">${c.img}</div>
        <h3 style="font-size:16px;font-weight:600">${esc(c.name)}</h3>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${c.frags.map(k => { const [n, b] = k.split('|'); return _celebFragHTML(n, b); }).join('')}
      </div>
    </div>`).join('')}
  </div>`;
}

function _attachCelebImageObservers(scope) {
  if (!scope) return;
  const cards = scope.querySelectorAll('.pcard');
  if (!cards.length) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { loadCelebImages(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '200px' });
    cards.forEach(c => io.observe(c));
  } else {
    setTimeout(() => loadCelebImages(scope), 100);
  }
}

function _doCelebFilter() {
  const q = celebQ.toLowerCase();
  const f = q ? CELEBS.filter(c => c.name.toLowerCase().includes(q)) : CELEBS;
  const grid = document.getElementById('celeb-grid');
  if (!grid) return;
  grid.innerHTML = _celebGridHTML(f);
  _attachCelebImageObservers(grid);
}

function r_celeb(el) {
  if (!_dbLoaded) {
    el.innerHTML = '<div class="sec fi" style="text-align:center;padding-top:80px"><div style="display:flex;align-items:center;justify-content:center;gap:10px;color:var(--td)"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span><span style="margin-left:4px">Loading fragrance data...</span></div></div>';
    loadDB().then(() => { if (CP === 'celeb') r_celeb(el); }).catch(() => { el.innerHTML = '<div class="sec fi" style="text-align:center;padding-top:80px"><p style="color:var(--td);margin-bottom:16px">Could not load fragrance data.</p><button class="btn btn-sm" onclick="go(\'celeb\')">Retry</button></div>'; });
    return;
  }
  const q = celebQ.toLowerCase();
  const f = q ? CELEBS.filter(c => c.name.toLowerCase().includes(q)) : CELEBS;
  el.innerHTML = `<div class="sec fi">
    ${crumbsHTML(CP)}
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Celebrity</span> Fragrances</h2>
      <p>Discover what ${CELEBS.length} celebrities actually wear.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <input type="search" id="celeb-s" placeholder="Search celebrities..." value="${esc(celebQ)}" oninput="celebQ=this.value;clearTimeout(_celebDebounce);_celebDebounce=setTimeout(_doCelebFilter,180)" style="max-width:min(400px,100%);flex:1">
    </div>
    <div id="celeb-grid">${_celebGridHTML(f)}</div>
  </div>`;
  _attachCelebImageObservers(el);
}

// ═══════════════ PROFILE / ACCOUNT PAGE (merged) ═══════════════
function r_account(el) {
  if (isPaid) {
    const hasProfile = scentProfile && scentProfile.queryCount > 0;
    el.innerHTML = `<div class="sec fi" style="max-width:720px;margin:40px auto">
      <div class="sec-header">
        <h2 class="fd"><span class="gg" style="font-weight:600">Your Scent</span> Profile</h2>
        <p>A living record of your taste — built automatically as you chat, rate recs, and take the quiz. The more you use ScentWise, the sharper your recommendations get.</p>
      </div>
      ${!hasProfile ? `<div class="glass-panel" style="margin-bottom:18px;text-align:center;padding:32px 24px">
        <div style="font-size:42px;margin-bottom:14px">✦</div>
        <h3 style="font-size:20px;margin:0 0 10px;font-weight:500">No profile yet</h3>
        <p style="color:var(--td);font-size:14px;line-height:1.7;margin:0 0 20px;max-width:420px;margin-left:auto;margin-right:auto">Start a chat, rate a recommendation, or take the 2-minute quiz. Your favorite notes, preferred brands, budget and wear context will appear here.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="openScentQuiz()">Take the Quiz</button>
          <button class="btn-o btn-sm" onclick="go('chat')">Start a Chat</button>
        </div>
      </div>` : renderProfileCard()}
      ${_renderCollection()}
      <div class="glass-panel" style="margin-top:22px">
        <p style="color:var(--g);font-size:10px;font-weight:600;letter-spacing:1.2px;margin-bottom:14px;text-transform:uppercase">Account & Billing</p>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:var(--td);font-size:13px">Status</span>
          <span class="tag">${isOwner ? 'Owner' : '✦ Premium'}</span>
        </div>
        ${userEmail ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:var(--td);font-size:13px">Email</span>
          <span style="font-size:14px">${esc(userEmail)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0">
          <span style="color:var(--td);font-size:13px">AI Queries</span>
          <span style="font-size:14px">${isOwner ? 'Unlimited' : aiUsage + ' / ' + MAX_PAID + ' this month'}</span>
        </div>
        <button class="btn-o" onclick="doLogout()" style="width:100%;text-align:center;margin-top:14px">Log Out</button>
      </div>
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
        <div style="width:72px;height:72px;border-radius:20px;background:var(--gl);border:1px solid rgba(201,169,110,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:var(--g);font-weight:600">✦</div>
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
      ${_renderCollection()}
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
      <div style="width:72px;height:72px;border-radius:20px;background:var(--gl);border:1px solid rgba(201,169,110,.15);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:var(--g);font-weight:600;letter-spacing:2px;box-shadow:var(--glow)">OWN</div>
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
      <div style="width:72px;height:72px;border-radius:20px;background:var(--gl);border:1px solid rgba(201,169,110,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:11px;color:var(--g);font-weight:600;letter-spacing:2px">ADMIN</div>
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
const _initMode = _initParams.get('mode');

go(_wantAdmin ? 'admin' : (_initMode && ['dupe','chat','explore','photo','zodiac','music','style','celeb'].includes(_initMode) ? _initMode : 'home'));

// Handle SPA route paths (e.g. /pricing, /how-it-works) — scroll to the relevant section
(function() {
  const pathMap = { '/pricing': 'hp-pricing', '/how-it-works': 'hp-how', '/discover': 'hp-discover', '/collections': 'hp-celebrities' };
  const target = pathMap[window.location.pathname];
  if (target) {
    requestAnimationFrame(function() {
      var el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  }
})();

// DB load is deferred to route transition — r_explore, r_chat, r_celeb etc.
// each call loadDB() themselves. Home never touches the ~3MB perfume JSON,
// so bounce visitors (most TikTok ad clicks) pay zero cost.

// Hydrate compare items — only bother if there's something to hydrate or
// the user explicitly asked for the compare view. Otherwise we'd force a
// ~3MB DB load on every home visit for a feature most users never touch.
if (_compareList.length || _initParams.get('compare') === '1') {
  loadDB().then(() => {
    if (_compareList.length) {
      _compareList.forEach(c => { if (!c.data) { const p = find(c.name, c.brand); if (p) c.data = p; } });
      _renderCompareBar();
    }
    if (_initParams.get('compare') === '1' && _compareList.length >= 2) {
      setTimeout(() => showComparison(), 200);
    }
  }).catch(() => {});
}

// Initialize auth from server-side cookies
(async function() {
  const prevTier = currentTier;
  // Load auth and scent profile in parallel (profile is non-blocking)
  const profileP = loadScentProfile();
  await checkTier();
  // profileP continues in background — no need to await
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
        // All retries failed — show a helpful message and jump to account so user can log in
        showToast('Your payment went through, but we couldn\'t verify it automatically. Log in with the email you used at checkout to activate.', 'info', 9000);
        window.history.replaceState({}, '', window.location.pathname);
        go('account');
        return;
      }
    }
    window.history.replaceState({}, '', window.location.pathname);
    if (activated) {
      showToast('✦ Welcome to ScentWise Premium! All AI features unlocked.', 'success', 6000);
      go('chat');
      return;
    }
  }
  // Only re-render if auth state actually changed (avoids wasteful double-render on homepage)
  if (currentTier !== prevTier || orderId) {
    go(CP);
  }
})();
