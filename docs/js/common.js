/* Közös segédfüggvények: adatbetöltés, képek URL-jei, igazított fotórács */

const GAP = 8; // képek közti távolság a rácsban (px)

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ": " + res.status);
  return res.json();
}

const photoSrc = (slug, p, w) => `photos/${slug}/${p.id}-${w}.webp`;
const photoSrcset = (slug, p) => p.sizes.map((w) => `${photoSrc(slug, p, w)} ${w}w`).join(", ");
const bestSize = (p, px) => p.sizes.find((w) => w >= px) || p.sizes[p.sizes.length - 1];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

/* Kép, ami betöltődés után finoman megjelenik */
function fadeImage(img) {
  const show = () => img.classList.add("loaded");
  if (img.complete && img.naturalWidth) show();
  else img.addEventListener("load", show, { once: true });
  return img;
}

/* Fejléc: görgetéskor sötét háttér */
function initHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const update = () => header.classList.toggle("scrolled", window.scrollY > 40);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---------- Igazított (justified) fotórács ----------
   Minden sor a képek arányából számolja ki a magasságot úgy, hogy pontosan kitöltse a szélességet.
   items: [{ slug, photo }]   opciók: { onOpen(index), targetH(szélesség), fillLast } */

function defaultTargetHeight(W) {
  if (W < 640) return Math.round(W * 0.85);                       // telefon: soronként ~1-2 kép
  return Math.round(Math.min(360, Math.max(240, W * 0.24)));       // gép: ~3-4 kép sorban
}

function layoutRows(items, W, targetH, fillLast) {
  const rows = [];
  let row = [];
  let sumAR = 0;
  for (const it of items) {
    row.push(it);
    sumAR += it.photo.w / it.photo.h;
    const h = (W - GAP * (row.length - 1)) / sumAR;
    if (h <= targetH) {
      rows.push({ items: row, h });
      row = [];
      sumAR = 0;
    }
  }
  if (row.length) {
    // az utolsó, nem teljes sor nem nyúlik szét, marad a célmagasságon
    const fit = (W - GAP * (row.length - 1)) / sumAR;
    // (fillLast: a rövid utolsó sor is kitölti a szélességet, ha ettől nem lesz túl nagy)
    const stretch = fillLast && fit <= targetH * 1.6;
    rows.push({ items: row, h: stretch ? fit : Math.min(targetH, fit), last: !stretch });
  }
  return rows;
}

function renderJustified(container, items, opts = {}) {
  const targetFn = opts.targetH || defaultTargetHeight;
  container.classList.add("justified");
  container.style.gap = GAP + "px";

  // a képelemek egyszer készülnek el, újraszámoláskor csak átrendezzük őket
  const figs = items.map((it, index) => {
    const img = fadeImage(
      el("img", {
        alt: it.alt || "",
        loading: "lazy",
        decoding: "async",
        width: it.photo.w,
        height: it.photo.h,
        srcset: photoSrcset(it.slug, it.photo),
        src: photoSrc(it.slug, it.photo, bestSize(it.photo, 800)),
      })
    );
    const btn = el("button", { class: "ph", type: "button", "aria-label": "Open photo" }, img);
    btn.addEventListener("click", () => opts.onOpen && opts.onOpen(index));
    return { btn, img };
  });

  let lastW = 0;
  const draw = () => {
    const W = Math.floor(container.clientWidth);
    if (!W || W === lastW) return;
    lastW = W;
    const rows = layoutRows(items, W, targetFn(W), opts.fillLast);
    container.replaceChildren();
    let i = 0;
    for (const r of rows) {
      const rowEl = el("div", { class: "row" });
      rowEl.style.gap = GAP + "px";
      const h = Math.round(r.h);
      let used = 0;
      r.items.forEach((it, k) => {
        const { btn, img } = figs[i++];
        let w = Math.floor(r.h * (it.photo.w / it.photo.h));
        // a sor pontosan kitöltse a szélességet (kivéve az utolsó, rövid sort)
        if (!r.last && k === r.items.length - 1) w = W - used - GAP * k;
        used += w;
        btn.style.width = w + "px";
        btn.style.height = h + "px";
        img.sizes = w + "px";
        rowEl.append(btn);
      });
      container.append(rowEl);
    }
  };

  draw();
  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }).observe(container);
}

/* ---------- Mozgás: beúszás görgetéskor ---------- */

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* A megadott elemek finoman beúsznak, amikor a képernyőre kerülnek.
   A .reveal osztályt csak innen kapják, így ha a JS nem fut le, a tartalom akkor is látszik. */
