// ScentWise Figma Plugin - Main Code
// Runs in Figma's plugin sandbox (no DOM access)

figma.showUI(__html__, { width: 400, height: 560, title: "ScentWise" });

// Handle messages from the UI iframe
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "create-perfume-card":
      await createPerfumeCard(msg.perfume);
      break;
    case "create-scent-palette":
      await createScentPalette(msg.perfumes);
      break;
    case "insert-perfume-text":
      await insertPerfumeText(msg.perfume);
      break;
    case "create-mood-board":
      await createMoodBoard(msg.perfumes);
      break;
    case "cancel":
      figma.closePlugin();
      break;
  }
};

// Color palette for fragrance families
const FRAGRANCE_COLORS = {
  floral: { r: 0.96, g: 0.60, b: 0.70 },
  woody: { r: 0.55, g: 0.38, b: 0.24 },
  oriental: { r: 0.73, g: 0.44, b: 0.14 },
  fresh: { r: 0.53, g: 0.81, b: 0.98 },
  citrus: { r: 0.99, g: 0.77, b: 0.20 },
  aquatic: { r: 0.24, g: 0.64, b: 0.88 },
  gourmand: { r: 0.82, g: 0.58, b: 0.40 },
  green: { r: 0.40, g: 0.73, b: 0.42 },
  fougere: { r: 0.47, g: 0.62, b: 0.38 },
  chypre: { r: 0.52, g: 0.46, b: 0.34 },
  default: { r: 0.85, g: 0.80, b: 0.95 },
};

function getFragranceColor(family) {
  if (!family) return FRAGRANCE_COLORS.default;
  const key = family.toLowerCase().trim();
  for (const [name, color] of Object.entries(FRAGRANCE_COLORS)) {
    if (key.includes(name)) return color;
  }
  return FRAGRANCE_COLORS.default;
}

async function loadFonts() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
}

// Create a structured perfume card component
async function createPerfumeCard(perfume) {
  await loadFonts();

  const frame = figma.createFrame();
  frame.name = `Perfume Card – ${perfume.name}`;
  frame.resize(320, 200);
  frame.cornerRadius = 12;
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  // Drop shadow
  frame.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.12 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Accent bar (left side, color-coded by fragrance family)
  const accent = figma.createRectangle();
  accent.name = "Accent";
  accent.resize(6, 200);
  accent.x = 0;
  accent.y = 0;
  accent.cornerRadius = 12;
  const accentColor = getFragranceColor(perfume.family);
  accent.fills = [{ type: "SOLID", color: accentColor }];
  frame.appendChild(accent);

  // Brand name
  const brand = figma.createText();
  brand.name = "Brand";
  brand.fontName = { family: "Inter", style: "Bold" };
  brand.fontSize = 11;
  brand.characters = (perfume.brand || "Unknown Brand").toUpperCase();
  brand.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  brand.letterSpacing = { value: 1.5, unit: "PIXELS" };
  brand.x = 24;
  brand.y = 20;
  frame.appendChild(brand);

  // Perfume name
  const name = figma.createText();
  name.name = "Name";
  name.fontName = { family: "Inter", style: "Bold" };
  name.fontSize = 20;
  name.characters = perfume.name || "Unknown Perfume";
  name.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  name.x = 24;
  name.y = 38;
  name.textAutoResize = "WIDTH_AND_HEIGHT";
  frame.appendChild(name);

  // Family tag
  if (perfume.family) {
    const tagFrame = figma.createFrame();
    tagFrame.name = "Family Tag";
    tagFrame.resize(80, 22);
    tagFrame.cornerRadius = 11;
    tagFrame.fills = [
      {
        type: "SOLID",
        color: accentColor,
        opacity: 0.15,
      },
    ];
    tagFrame.x = 24;
    tagFrame.y = 72;

    const tagText = figma.createText();
    tagText.name = "Family Label";
    tagText.fontName = { family: "Inter", style: "Medium" };
    tagText.fontSize = 10;
    tagText.characters = perfume.family;
    tagText.fills = [{ type: "SOLID", color: accentColor }];
    tagText.x = 8;
    tagText.y = 5;
    tagText.textAutoResize = "WIDTH_AND_HEIGHT";
    tagFrame.resize(tagText.width + 16, 22);
    tagFrame.appendChild(tagText);
    frame.appendChild(tagFrame);
  }

  // Notes section
  if (perfume.notes) {
    const notesLabel = figma.createText();
    notesLabel.name = "Notes Label";
    notesLabel.fontName = { family: "Inter", style: "Bold" };
    notesLabel.fontSize = 10;
    notesLabel.characters = "NOTES";
    notesLabel.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
    notesLabel.letterSpacing = { value: 1, unit: "PIXELS" };
    notesLabel.x = 24;
    notesLabel.y = 108;
    frame.appendChild(notesLabel);

    const notesText = figma.createText();
    notesText.name = "Notes";
    notesText.fontName = { family: "Inter", style: "Regular" };
    notesText.fontSize = 12;
    const notesStr = Array.isArray(perfume.notes)
      ? perfume.notes.slice(0, 5).join(", ")
      : String(perfume.notes).split(",").slice(0, 5).join(", ");
    notesText.characters = notesStr || "–";
    notesText.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
    notesText.x = 24;
    notesText.y = 124;
    notesText.textAutoResize = "WIDTH_AND_HEIGHT";
    frame.appendChild(notesText);
  }

  // Year badge
  if (perfume.year) {
    const year = figma.createText();
    year.name = "Year";
    year.fontName = { family: "Inter", style: "Regular" };
    year.fontSize = 11;
    year.characters = String(perfume.year);
    year.fills = [{ type: "SOLID", color: { r: 0.65, g: 0.65, b: 0.65 } }];
    year.textAlignHorizontal = "RIGHT";
    year.x = 270;
    year.y = 170;
    year.textAutoResize = "WIDTH_AND_HEIGHT";
    frame.appendChild(year);
  }

  // Position in canvas
  const viewport = figma.viewport.center;
  frame.x = viewport.x - 160;
  frame.y = viewport.y - 100;

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.currentPage.selection = [frame];

  figma.ui.postMessage({ type: "card-created", name: perfume.name });
}

