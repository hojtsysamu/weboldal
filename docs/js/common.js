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
