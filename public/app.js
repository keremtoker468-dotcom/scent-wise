
// ═══════════════ CONFIG ═══════════════
const API_URL = '/api/recommend';
let LEMON_URL = ''; // Dynamically created via /api/create-checkout

// ═══════════════ DATABASE ENGINE ═══════════════
const _CM = {F:'Fresh',L:'Floral',O:'Oriental',W:'Woody',S:'Sweet',A:'Aromatic',Q:'Aquatic',U:'Fruity',M:'Musky',P:'Warm Spicy','':''};
const _GM = {M:'Male',F:'Female',U:'Unisex','':''};

// Decode SI (basic 70k entries): _SI stores "name|brandIdx|catChar|genderChar", _SB is brand list
const SI = (typeof _SI !== 'undefined') ? _SI.map(s => {
  const p = s.split('|');
  return p[0] + '|' + (_SB[+p[1]]||'') + '|' + (_CM[p[2]]||p[2]) + '|' + (_GM[p[3]]||p[3]);
}) : [];

// Decode RD (rich 8k entries): _RD stores [name,brandIdx,catChar,genderChar,rating,accordIdxs,notes,conc,longevity]
const RD = (typeof _RD !== 'undefined') ? _RD.map(e => {
  const o = {n:e[0], b:_RB[e[1]]||'', c:_CM[e[2]]||e[2], g:_GM[e[3]]||e[3], r:e[4], a:(e[5]||[]).map(i=>_RA[i]).join(', ')};
  if (e[6]) o.t = e[6];
  if (e[7]) o.o = e[7];
  if (e[8]) o.l = e[8];
  return o;
}) : [];

const RL = {};
RD.forEach(p => { RL[(p.n+'|'+p.b).toLowerCase()] = p; });

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
    const r = await fetch('/api/check-tier', { credentials: 'same-origin' });
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
    const r = await fetch('/api/create-checkout', { method: 'POST', credentials: 'same-origin' });
    const d = await r.json();
    if (d.url) {
      LEMON_URL = d.url;
      window.location.href = d.url;
    } else {
      alert(d.error || 'Could not start checkout. Please try again.');
      btns.forEach(b => { b.disabled = false; b.innerHTML = b._prev || 'Subscribe Now'; });
    }
  } catch {
    alert('Could not start checkout. Please try again.');
    btns.forEach(b => { b.disabled = false; b.innerHTML = b._prev || 'Subscribe Now'; });
  }
}

async function loginOwner(key) {
  try {
    const r = await fetch('/api/owner-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    await fetch('/api/owner-auth', { method: 'DELETE', credentials: 'same-origin' });
  } catch {}
  isOwner = false; isPaid = false; currentTier = 'free'; go(CP);
}

async function activateSubscription(orderId, silent) {
  try {
    const r = await fetch('/api/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ orderId })
    });
    const d = await r.json();
    if (d.success) { isPaid = true; currentTier = d.tier || 'premium'; if (d.email) userEmail = d.email; go(CP); return true; }
    if (!silent) {
      if (r.status === 429) {
        alert('Too many attempts. Please wait a minute and try again.');
      } else {
        alert(d.error || 'Could not verify your order. Double-check the order number from your LemonSqueezy confirmation email, or try logging in with your email instead.');
      }
    }
  } catch (err) {
    console.error('Subscription activation error:', err);
    if (!silent) alert('Network error — please check your connection and try again.');
  }
  return false;
}

function showPaywall() {
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
    else alert('Please enter a valid numeric order ID (e.g. 2944561).');
  }
}