// Create a mood board grid of perfume cards
async function createMoodBoard(perfumes) {
  await loadFonts();

  const COLS = 3;
  const CARD_W = 320;
  const CARD_H = 200;
  const GAP = 20;

  const board = figma.createFrame();
  board.name = "ScentWise Mood Board";
  board.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];
  board.cornerRadius = 16;

  const rows = Math.ceil(perfumes.length / COLS);
  board.resize(
    COLS * CARD_W + (COLS + 1) * GAP,
    rows * CARD_H + (rows + 1) * GAP + 60
  );

  // Title
  const title = figma.createText();
  title.name = "Title";
  title.fontName = { family: "Inter", style: "Bold" };
  title.fontSize = 22;
  title.characters = "ScentWise Mood Board";
  title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  title.x = GAP;
  title.y = GAP;
  board.appendChild(title);

  for (let i = 0; i < perfumes.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const card = figma.createFrame();
    card.name = perfumes[i].name;
    card.resize(CARD_W, CARD_H);
    card.cornerRadius = 12;
    card.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    card.x = GAP + col * (CARD_W + GAP);
    card.y = 60 + row * (CARD_H + GAP);

    // Accent
    const accent = figma.createRectangle();
    accent.resize(6, CARD_H);
    const c = getFragranceColor(perfumes[i].family);
    accent.fills = [{ type: "SOLID", color: c }];
    accent.cornerRadius = 12;
    card.appendChild(accent);

    // Brand
    const brand = figma.createText();
    brand.fontName = { family: "Inter", style: "Bold" };
    brand.fontSize = 10;
    brand.characters = (perfumes[i].brand || "").toUpperCase();
    brand.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
    brand.letterSpacing = { value: 1, unit: "PIXELS" };
    brand.x = 20;
    brand.y = 16;
    card.appendChild(brand);

    // Name
    const name = figma.createText();
    name.fontName = { family: "Inter", style: "Bold" };
    name.fontSize = 16;
    name.characters = perfumes[i].name || "–";
    name.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
    name.x = 20;
    name.y = 34;
    card.appendChild(name);

    if (perfumes[i].family) {
      const fam = figma.createText();
      fam.fontName = { family: "Inter", style: "Regular" };
      fam.fontSize = 11;
      fam.characters = perfumes[i].family;
      fam.fills = [{ type: "SOLID", color: c }];
      fam.x = 20;
      fam.y = 60;
      card.appendChild(fam);
    }

    board.appendChild(card);
  }

  const viewport = figma.viewport.center;
  board.x = viewport.x - board.width / 2;
  board.y = viewport.y - board.height / 2;

  figma.currentPage.appendChild(board);
  figma.viewport.scrollAndZoomIntoView([board]);
  figma.currentPage.selection = [board];

  figma.ui.postMessage({ type: "board-created", count: perfumes.length });
}

