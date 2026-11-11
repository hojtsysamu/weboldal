/* Kurzor-kiegészítő: a megszokott egérkurzor megmarad, mellette egy kis pötty úszik utána.
   Linkek és képek fölött a pötty kinagyodik, és kiírja, mit fog csinálni a kattintás (Open / View).
   Csak egérrel (nem érintőképernyőn) működik. Ha nem kell, töröld a <script src="js/cursor.js"> sort
   az index.html-ből és az album.html-ből. */
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const label = document.createElement("i");
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.append(label);
  document.body.append(ring);

  // 1 = azonnal követ, kisebb szám = lustábban úszik utána (0,25 körül természetes)
  const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.25;
  let x = -100, y = -100, rx = x, ry = y, shown = false;

  window.addEventListener("mousemove", (e) => {
    x = e.clientX; y = e.clientY;
    if (!shown) { rx = x; ry = y; shown = true; document.body.classList.add("cursor-on"); }
    const t = e.target.closest ? e.target.closest("a, button, .pf-item, .album-card, .theme-card, .ph") : null;
    const photo = !!(t && t.matches(".pf-item, .album-card, .theme-card, .ph"));
    ring.classList.toggle("hover", !!t && !photo);
    ring.classList.toggle("photo", photo);
    label.textContent = !photo ? "" : t.matches(".album-card, .theme-card") ? "Open" : "View";
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => document.body.classList.remove("cursor-on"));
  document.documentElement.addEventListener("mouseenter", () => shown && document.body.classList.add("cursor-on"));
  window.addEventListener("mousedown", () => ring.classList.add("down"));
  window.addEventListener("mouseup", () => ring.classList.remove("down"));

  (function loop() {
    rx += (x - rx) * smooth;
    ry += (y - ry) * smooth;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    requestAnimationFrame(loop);
  })();
})();
