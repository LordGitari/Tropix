"""Prepare the printed-text layers for the 3D bottles.

The bottle models are a single painted mesh. The site draws their printed text
(logo, the big "drink" lettering, small print) as a separate layer on the
outside of the glass. This script pulls that text out of each model's base
colour texture ahead of time, so the browser doesn't have to scan millions of
pixels while the page loads.

Usage (run with the original, full-resolution models, before compression):
    pip install pillow numpy
    python scripts/make-print-masks.py path/to/orange.glb path/to/berry.glb ...

Writes public/print/<name>.webp and prints each model's drink colour, which goes
in the `liquid` field of src/data/drinks.ts.
"""
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "print"


def base_colour_texture(glb_path):
    data = Path(glb_path).read_bytes()
    json_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20 : 20 + json_len])
    binary = data[20 + json_len + 8 :]
    index = gltf["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    texture = gltf["textures"][index]
    source = texture.get("source", texture.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
    view = gltf["bufferViews"][gltf["images"][source]["bufferView"]]
    start = view.get("byteOffset", 0)
    return Image.open(io.BytesIO(binary[start : start + view["byteLength"]])).convert("RGB")


def make_mask(glb_path):
    pixels = np.asarray(base_colour_texture(glb_path)).astype(np.float64)
    brightest, darkest = pixels.max(2), pixels.min(2)
    saturation = np.where(brightest > 0, (brightest - darkest) / np.maximum(brightest, 1), 0)
    luminance = pixels.mean(2)

    # The drink colour: the average strongly coloured pixel.
    drink = saturation > 0.4
    colour = pixels[drink].mean(0)
    drink_lum = luminance[drink].mean()

    # Clearly lighter and greyer than the drink = white print; clearly darker = dark print.
    clamp = lambda v: np.clip(v, 0, 1)
    light = clamp((luminance - drink_lum - 45) / 20) * clamp((0.24 - saturation) / 0.08)
    dark = clamp((drink_lum - 40 - luminance) / 20)
    alpha = np.round(np.maximum(light, dark) * 255).astype(int)
    alpha[alpha < 64] = 0  # the site cuts off below 50%; dropping faint noise keeps files small
    value = np.where((light >= dark) & (alpha > 0), 250, 18)

    OUT.mkdir(parents=True, exist_ok=True)
    name = Path(glb_path).stem
    rgba = np.dstack([value, value, value, alpha]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(OUT / f"{name}.webp", "WEBP", lossless=True, method=6)
    print(f'{name}: liquid "#{int(round(colour[0])):02x}{int(round(colour[1])):02x}{int(round(colour[2])):02x}"')


if __name__ == "__main__":
    for path in sys.argv[1:]:
        make_mask(path)
