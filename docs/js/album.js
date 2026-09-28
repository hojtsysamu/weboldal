/* Albumoldal: az album.html?a=<mappa-neve> címről tölti be az adott albumot */

(async function () {
  initHeader();
  const lightbox = createLightbox();

  const slug = new URLSearchParams(location.search).get("a");
  const [site, data] = await Promise.all([
    getJSON("site.json").catch(() => ({})),
    getJSON("albums.json").catch(() => ({ albums: [] })),
  ]);
  const albums = data.albums || [];
  const name = site.name || "Photographer";
  document.querySelectorAll("[data-name]").forEach((n) => (n.textContent = name));
  document.getElementById("year").textContent = new Date().getFullYear();

  const idx = albums.findIndex((a) => a.slug === slug);
  const body = document.getElementById("album-body");

  if (idx < 0) {
    document.title = name;
    document.getElementById("album-title").textContent = "Album not found";
    body.append(el("p", { class: "message" }, "This album does not exist. ",
      el("a", { href: "index.html#albumok", text: "Back to albums" })));
    return;
  }

  const album = albums[idx];
  document.title = `${album.title} – ${name}`;
  document.getElementById("album-title").textContent = album.title;
  const desc = document.getElementById("album-desc");
  if (album.description) desc.textContent = album.description; else desc.hidden = true;
  document.getElementById("album-meta").textContent = `${album.photos.length} ${album.photos.length === 1 ? "photo" : "photos"}`;

  const items = album.photos.map((p) => ({ slug: album.slug, photo: p }));
  const grid = el("div");
  body.append(grid);
  renderJustified(grid, items, { onOpen: (i) => lightbox.open(items, i) });

  /* előző / következő album */
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