// ═══════════════ EMAIL LOGIN ═══════════════
async function loginWithEmail(email) {
  if (!email || !email.trim()) return false;
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email.trim() })
    });
    const d = await r.json();
    if (d.success) { isPaid = true; currentTier = d.tier || 'premium'; userEmail = d.email || email.trim(); go(CP); return true; }
    if (r.status === 404) {
      alert('No subscription found for this email. Make sure you\'re using the same email from your LemonSqueezy purchase. You can also try your order ID instead.');
    } else if (r.status === 429) {
      alert('Too many login attempts. Please wait a minute and try again.');
    } else {
      alert(d.error || 'Could not verify your subscription. Please try again or use your order ID.');
    }
  } catch (err) {
    console.error('Login error:', err);
    alert('Network error — please check your connection and try again.');
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
  fetch('/api/owner-auth', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
  isOwner = false; isPaid = false; currentTier = 'free'; userEmail = ''; go('home');
}

// ═══════════════ LEMONSQUEEZY CHECKOUT EVENTS ═══════════════
function setupLemonSqueezy() {
  if (typeof window.createLemonSqueezy === 'function') window.createLemonSqueezy();
  if (window.LemonSqueezy) {
    window.LemonSqueezy.Setup({
      eventHandler: async function(event) {
        if (event.event === 'Checkout.Success') {
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
      headers: {'Content-Type': 'application/json'},
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
    return d.result || 'No response. Try again.';
  } catch (e) {
    if (e.message === 'ai_unavailable') return '**Oops!** Our AI is temporarily unavailable. Please try again in a moment.';
    if (e.message === 'request_failed') return '**Something went wrong.** Please try again.';
    if (e.message === 'Failed to fetch' || e.message.includes('network')) return '**Connection issue.** Check your internet and try again.';
    return '**Something went wrong.** Please try again in a moment.';
  }
}

// ═══════════════ HELPERS ═══════════════
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmt(text) {
  let s = esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--g)">$1</strong>')
    .replace(/\n/g, '<br>');
  // Add retry button to error messages
  if (text.startsWith('**Oops!**') || text.startsWith('**Something went wrong') || text.startsWith('**Connection issue')) {
    s += '<br><button onclick="retryLast()" class="btn-o btn-sm" style="margin-top:10px">Try Again</button>';
  }
  return s;
}

function perfCard(p) {
  if (!p) return '';
  return `<div class="pcard">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font-weight:600;font-size:14px">${esc(p.name||p.n)}</span>
      <span style="color:var(--td);font-size:12px;flex-shrink:0;margin-left:8px">${esc(p.brand||p.b)}</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      ${p.category||p.c ? `<span class="tag" style="font-size:10px;padding:3px 10px">${esc(p.category||p.c)}</span>` : ''}
      ${p.gender||p.g ? `<span class="tag" style="font-size:10px;padding:3px 10px;background:rgba(133,193,233,.06);color:#85c1e9;border-color:rgba(133,193,233,.1)">${esc(p.gender||p.g)}</span>` : ''}
      ${p.rating||p.r ? `<span class="tag" style="font-size:10px;padding:3px 10px;background:rgba(232,168,124,.06);color:#e8a87c;border-color:rgba(232,168,124,.1)">★ ${p.rating||p.r}</span>` : ''}
    </div>
    ${p.notes||p.t ? `<p class="note">Notes: ${esc(p.notes||p.t)}</p>` : ''}
    ${p.accords||p.a ? `<p class="note">Accords: ${esc(p.accords||p.a)}</p>` : ''}
  </div>`;
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
let photoChat = _ss('photoChat') || [], photoChatLoad = false;
let celebQ = '';
let expQ = '', expFilter = 'all', expResults = [];
const cache = {};

// Birthday to zodiac sign converter
function bdayToZodiac(input) {
  const s = input.trim().toLowerCase();
  // Try parsing various date formats
  let m, d;
  // DD/MM, DD.MM, DD-MM
  let p = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})/);
  if (p) { d = parseInt(p[1]); m = parseInt(p[2]); }
  // Month name + day
  if (!m) {
    const months = {jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
    for (const [k,v] of Object.entries(months)) {
      if (s.includes(k)) { m = v; const dm = s.match(/\d+/); if (dm) d = parseInt(dm[0]); break; }
    }
  }
  if (!m || !d || d < 1 || d > 31 || m < 1 || m > 12) return null;
  const signs = [
    [1,20,'Capricorn'],[2,19,'Aquarius'],[3,20,'Pisces'],[4,20,'Aries'],[5,21,'Taurus'],
    [6,21,'Gemini'],[7,22,'Cancer'],[8,23,'Leo'],[9,23,'Virgo'],[10,23,'Libra'],
    [11,22,'Scorpio'],[12,22,'Sagittarius'],[12,32,'Capricorn']
  ];
  for (let i = 0; i < signs.length - 1; i++) {
    const [sm,sd] = signs[i], [nm] = signs[i+1];
    if (m === sm && d >= sd) return signs[i][2];
    if (m === sm && d < sd) return signs[i-1]?.[2] || 'Capricorn';
  }
  // Fallback
  if (m===1 && d<=20) return 'Capricorn';
  if (m===1) return 'Aquarius';
  const z2 = [[1,20,'Aquarius'],[2,19,'Pisces'],[3,20,'Aries'],[4,20,'Taurus'],[5,21,'Gemini'],[6,21,'Cancer'],[7,22,'Leo'],[8,23,'Virgo'],[9,23,'Libra'],[10,23,'Scorpio'],[11,22,'Sagittarius'],[12,21,'Capricorn']];
  for (const [zm,zd,zn] of z2) { if (m===zm && d<=zd) return z2[z2.indexOf([zm,zd,zn])-1]?.[2]||zn; if (m===zm) return zn; }
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
      <input type="text" id="${inputId}" placeholder="${placeholder}" onkeydown="if(event.key==='Enter')${sendFn}()">
      <button class="btn btn-sm" onclick="${sendFn}()" ${loadingFlag?'disabled':''}>Send</button>
    </div>
  </div>`;
}

// ═══════════════ NAV ═══════════════
const NI = [
  {id:'home',l:'Home',i:'✦'},{id:'explore',l:'Explore',i:'🧪'},{id:'chat',l:'AI Advisor',i:'💬'},
  {id:'photo',l:'Style Scan',i:'📸'},{id:'zodiac',l:'Zodiac',i:'🔮'},{id:'music',l:'Music',i:'🎶'},
  {id:'style',l:'Style',i:'🪞'},{id:'celeb',l:'Celebs',i:'💫'},{id:'account',l:'Account',i:'👤'}
];
// Mobile bottom bar (core tabs)
const MNI = [
  {id:'home',l:'Home',i:'✦'},{id:'explore',l:'Explore',i:'🧪'},{id:'chat',l:'AI',i:'💬'},
  {id:'celeb',l:'Celebs',i:'💫'},{id:'account',l:'Account',i:'👤'}
];
// All switchable modes (for the pill bar)
const MODES = [
  {id:'chat',l:'AI Advisor',i:'💬'},{id:'explore',l:'Explore',i:'🧪'},
  {id:'photo',l:'Photo Scan',i:'📸'},{id:'zodiac',l:'Zodiac',i:'🔮'},
  {id:'music',l:'Music',i:'🎶'},{id:'style',l:'Style',i:'🪞'},
  {id:'celeb',l:'Celebs',i:'💫'}
];

function rNav() {
  document.getElementById('nav').innerHTML = NI.map(n =>
    `<a class="ni ${CP===n.id?'na':''}" onclick="go('${n.id}')">${n.i} ${n.l}</a>`
  ).join('');
  const mobEl = document.getElementById('mob-nav');
  if (mobEl) {
    mobEl.innerHTML = MNI.map(n =>
      `<div class="mob-ni ${CP===n.id?'mob-na':''}" onclick="go('${n.id}')"><span>${n.i}</span><span>${n.l}</span></div>`
    ).join('');
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

function go(p) {
  document.querySelectorAll('[id^="page-"]').forEach(e => e.classList.add('hidden'));
  CP = p; rNav();
  const e = document.getElementById('page-' + p);
  if (e) { e.classList.remove('hidden'); e.innerHTML = ''; window['r_' + p](e); }
  // Hide SPA nav/footer on homepage, show on other pages
  const navW = document.querySelector('.nav-w');
  const mobNav = document.querySelector('.mob-nav');
  const modeBar = document.getElementById('mode-bar');
  const footer = document.getElementById('site-footer');
  if (p === 'home') {
    if (navW) navW.style.display = 'none';
    if (mobNav) mobNav.style.display = 'none';
    if (modeBar) modeBar.style.display = 'none';
    if (footer) footer.style.display = 'none';
    document.body.style.paddingBottom = '0';
  } else {
    if (navW) navW.style.display = '';
    if (mobNav) mobNav.style.display = '';
    if (footer) footer.style.display = '';
    document.body.style.paddingBottom = '';
    // Clean up homepage scroll handler
    if (window._hpScrollHandler) {
      window.removeEventListener('scroll', window._hpScrollHandler);
      window._hpScrollHandler = null;
    }
  }
  window.scrollTo({top:0,behavior:'smooth'});
  initSwipe();
}

// Swipe between modes on mobile
let _swTx=0,_swTy=0,_swActive=false;
function initSwipe(){
  const isMode = MODES.some(m=>m.id===CP);
  if(!isMode){_swActive=false;return;}
  _swActive=true;
}
document.addEventListener('touchstart',function(e){
  if(!_swActive)return;
  _swTx=e.touches[0].clientX;
  _swTy=e.touches[0].clientY;
},{passive:true});
document.addEventListener('touchend',function(e){
  if(!_swActive)return;
  const dx=e.changedTouches[0].clientX-_swTx;
  const dy=e.changedTouches[0].clientY-_swTy;
  if(Math.abs(dx)<80||Math.abs(dy)>Math.abs(dx)*0.6)return; // need 80px+ horizontal, not too diagonal
  const ci=MODES.findIndex(m=>m.id===CP);
  if(ci===-1)return;
  if(dx<0&&ci<MODES.length-1)go(MODES[ci+1].id); // swipe left = next
  if(dx>0&&ci>0)go(MODES[ci-1].id); // swipe right = prev
},{passive:true});

// ═══════════════ HOME ═══════════════
function r_home(el) {
  const perfumeCount = (Math.ceil(SI.length/5000)*5000).toLocaleString();
  const celebCount = CELEBS.length;
  el.innerHTML = `<div class="hp-grain">
  <!-- Homepage Nav -->
  <nav class="hp-nav" id="hp-nav">
    <div class="hp-nav-logo" onclick="go('home')">Scent<span>Wise</span></div>
    <div class="hp-nav-links">
      <a onclick="document.getElementById('hp-discover').scrollIntoView({behavior:'smooth'})">Discover</a>
      <a onclick="document.getElementById('hp-how').scrollIntoView({behavior:'smooth'})">How It Works</a>
      <a onclick="document.getElementById('hp-celebrities').scrollIntoView({behavior:'smooth'})">Collections</a>
      <a class="hp-nav-cta" onclick="go('chat')">Try Free</a>
    </div>
    <div class="hp-nav-toggle" onclick="this.classList.toggle('open');this.closest('.hp-nav').querySelector('.hp-nav-links').style.display=this.classList.contains('open')?'flex':'none'">
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
      <div class="hp-mode-item hp-reveal" onclick="go('celeb')">
        <div class="hp-mode-number">06</div>
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
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">🏎️</div><div class="hp-celeb-name">David Beckham</div><div class="hp-celeb-count">12 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">🎤</div><div class="hp-celeb-name">Rihanna</div><div class="hp-celeb-count">8 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">🎬</div><div class="hp-celeb-name">Johnny Depp</div><div class="hp-celeb-count">5 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">⚽</div><div class="hp-celeb-name">Cristiano Ronaldo</div><div class="hp-celeb-count">10 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">🎵</div><div class="hp-celeb-name">Ariana Grande</div><div class="hp-celeb-count">9 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">🏀</div><div class="hp-celeb-name">LeBron James</div><div class="hp-celeb-count">6 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">💎</div><div class="hp-celeb-name">Zendaya</div><div class="hp-celeb-count">7 fragrances</div></div>
        <div class="hp-celeb-card" onclick="go('celeb')"><div class="hp-celeb-emoji">🎤</div><div class="hp-celeb-name">Drake</div><div class="hp-celeb-count">4 fragrances</div></div>
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
    const hpObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          hpObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.hp-reveal').forEach(el => hpObserver.observe(el));
    // Homepage nav scroll effect
    const hpNav = document.getElementById('hp-nav');
    if (hpNav) {
      window._hpScrollHandler = () => { hpNav.classList.toggle('scrolled', window.scrollY > 60); };
      window.addEventListener('scroll', window._hpScrollHandler);
    }
  }, 50);
}

// ═══════════════ EXPLORE (FREE — uses local DB) ═══════════════
function r_explore(el) {
  const filters = ['all','Male','Female','Unisex'];
  el.innerHTML = `<div class="sec fi">
    <div class="sec-header">
      <h2 class="fd"><span class="gg" style="font-weight:600">Explore</span> Database</h2>
      <p>Search ${(Math.ceil(SI.length/5000)*5000).toLocaleString()}+ fragrances — works offline, no subscription needed.</p>
    </div>
    <div class="glass-panel" style="margin-bottom:24px">
      <div class="inp-row" style="margin-bottom:14px">
        <input type="text" id="exp-inp" placeholder="Search by name, brand, category..." value="${esc(expQ)}" onkeydown="if(event.key==='Enter')doExp()">
        <button class="btn btn-sm" onclick="doExp()">Search</button>
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
}

// ═══════════════ CHAT (PAID) ═══════════════
function r_chat(el) {
  if (!isPaid && !hasFreeTrialLeft() && chatMsgs.length === 0) { el.innerHTML = `<div class="sec fi">${showPaywall()}</div>`; return; }
  const sugg = ["Best fragrances under $50","Dupe for Baccarat Rouge 540","Build me a 4-season rotation","Compare Aventus vs CDNIM","Best office fragrances","Top 5 winter blind buys"];
  const trialBanner = (!isPaid && hasFreeTrialLeft()) ? `<div style="background:var(--gl);border:1px solid rgba(201,169,110,.15);border-radius:var(--r-sm);padding:10px 16px;margin-bottom:14px;font-size:12px;color:var(--g);display:flex;align-items:center;gap:8px"><span style="font-size:16px">✦</span> Free trial: <strong>${FREE_LIMIT - freeUsed}</strong> of ${FREE_LIMIT} queries remaining</div>` : (!isPaid && freeUsed >= FREE_LIMIT) ? `<div style="background:rgba(255,255,255,.02);border:1px solid var(--d4);border-radius:var(--r-sm);padding:10px 16px;margin-bottom:14px;font-size:12px;color:var(--td)">Free trial used — <a onclick="unlockPaid()" style="color:var(--g);cursor:pointer;text-decoration:underline;font-weight:500">Subscribe for unlimited access</a></div>` : '';
  el.innerHTML = `<div class="chat-wrap fi">
    <div style="margin-bottom:18px">
      <h2 class="fd" style="font-size:28px;font-weight:400"><span class="gg" style="font-weight:600">AI</span> Fragrance Advisor</h2>
      <p style="color:var(--td);font-size:13px;margin-top:6px">Powered by ${(Math.ceil(SI.length/5000)*5000).toLocaleString()}+ perfumes with real notes, accords & ratings</p>
      ${trialBanner}
    </div>
    <div class="msgs" id="c-msgs">
      ${chatMsgs.length===0?`<div style="display:flex;flex-direction:column;gap:10px;margin-top:24px">
        <p style="color:var(--td);font-size:13px;margin-bottom:4px;font-weight:500">Try asking:</p>
        ${sugg.map((s,i)=>`<div class="card fi stagger-${i+1}" onclick="cSend('${s}')" style="padding:14px 18px;cursor:pointer;font-size:14px">${s}</div>`).join('')}
      </div>`:''}
      ${chatMsgs.map(m=>`<div class="cb fi ${m.role==='user'?'cb-u':'cb-a'}">
        ${m.role==='assistant'?'<div style="color:var(--g);font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1.2px;text-transform:uppercase">ScentWise AI</div>':''}
        ${fmt(m.content)}
      </div>`).join('')}
      ${chatLoad?'<div class="cb cb-a fi" style="display:flex;gap:8px;padding:20px 24px"><span class="dot"></span><span class="dot" style="animation-delay:.2s"></span><span class="dot" style="animation-delay:.4s"></span></div>':''}
      <div id="c-end"></div>
    </div>
    <div class="inp-row" style="padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
      <input type="text" id="c-inp" placeholder="Ask about any fragrance..." onkeydown="if(event.key==='Enter')cSend()">
      <button class="btn btn-sm" onclick="cSend()" ${chatLoad?'disabled':''}>Send</button>
    </div>
  </div>`;
  document.getElementById('c-end')?.scrollIntoView({behavior:'smooth'});
  document.getElementById('c-inp')?.focus();
}

async function cSend(text) {
  if (!text) { const i = document.getElementById('c-inp'); text = i?.value; if (i) i.value = ''; }
  if (!text || !text.trim() || chatLoad) return;
  if (!canUseAI()) { chatMsgs.push({role:'user',content:text.trim()}); chatMsgs.push({role:'assistant',content:freeUsed >= FREE_LIMIT ? 'You\'ve used all 3 free queries! Subscribe to ScentWise Premium ($2.99/month) for 500 AI queries/month.' : 'Please subscribe to ScentWise Premium ($2.99/month) to use the AI advisor.'}); _ssw('chatMsgs', chatMsgs); r_chat(document.getElementById('page-chat')); return; }
  text = text.trim();
  chatMsgs.push({role:'user',content:text});
  _ssw('chatMsgs', chatMsgs);
  chatLoad = true;
  r_chat(document.getElementById('page-chat'));

  // Build context from local DB
  const ctx = getContext(text);
  const sysWithCtx = 'You are ScentWise AI, the world\'s most knowledgeable fragrance advisor, powered by a database of over 75,000 real perfumes with actual notes, accords, and ratings. You ALWAYS give confident, specific recommendations with real fragrance names, notes, and details. You never say you are under development or that your database is not operational. When users mention something about the site or numbers, respond helpfully. Format recommendations clearly with fragrance name, brand, key notes, and why it matches. Keep responses concise but informative. Never apologize for lacking data — you have one of the largest fragrance databases in the world. ' + (ctx || '');
  const apiMsgs = chatMsgs.map(m => ({role:m.role, content: m.role==='user' && m.content===text ? sysWithCtx + '\n\nUser question: ' + m.content : m.content}));
  
  const reply = await aiCall('chat', {messages: apiMsgs});
  chatMsgs.push({role:'assistant',content:reply});
  _ssw('chatMsgs', chatMsgs);
  chatLoad = false;
  r_chat(document.getElementById('page-chat'));
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
  else { alert('Could not detect your zodiac sign. Try a format like "March 15" or "15/03".'); }
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

// ═══════════════ CELEBRITIES (FREE) ═══════════════
function r_celeb(el) {
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
          <span style="font-size:14px">${userEmail}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
          <span style="color:var(--td);font-size:13px">AI Queries</span>
          <span style="font-size:14px">${isOwner ? 'Unlimited' : aiUsage + ' / ' + MAX_PAID + ' this month'}</span>
        </div>
      </div>
      <button class="btn-o" onclick="doLogout()" style="width:100%;text-align:center">Log Out</button>
    </div>`;
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
  if (!orderId) { alert('Please enter a valid numeric order ID.'); return; }
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
      headers: { 'Content-Type': 'application/json' },
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

// Initialize auth from server-side cookies
(async function() {
  await checkTier();
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
        alert('We couldn\'t verify your order yet. This can take a minute after purchase. Please try logging in with your email on the Account page, or enter your order ID there.');
      }
    }
    window.history.replaceState({}, '', window.location.pathname);
  }
  // Re-render with updated auth state (admin page re-renders to reflect owner status)
  go(CP);
})();
