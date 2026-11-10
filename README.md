# Fotós portfólió

## Egyszeri előkészület
```
pip install -r requirements.txt
```

## Új képek feltöltése (minden alkalommal)
1. Másold a képeket az `originals/<album-neve>/` mappába (új mappa = új album).
   (Ha nincs `originals/hero.jpg`, a nyitókép az album `kedvenc/` almappájának első képe lesz.)
2. Futtasd: `python build.py`
3. Nézd meg helyben: `python -m http.server -d docs 8000` majd böngészőben: http://localhost:8000
4. Töltsd fel:
   ```
   git add .
   git commit -m "Új képek"
   git push
   ```

## A főoldali Portfolio rész képeinek kiválasztása
Készíts egy `originals/portfolio/` mappát, és ide másold azokat a képeket, amelyeket a főoldalon látni szeretnél
(minden betöltéskor véletlen sorrendben jelennek meg). Ez a mappa nem album, nem jelenik meg az Albums részben.
- Közvetlenül a `portfolio` mappában lévő kép: kattintásra nagyban nyílik meg.
- `originals/portfolio/<album-neve>/` almappában lévő kép: kattintásra az adott albumra visz
  (az almappa neve egyezzen az album mappájának nevével, például `portfolio/early-drift/`).

Ha nincs `portfolio` mappa, a főoldal az összes albumból véletlenszerűen válogat (legfeljebb 18 képet).
Mindig futtasd utána a `python build.py` parancsot.

## Kurzor-kiegészítő
A megszokott egérkurzor megmarad, mellette egy kis pötty úszik utána, képek fölött kiírja: Album / View / Open. A `docs/js/cursor.js` adja (csak egérrel működik, telefonon nem). Kikapcsolás: töröld a
`<script src="js/cursor.js"></script>` sort az `index.html`-ből és az `album.html`-ből.

## Szövegek átírása
A név, a rövid bemutatkozás, a "Rólam" szöveg és az elérhetőségek a `docs/site.json` fájlban vannak.
Az albumok címe/leírása/borítója az album mappájában lévő `album.yml` fájlban.

## GitHub Pages
Repo → Settings → Pages → Branch: `main`, mappa: `/docs`.
