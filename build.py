#!/usr/bin/env python3
"""
Feldolgozza az originals/ mappa képeit, és elkészíti a weboldalhoz szükséges
fájlokat a docs/ mappában:

  docs/photos/<album>/<kep>-<szelesseg>.webp   (több méretben)
  docs/photos/_themes/...                      (a főoldali témák széles borítóképei)
  docs/albums.json                             (témák, albumok és képek listája)

Szerkezet:  originals/<téma>/<album>/<képek>

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
HERO_OUT = ROOT / "docs" / "hero"
ABOUT_OUT = ROOT / "docs" / "about"

WIDTHS = [480, 800, 1200, 1800, 2400]   # ezekben a szélességekben készülnek a képek
QUALITY = 82                            # WebP minőség (75-90 között érdemes)
EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
THEMES_SLUG = "_themes"                 # a témák borítóképeinek mappája a docs/photos alatt
FEATURED_DIR = "kedvenc"                # ha nincs originals/hero.jpg, ennek az első képe lesz a nyitókép

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


def read_meta(folder: Path, filename: str) -> dict:
    meta_file = folder / filename
    if meta_file.exists() and yaml is not None:
        try:
            return yaml.safe_load(meta_file.read_text(encoding="utf-8")) or {}
        except Exception as exc:
            print(f"  ! {filename} hiba ({folder.name}): {exc}")
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


def build_album(folder: Path, slug: str):
    print(f"  Album: {folder.name}")
    meta = read_meta(folder, "album.yml")

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


def is_image(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in EXTENSIONS


def build_theme(folder: Path, theme_slug: str, used_slugs: set):
    """Egy téma: originals/<téma>/ . Az almappái az albumok (régi szerkezet: ha a mappában közvetlenül képek vannak,
    az egyetlen albumos téma lesz). Opcionális: theme.yml és cover.jpg (a főoldali széles borítókép)."""
    print(f"Téma: {folder.name}")
    meta = read_meta(folder, "theme.yml")

    def album_slug(name: str) -> str:
        base = slugify(name)
        slug, n = base, 2
        if slug in used_slugs:
            slug = f"{theme_slug}-{base}"
        while slug in used_slugs:
            slug, n = f"{theme_slug}-{base}-{n}", n + 1
        used_slugs.add(slug)
        return slug

    loose = [p for p in sorted(folder.iterdir()) if is_image(p) and p.stem.lower() != "cover"]
    albums = []
    if loose:
        # régi szerkezet: a mappa maga az album
        album = build_album(folder, album_slug(folder.name))
        if album:
            albums.append(album)
    else:
        for sub in sorted(d for d in folder.iterdir() if d.is_dir() and d.name != FEATURED_DIR and d.name[0] not in "._"):
            album = build_album(sub, album_slug(sub.name))
            if album:
                albums.append(album)
    if not albums:
        print("  (nincs album, kihagyva)")
        return None

    albums.sort(key=lambda a: (a["order"], a["title"].lower()))
    for a in albums:
        a["theme"] = theme_slug

    # borítókép: cover.jpg a téma mappájában > theme.yml 'cover' > az első album borítója
    cover = None
    cover_file = next((p for p in sorted(folder.iterdir()) if is_image(p) and p.stem.lower() == "cover"), None)
    if cover_file:
        photo = process_photo(cover_file, THEMES_SLUG, theme_slug, False)
        del photo["featured"]
        cover = {"slug": THEMES_SLUG, "photo": photo}
    elif meta.get("cover"):
        wanted = slugify(Path(str(meta["cover"])).stem)
        for a in albums:
            for ph in a["photos"]:
                if ph["id"] == wanted and cover is None:
                    cover = {"slug": a["slug"], "photo": ph}
        if cover is None:
            print(f"  ! a megadott borítókép nem található: {meta['cover']}")
    if cover is None:
        first = albums[0]
        ph = next((x for x in first["photos"] if x["id"] == first["cover"]), first["photos"][0])
        cover = {"slug": first["slug"], "photo": ph}

    title = meta.get("title") or (albums[0]["title"] if loose else pretty_title(folder.name))
    desc = meta.get("description") or (albums[0]["description"] if loose else "")
    return {
        "theme": {
            "slug": theme_slug, "title": str(title), "description": str(desc),
            "cover": cover, "order": meta.get("order", 1000), "albums": [a["slug"] for a in albums],
        },
        "albums": albums,
    }


def build_single(stem, out_dir, label):
    """Egyetlen különálló kép feldolgozása: originals/<stem>.jpg (vagy .png, .webp ...) -> docs/<out_dir>/<stem>-<szélesség>.webp"""
    src = next((f for f in sorted(SRC.iterdir())
                if f.is_file() and f.stem.lower() == stem and f.suffix.lower() in EXTENSIONS), None)
    if src is None:
        if out_dir.is_dir():
            import shutil
            shutil.rmtree(out_dir)
        return None
    with Image.open(src) as probe:
        width, height = oriented_size(probe)
    sizes = sizes_for(width)
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = []
    for w in sizes:
        target = out_dir / f"{stem}-{w}.webp"
        if FORCE or not target.exists() or target.stat().st_mtime < src.stat().st_mtime:
            todo.append((w, target))
    if todo:
        img = load_prepared(src)
        for w, target in todo:
            resized = img if w == img.width else img.resize((w, round(w * img.height / img.width)), Image.LANCZOS)
            resized.save(target, "WEBP", quality=QUALITY, method=6)
        print(f"  + {label}: {src.name}  ({len(todo)} új méret)")
    return {"sizes": sizes, "w": width, "h": height}


def build_hero():
    """A nyitóoldal fix háttérképe: originals/hero.jpg"""
    return build_single("hero", HERO_OUT, "nyitókép")


def build_about():
    """A Rólam rész képe: originals/about.jpg"""
    return build_single("about", ABOUT_OUT, "rólam-kép")


def main():
    if not SRC.is_dir():
        sys.exit("Nem találom az originals/ mappát. A build.py mellett kell lennie.")
    if yaml is None:
        print("Figyelem: a pyyaml nincs telepítve, a theme.yml és album.yml fájlok figyelmen kívül maradnak.")
        print("          Telepítés: pip install pyyaml\n")

    themes, used_album_slugs, used_theme_slugs = [], set(), set()
    for folder in sorted(p for p in SRC.iterdir() if p.is_dir() and p.name[0] not in "._"):
        if folder.name.lower() == "portfolio":
            print("Megjegyzés: a régi 'portfolio' mappa már nem különleges, sima témaként kezeli. Ha nem kell, töröld.")
        theme_slug, n = slugify(folder.name), 2
        while theme_slug in used_theme_slugs:
            theme_slug, n = f"{slugify(folder.name)}-{n}", n + 1
        used_theme_slugs.add(theme_slug)
        result = build_theme(folder, theme_slug, used_album_slugs)
        if result:
            themes.append(result)

    themes.sort(key=lambda t: (t["theme"]["order"], t["theme"]["title"].lower()))
    theme_list = [t["theme"] for t in themes]
    albums = [a for t in themes for a in t["albums"]]
    for x in theme_list + albums:
        del x["order"]

    # a már nem létező albumok / témaborítók törlése a weboldalról
    import shutil
    uses_themes_dir = any(t["cover"]["slug"] == THEMES_SLUG for t in theme_list)
    keep = {a["slug"] for a in albums} | ({THEMES_SLUG} if uses_themes_dir else set())
    if OUT.is_dir():
        for d in OUT.iterdir():
            if d.is_dir() and d.name not in keep:
                shutil.rmtree(d)
                print(f"Törölve a weboldalról: {d.name}")
    if uses_themes_dir:
        valid = {f"{t['cover']['photo']['id']}-{w}.webp" for t in theme_list if t["cover"]["slug"] == THEMES_SLUG
                 for w in t["cover"]["photo"]["sizes"]}
        for old in (OUT / THEMES_SLUG).glob("*.webp"):
            if old.name not in valid:
                old.unlink()

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    hero = build_hero()
    about = build_about()
    JSON_PATH.write_text(json.dumps({"hero": hero, "about": about, "themes": theme_list, "albums": albums},
                                    ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(a["photos"]) for a in albums)
    print(f"\nKész: {len(theme_list)} téma, {len(albums)} album, {total} kép -> docs/albums.json")


if __name__ == "__main__":
    main()
