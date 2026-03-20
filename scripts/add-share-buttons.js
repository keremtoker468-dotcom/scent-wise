#!/usr/bin/env node
/**
 * Injects social share buttons into blog articles.
 * Adds Copy/Twitter/WhatsApp buttons after the article meta section.
 *
 * Usage: node scripts/add-share-buttons.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'public', 'blog');
const SHARE_MARKER = '<!-- share-buttons -->';

const SHARE_CSS = `<style>.share-bar{display:flex;gap:8px;align-items:center;margin:20px 0;padding:16px 0;border-top:1px solid var(--d4);border-bottom:1px solid var(--d4);flex-wrap:wrap}.share-bar>span{font-size:13px;color:var(--td);font-weight:500}.share-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;border:1px solid var(--d4);background:transparent;color:var(--td);font-size:13px;text-decoration:none;cursor:pointer;transition:all .2s}.share-btn:hover{background:rgba(201,169,110,.1);border-color:rgba(201,169,110,.3);color:var(--g);text-decoration:none}</style>
<script>function openEmailShare(s,b){s=decodeURIComponent(s);b=decodeURIComponent(b);var d=document.createElement('div');d.id='email-share-picker';d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)';var bs='display:flex;align-items:center;gap:10px;width:100%;padding:14px 18px;border:1px solid #23232a;border-radius:10px;background:#16161a;color:#f0ece4;font-size:14px;cursor:pointer;text-decoration:none';d.innerHTML='<div style="background:#0f0f12;border:1px solid #23232a;border-radius:16px;padding:24px;max-width:320px;width:90%"><div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#f0ece4">Send via email</div><div style="display:flex;flex-direction:column;gap:8px"><a href="https://mail.google.com/mail/?view=cm&su='+encodeURIComponent(s)+'&body='+encodeURIComponent(b)+'" target="_blank" rel="noopener" style="'+bs+'" onclick="closeEmailPicker()">Gmail</a><a href="https://outlook.live.com/mail/0/deeplink/compose?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(b)+'" target="_blank" rel="noopener" style="'+bs+'" onclick="closeEmailPicker()">Outlook</a><a href="https://compose.mail.yahoo.com/?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(b)+'" target="_blank" rel="noopener" style="'+bs+'" onclick="closeEmailPicker()">Yahoo Mail</a><a href="mailto:?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(b)+'" style="'+bs+'" onclick="closeEmailPicker()">Other</a></div><button onclick="closeEmailPicker()" style="margin-top:14px;width:100%;text-align:center;color:#8a8278;font-size:13px;cursor:pointer;padding:8px;background:none;border:none">Cancel</button></div>';d.addEventListener('click',function(e){if(e.target===d)closeEmailPicker()});document.body.appendChild(d)}function closeEmailPicker(){var e=document.getElementById('email-share-picker');if(e)e.remove()}</script>`;

function makeShareHTML(title, url) {
  const tweetText = encodeURIComponent(title + '\n\n' + url);
  const waText = encodeURIComponent(title + '\n\nRead more: ' + url);
  const emailSubject = encodeURIComponent(title);
  const emailBody = encodeURIComponent(title + '\n\nRead more: ' + url);
  return `${SHARE_MARKER}
${SHARE_CSS}
<div class="share-bar">
  <span>Share this:</span>
  <button class="share-btn" onclick="navigator.clipboard.writeText('${url}').then(()=>this.textContent='Copied!')">📋 Copy</button>
  <a class="share-btn" href="https://wa.me/?text=${waText}" target="_blank" rel="noopener">💬 WhatsApp</a>
  <a class="share-btn" href="mailto:?subject=${emailSubject}&body=${emailBody}">✉️ Email</a>
  <a class="share-btn" href="https://twitter.com/intent/tweet?text=${tweetText}" target="_blank" rel="noopener">𝕏 Tweet</a>
</div>`;
}

let modified = 0;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes(SHARE_MARKER)) continue;

  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' | ScentWise', '').replace(' — ScentWise', '') : 'ScentWise Blog';
  const url = `https://scent-wise.com/blog/${file}`;

  // Insert after the <div class="meta"> section
  const metaEnd = html.indexOf('</div>', html.indexOf('class="meta"'));
  if (metaEnd > -1) {
    const insertPos = metaEnd + 6;
    html = html.slice(0, insertPos) + '\n' + makeShareHTML(title, url) + html.slice(insertPos);
    fs.writeFileSync(filePath, html, 'utf8');
    modified++;
    console.log(`  ✓ ${file}`);
  }
}

console.log(`\nDone! Added share buttons to ${modified} articles.`);
