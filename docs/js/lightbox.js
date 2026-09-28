/* Teljes képernyős képnézegető: nyilak, Esc, húzás (swipe) telefonon */

function createLightbox() {
  const img = el("img", { class: "lb-img", alt: "" });
  const count = el("div", { class: "lb-count" });
  const close = el("button", { class: "lb-close", type: "button", "aria-label": "Bezárás", text: "×" });
  const prev = el("button", { class: "lb-prev", type: "button", "aria-label": "Előző kép", text: "‹" });
  const next = el("button", { class: "lb-next", type: "button", "aria-label": "Következő kép", text: "›" });
  const root = el("div", { class: "lb", role: "dialog", "aria-modal": "true", "aria-label": "Képnézegető" },
    img, close, prev, next, count);
  document.body.append(root);

  let list = [];
  let index = 0;

  const srcFor = (item) => {
    const p = item.photo;
    const ar = p.w / p.h;
    const cssW = Math.min(window.innerWidth * 0.96, window.innerHeight * 0.9 * ar);
    const w = bestSize(p, cssW * (window.devicePixelRatio || 1));
    return photoSrc(item.slug, p, w);
  };

  const show = (i) => {
    index = (i + list.length) % list.length;
    img.src = srcFor(list[index]);
    img.alt = list[index].alt || "";
    count.textContent = `${index + 1} / ${list.length}`;
    // a szomszédos képek előtöltése
    [index - 1, index + 1].forEach((n) => {
      const it = list[(n + list.length) % list.length];
      if (it) new Image().src = srcFor(it);
    });
  };

  const open = (items, i) => {
    list = items;
    show(i);
    root.classList.add("open");
    document.body.classList.add("lb-open");
    close.focus();
  };
  const hide = () => {
    root.classList.remove("open");
    document.body.classList.remove("lb-open");
  };

  close.addEventListener("click", hide);
  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  root.addEventListener("click", (e) => { if (e.target === root) hide(); });
  document.addEventListener("keydown", (e) => {
    if (!root.classList.contains("open")) return;
    if (e.key === "Escape") hide();
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });

  let startX = 0, startY = 0;
  root.addEventListener("touchstart", (e) => {
    startX = e.changedTouches[0].clientX;
    startY = e.changedTouches[0].clientY;
  }, { passive: true });
  root.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) hide();   // lefelé húzás = bezárás
  }, { passive: true });

  return { open };
}
