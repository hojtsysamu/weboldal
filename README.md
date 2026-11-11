# Fotós portfólió

## Egyszeri előkészület
```
python -m pip install -r requirements.txt
```

## Mappaszerkezet: téma → album → képek
```
originals/
  hero.jpg                  <- a főoldal nyitóképe (nem kötelező)
  about.jpg                 <- a Rólam rész kör alakú képe (nem kötelező)
  autok/                    <- TÉMA (ez jelenik meg a főoldalon egy széles képként)
    cover.jpg               <- a téma főoldali képe (nem kötelező, ajánlott: fekvő, 2:1 arányú, pl. 2400×1200 px)
    theme.yml               <- cím, leírás, sorrend (nem kötelező)
    early-drift/            <- ALBUM (a téma oldalán jelenik meg)
      album.yml             <- cím, leírás, borító, sorrend (nem kötelező)
      01-elso.jpg
      02-masodik.jpg
    track-day/
      ...
  koncert/
    gitaros-este/
      ...
```
- A mappák és a témák nevét kisbetűvel, ékezet és szóköz nélkül, kötőjellel érdemes írni (`modell-fotozas`). A szép, ékezetes cím a `theme.yml` / `album.yml` fájlban adható meg.
- Ha egy témában csak egy album van, a főoldalon a téma képére kattintva egyből az album nyílik meg.
- Ha nincs `cover.jpg` a téma mappájában, a téma képe az első album borítóképe lesz (ez általában álló kép, ezért a 2:1-es sávban erősen levágva látszik, ezért érdemes külön, 2:1 arányú `cover.jpg`-t adni).
- Régi szerkezet is működik: ha egy mappában közvetlenül képek vannak, az egyetlen albumos témaként jelenik meg.

## Új képek feltöltése (minden alkalommal)
1. Másold a képeket a megfelelő `originals/<téma>/<album>/` mappába (új mappa = új téma vagy album).
2. Futtasd: `python build.py`
3. Nézd meg helyben: `python -m http.server -d docs 8000` majd böngészőben: http://localhost:8000
4. Töltsd fel:
   ```
   git add .
   git commit -m "Új képek"
   git push
   ```

## Nyitókép és Rólam-kép
- `originals/hero.jpg` (vagy `.png`, `.webp`): a főoldal fix háttérképe. Ha nincs, az első album `kedvenc/` almappájának első képe (vagy borítója) lesz.
- `originals/about.jpg`: a Rólam szöveg mellett jelenik meg kör alakúra vágva (a kép felső-középső része marad meg). Ha nincs, csak a szöveg látszik.

## Kurzor-kiegészítő
A megszokott egérkurzor megmarad, mellette egy kis pötty úszik utána, képek fölött kiírja: Open / View. A `docs/js/cursor.js` adja (csak egérrel működik, telefonon nem). Kikapcsolás: töröld a
`<script src="js/cursor.js"></script>` sort az `index.html`-ből, a `theme.html`-ből és az `album.html`-ből.

## Szövegek átírása
A név, a rövid bemutatkozás, a "Rólam" szöveg és az elérhetőségek a `docs/site.json` fájlban vannak.
A témák és albumok címe/leírása/borítója a `theme.yml` és `album.yml` fájlokban.

## GitHub Pages
Repo → Settings → Pages → Branch: `main`, mappa: `/docs`.
