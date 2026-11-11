/* Albumoldal: az album.html?a=<album-neve> címről tölti be az adott albumot */

(async function () {
  initHeader();
  const lightbox = createLightbox();

  const slug = new URLSearchParams(location.search).get("a");
  const [site, data] = await Promise.all([
    getJSON("site.json").catch(() => ({})),
    getJSON("albums.json").catch(() => ({ themes: [], albums: [] })),
  ]);
  const allAlbums = data.albums || [];
  const themes = data.themes || [];
  const name = site.name || "Photographer";
  document.querySelectorAll("[data-name]").forEach((n) => (n.textContent = name));
  document.getElementById("year").textContent = new Date().getFullYear();

  const found = allAlbums.find((a) => a.slug === slug);
  const body = document.getElementById("album-body");

  if (!found) {
    document.title = name;
    document.getElementById("album-title").textContent = "Album not found";
    body.append(el("p", { class: "message" }, "This album does not exist. ",
      el("a", { href: "index.html#work", text: "Back to work" })));
    return;
  }

  const album = found;
  // a téma albumai (egymás közti lapozáshoz) és a vissza-link
  const theme = themes.find((t) => t.slug === album.theme);
  const albums = allAlbums.filter((a) => a.theme === album.theme);
  const idx = albums.findIndex((a) => a.slug === album.slug);
  const back = document.getElementById("album-back");
  if (theme && theme.albums.length > 1) {
    back.href = `theme.html?t=${theme.slug}`;
    back.textContent = "← " + theme.title;
  }
  document.title = `${album.title} – ${name}`;
  document.getElementById("album-title").textContent = album.title;
  const desc = document.getElementById("album-desc");
  if (album.description) desc.textContent = album.description; else desc.hidden = true;
  document.getElementById("album-meta").textContent = `${album.photos.length} ${album.photos.length === 1 ? "photo" : "photos"}`;

  const items = album.photos.map((p) => ({ slug: album.slug, photo: p }));
  const grid = el("div", { class: "masonry" });
  body.append(grid);
  const nodes = items.map((it, i) => {
    const img = fadeImage(el("img", {
      alt: "", loading: "lazy", decoding: "async",
      srcset: photoSrcset(it.slug, it.photo),
      sizes: "(max-width: 640px) 50vw, (max-width: 1700px) 33vw, 520px",
      src: photoSrc(it.slug, it.photo, bestSize(it.photo, 1200)),
    }));
    const btn = el("button", { class: "pf-item", type: "button", "aria-label": "Open photo" }, img);
    btn.addEventListener("click", () => lightbox.open(items, i));
    return { a: btn, ratio: it.photo.h / it.photo.w };
  });
  // 3 nagy oszlop (nagyon széles képernyőn is, hogy a képek nagyok maradjanak); a sorrend nagyjából megmarad
  createMasonry(grid, nodes, { colsFor: (W) => (W < 640 ? 2 : W < 1700 ? 3 : 4), keepOrder: true });
  reveal(nodes.map((n) => n.a));

  /* előző / következő album (ugyanabban a témában) */
  const nav = document.getElementById("album-nav");
  const prev = albums[(idx - 1 + albums.length) % albums.length];
  const next = albums[(idx + 1) % albums.length];
  if (albums.length > 1) {
    nav.append(
      el("a", { href: `album.html?a=${prev.slug}`, text: "← " + prev.title }),
      el("a", { href: `album.html?a=${next.slug}`, text: next.title + " →" })
    );
  } else nav.hidden = true;
})();
