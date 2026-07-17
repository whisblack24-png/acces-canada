from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / "public" / "brand" / "signature-director.png").convert("RGBA")
width = 720
height = round(source.height * width / source.width)
alpha = source.resize((width, height), Image.Resampling.LANCZOS).getchannel("A")
runs = []
for y in range(height):
    x = 0
    while x < width:
        while x < width and alpha.getpixel((x, y)) < 48:
            x += 1
        start = x
        while x < width and alpha.getpixel((x, y)) >= 48:
            x += 1
        if x > start:
            runs.append((start, height - y - 1, x - start))

target = ROOT / "lib" / "signature-director-data.ts"
target.write_text(
    "// Generated from the approved transparent signature asset.\n"
    f"export const directorSignatureWidth={width};\n"
    f"export const directorSignatureHeight={height};\n"
    "export const directorSignatureRuns:readonly [number,number,number][]=\n["
    + ",".join(f"[{x},{y},{length}]" for x, y, length in runs)
    + "];\n",
    encoding="utf-8",
)
