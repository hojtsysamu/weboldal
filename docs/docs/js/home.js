/* Főoldal: nyitókép, futó szöveg, Portfolio (véletlenszerű rács), albumok, szövegek a site.json-ból */

const PORTFOLIO_MAX = 18; // ennyi véletlenszerű kép jelenik meg a Portfolio részben (telefonon legfeljebb 12)

(async function () {
  initHeader();
  const lightbox = createLightbox();

  const [site, data] = await Promise.all([
    getJSON("site.json").catch(() => ({})),
    getJSON("albums.json").catch(() => ({ albums: [] })),
  ]);
  const albums = data.albums || [];

  /* --- szövegek --- */
  const name = site.name || "Photographer";
  document.title = site.tagline ? `${name} – ${site.tagline}` : name;
  document.querySelectorAll("[data-name]").forEach((n) => (n.textContent = name));
  document.getElementById("tagline").textContent = site.tagline || "";
  document.getElementById("intro").textContent = site.intro || "";
  document.getElementById("year").textContent = new Date().getFullYear();

  const aboutBox = document.getElementById("about-text");
  (site.about || []).forEach((t) => aboutBox.append(el("p", { text: t })));
  if (!(site.about || []).length) document.getElementById("rolam").hidden = true;

  const mail = document.getElementById("mail");
  if (site.email) { mail.href = "mailto:" + site.email; mail.textContent = site.email; }
  else mail.hidden = true;
  const social = document.getElementById("social");
  if (site.instagram) {
    const handle = site.instagram.replace(/\/$/, "").split("/").pop();
    social.append(el("a", { href: site.instagram, target: "_blank", rel: "noopener", text: "Instagram: @" + handle }));
  }

  /* --- képek gyűjtése --- */
  const all = albums.flatMap((a) => a.photos.map((p) => ({ slug: a.slug, photo: p, album: a })));
  let featured = all.filter((x) => x.photo.featured);
  if (!featured.length) featured = albums.map((a) => all.find((x) => x.slug === a.slug && x.photo.id === a.cover)).filter(Boolean);

  /* --- nyitókép: fix kép (originals/hero.jpg); ha nincs, az első kiemelt kép --- */
  const hero = document.getElementById("hero");
  let heroItem = null;
  let img = null;
  if (data.hero) {
    const sz = data.hero.sizes;
    const pick = sz.find((w) => w >= 1800) || sz[sz.length - 1];
    img = el("img", {
      class: "hero-img", alt: "", decoding: "async", fetchpriority: "high",
      srcset: sz.map((w) => `hero/hero-${w}.webp ${w}w`).join(", "), sizes: "100vw",
      src: `hero/hero-${pick}.webp`,
    });
  } else if (featured.length) {
    heroItem = featured[0];
    img = el("img", {
      class: "hero-img", alt: "", decoding: "async", fetchpriority: "high",
      srcset: photoSrcset(heroItem.slug, heroItem.photo), sizes: "100vw",
      src: photoSrc(heroItem.slug, heroItem.photo, bestSize(heroItem.photo, 1800)),
    });
  }
  if (img) {
    hero.prepend(img);
    fadeImage(img);
  }

  initHeroMotion(hero);

  /* --- futó nagy szöveg: a neved és a tagline végigfut --- */
  const track = document.getElementById("marquee-track");
  const makeGroup = () => {
    const g = el("div", { class: "marquee-group" });
    for (let i = 0; i < 3; i++) {
      g.append(el("span", { class: "m-name", text: name }), el("span", { class: "m-dot" }));
      if (site.tagline) g.append(el("span", { class: "m-out", text: site.tagline }), el("span", { class: "m-dot" }));
    }
    return g;
  };
  const g1 = makeGroup();
  track.append(g1, makeGroup());
  const setSpeed = () => { track.style.animationDuration = Math.max(20, g1.offsetWidth / 70) + "s"; };
  setSpeed();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setSpeed);

  /* --- Portfolio: véletlenszerű képek az összes albumból, egymásba csúszó (masonry) rácsban --- */
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  // albumonként keverve, majd körbe-körbe húzva, hogy egy nagy album se nyomja el a többit
  const pickPortfolio = (max) => {
    const pools = shuffle(albums.filter((a) => a.photos.length)
      .map((a) => shuffle(a.photos.map((p) => ({ slug: a.slug, photo: p, album: a })))));
    const out = [];
    while (out.length < max && pools.some((q) => q.length)) {
      for (const q of pools) if (q.length && out.length < max) out.push(q.pop());
    }
    return shuffle(out);
  };

  const pfSection = document.getElementById("portfolio");
  const pfGrid = document.getElementById("portfolio-grid");
  const pfItems = pickPortfolio(PORTFOLIO_MAX);
  if (!pfItems.length) {
    pfSection.hidden = true;
  } else {
    const nodes = pfItems.map((it) => {
      const img = fadeImage(el("img", {
        alt: "", loading: "lazy", decoding: "async",
        srcset: photoSrcset(it.slug, it.photo),
        sizes: "(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw",
        src: photoSrc(it.slug, it.photo, bestSize(it.photo, 800)),
      }));
      const a = el("a", { class: "pf-item", href: `album.html?a=${it.slug}`, "aria-label": `Open album: ${it.album.title}` },
        img, el("span", { class: "pf-cap", text: it.album.title }));
      a.style.aspectRatio = `${it.photo.w} / ${it.photo.h}`;
      return { a, ratio: it.photo.h / it.photo.w };
    });

    let lastCols = 0;
    const layout = () => {
      const W = pfGrid.clientWidth;
      if (!W) return;
      const cols = W < 600 ? 2 : W < 1000 ? 3 : 4;
      if (cols === lastCols) return;
      lastCols = cols;
      const colEls = Array.from({ length: cols }, () => el("div", { class: "pf-col" }));
      const subset = nodes.slice(0, cols === 2 ? Math.min(12, PORTFOLIO_MAX) : PORTFOLIO_MAX);
      // Sok véletlen sorrendet kipróbálunk: mindegyiknél minden képet a pillanatnyilag legrövidebb oszlopba teszünk,
      // és azt a kiosztást tartjuk meg, ahol az oszlopok alja a leginkább egy szintre esik.
      // (a páros oszlopok CSS-ből lejjebb indulnak, ezt itt ~0,3 oszlopszélességgel számoljuk be)
      const simulate = (order) => {
        const heights = colEls.map((_, i) => (i % 2 ? 0.3 : 0));
        const assign = order.map((n) => {
          let c = 0;
          for (let i = 1; i < cols; i++) if (heights[i] < heights[c]) c = i;
          heights[c] += n.ratio + 0.04;
          return c;
        });
        return { order, assign, spread: Math.max(...heights) - Math.min(...heights) };
      };
      let best = simulate(subset);
      for (let t = 0; t < 300 && best.spread > 0.08; t++) {
        const cand = simulate(shuffle(subset.slice()));
        if (cand.spread < best.spread) best = cand;
      }
      best.order.forEach((n, k) => colEls[best.assign[k]].append(n.a));
      pfGrid.replaceChildren(...colEls);
    };
    layout();
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); }).observe(pfGrid);
    reveal(nodes.map((n) => n.a));
  }

  /* --- albumok --- */
  const grid = document.getElementById("albums-grid");
  if (!albums.length) {
    grid.replaceWith(el("p", { class: "message",
      text: "No albums yet. Copy your photos into the originals folder (one subfolder per album), run python build.py, and refresh the page." }));
  }
  albums.forEach((a) => {
    const cover = a.photos.find((p) => p.id === a.cover) || a.photos[0];
    const img = fadeImage(el("img", {
      alt: "", loading: "lazy", srcset: photoSrcset(a.slug, cover),
      sizes: "(max-width: 640px) 100vw, 33vw",
      src: photoSrc(a.slug, cover, bestSize(cover, 800)),
    }));
    const label = el("div", { class: "label" },
      el("div", { class: "name", text: a.title }),
      el("div", { class: "count", text: `${a.photos.length} ${a.photos.length === 1 ? "photo" : "photos"}` }));
    grid.append(el("a", { class: "album-card", href: `album.html?a=${a.slug}` }, img, label));
  });
  reveal(grid.querySelectorAll(".album-card"));
  reveal(document.querySelectorAll(".section-title, .about .text, .contact .mail, .contact .social"));

  /* Ha az albumoldalról jöttünk (index.html#rolam stb.), a tartalom csak most töltődött be,
     ezért a böngésző elsőre rossz helyre görgetett: itt újra a jó szekcióhoz ugrunk. */
  const jumpToHash = () => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
  };
  requestAnimationFrame(() => requestAnimationFrame(jumpToHash));
  window.addEventListener("load", jumpToHash);
})();
