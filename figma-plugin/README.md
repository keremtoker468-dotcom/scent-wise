# ScentWise Figma Plugin

A Figma plugin for the ScentWise fragrance advisor app. Insert perfume-branded design elements directly into your Figma files.

## Features

- **Perfume Cards** — Branded cards with fragrance-family color accents, notes, and metadata
- **Mood Boards** — Multi-card grids for presenting multiple fragrances (2–9 perfumes)
- **Color Palettes** — Auto-generated color swatches based on fragrance families
- **Text Blocks** — Clean typography blocks with full perfume details

## Installation (Development)

1. Open Figma Desktop
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select `figma-plugin/manifest.json` from this repository
4. The plugin will appear under **Plugins → Development → ScentWise**

## Usage

1. Open the plugin from the Figma menu
2. Search for perfumes by name, brand, or fragrance notes
3. Click items to select them (multiple selections supported)
4. Choose an action:
   - **Card** — Single perfume card (1 perfume selected)
   - **Text** — Text-only info block (1 perfume selected)
   - **Mood Board** — Grid layout (2–9 perfumes selected)
   - **Palette** — Color swatches (1+ perfumes selected)

## Fragrance Family Colors

| Family | Color |
|--------|-------|
| Floral | Pink |
| Woody | Brown |
| Oriental | Amber |
| Fresh | Light Blue |
| Citrus | Yellow |
| Aquatic | Blue |
| Gourmand | Warm Tan |
| Green | Green |
| Fougère | Sage |
| Chypre | Warm Gray |

## Plugin Files

```
figma-plugin/
├── manifest.json   # Figma plugin metadata
├── code.js         # Plugin sandbox code (Figma API calls)
├── ui.html         # Plugin UI (search, selection, actions)
└── README.md       # This file
```

## Publishing to Figma Community

To publish this plugin:

1. Create a Figma account and log in to Figma Desktop
2. Go to **Plugins → Development → ScentWise → Publish…**
3. Fill in the plugin details and submit for review
