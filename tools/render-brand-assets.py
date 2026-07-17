from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "brand"
NAVY = (11, 29, 54, 255)
GOLD = (212, 175, 55, 255)
RED = (208, 0, 0, 255)
WHITE = (255, 255, 255, 225)

def font(size, bold=False, serif=False):
    name = ("georgiab.ttf" if bold else "georgia.ttf") if serif else ("arialbd.ttf" if bold else "arial.ttf")
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()

def centered(draw, xy, text, f, fill, spacing=0):
    widths = [draw.textlength(char, font=f) for char in text]
    x = xy[0] - (sum(widths) + spacing * max(0, len(text) - 1)) / 2
    for char, width in zip(text, widths):
        draw.text((x, xy[1]), char, font=f, fill=fill, anchor="lm")
        x += width + spacing

def seal(path, mono=False):
    size = 1600
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    center = size // 2
    ink = NAVY
    accent = ink if mono else GOLD
    maple_color = ink if mono else RED
    draw.ellipse((35, 35, size - 35, size - 35), fill=WHITE, outline=accent, width=28)
    draw.ellipse((72, 72, size - 72, size - 72), outline=ink, width=16)
    draw.ellipse((280, 280, size - 280, size - 280), fill=(255, 255, 255, 175), outline=accent, width=18)
    draw.ellipse((325, 325, size - 325, size - 325), outline=accent, width=7)
    centered(draw, (center, 215), "ACCÈS CANADA", font(70, True, True), ink, 4)
    centered(draw, (center, 1360), "DOCUMENT OFFICIEL", font(46, True, True), ink, 3)
    maple = [(800,278),(827,346),(889,312),(873,382),(947,390),(888,437),(933,490),(857,476),(860,553),(800,510),(740,553),(743,476),(667,490),(712,437),(653,390),(727,382),(711,312),(773,346)]
    draw.polygon(maple, fill=maple_color)
    draw.line((800, 510, 800, 576), fill=maple_color, width=12)
    draw.text((790, 845), "A", font=font(390, True, True), fill=ink, anchor="rm")
    draw.text((790, 845), "C", font=font(390, True, True), fill=accent, anchor="lm")
    draw.line((500, 980, 1100, 980), fill=accent, width=8)
    draw.ellipse((787, 966, 813, 992), fill=accent)
    for side in (-1, 1):
        points = []
        for index in range(9):
            y = 600 + index * 65
            x = center + side * (565 - 18 * index)
            points.append((x, y))
            draw.ellipse((x - 28, y - 18, x + 28, y + 18), fill=accent)
        draw.line(points, fill=accent, width=12)
    image.save(path, optimize=True)

seal(OUT / "seal-official.png")
seal(OUT / "seal-monochrome.png", mono=True)
seal(OUT / "seal-signed.png")