function reveal(nodes) {
  const list = Array.from(nodes);
  if (!list.length || !("IntersectionObserver" in window) || prefersReducedMotion()) return;
  const io = new IntersectionObserver((entries) => {
    let k = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.style.transitionDelay = Math.min(k++, 6) * 90 + "ms"; // egyszerre belépő elemek: lépcsőzetesen
      e.target.classList.add("in");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  for (const n of list) {
    n.classList.add("reveal");
    io.observe(n);
  }
}

/* Nyitókép: görgetéskor a kép lassabban mozog (parallax), a szöveg elhalványul */
function initHeroMotion(hero) {
  if (!hero || prefersReducedMotion()) return;
  const img = hero.querySelector(".hero-img");
  const text = hero.querySelector(".hero-text");
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const h = hero.offsetHeight;
    if (y > h) return;
    if (img) img.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
    if (text) {
      text.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0)`;
      text.style.opacity = Math.max(0, 1 - y / (h * 0.6)).toFixed(3);
    }
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

/* ---------- Egymásba csúszó (masonry) rács: a főoldali Portfolio és az albumoldalak is ezt használják ----------
   nodes: [{ a: <elem>, ratio: magasság/szélesség }]
   opciók: colsFor(W) = oszlopok száma, poolFor(W) = megjelenítendő node-ok, keepOrder = a sorrend nagyjából marad
   Az oszlopok alja pixelre egy szintre esik (a képek szélét emiatt egy hajszálnyit levágjuk). */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createMasonry(grid, nodes, opts = {}) {
  const colsFor = opts.colsFor || ((W) => (W < 600 ? 2 : W < 1000 ? 3 : 4));
  const poolFor = opts.poolFor || (() => nodes);
  const keepOrder = !!opts.keepOrder;

  let arrangement = [];   // oszlopok: mindegyikben a node-ok listája
  let arrKey = "";
  let lastW = 0, lastVW = 0;

  const layout = () => {
    const W = grid.clientWidth;
    const vw = window.innerWidth;
    if (!W || (W === lastW && vw === lastVW)) return;
    lastW = W; lastVW = vw;

    const pool = poolFor(W);
    let cols = Math.max(1, Math.min(colsFor(W), Math.ceil(pool.length / 2)));   // oszloponként legalább ~2 kép
    const balance = pool.length >= cols * 2 && cols > 1;                         // kevés kép: nincs kiegyenlítés

    const gap = Math.round(Math.min(16, Math.max(8, vw * 0.012)));
    const offset = balance ? Math.round(Math.min(96, Math.max(28, vw * 0.06))) : 0;   // páros oszlopok lejjebb indulnak
    const colW = (W - gap * (cols - 1)) / cols;
    const offsets = Array.from({ length: cols }, (_, i) => (i % 2 ? offset : 0));

    // 1) elrendezés: minden kép a pillanatnyilag legrövidebb oszlopba kerül; sok változatot kipróbálunk,
    //    és azt tartjuk meg, ahol az oszlopok alja a leginkább egy szintre esik
    const key = cols + ":" + pool.length;
    if (key !== arrKey) {
      arrKey = key;
      const simulate = (order) => {
        const heights = offsets.map((o) => o / colW);
        const colsOut = Array.from({ length: cols }, () => []);
        order.forEach((n) => {
          let c = 0;
          for (let i = 1; i < cols; i++) if (heights[i] < heights[c]) c = i;
          colsOut[c].push(n);
          heights[c] += n.ratio + gap / colW;
        });
        return { colsOut, spread: Math.max(...heights) - Math.min(...heights) };
      };
      let best = simulate(pool);
      if (keepOrder) {
        // a sorrendet csak kicsit keverjük: közeli képeket cserélgetünk, amíg jobb nem lesz az alja
        let order = pool.slice();
        for (let t = 0; t < 1500 && best.spread > 0.05; t++) {
          const cand = order.slice();
          const i = Math.floor(Math.random() * cand.length);
          const j = Math.min(cand.length - 1, Math.max(0, i + Math.floor(Math.random() * 9) - 4));
          [cand[i], cand[j]] = [cand[j], cand[i]];
          const r = simulate(cand);
          if (r.spread <= best.spread) { best = r; order = cand; }
        }
      } else {
        for (let t = 0; t < 400 && best.spread > 0.05; t++) {
          const cand = simulate(shuffle(pool.slice()));
          if (cand.spread < best.spread) best = cand;
        }
      }
      arrangement = best.colsOut;
      grid.replaceChildren(...arrangement.map((list) => el("div", { class: "pf-col" }, ...list.map((n) => n.a))));
    }

    // 2) pontos magasságok: minden oszlop alja pixelre ugyanott van
    grid.style.gap = gap + "px";
    const colEls = grid.children;
    const natural = arrangement.map((list) => list.reduce((sum, n) => sum + n.ratio * colW, 0));
    const bottoms = arrangement.map((list, i) => offsets[i] + natural[i] + gap * (list.length - 1));
    const B = Math.round(bottoms.reduce((x, y) => x + y, 0) / bottoms.length);
    arrangement.forEach((list, i) => {
      const col = colEls[i];
      col.style.gap = gap + "px";
      col.style.marginTop = offsets[i] + "px";
      if (!balance) { list.forEach((n) => (n.a.style.height = Math.round(n.ratio * colW) + "px")); return; }
      const avail = B - offsets[i] - gap * (list.length - 1);
      const f = avail / natural[i];
      let used = 0;
      list.forEach((n, k) => {
        const h = k === list.length - 1 ? avail - used : Math.round(n.ratio * colW * f);
        used += h;
        n.a.style.height = h + "px";
      });
    });
  };

  layout();
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); }).observe(grid);
}
