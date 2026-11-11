/* Főoldal: nyitókép, témák (széles borítóképek), rólam, kapcsolat a site.json-ból */

(async function () {
  initHeader();

  const [site, data] = await Promise.all([
    getJSON("site.json").catch(() => ({})),
    getJSON("albums.json").catch(() => ({ themes: [], albums: [] })),
  ]);
  const albums = data.albums || [];
  const themes = data.themes || [];

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

  /* --- témák: egy-egy széles kép az oldal teljes szélességében; kattintásra a téma albumai nyílnak meg --- */
  const box = document.getElementById("themes");
  const albumBySlug = Object.fromEntries(albums.map((a) => [a.slug, a]));
  if (!themes.length) {
    box.replaceWith(el("p", { class: "message", text: "Nothing here yet. Create a folder in originals/ for each theme, run python build.py, and refresh the page." }));
  }
  themes.forEach((t) => {
    const single = t.albums.length === 1 ? albumBySlug[t.albums[0]] : null;   // egyetlen album: egyből oda visz
    const href = single ? `album.html?a=${single.slug}` : `theme.html?t=${t.slug}`;
    const count = single
      ? `${single.photos.length} ${single.photos.length === 1 ? "photo" : "photos"}`
      : `${t.albums.length} albums`;
    const img = fadeImage(el("img", {
      alt: "", loading: "lazy", decoding: "async",
      srcset: photoSrcset(t.cover.slug, t.cover.photo), sizes: "100vw",
      src: photoSrc(t.cover.slug, t.cover.photo, bestSize(t.cover.photo, 1800)),
    }));
    const label = el("div", { class: "label" },
      el("div", { class: "name", text: t.title }),
      el("div", { class: "count", text: count }));
    box.append(el("a", { class: "theme-card", href, "aria-label": t.title }, img, label));
  });
  reveal(box.querySelectorAll(".theme-card"));
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
