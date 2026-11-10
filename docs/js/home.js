/* Főoldal: nyitókép, Portfolio (egymásba csúszó rács), albumok, szövegek a site.json-ból */

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

  /* Rólam-kép (originals/about.jpg): a szöveg mellett jelenik meg, ha van ilyen kép */
  if (data.about) {
    const sz = data.about.sizes;
    const pick = sz.find((w) => w >= 1200) || sz[sz.length - 1];
    const fig = el("figure", { class: "about-photo" }, fadeImage(el("img", {
      alt: name, loading: "lazy", decoding: "async",
      srcset: sz.map((w) => `about/about-${w}.webp ${w}w`).join(", "), sizes: "(max-width: 800px) 100vw, 40vw",
      src: `about/about-${pick}.webp`,
    })));
    document.getElementById("about-grid").classList.add("has-photo");
    document.getElementById("about-grid").prepend(fig);
    reveal([fig]);
  }

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

  /* --- Portfolio ---
     Ha van originals/portfolio mappa, az ott kiválasztott képek jelennek meg (véletlen sorrendben).
     Ha nincs, az összes albumból véletlenszerűen válogat. */
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

  const albumBySlug = Object.fromEntries(albums.map((a) => [a.slug, a]));
  const chosen = data.portfolio || [];
  const limited = !chosen.length;      // true: véletlen válogatás, ilyenkor van darabszám-korlát
  const pfItems = limited
    ? pickPortfolio(PORTFOLIO_MAX).map((it) => ({ slug: it.slug, photo: it.photo, link: it.slug, title: it.album.title }))
    : shuffle(chosen.map((c) => {
        const alb = c.album ? albumBySlug[c.album] : null;
        return { slug: "_portfolio", photo: c.photo, link: alb ? alb.slug : null, title: alb ? alb.title : "" };
      }));

  const pfSection = document.getElementById("portfolio");
  const pfGrid = document.getElementById("portfolio-grid");
  if (!pfItems.length) {
    pfSection.hidden = true;
  } else {
    const lbItems = pfItems.filter((it) => !it.link);   // album nélküli képek: nagyban nyílnak meg
    const nodes = pfItems.map((it) => {
      const img = fadeImage(el("img", {
        alt: "", loading: "lazy", decoding: "async",
        srcset: photoSrcset(it.slug, it.photo),
        sizes: "(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw",
        src: photoSrc(it.slug, it.photo, bestSize(it.photo, 800)),
      }));
      const a = el("a", {
        class: "pf-item", href: it.link ? `album.html?a=${it.link}` : "#",
        "aria-label": it.link ? `Open album: ${it.title}` : "Open photo",
      }, img, it.link ? el("span", { class: "pf-cap", text: it.title }) : null);
      if (!it.link) a.addEventListener("click", (e) => { e.preventDefault(); lightbox.open(lbItems, lbItems.indexOf(it)); });
      return { a, ratio: it.photo.h / it.photo.w, linked: !!it.link };
    });

    createMasonry(pfGrid, nodes, {
      colsFor: (W) => (W < 600 ? 2 : W < 1000 ? 3 : 4),
      poolFor: (W) => (limited ? nodes.slice(0, W < 600 ? Math.min(12, PORTFOLIO_MAX) : PORTFOLIO_MAX) : nodes),
    });
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
