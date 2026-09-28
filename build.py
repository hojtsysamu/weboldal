#!/usr/bin/env python3
"""
Feldolgozza az originals/ mappa képeit, és elkészíti a weboldalhoz szükséges
fájlokat a docs/ mappában:

  docs/photos/<album>/<kep>-<szelesseg>.webp   (több méretben)
  docs/albums.json                             (album- és képlista)

Használat:   python build.py            (csak az új/módosított képeket dolgozza fel)
             python build.py --force    (mindent újragenerál)
"""
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

try:
    import yaml
except ImportError:
    yaml = None

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "originals"
OUT = ROOT / "docs" / "photos"
JSON_PATH = ROOT / "docs" / "albums.json"

WIDTHS = [480, 800, 1200, 1800, 2400]   # ezekben a szélességekben készülnek a képek
QUALITY = 82                            # WebP minőség (75-90 között érdemes)
EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
FEATURED_DIR = "kedvenc"                # ennek a képei a főoldalon is megjelennek

FORCE = "--force" in sys.argv
SRGB = ImageCms.createProfile("sRGB")


def slugify(text: str) -> str:
    """Ékezet nélküli, webbarát név: 'Utazás Portugália' -> 'utazas-portugalia'."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "kep"


def pretty_title(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").strip().title()


def oriented_size(img: Image.Image):
    """A kép valódi (elforgatás utáni) mérete, a pixelek betöltése nélkül."""
    w, h = img.size
    orientation = img.getexif().get(274)
    if orientation in (5, 6, 7, 8):
        w, h = h, w
    return w, h


def load_prepared(path: Path) -> Image.Image:
    """Betölti a képet: elforgatás az EXIF szerint, sRGB-re alakítás."""
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    icc = img.info.get("icc_profile")
    if icc:
        try:
            profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            img = ImageCms.profileToProfile(img, profile, SRGB, outputMode="RGB")
        except Exception:
            pass
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def sizes_for(width: int):
    sizes = [w for w in WIDTHS if w <= width]
    if not sizes:               # kisebb kép, mint a legkisebb méret
        sizes = [width]
    return sizes


def process_photo(path: Path, album_slug: str, photo_id: str, featured: bool):
    with Image.open(path) as probe:
        width, height = oriented_size(probe)

    sizes = sizes_for(width)
    out_dir = OUT / album_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    src_mtime = path.stat().st_mtime
    todo = []
    for w in sizes:
        target = out_dir / f"{photo_id}-{w}.webp"
        if FORCE or not target.exists() or target.stat().st_mtime < src_mtime:
            todo.append((w, target))

    if todo:
        img = load_prepared(path)
        for w, target in todo:
            if w == img.width:
                resized = img
            else:
                resized = img.resize((w, round(w * img.height / img.width)), Image.LANCZOS)
            # Metaadat (EXIF, GPS) nem kerül a fájlba
            resized.save(target, "WEBP", quality=QUALITY, method=6)
        print(f"  + {path.name}  ({len(todo)} új méret)")

    return {"id": photo_id, "w": width, "h": height, "sizes": sizes, "featured": featured}


def read_meta(folder: Path) -> dict:
    meta_file = folder / "album.yml"
    if meta_file.exists() and yaml is not None:
        try:
            return yaml.safe_load(meta_file.read_text(encoding="utf-8")) or {}
        except Exception as exc:
            print(f"  ! album.yml hiba ({folder.name}): {exc}")
    return {}


def collect_images(folder: Path):
    """Visszaadja a (fájl, kedvenc?) párokat; a 'kedvenc' almappa képei külön jelölve."""
    files = {}
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() in EXTENSIONS:
            files[p.stem] = (p, False)
    fav = folder / FEATURED_DIR
    if fav.is_dir():
        for p in sorted(fav.iterdir()):
            if p.is_file() and p.suffix.lower() in EXTENSIONS:
                files[p.stem] = (p, True)     # ha mindkét helyen van, kedvencnek számít
    return sorted(files.values(), key=lambda item: item[0].name.lower())


def build_album(folder: Path):
    print(f"Album: {folder.name}")
    meta = read_meta(folder)
    slug = slugify(folder.name)

    photos = []
    used_ids = set()
    for path, featured in collect_images(folder):
        photo_id = slugify(path.stem)
        base, n = photo_id, 2
        while photo_id in used_ids:
            photo_id, n = f"{base}-{n}", n + 1
        used_ids.add(photo_id)
        try:
            photos.append(process_photo(path, slug, photo_id, featured))
        except Exception as exc:
            print(f"  ! {path.name} kihagyva: {exc}")

    if not photos:
        print("  (nincs kép, kihagyva)")
        return None

    # a már nem létező képek fájljainak törlése
    valid = {f"{p['id']}-{w}.webp" for p in photos for w in p["sizes"]}
    for old in (OUT / slug).glob("*.webp"):
        if old.name not in valid:
            old.unlink()
            print(f"  - {old.name} törölve (már nincs az originals-ban)")

    cover = photos[0]["id"]
    if meta.get("cover"):
        wanted = slugify(Path(str(meta["cover"])).stem)
        if wanted in used_ids:
            cover = wanted
        else:
            print(f"  ! a megadott borítókép nem található: {meta['cover']}")

    return {
        "slug": slug,
        "title": str(meta.get("title") or pretty_title(folder.name)),
        "description": str(meta.get("description") or ""),
        "cover": cover,
        "order": meta.get("order", 1000),
        "photos": photos,
    }


def main():
    if not SRC.is_dir():
        sys.exit("Nem találom az originals/ mappát. A build.py mellett kell lennie.")
    if yaml is None:
        print("Figyelem: a pyyaml nincs telepítve, az album.yml fájlok figyelmen kívül maradnak.")
        print("          Telepítés: pip install pyyaml\n")

    albums = []
    for folder in sorted(p for p in SRC.iterdir() if p.is_dir()):
        album = build_album(folder)
        if album:
            albums.append(album)

    albums.sort(key=lambda a: (a["order"], a["title"].lower()))
    for a in albums:
        del a["order"]

    # a már nem létező albumok mappáinak törlése
    import shutil
    keep = {a["slug"] for a in albums}
    if OUT.is_dir():
        for d in OUT.iterdir():
            if d.is_dir() and d.name not in keep:
                shutil.rmtree(d)
                print(f"Album törölve a weboldalról: {d.name}")

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps({"albums": albums}, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(a["photos"]) for a in albums)
    print(f"\nKész: {len(albums)} album, {total} kép -> docs/albums.json")


if __name__ == "__main__":
    main()
