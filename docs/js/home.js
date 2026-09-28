/* Főoldal: nyitókép, kiemelt képek, albumok, szövegek a site.json-ból */

(async function () {
  initHeader();
  const lightbox = createLightbox();

  const [site, data] = await Promise.all([
    getJSON("site.json").catch(() => ({})),
    getJSON("albums.json").catch(() => ({ albums: [] })),
  ]);
  const albums = data.albums || [];

  /* --- szövegek --- */
  const name = site.name || "Fotográfus";
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

  /* --- kiemelt képek --- */
  const featSection = document.getElementById("kiemelt");
  const gridItems = featured.filter((x) => x !== heroItem).slice(0, 6);
  if (gridItems.length >= 2) {
    renderJustified(document.getElementById("featured-grid"), gridItems, {
      onOpen: (i) => lightbox.open(gridItems, i),
      fillLast: true,
    });
  } else {
    featSection.hidden = true;
  }

  /* --- albumok --- */
  const grid = document.getElementById("albums-grid");
  if (!albums.length) {
    grid.replaceWith(el("p", { class: "message",
      text: "Még nincs feltöltött album. Másold a képeket az originals mappába (albumonként egy almappába), futtasd le a python build.py parancsot, és frissítsd az oldalt." }));
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
      el("div", { class: "count", text: `${a.photos.length} kép` }));
    grid.append(el("a", { class: "album-card", href: `album.html?a=${a.slug}` }, img, label));
  });
})();
