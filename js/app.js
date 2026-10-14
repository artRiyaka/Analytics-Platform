(function () {
  const DATA = window.VELA;
  const PRODUCTS = DATA.products;
  const RANGE = { "3M": 3, "6M": 6, "12M": 12, "18M": 18 };
  const MONTH_FULL = {
    Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June",
    Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December"
  };
  const PALETTE = ["#e4c27a", "#8eb6d4", "#7dcea0", "#e0a0b0", "#c4b4e0", "#e0b07a", "#9fd0c8", "#f0c0a0"];
  const TITLES = {
    overview: "Overview",
    products: "Products",
    analytics: "Analytics",
    trends: "Trends",
    insights: "Insights"
  };

  const state = {
    view: "overview",
    range: "12M",
    query: "",
    filters: { category: "all", material: "all", color: "all", signal: "all" },
    sort: "trend",
    compare: [],
    drawerId: null,
    compareOpen: false,
    breakdown: "categories",
    trendScope: "all"
  };

  let chartSeq = 0;
  let toastTimer = 0;

  const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function money(n) { return moneyFmt.format(Math.round(n)); }

  function signedPct(n) {
    const v = Math.abs(n).toFixed(1);
    if (n > 0.05) return `+${v}%`;
    if (n < -0.05) return `−${v}%`;
    return "0.0%";
  }

  function deltaClass(n) {
    if (n > 0.15) return "up";
    if (n < -0.15) return "down";
    return "flat";
  }

  function phrase(change) {
    const n = Math.abs(change).toFixed(1);
    return change >= 0 ? `up ${n}%` : `down ${n}%`;
  }

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d} ${names[m - 1]} ${y}`;
  }

  function initials(brand) {
    const parts = brand.replace(/&/g, " ").split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0] || ""));
    if (parts.length <= 1) return (parts[0] || "?").slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  }

  function bandInk(color) {
    return ["Ink", "Oxblood", "Moss", "Slate", "Espresso", "Charcoal"].includes(color) ? "#f4f1ea" : "#1a1814";
  }

  function monthSlice() { return DATA.months.slice(-RANGE[state.range]); }

  function sliceMetric(product, key) { return product[key].slice(-RANGE[state.range]); }

  function pctChange(arr) {
    const a = arr[0];
    const b = arr[arr.length - 1];
    if (!a) return 0;
    return ((b - a) / a) * 100;
  }

  function priceChange(product) { return pctChange(sliceMetric(product, "prices")); }
  function demandChange(product) { return pctChange(sliceMetric(product, "demand")); }
  function demandNow(product) { return sliceMetric(product, "demand").at(-1); }

  function trendScore(product) {
    const score = 50 + priceChange(product) * 1.6 + demandChange(product) * 0.8 + (demandNow(product) - 55) * 0.25;
    return Math.max(1, Math.min(99, Math.round(score)));
  }

  function signalOf(product) {
    const ch = priceChange(product);
    if (ch >= 2) return "Rising";
    if (ch <= -2) return "Cooling";
    return "Stable";
  }

  function rebase(arr) {
    const base = arr[0] || 1;
    return arr.map((v) => (v / base) * 100);
  }

  function indexSeries(products) {
    const n = RANGE[state.range];
    if (!products.length) return [];
    const rebased = products.map((p) => rebase(p.prices.slice(-n)));
    return rebased[0].map((_, i) => rebased.reduce((sum, arr) => sum + arr[i], 0) / rebased.length);
  }

  function grouped(key, products) {
    const map = new Map();
    products.forEach((p) => {
      if (!map.has(p[key])) map.set(p[key], []);
      map.get(p[key]).push(p);
    });
    return [...map.entries()].map(([name, items]) => {
      const change = items.reduce((sum, p) => sum + priceChange(p), 0) / items.length;
      const demand = items.reduce((sum, p) => sum + demandNow(p), 0) / items.length;
      const score = Math.round(items.reduce((sum, p) => sum + trendScore(p), 0) / items.length);
      return { name, count: items.length, change, demand, score };
    }).sort((a, b) => b.change - a.change);
  }

  function story(products) {
    const cats = grouped("category", products);
    if (!cats.length) return "No products in this view.";
    const top = cats[0];
    if (cats.length === 1) return `${top.name} is ${phrase(top.change)} in this window.`;
    const bottom = cats[cats.length - 1];
    const endWord = bottom.change < 0 ? "the softest" : "the slowest";
    return `${top.name} leads this window, ${phrase(top.change)}. ${bottom.name} is ${endWord}, ${phrase(bottom.change)}.`;
  }

  function getProduct(id) { return PRODUCTS.find((p) => p.id === id); }

  function filteredProducts() {
    const q = state.query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (state.filters.category !== "all" && p.category !== state.filters.category) return false;
      if (state.filters.material !== "all" && p.material !== state.filters.material) return false;
      if (state.filters.color !== "all" && p.color !== state.filters.color) return false;
      if (state.filters.signal !== "all" && signalOf(p) !== state.filters.signal) return false;
      if (!q) return true;
      const blob = `${p.name} ${p.brand} ${p.category} ${p.material} ${p.color}`.toLowerCase();
      return blob.includes(q);
    }).sort((a, b) => {
      if (state.sort === "change") return priceChange(b) - priceChange(a);
      if (state.sort === "price") return b.price - a.price;
      if (state.sort === "demand") return demandNow(b) - demandNow(a);
      if (state.sort === "name") return a.name.localeCompare(b.name);
      return trendScore(b) - trendScore(a);
    });
  }

  function filtersActive() {
    const f = state.filters;
    return Boolean(state.query || f.category !== "all" || f.material !== "all" || f.color !== "all" || f.signal !== "all");
  }

  function scopedProducts() {
    if (state.trendScope === "all") return PRODUCTS;
    return PRODUCTS.filter((p) => p.category === state.trendScope);
  }

  function analyticsProducts() {
    if (state.breakdown === "categories") return PRODUCTS;
    return PRODUCTS.filter((p) => p.category === state.breakdown);
  }

  function analyticsSeries() {
    if (state.breakdown === "categories") {
      const series = [{ name: "Market", color: "#e4c27a", values: indexSeries(PRODUCTS), width: 2.4 }];
      DATA.categories.forEach((cat) => {
        series.push({
          name: cat,
          color: DATA.categoryColor[cat],
          values: indexSeries(PRODUCTS.filter((p) => p.category === cat)),
          width: 1.5
        });
      });
      return series;
    }
    return analyticsProducts().map((p, i) => ({
      name: p.name,
      color: PALETTE[i % PALETTE.length],
      values: rebase(sliceMetric(p, "prices")),
      width: 1.8
    }));
  }

  function spark(values) {
    const w = 96;
    const h = 32;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const d = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const color = values.at(-1) >= values[0] ? "#7dcea0" : "#e07a7a";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function legendHTML(series) {
    return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  }

  function selectOptions(list, current, allLabel) {
    const all = `<option value="all"${current === "all" ? " selected" : ""}>${esc(allLabel)}</option>`;
    const rest = list.map((v) => `<option value="${esc(v)}"${current === v ? " selected" : ""}>${esc(v)}</option>`).join("");
    return all + rest;
  }

  function divergingRows(rows, action) {
    const max = Math.max(...rows.map((r) => Math.abs(r.change)), 1);
    return `<div class="rank-list">${rows.map((r) => {
      const pct = (Math.abs(r.change) / max) * 100;
      const pos = r.change >= 0;
      return `<button class="rank-row" type="button" data-action="${action}" data-value="${esc(r.name)}">
        <span class="rank-name">${esc(r.name)}<small>${r.count} product${r.count === 1 ? "" : "s"}</small></span>
        <span class="divbar" aria-hidden="true">
          <span class="divbar-neg"><span style="width:${pos ? 0 : pct}%"></span></span>
          <span class="divbar-pos"><span style="width:${pos ? pct : 0}%"></span></span>
        </span>
        <span class="delta ${deltaClass(r.change)}">${signedPct(r.change)}</span>
      </button>`;
    }).join("")}</div>`;
  }

  function productCard(p) {
    const ch = priceChange(p);
    const sig = signalOf(p);
    const on = state.compare.includes(p.id);
    return `<article class="pcard">
      <button class="pcard-hit" type="button" data-action="open" data-id="${p.id}">
        <span class="pcard-band" style="--swatch:${DATA.colorHex[p.color]};--ink:${bandInk(p.color)}">
          <span class="pcard-top">
            <span class="kicker">${esc(p.category)}</span>
            <span class="sig">${sig}</span>
          </span>
          <span class="monogram">${esc(initials(p.brand))}</span>
        </span>
        <span class="pcard-body">
          <span class="pcard-brand">${esc(p.brand)}</span>
          <span class="pcard-name">${esc(p.name)}</span>
          <span class="pcard-price"><span class="num">${money(p.price)}</span><span class="delta ${deltaClass(ch)}">${signedPct(ch)}</span></span>
          <span class="pcard-foot">${spark(sliceMetric(p, "prices"))}<span>${esc(p.material)} · ${esc(p.color)}</span></span>
        </span>
      </button>
      <button class="btn-ghost btn-compare${on ? " is-on" : ""}" type="button" data-action="toggle-compare" data-id="${p.id}" aria-pressed="${on}">${on ? "Added" : "Compare"}</button>
    </article>`;
  }

  function miniList(items) {
    if (!items.length) return `<p class="empty">Nothing in this group.</p>`;
    return `<ul class="mini">${items.map((p) => {
      const ch = priceChange(p);
      return `<li>
        <button class="linkish" type="button" data-action="open" data-id="${p.id}"><span>${esc(p.name)}</span><small>${esc(p.brand)}</small></button>
        <span class="delta ${deltaClass(ch)}">${signedPct(ch)}</span>
      </li>`;
    }).join("")}</ul>`;
  }

  function kpi(label, value, hint) {
    return `<article class="kpi"><p class="eyebrow">${esc(label)}</p><p class="value">${value}</p><p class="hint">${hint}</p></article>`;
  }

  function renderOverview() {
    const index = indexSeries(PRODUCTS);
    const latest = index.at(-1);
    const delta = latest - 100;
    const changes = PRODUCTS.map(priceChange);
    const avg = changes.reduce((s, n) => s + n, 0) / changes.length;
    const rising = PRODUCTS.filter((p) => signalOf(p) === "Rising").length;
    const demand = PRODUCTS.reduce((s, p) => s + demandNow(p), 0) / PRODUCTS.length;
    const shares = DATA.categories.map((cat) => {
      const value = PRODUCTS.filter((p) => p.category === cat).reduce((s, p) => s + demandNow(p), 0);
      return { name: cat, color: DATA.categoryColor[cat], value };
    });
    const total = shares.reduce((s, p) => s + p.value, 0) || 1;
    const movers = PRODUCTS.slice().sort((a, b) => priceChange(b) - priceChange(a)).slice(0, 6);
    const notes = DATA.observations.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    return `
      <div class="page-head"><div>
        <h1>Overview</h1>
        <p class="lede">Price history stands in for an external market feed. Field notes and desk research sit beside it.</p>
      </div></div>
      <section class="kpi-grid">
        ${kpi("Market index", latest.toFixed(1), `<span class="delta ${deltaClass(delta)}">${signedPct(delta)}</span> from the start of ${state.range}`)}
        ${kpi("Avg. price change", signedPct(avg), `Across ${PRODUCTS.length} products`)}
        ${kpi("Rising products", String(rising), `of ${PRODUCTS.length} in this window`)}
        ${kpi("Demand index", demand.toFixed(0), "Average current demand")}
      </section>
      <div class="callout">${esc(story(PRODUCTS))}</div>
      <section class="overview-grid">
        <article class="panel">
          <div class="panel-head"><h2>Market index</h2><span>Rebased to 100 · ${state.range}</span></div>
          <div class="chart-canvas" data-chart="market"></div>
        </article>
        <article class="panel">
          <div class="panel-head"><h2>Demand share</h2><span>Current window</span></div>
          <div class="donut-wrap">
            <div class="donut-canvas" data-chart="donut"></div>
            <ul class="legend-list">
              ${shares.map((s) => `<li><button type="button" data-action="goto-category" data-value="${esc(s.name)}"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><strong>${Math.round((s.value / total) * 100)}%</strong></button></li>`).join("")}
            </ul>
          </div>
        </article>
      </section>
      <section class="split">
        <article class="panel">
          <div class="panel-head"><h2>Top movers</h2><button class="text-btn" type="button" data-view="products">Browse products</button></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th class="num">Change</th><th class="num">Score</th></tr></thead>
            <tbody>
              ${movers.map((p) => `<tr>
                <td><button class="linkish" type="button" data-action="open" data-id="${p.id}">${esc(p.name)}<small>${esc(p.brand)}</small></button></td>
                <td>${esc(p.category)}</td>
                <td class="num">${money(p.price)}</td>
                <td class="num"><span class="delta ${deltaClass(priceChange(p))}">${signedPct(priceChange(p))}</span></td>
                <td class="num">${trendScore(p)}</td>
              </tr>`).join("")}
            </tbody>
          </table></div>
        </article>
        <article class="panel">
          <div class="panel-head"><h2>Field notes</h2><button class="text-btn" type="button" data-view="insights">All insights</button></div>
          <ul class="feed">
            ${notes.map((n) => `<li><time datetime="${n.date}">${fmtDate(n.date)}</time><p>${esc(n.text)}</p><span>${esc(n.place)} · Field note</span></li>`).join("")}
          </ul>
        </article>
      </section>`;
  }

  function renderProducts() {
    return `
      <div class="page-head"><div>
        <h1>Product database</h1>
        <p class="lede">Search, filter, and compare products. Price change follows the selected window.</p>
      </div></div>
      <div class="toolbar">
        <div class="toolbar-row">
          <label class="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 16.5 20 20.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <input id="product-search" type="search" placeholder="Search name, brand, material, color" value="${esc(state.query)}" autocomplete="off" aria-label="Filter products">
          </label>
          <label class="select">Sort
            <select id="sort">
              ${[["trend", "Trend score"], ["change", "Price change"], ["price", "Price"], ["demand", "Demand"], ["name", "Name"]].map(([v, l]) => `<option value="${v}"${state.sort === v ? " selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="chips" role="group" aria-label="Category">
          ${[["all", "All"], ...DATA.categories.map((c) => [c, c])].map(([v, l]) => `<button class="chip${state.filters.category === v ? " is-active" : ""}" type="button" data-action="filter-category" data-value="${esc(v)}">${esc(l)}</button>`).join("")}
        </div>
        <div class="toolbar-row">
          <label class="select">Material
            <select id="filter-material">${selectOptions(DATA.materials, state.filters.material, "All materials")}</select>
          </label>
          <label class="select">Color
            <select id="filter-color">${selectOptions(DATA.colors, state.filters.color, "All colors")}</select>
          </label>
          <label class="select">Signal
            <select id="filter-signal">${selectOptions(["Rising", "Stable", "Cooling"], state.filters.signal, "All signals")}</select>
          </label>
        </div>
        <div class="result-line">
          <span id="result-count" aria-live="polite"></span>
          ${filtersActive() ? `<button class="text-btn" type="button" data-action="clear-filters">Clear filters</button>` : ""}
        </div>
      </div>
      <div id="product-grid"></div>`;
  }

  function renderProductGrid() {
    const host = document.getElementById("product-grid");
    if (!host) return;
    const items = filteredProducts();
    const count = document.getElementById("result-count");
    if (count) count.textContent = `${items.length} product${items.length === 1 ? "" : "s"}`;
    host.innerHTML = items.length
      ? `<div class="product-grid">${items.map(productCard).join("")}</div>`
      : `<div class="empty"><p>No products match this search.</p><button class="btn-ghost" type="button" data-action="clear-filters">Clear filters</button></div>`;
  }

  function renderAnalytics() {
    const series = analyticsSeries();
    const items = analyticsProducts().slice().sort((a, b) => priceChange(b) - priceChange(a));
    const gainers = items.slice(0, 5);
    const decliners = items.slice().sort((a, b) => priceChange(a) - priceChange(b)).slice(0, 5);
    const demanded = items.slice().sort((a, b) => demandNow(b) - demandNow(a)).slice(0, 5);
    const options = [["categories", "All categories"], ...DATA.categories.map((c) => [c, c])]
      .map(([v, l]) => `<option value="${esc(v)}"${state.breakdown === v ? " selected" : ""}>${esc(l)}</option>`).join("");
    return `
      <div class="page-head">
        <div>
          <h1>Analytics</h1>
          <p class="lede">Indexed history so categories and products on different price levels can be read together.</p>
        </div>
        <label class="select">Breakdown<select id="analytics-breakdown">${options}</select></label>
      </div>
      <article class="panel">
        <div class="panel-head"><h2>${state.breakdown === "categories" ? "Market and categories" : esc(state.breakdown)}</h2><span>Rebased to 100 · ${state.range}</span></div>
        ${legendHTML(series)}
        <div class="chart-canvas" data-chart="analytics"></div>
      </article>
      <section class="tri">
        <article class="panel"><div class="panel-head"><h2>Strongest prices</h2></div>${miniList(gainers)}</article>
        <article class="panel"><div class="panel-head"><h2>Softest prices</h2></div>${miniList(decliners)}</article>
        <article class="panel"><div class="panel-head"><h2>Highest demand</h2></div>${miniList(demanded)}</article>
      </section>`;
  }

  function renderTrends() {
    const products = scopedProducts();
    const cats = grouped("category", products);
    const colors = grouped("color", products);
    const materials = grouped("material", products);
    const scopeOptions = [["all", "All categories"], ...DATA.categories.map((c) => [c, c])]
      .map(([v, l]) => `<option value="${esc(v)}"${state.trendScope === v ? " selected" : ""}>${esc(l)}</option>`).join("");
    return `
      <div class="page-head">
        <div>
          <h1>Trend intelligence</h1>
          <p class="lede">Category, color, and material momentum from the product set. Preference tracks are desk research and stay market-wide.</p>
        </div>
        <label class="select">Scope<select id="trend-scope">${scopeOptions}</select></label>
      </div>
      <div class="callout">${esc(story(products))}</div>
      <section class="trend-grid">
        <article class="panel">
          <div class="panel-head"><h2>Categories</h2><span>Avg. price change · ${state.range}</span></div>
          ${divergingRows(cats, "goto-category")}
        </article>
        <article class="panel">
          <div class="panel-head"><h2>Consumer preferences</h2><span>Desk research</span></div>
          ${DATA.preferences.map((pref) => `<div class="pref">
            <div class="pref-top"><strong>${esc(pref.name)}</strong><span class="delta ${deltaClass(pref.delta)}">${signedPct(pref.delta)}</span></div>
            <p>${esc(pref.note)}</p>
            <div class="meter" aria-hidden="true"><span style="width:${pref.score}%"></span></div>
            <span class="source-tag">Score ${pref.score} · Desk research</span>
          </div>`).join("")}
        </article>
      </section>
      <article class="panel" style="margin-top:14px">
        <div class="panel-head"><h2>Colors</h2><span>Open a color in the product database</span></div>
        <div class="swatches">
          ${colors.map((c) => `<button class="swatch" type="button" style="--swatch:${DATA.colorHex[c.name]}" data-action="goto-color" data-value="${esc(c.name)}">
            <span class="swatch-chip"></span>
            <span class="swatch-name">${esc(c.name)}</span>
            <span class="muted">${c.count} product${c.count === 1 ? "" : "s"}</span>
            <strong class="${deltaClass(c.change) === "down" ? "sig-cooling" : "sig-rising"}">${signedPct(c.change)}</strong>
          </button>`).join("")}
        </div>
      </article>
      <article class="panel" style="margin-top:14px">
        <div class="panel-head"><h2>Materials</h2><span>Avg. price change · ${state.range}</span></div>
        ${divergingRows(materials, "goto-material")}
      </article>`;
  }

  function insightCard(item, feature) {
    return `<article class="panel insight${feature ? " feature" : ""}">
      <div>
        <div class="card-kicker"><span>${esc(item.kicker)}</span><time datetime="${item.date}">${fmtDate(item.date)}</time></div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.body)}</p>
      </div>
      <span class="sig-text sig-${item.signal.toLowerCase()}">${esc(item.signal)}</span>
    </article>`;
  }

  function renderInsights() {
    const [feature, ...rest] = DATA.insights;
    const side = rest.slice(0, 2);
    const more = rest.slice(2);
    const notes = DATA.observations.slice().sort((a, b) => b.date.localeCompare(a.date));
    return `
      <div class="page-head"><div>
        <h1>Insights</h1>
        <p class="lede">Desk research and field notes, kept next to the market feed.</p>
      </div></div>
      <section class="insight-grid">
        ${insightCard(feature, true)}
        <div class="stack">${side.map((item) => insightCard(item, false)).join("")}</div>
      </section>
      ${more.length ? `<section class="more-grid">${more.map((item) => insightCard(item, false)).join("")}</section>` : ""}
      <article class="panel" style="margin-top:14px">
        <div class="panel-head"><h2>Field observations</h2><span>Logged by hand</span></div>
        <ol class="timeline">
          ${notes.map((n) => `<li><time datetime="${n.date}">${fmtDate(n.date)}</time><div><p>${esc(n.text)}</p><span>${esc(n.place)} · Field note</span></div></li>`).join("")}
        </ol>
      </article>`;
  }

  const VIEWS = {
    overview: renderOverview,
    products: renderProducts,
    analytics: renderAnalytics,
    trends: renderTrends,
    insights: renderInsights
  };

  function tickIndices(n, maxTicks = 6) {
    if (n <= maxTicks) return [...Array(n).keys()];
    const out = [];
    for (let i = 0; i < maxTicks; i++) out.push(Math.round((i * (n - 1)) / (maxTicks - 1)));
    return [...new Set(out)];
  }

  function formatAxis(v, mode) {
    if (mode === "money") {
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
      return `$${Math.round(v)}`;
    }
    return String(Math.round(v));
  }

  function formatVal(v, mode) {
    return mode === "money" ? money(v) : v.toFixed(1);
  }

  function drawLines(el, series, labels, options = {}) {
    if (!el) return;
    const mode = options.mode || "index";
    const ready = (series || []).filter((s) => s.values && s.values.length);
    if (!ready.length) {
      el.innerHTML = `<p class="empty">No data in this window.</p>`;
      return;
    }
    const uid = `g${++chartSeq}`;
    const W = 720;
    const H = 280;
    const pad = { l: 52, r: 16, t: 16, b: 32 };
    const n = ready[0].values.length;
    const labs = labels.slice(-n);
    const all = ready.flatMap((s) => s.values);
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (min === max) { min -= 1; max += 1; }
    const padY = (max - min) * 0.14;
    min -= padY;
    max += padY;
    const x = (i) => pad.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

    let grid = "";
    for (let t = 0; t <= 4; t++) {
      const v = min + ((max - min) * t) / 4;
      const yy = y(v);
      grid += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="rgba(255,255,255,0.07)"></line>`;
      grid += `<text x="${pad.l - 8}" y="${yy + 4}" text-anchor="end" fill="#8b919c" font-size="11">${esc(formatAxis(v, mode))}</text>`;
    }
    let xlabels = "";
    tickIndices(n).forEach((i) => {
      const [m, yr] = labs[i];
      const text = i === 0 || m === "Jan" ? `${m} '${String(yr).slice(2)}` : m;
      xlabels += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" fill="#8b919c" font-size="11">${esc(text)}</text>`;
    });

    let defs = "";
    let shapes = "";
    ready.forEach((s) => {
      const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
      if (ready.length === 1) {
        const baseY = H - pad.b;
        const area = `${d} L${pts[pts.length - 1].x.toFixed(2)},${baseY} L${pts[0].x.toFixed(2)},${baseY} Z`;
        defs = `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity="0.32"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
        shapes += `<path d="${area}" fill="url(#${uid})"></path>`;
      }
      shapes += `<path class="line" d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.8}" stroke-linejoin="round" stroke-linecap="round"></path>`;
      if (ready.length === 1) {
        const last = pts[pts.length - 1];
        shapes += `<circle cx="${last.x}" cy="${last.y}" r="3.5" fill="${s.color}"></circle>`;
      }
    });

    const title = options.label || "Chart";
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${defs}${grid}${shapes}${xlabels}<line class="guide" y1="${pad.t}" y2="${H - pad.b}" stroke="rgba(255,255,255,0.35)" stroke-dasharray="3 4" visibility="hidden"></line><g class="dots"></g></svg><div class="tip"></div>`;

    const svg = el.querySelector("svg");
    const guide = svg.querySelector(".guide");
    const dots = svg.querySelector(".dots");
    const tip = el.querySelector(".tip");

    function hide() {
      guide.setAttribute("visibility", "hidden");
      dots.innerHTML = "";
      tip.classList.remove("on");
    }

    function show(idx, clientX, clientY) {
      const i = Math.max(0, Math.min(n - 1, idx));
      const gx = x(i);
      guide.setAttribute("x1", gx);
      guide.setAttribute("x2", gx);
      guide.setAttribute("visibility", "visible");
      dots.innerHTML = ready.map((s) => `<circle cx="${gx}" cy="${y(s.values[i])}" r="3.5" fill="${s.color}" stroke="#101218" stroke-width="1.5"></circle>`).join("");
      const [m, yr] = labs[i];
      const rows = ready.map((s) => `<span class="tip-row"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><strong>${esc(formatVal(s.values[i], mode))}</strong></span>`).join("");
      tip.innerHTML = `<span class="tip-date">${esc(MONTH_FULL[m])} ${yr}</span>${rows}`;
      tip.classList.add("on");
      const box = el.getBoundingClientRect();
      tip.style.left = "0px";
      tip.style.top = "0px";
      let left = clientX - box.left + 14;
      let top = clientY - box.top + 14;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      if (left + tw > box.width - 8) left = clientX - box.left - tw - 14;
      if (top + th > box.height - 8) top = Math.max(8, box.height - th - 8);
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    }

    svg.addEventListener("pointermove", (event) => {
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const loc = pt.matrixTransform(ctm.inverse());
      const t = (loc.x - pad.l) / (W - pad.l - pad.r);
      if (t < -0.02 || t > 1.02) { hide(); return; }
      show(Math.round(t * (n - 1)), event.clientX, event.clientY);
    });
    svg.addEventListener("pointerleave", hide);

    svg.querySelectorAll(".line").forEach((path) => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset .9s ease";
        path.style.strokeDashoffset = "0";
      });
    });
  }

  function drawDonut(el) {
    if (!el) return;
    const parts = DATA.categories.map((cat) => ({
      name: cat,
      color: DATA.categoryColor[cat],
      value: PRODUCTS.filter((p) => p.category === cat).reduce((s, p) => s + demandNow(p), 0)
    }));
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    const r = 58;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = parts.map((p) => {
      const full = (p.value / total) * c;
      const len = Math.max(0, full - 2);
      const circle = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${p.color}" stroke-width="12" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"></circle>`;
      offset += full;
      return circle;
    }).join("");
    const leader = parts.slice().sort((a, b) => b.value - a.value)[0];
    const pct = Math.round((leader.value / total) * 100);
    el.innerHTML = `<svg viewBox="0 0 160 160" role="img" aria-label="Demand share by category">${arcs}<text x="80" y="76" text-anchor="middle" fill="#f3f1eb" font-size="22" font-weight="600">${pct}%</text><text x="80" y="96" text-anchor="middle" fill="#a1a6b0" font-size="11">${esc(leader.name)}</text></svg>`;
  }

  function hydrate(root) {
    root.querySelectorAll("[data-chart]").forEach((node) => {
      if (node.dataset.chart === "market") {
        drawLines(node, [{ name: "Market index", color: "#e4c27a", values: indexSeries(PRODUCTS), width: 2.3 }], monthSlice(), { mode: "index", label: "Market index" });
      }
      if (node.dataset.chart === "analytics") {
        drawLines(node, analyticsSeries(), monthSlice(), { mode: "index", label: "Indexed prices" });
      }
      if (node.dataset.chart === "donut") drawDonut(node);
    });
  }

  function drawerHTML(p) {
    const ch = priceChange(p);
    const dCh = demandChange(p);
    return `
      <div class="drawer-top">
        <div>
          <p class="eyebrow">${esc(p.category)}</p>
          <h2>${esc(p.name)}</h2>
          <p class="muted">${esc(p.brand)}</p>
        </div>
        <button class="icon-btn" type="button" data-action="close-drawer" aria-label="Close">×</button>
      </div>
      <div class="price-line"><span class="num">${money(p.price)}</span><span class="delta ${deltaClass(ch)}">${signedPct(ch)}</span></div>
      <div class="panel-head"><h2>Price history</h2><span>${state.range}</span></div>
      <div class="chart-canvas" data-chart="drawer"></div>
      <div class="stat-grid">
        <div><span>Trend score</span><strong>${trendScore(p)}</strong></div>
        <div><span>Signal</span><strong>${signalOf(p)}</strong></div>
        <div><span>Demand</span><strong>${demandNow(p)}</strong></div>
        <div><span>Demand change</span><strong class="${deltaClass(dCh)}">${signedPct(dCh)}</strong></div>
      </div>
      <div class="meta-list">
        <div><span>Material</span><strong>${esc(p.material)}</strong></div>
        <div><span>Color</span><strong><i class="dot" style="background:${DATA.colorHex[p.color]}"></i>${esc(p.color)}</strong></div>
        <div><span>Window</span><strong>${state.range}</strong></div>
      </div>
      ${p.note ? `<div class="note"><span>Field note</span><p>${esc(p.note)}</p></div>` : ""}
      <div class="sources"><span class="source">Market feed</span>${p.note ? `<span class="source">Field note</span>` : ""}</div>
      <button class="btn-ghost${state.compare.includes(p.id) ? " is-on" : ""}" type="button" data-action="toggle-compare" data-id="${p.id}" aria-pressed="${state.compare.includes(p.id)}">${state.compare.includes(p.id) ? "Added" : "Compare"}</button>`;
  }

  function compareHTML() {
    const items = state.compare.map(getProduct).filter(Boolean);
    const lead = (fn) => {
      const best = Math.max(...items.map(fn));
      return items.map((p) => ({ p, on: fn(p) === best }));
    };
    const row = (label, render, scoreFn) => {
      const marks = scoreFn ? lead(scoreFn) : items.map((p) => ({ p, on: false }));
      return `<tr><th>${label}</th>${marks.map(({ p, on }) => `<td class="${on ? "is-lead" : ""}">${render(p)}</td>`).join("")}</tr>`;
    };
    return `<div class="modal-card">
      <div class="compare-head">
        <div>
          <h2>Compare</h2>
          <p class="lede">Indexed to 100 at the start of the ${state.range} window.</p>
        </div>
        <button class="icon-btn" type="button" data-action="close-modal" aria-label="Close compare">×</button>
      </div>
      <div class="legend">${items.map((p, i) => `<span><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(p.name)}</span>`).join("")}</div>
      <div class="chart-canvas" data-chart="compare"></div>
      <div class="table-wrap"><table>
        <thead><tr><th></th>${items.map((p, i) => `<th><button class="linkish" type="button" data-action="open" data-id="${p.id}">${esc(p.name)}<small>${esc(p.brand)}</small></button><button class="remove-link" type="button" data-action="remove-compare" data-id="${p.id}">Remove</button></th>`).join("")}</tr></thead>
        <tbody>
          ${row("Price", (p) => money(p.price))}
          ${row("Window change", (p) => signedPct(priceChange(p)), priceChange)}
          ${row("Trend score", (p) => String(trendScore(p)), trendScore)}
          ${row("Demand", (p) => String(demandNow(p)), demandNow)}
          ${row("Demand change", (p) => signedPct(demandChange(p)), demandChange)}
          ${row("Category", (p) => esc(p.category))}
          ${row("Material", (p) => esc(p.material))}
          ${row("Color", (p) => esc(p.color))}
        </tbody>
      </table></div>
    </div>`;
  }

  function syncOverlays() {
    const scrim = document.getElementById("scrim");
    const drawer = document.getElementById("drawer");
    const modal = document.getElementById("modal");
    if (state.drawerId && getProduct(state.drawerId)) {
      const product = getProduct(state.drawerId);
      drawer.hidden = false;
      drawer.innerHTML = drawerHTML(product);
      drawer.scrollTop = 0;
      drawLines(drawer.querySelector(".chart-canvas"), [{
        name: "Price",
        color: "#e4c27a",
        values: sliceMetric(product, "prices"),
        width: 2.2
      }], monthSlice(), { mode: "money", label: `${product.name} price` });
    } else {
      state.drawerId = null;
      drawer.hidden = true;
      drawer.innerHTML = "";
    }
    if (state.compareOpen && state.compare.length >= 2) {
      modal.hidden = false;
      modal.innerHTML = compareHTML();
      const items = state.compare.map(getProduct).filter(Boolean);
      drawLines(modal.querySelector(".chart-canvas"), items.map((p, i) => ({
        name: p.name,
        color: PALETTE[i % PALETTE.length],
        values: rebase(sliceMetric(p, "prices")),
        width: 2
      })), monthSlice(), { mode: "index", label: "Compared price index" });
    } else {
      state.compareOpen = false;
      modal.hidden = true;
      modal.innerHTML = "";
    }
    scrim.hidden = !state.drawerId && !state.compareOpen;
  }

  function syncTray() {
    const tray = document.getElementById("tray");
    document.body.classList.toggle("has-tray", state.compare.length > 0);
    if (!state.compare.length) {
      tray.hidden = true;
      tray.innerHTML = "";
      return;
    }
    const chips = state.compare.map((id) => {
      const p = getProduct(id);
      if (!p) return "";
      return `<span class="tray-chip">${esc(p.name)}<button type="button" data-action="remove-compare" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">×</button></span>`;
    }).join("");
    tray.hidden = false;
    tray.innerHTML = `<div class="tray-items">${chips}</div><button class="btn-ghost" type="button" data-action="clear-compare">Clear</button><button class="btn-primary" type="button" data-action="open-compare"${state.compare.length < 2 ? " disabled" : ""}>Compare</button>`;
  }

  function syncCompareButtons() {
    document.querySelectorAll('[data-action="toggle-compare"]').forEach((btn) => {
      const on = state.compare.includes(btn.dataset.id);
      btn.classList.toggle("is-on", on);
      btn.textContent = on ? "Added" : "Compare";
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function syncChrome() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const on = btn.dataset.view === state.view;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    document.querySelectorAll("[data-range]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.range === state.range);
    });
    const gs = document.getElementById("global-search");
    if (gs && document.activeElement !== gs) gs.value = state.query;
    document.title = `${TITLES[state.view]} — Vela`;
  }

  function render(options = {}) {
    syncChrome();
    const root = document.getElementById("view");
    root.classList.remove("is-entering");
    root.innerHTML = VIEWS[state.view]();
    if (options.animate) {
      void root.offsetWidth;
      root.classList.add("is-entering");
    }
    if (state.view === "products") renderProductGrid();
    hydrate(root);
    syncOverlays();
    syncTray();
  }

  function setView(view) {
    if (!VIEWS[view]) return;
    state.view = view;
    state.drawerId = null;
    state.compareOpen = false;
    render({ animate: true });
  }

  function setRange(range) {
    if (!RANGE[range]) return;
    state.range = range;
    render();
  }

  function gotoProducts(patch) {
    state.filters = { category: "all", material: "all", color: "all", signal: "all", ...patch };
    state.query = "";
    state.sort = "trend";
    state.view = "products";
    state.drawerId = null;
    state.compareOpen = false;
    render({ animate: true });
  }

  function toggleCompare(id) {
    const index = state.compare.indexOf(id);
    if (index >= 0) state.compare.splice(index, 1);
    else if (state.compare.length >= 3) {
      toast("You can compare up to three products.");
      return;
    } else state.compare.push(id);
    if (state.compare.length < 2) state.compareOpen = false;
    syncTray();
    syncCompareButtons();
    if (state.compareOpen || state.drawerId === id) syncOverlays();
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.hidden = true; }, 2400);
  }

  function reset() {
    state.view = "overview";
    state.range = "12M";
    state.query = "";
    state.filters = { category: "all", material: "all", color: "all", signal: "all" };
    state.sort = "trend";
    state.compare = [];
    state.drawerId = null;
    state.compareOpen = false;
    state.breakdown = "categories";
    state.trendScope = "all";
    document.body.classList.remove("has-tray");
    document.getElementById("app").hidden = true;
    const login = document.getElementById("login");
    login.hidden = false;
    login.classList.remove("is-leaving");
    document.title = "Vela — Market Intelligence";
  }

  function onClick(event) {
    if (event.target.id === "modal") {
      state.compareOpen = false;
      syncOverlays();
      return;
    }
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      const value = actionEl.dataset.value;
      if (action === "sign-out") reset();
      if (action === "filter-category") {
        state.filters.category = value;
        render();
      }
      if (action === "clear-filters") {
        state.query = "";
        state.filters = { category: "all", material: "all", color: "all", signal: "all" };
        render();
      }
      if (action === "toggle-compare") toggleCompare(id);
      if (action === "open") {
        state.compareOpen = false;
        state.drawerId = id;
        syncOverlays();
      }
      if (action === "close-drawer") {
        state.drawerId = null;
        syncOverlays();
      }
      if (action === "close-modal" || action === "close-overlays") {
        if (state.compareOpen) state.compareOpen = false;
        else state.drawerId = null;
        syncOverlays();
      }
      if (action === "remove-compare") {
        state.compare = state.compare.filter((item) => item !== id);
        if (state.compare.length < 2) state.compareOpen = false;
        syncTray();
        syncCompareButtons();
        syncOverlays();
      }
      if (action === "clear-compare") {
        state.compare = [];
        state.compareOpen = false;
        syncTray();
        syncCompareButtons();
        syncOverlays();
      }
      if (action === "open-compare") {
        if (state.compare.length < 2) toast("Add at least two products to compare.");
        else {
          state.drawerId = null;
          state.compareOpen = true;
          syncOverlays();
        }
      }
      if (action === "goto-category") gotoProducts({ category: value });
      if (action === "goto-color") gotoProducts({ color: value });
      if (action === "goto-material") gotoProducts({ material: value });
      return;
    }
    const viewEl = event.target.closest("[data-view]");
    if (viewEl) { setView(viewEl.dataset.view); return; }
    const rangeEl = event.target.closest("[data-range]");
    if (rangeEl) setRange(rangeEl.dataset.range);
  }

  function onInput(event) {
    if (event.target.id !== "global-search" && event.target.id !== "product-search") return;
    state.query = event.target.value;
    const otherId = event.target.id === "global-search" ? "product-search" : "global-search";
    const other = document.getElementById(otherId);
    if (other && document.activeElement !== other) other.value = state.query;
    if (state.view === "products") renderProductGrid();
  }

  function onChange(event) {
    const id = event.target.id;
    if (id === "sort") state.sort = event.target.value;
    else if (id === "filter-material") state.filters.material = event.target.value;
    else if (id === "filter-color") state.filters.color = event.target.value;
    else if (id === "filter-signal") state.filters.signal = event.target.value;
    else if (id === "analytics-breakdown") state.breakdown = event.target.value;
    else if (id === "trend-scope") state.trendScope = event.target.value;
    else return;
    render();
  }

  function onKey(event) {
    if (event.key === "Enter" && event.target.id === "global-search") {
      event.preventDefault();
      state.query = event.target.value;
      setView("products");
    }
    if (event.key === "Escape") {
      if (state.compareOpen) state.compareOpen = false;
      else state.drawerId = null;
      syncOverlays();
    }
  }

  function enter() {
    const login = document.getElementById("login");
    login.classList.add("is-leaving");
    window.setTimeout(() => {
      login.hidden = true;
      document.getElementById("app").hidden = false;
      render({ animate: true });
    }, 280);
  }

  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    enter();
  });
  document.getElementById("app").addEventListener("click", onClick);
  document.getElementById("app").addEventListener("input", onInput);
  document.getElementById("app").addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
})();
