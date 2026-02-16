# ScentWise — AI Fragrance Advisor

AI-powered fragrance recommendations with a database of 70,000+ perfumes, 101 celebrities, and 6 AI recommendation modes.

## Features

**Free (no subscription needed):**
- Database Explorer — search & browse 70,000+ fragrances with notes, accords, ratings, and gender filters
- Celebrity Fragrances — browse 101 celebrities and what they actually wear (with database cross-references)

**Premium ($7/month):**
- AI Chat Advisor — ask about dupes, seasonal picks, budget rotations, blind buys (with database context)
- Style Scan — upload a photo, get fragrance matches for your aesthetic
- Zodiac Match — scents matched to your birth sign's energy
- Music → Fragrance — your playlist reveals your scent identity
- Style Match — streetwear, minimalist, goth? Get matched scents
- 500 AI queries/month

## Deploy to Vercel (10 minutes)

### Step 1: Get your Gemini API key
1. Go to https://aistudio.google.com/apikey
2. Create a new API key (free)
3. Copy it

### Step 2: Push to GitHub
1. Go to github.com → click "+" → New repository → Name it "scentwise"
2. Click "uploading an existing file"
3. Unzip this folder and drag ALL files in (keep the api/ and public/ folders)
4. Click "Commit changes"

IMPORTANT: Make sure the folder structure is at the ROOT of the repo:
```
scentwise/          ← your repo
├── api/
│   └── recommend.js
├── public/
│   └── index.html
├── package.json
├── vercel.json
└── README.md
```

NOT nested inside a subfolder.

### Step 3: Deploy on Vercel
1. Go to vercel.com/new → Sign in with GitHub
2. Import your "scentwise" repo
3. Before clicking Deploy → expand "Environment Variables"
4. Add: Name = GEMINI_API_KEY, Value = your key
5. Click Deploy

Your site goes live at your-project.vercel.app in ~30 seconds.

### Step 4: Set up payments (Lemon Squeezy)
1. Go to lemonsqueezy.com → Create account
2. Create a product: "ScentWise Premium" at $7/month recurring
3. Copy the checkout URL
4. In public/index.html, find LEMON_URL and replace with your checkout URL
5. Set checkout success redirect to: https://your-site.vercel.app/?paid=true
6. Push the change to GitHub (Vercel auto-redeploys)

## Revenue Projection

At $7/month with 200 subscribers = $1,400/month
Gemini API cost: ~$0.001 per query × 500 queries × 200 users = ~$100/month
Net profit: ~$1,300/month

## Architecture

- Frontend: Single HTML file with 70K fragrances embedded client-side (searches are instant, no API needed)
- Backend: Vercel serverless function calling Gemini 2.0 Flash (only for AI features)
- Payments: Lemon Squeezy handles subscriptions
- The database explorer and celebrity browsing work completely offline — zero API cost
- AI features send relevant database context to Gemini for accurate recommendations
