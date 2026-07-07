from PIL import Image, ImageDraw
import os

sizes = [16, 32, 48, 128]
out = r"C:\Users\kushal\watchparty\extension\icons"

os.makedirs(out, exist_ok=True)

for s in sizes:
    img = Image.new("RGBA", (s, s), (8, 10, 15, 255))
    draw = ImageDraw.Draw(img)

    # simple play triangle
    pad = s * 0.25
    draw.polygon([
        (pad, pad),
        (s - pad, s / 2),
        (pad, s - pad)
    ], fill=(245, 166, 35, 255))

    img.save(f"{out}/icon{s}.png")

print("Icons generated")