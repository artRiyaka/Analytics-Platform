/* Demo dataset. Price and demand history stand in for an external market feed.
   Field notes and desk research are manually logged observations. */
(function () {
  const months = [
    ["May", 2025], ["Jun", 2025], ["Jul", 2025], ["Aug", 2025], ["Sep", 2025], ["Oct", 2025],
    ["Nov", 2025], ["Dec", 2025], ["Jan", 2026], ["Feb", 2026], ["Mar", 2026], ["Apr", 2026],
    ["May", 2026], ["Jun", 2026], ["Jul", 2026], ["Aug", 2026], ["Sep", 2026], ["Oct", 2026]
  ];

  const colorHex = {
    Ink: "#1b2430",
    Slate: "#5d6b7a",
    Ivory: "#f0eadc",
    Charcoal: "#2a2e33",
    Sand: "#cbb89a",
    Chrome: "#d5d8de",
    Espresso: "#3a2b26",
    Moss: "#3f5c45",
    Bone: "#e7e1d4",
    Oak: "#b08456",
    Clay: "#b48b74",
    Rose: "#d09a9c",
    Amber: "#d08a3e",
    Oxblood: "#6e2430",
    Gold: "#d4b15e"
  };

  const categoryColor = {
    Apparel: "#e4c27a",
    Footwear: "#8eb6d4",
    Home: "#d4a574",
    Beauty: "#e0a0b4",
    Accessories: "#c4b4e0",
    Outdoor: "#7dcea0"
  };

  function buildSeries(end, changePct, seed) {
    const start = end / (1 + changePct / 100);
    const out = [];
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const wave = Math.sin(seed + i * 0.83) * end * 0.015 + Math.cos(seed * 1.3 + i * 0.41) * end * 0.008;
      out.push(Math.round((start + (end - start) * t + wave) * 100) / 100);
    }
    out[17] = end;
    return out;
  }

  function buildDemand(end, changePct, seed) {
    const start = end / (1 + changePct / 100);
    const out = [];
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const wave = Math.sin(seed + i * 0.9) * 3.2 + Math.cos(seed * 0.8 + i * 0.33) * 1.6;
      const v = Math.max(8, Math.min(96, start + (end - start) * t + wave));
      out.push(Math.round(v));
    }
    out[17] = end;
    return out;
  }

  const specs = [
    ["p1", "Ink Wool Overcoat", "Atelier North", "Apparel", "Wool", "Ink", 640, 11, 74, 8, 1.2, "Outerwear buyers kept ink and charcoal on the forward rack into October."],
    ["p2", "Slate Denim Jacket", "Harbor & Co", "Apparel", "Denim", "Slate", 228, 6, 66, 4, 2.1, ""],
    ["p3", "Ivory Knit Polo", "Atelier North", "Apparel", "Cotton", "Ivory", 168, 1.4, 58, -1, 2.7, ""],
    ["p4", "Pleat Trouser", "Harbor & Co", "Apparel", "Wool", "Charcoal", 246, -3.2, 49, -5, 3.3, "Tailoring appointments slipped where the cloth read as office-only."],
    ["p5", "Sand Leather Loafer", "Calder", "Footwear", "Leather", "Sand", 390, 4.2, 63, 3, 4.1, ""],
    ["p6", "Chrome Runner", "Calder", "Footwear", "Mesh", "Chrome", 210, 14, 81, 12, 4.8, "Lightweight runners are being reordered ahead of darker boots."],
    ["p7", "Espresso Boot", "Calder", "Footwear", "Leather", "Espresso", 460, -8.4, 42, -9, 5.4, "Heavy boots moved to the back wall in two of the walks this month."],
    ["p8", "Garden Clog", "Calder", "Footwear", "Rubber", "Moss", 96, 9.1, 70, 7, 6.2, ""],
    ["p9", "Ceramic Pour Vessel", "Studio Hale", "Home", "Ceramic", "Bone", 84, 7.4, 72, 6, 6.8, "Matte pourers outsold high-gloss sets on the same table."],
    ["p10", "Oak Lounge Chair", "Studio Hale", "Home", "Oak", "Oak", 1280, 2.2, 55, 1, 7.5, ""],
    ["p11", "Linen Table Throw", "Studio Hale", "Home", "Linen", "Sand", 140, 10.5, 68, 8, 8.1, ""],
    ["p12", "Stoneware Lamp", "Studio Hale", "Home", "Stoneware", "Clay", 320, -5.1, 44, -4, 8.8, ""],
    ["p13", "Serum Veil 30", "Lumen Lab", "Beauty", "Glass", "Bone", 54, 16.2, 86, 14, 9.4, "Counters are editing routines down to a veil, a balm, and a compact."],
    ["p14", "Mineral Balm", "Lumen Lab", "Beauty", "Wax", "Clay", 28, -6.4, 47, -5, 10.1, ""],
    ["p15", "Tint Compact", "Lumen Lab", "Beauty", "Recycled aluminum", "Rose", 36, 12.4, 77, 10, 10.7, ""],
    ["p16", "Oil Hair Veil", "Lumen Lab", "Beauty", "Glass", "Amber", 42, 3.1, 60, 2, 11.3, ""],
    ["p17", "Oxblood Mini Bag", "Marlowe", "Accessories", "Leather", "Oxblood", 520, -9.2, 40, -8, 12.2, "Oxblood was presented, but orders concentrated in sand and ink."],
    ["p18", "Gold Chain Cuff", "Marlowe", "Accessories", "Brass", "Gold", 180, 8.2, 69, 6, 12.9, ""],
    ["p19", "Silk Scarf Grid", "Marlowe", "Accessories", "Silk", "Ivory", 210, 0.6, 52, -1, 13.5, ""],
    ["p20", "Woven Tote", "Marlowe", "Accessories", "Cotton", "Sand", 150, 13.1, 78, 11, 14.2, "Open-weave totes are replacing structured minis at the entry table."],
    ["p21", "Trail Shell Jacket", "Fieldwork", "Outdoor", "Recycled nylon", "Moss", 340, 15.4, 83, 13, 15.1, "Moss shells stayed on forward tables rather than moving to clearance."],
    ["p22", "Packable Daypack", "Fieldwork", "Outdoor", "Recycled nylon", "Ink", 188, 5.2, 64, 3, 15.8, ""],
    ["p23", "Merino Base Layer", "Fieldwork", "Outdoor", "Merino", "Charcoal", 128, 7.6, 71, 6, 16.4, "Buyers asked for packable wool, not a heavier melton."],
    ["p24", "Down Vest", "Fieldwork", "Outdoor", "Recycled polyester", "Ink", 260, 4.4, 61, 2, 17.1, ""]
  ];

  const products = specs.map((row) => ({
    id: row[0],
    name: row[1],
    brand: row[2],
    category: row[3],
    material: row[4],
    color: row[5],
    price: row[6],
    prices: buildSeries(row[6], row[7], row[10]),
    demand: buildDemand(row[8], row[9], row[10] + 0.4),
    note: row[11]
  }));

  const insights = [
    {
      kicker: "Color",
      title: "Ink and moss are carrying outerwear into late October",
      body: "Across apparel and outdoor, dark neutral and moss are still being reordered. Brighter seasonal color is present in the line, but it is not where the demand index is building.",
      date: "2026-10-09",
      signal: "Rising"
    },
    {
      kicker: "Material",
      title: "Recycled nylon is no longer framed as a compromise",
      body: "Shells and packs in recycled nylon are holding price and demand together. Buyers describe the hand-feel next to merino, not as a substitute for it.",
      date: "2026-10-02",
      signal: "Rising"
    },
    {
      kicker: "Beauty",
      title: "Gloss is leaving the counter",
      body: "The fastest beauty names are simple veils and compacts. Heavier balms with a clinical shine are the group giving price back.",
      date: "2026-09-24",
      signal: "Watch"
    },
    {
      kicker: "Home",
      title: "Dry clay is replacing shine on the table",
      body: "Bone ceramic and sand linen are moving together. Stoneware with a glossy glaze is the home silhouette under the most pressure.",
      date: "2026-09-18",
      signal: "Rising"
    },
    {
      kicker: "Accessories",
      title: "Small leather goods are splitting in two directions",
      body: "Sand and ink woven and leather pieces are rising. Oxblood minis are the clear cooling pocket inside an otherwise stable accessories set.",
      date: "2026-09-11",
      signal: "Cooling"
    }
  ];

  const observations = [
    { date: "2026-10-11", place: "Copenhagen retail", text: "Moss shells remained on the forward table. Staff had not been asked to mark them down." },
    { date: "2026-10-08", place: "Seoul showroom", text: "Buyers asked for packable wool and rejected a heavier melton offered at a similar price." },
    { date: "2026-10-04", place: "Milan showroom", text: "Oxblood leather was shown first. The order conversation moved to sand and ink within the hour." },
    { date: "2026-09-28", place: "Los Angeles pop-up", text: "Matte ceramic pourers outsold glazed sets placed on the same surface." },
    { date: "2026-09-22", place: "London counter", text: "Shoppers compared routines and left with fewer steps: veil, compact, and a plain balm." },
    { date: "2026-09-16", place: "Portland outfitter", text: "Repair patches and recraft notes came up without a prompt, especially on wool and nylon." },
    { date: "2026-09-09", place: "Paris apartment retail", text: "Sand linen was styled with oak. White lacquer sets were still in the room, but not in the vignette." }
  ];

  const preferences = [
    { name: "Quiet luxury", score: 82, delta: 4.1, note: "Lower branding, higher material quality, fewer logos on the product itself." },
    { name: "Repair and longevity", score: 76, delta: 6.8, note: "Spare parts, recrafting, and visible mending showed up unprompted in field notes." },
    { name: "Mineral and earth color", score: 71, delta: 5.2, note: "Ink, moss, clay, and sand are outpacing brights across categories." },
    { name: "Low-sheen surfaces", score: 69, delta: 3.4, note: "Matte ceramic, brushed metal, and dry wool are the finishes being pulled forward." },
    { name: "Travel-light kits", score: 64, delta: 2.1, note: "Packable layers, daypacks, and soft totes are grouping into one purchase story." },
    { name: "Short beauty routines", score: 61, delta: -1.8, note: "High-gloss, multi-step routines are cooling against veils, compacts, and simple oils." }
  ];

  const categories = ["Apparel", "Footwear", "Home", "Beauty", "Accessories", "Outdoor"];
  const materials = [...new Set(products.map((p) => p.material))].sort();
  const colors = [...new Set(products.map((p) => p.color))].sort();

  window.VELA = {
    months,
    products,
    insights,
    observations,
    preferences,
    categories,
    materials,
    colors,
    colorHex,
    categoryColor
  };
})();
