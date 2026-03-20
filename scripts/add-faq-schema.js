#!/usr/bin/env node
/**
 * Adds FAQPage schema.org structured data to blog articles.
 * Extracts Q&A pairs from h2/h3 headings that are questions + their following paragraphs.
 *
 * Usage: node scripts/add-faq-schema.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'public', 'blog');
const FAQ_MARKER = '<!-- faq-schema -->';

function extractFAQs(html) {
  const faqs = [];
  // Match h2 or h3 headings that contain a question mark or start with common question words
  const headingRegex = /<h[23][^>]*>([^<]+(?:\?|What |How |Why |Which |When |Where |Is |Are |Can |Do |Should ))[^<]*<\/h[23]>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const question = match[1].replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    // Get the next <p> tag content as the answer
    const afterHeading = html.slice(match.index + match[0].length, match.index + match[0].length + 2000);
    const pMatch = afterHeading.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (pMatch) {
      const answer = pMatch[1]
        .replace(/<[^>]+>/g, '') // strip HTML tags
        .replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .trim();
      if (answer.length > 30 && question.length > 10) {
        faqs.push({ question, answer: answer.slice(0, 500) });
      }
    }
    if (faqs.length >= 6) break; // Max 6 FAQs per page
  }
  return faqs;
}

function makeFAQSchema(faqs) {
  if (!faqs.length) return '';
  const escaped = (s) => s.replace(/"/g, '\\"').replace(/\n/g, ' ');
  return `${FAQ_MARKER}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    ${faqs.map(f => `{
      "@type": "Question",
      "name": "${escaped(f.question)}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${escaped(f.answer)}"
      }
    }`).join(',\n    ')}
  ]
}
</script>`;
}

let modified = 0;
let totalFAQs = 0;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes(FAQ_MARKER)) continue;

  const faqs = extractFAQs(html);
  if (!faqs.length) continue;

  // Insert before </head>
  const headEnd = html.indexOf('</head>');
  if (headEnd > -1) {
    html = html.slice(0, headEnd) + '\n' + makeFAQSchema(faqs) + '\n' + html.slice(headEnd);
    fs.writeFileSync(filePath, html, 'utf8');
    modified++;
    totalFAQs += faqs.length;
    console.log(`  ✓ ${file} (${faqs.length} FAQs)`);
  }
}

console.log(`\nDone! Added FAQ schema to ${modified} articles (${totalFAQs} total Q&As).`);