// Create a scent note color palette
async function createScentPalette(perfumes) {
  await loadFonts();

  const families = [
    ...new Set(perfumes.map((p) => p.family).filter(Boolean)),
  ].slice(0, 8);

  const SWATCH_W = 120;
  const SWATCH_H = 80;
  const GAP = 12;

  const frame = figma.createFrame();
  frame.name = "ScentWise Color Palette";
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  frame.cornerRadius = 12;
  frame.resize(
    families.length * (SWATCH_W + GAP) + GAP,
    SWATCH_H + 60 + GAP * 2
  );

  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Bold" };
  title.fontSize = 16;
  title.characters = "Fragrance Family Palette";
  title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  title.x = GAP;
  title.y = GAP;
  frame.appendChild(title);

  families.forEach((family, i) => {
    const color = getFragranceColor(family);

    const swatch = figma.createRectangle();
    swatch.name = family;
    swatch.resize(SWATCH_W, SWATCH_H);
    swatch.x = GAP + i * (SWATCH_W + GAP);
    swatch.y = 44;
    swatch.cornerRadius = 8;
    swatch.fills = [{ type: "SOLID", color }];
    frame.appendChild(swatch);

    const label = figma.createText();
    label.fontName = { family: "Inter", style: "Medium" };
    label.fontSize = 11;
    label.characters = family;
    label.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
    label.x = GAP + i * (SWATCH_W + GAP);
    label.y = 44 + SWATCH_H + 8;
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    frame.appendChild(label);
  });

  const viewport = figma.viewport.center;
  frame.x = viewport.x - frame.width / 2;
  frame.y = viewport.y - frame.height / 2;

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.currentPage.selection = [frame];

  figma.ui.postMessage({ type: "palette-created" });
}

// Insert perfume details as a formatted text block
async function insertPerfumeText(perfume) {
  await loadFonts();

  const frame = figma.createFrame();
  frame.name = `Perfume Info – ${perfume.name}`;
  frame.fills = [];
  frame.resize(300, 160);

  const lines = [
    { text: perfume.name || "–", size: 20, style: "Bold" },
    { text: `by ${perfume.brand || "Unknown"}`, size: 13, style: "Regular" },
    { text: " ", size: 8, style: "Regular" },
    {
      text: perfume.family ? `Family: ${perfume.family}` : "",
      size: 12,
      style: "Medium",
    },
    { text: perfume.year ? `Year: ${perfume.year}` : "", size: 12, style: "Regular" },
    {
      text: perfume.notes
        ? `Notes: ${
            Array.isArray(perfume.notes)
              ? perfume.notes.slice(0, 6).join(", ")
              : String(perfume.notes).split(",").slice(0, 6).join(", ")
          }`
        : "",
      size: 12,
      style: "Regular",
    },
  ].filter((l) => l.text.trim() !== "");

  let yOffset = 0;
  lines.forEach((line) => {
    const text = figma.createText();
    text.fontName = { family: "Inter", style: line.style };
    text.fontSize = line.size;
    text.characters = line.text;
    text.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
    text.x = 0;
    text.y = yOffset;
    text.textAutoResize = "WIDTH_AND_HEIGHT";
    frame.appendChild(text);
    yOffset += line.size + 6;
  });

  frame.resize(300, yOffset);

  const viewport = figma.viewport.center;
  frame.x = viewport.x - 150;
  frame.y = viewport.y - yOffset / 2;

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.currentPage.selection = [frame];

  figma.ui.postMessage({ type: "text-inserted", name: perfume.name });
}
