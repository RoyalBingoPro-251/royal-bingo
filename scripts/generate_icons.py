#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("assets", exist_ok=True)
size = 512
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Outer Royal Navy Shield with Golden Border
draw.rounded_rectangle([16, 16, 496, 496], radius=96, fill=(10, 17, 40, 255), outline=(234, 179, 8, 255), width=14)

# Golden Crown
crown_pts = [(130, 210), (110, 120), (195, 170), (256, 95), (317, 170), (402, 120), (382, 210)]
draw.polygon(crown_pts, fill=(250, 204, 21, 255))

# Central Bingo Ball with "251"
draw.ellipse([156, 225, 356, 425], fill=(234, 179, 8, 255))
draw.ellipse([172, 241, 340, 409], fill=(15, 23, 42, 255))

try:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 64)
except Exception:
    font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), "251", font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
draw.text((256 - tw / 2, 322 - th / 2 - 8), "251", fill=(250, 204, 21, 255), font=font)

img.save("assets/icon.png", format="PNG")
img.save(
    "assets/icon.ico",
    format="ICO",
    sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
)
print("Generated assets/icon.png and assets/icon.ico with 251 badge successfully.")
