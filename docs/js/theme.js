/* Témaoldal: a theme.html?t=<téma-neve> címről tölti be az adott téma albumait */

(async function () {
  initHeader();

  const slug = new URLSearchParams(location.search).get("t");
  const [site, data] = await Promise.all([
    getJSON("site.json").catch(() => ({})),
    getJSON("albums.json").catch(() => ({ themes: [], albums: [] })),
  ]);
  const themes = data.themes || [];
  const albums = data.albums || [];
  const name = site.name || "Photographer";
  document.querySelectorAll("[data-name]").forEach((n) => (n.textContent = name));
  document.getElementById("year").textContent = new Date().getFullYear();

  const idx = themes.findIndex((t) => t.slug === slug);
  const body = document.getElementById("theme-body");
  if (idx < 0) {
    document.title = name;
    document.getElementById("theme-title").textContent = "Not found";
    body.append(el("p", { class: "message" }, "This page does not exist. ", el("a", { href: "index.html#work", text: "Back to work" })));
    return;
  }

  const theme = themes[idx];
  const list = theme.albums.map((s) => albums.find((a) => a.slug === s)).filter(Boolean);
  document.title = `${theme.title} – ${name}`;
  document.getElementById("theme-title").textContent = theme.title;
  const desc = document.getElementById("theme-desc");
  if (theme.description) desc.textContent = theme.description; else desc.hidden = true;
  document.getElementById("theme-meta").textContent = `${list.length} ${list.length === 1 ? "album" : "albums"}`;

  const grid = el("div", { class: "albums-grid" });
  body.append(grid);
  list.forEach((a) => {
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

  /* előző / következő téma */
  const nav = document.getElementById("theme-nav");
  if (themes.length > 1) {
    const prev = themes[(idx - 1 + themes.length) % themes.length];
    const next = themes[(idx + 1) % themes.length];
    const hrefFor = (t) => (t.albums.length === 1 ? `album.html?a=${t.albums[0]}` : `theme.html?t=${t.slug}`);
    nav.append(el("a", { href: hrefFor(prev), text: "← " + prev.title }), el("a", { href: hrefFor(next), text: next.title + " →" }));
  } else nav.hidden = true;
})();
