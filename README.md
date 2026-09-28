# Fotós portfólió

## Egyszeri előkészület
```
pip install -r requirements.txt
```

## Új képek feltöltése (minden alkalommal)
1. Másold a képeket az `originals/<album-neve>/` mappába (új mappa = új album).
   A főoldalon megjelenő képeket tedd az album `kedvenc/` almappájába.
2. Futtasd: `python build.py`
3. Nézd meg helyben: `python -m http.server -d docs 8000` majd böngészőben: http://localhost:8000
4. Töltsd fel:
   ```
   git add .
   git commit -m "Új képek"
   git push
   ```

## Szövegek átírása
A név, a rövid bemutatkozás, a "Rólam" szöveg és az elérhetőségek a `docs/site.json` fájlban vannak.
Az albumok címe/leírása/borítója az album mappájában lévő `album.yml` fájlban.

## GitHub Pages
Repo → Settings → Pages → Branch: `main`, mappa: `/docs`.
