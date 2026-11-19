"""Prepara la Pegasus 36 para el configurador.

El modelo es una sola malla con una textura, así que este script:
1. Agrupa los triángulos por isla UV y asigna cada isla a una zona
   (cuerpo, forro, cordones, detalles, mediasuela, suela) según dónde cae
   en el atlas de texturas y su color. Escribe un byte por triángulo en
   zones.bin (el orden de las zonas es ZONES).
2. Genera textures/NikeShoe_neutral.jpg: la textura original en gris con
   el brillo de cada zona igualado, para que el color elegido se vea limpio
   y conserve el tejido, las costuras y la goma.

Uso: python3 scripts/build_zones.py   (requiere numpy y Pillow)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "public/assets/nike_air_zoom_pegasus_36"
ZONES = ["cuerpo", "forro", "cordones", "detalles", "mediasuela", "suela"]
# Brillo medio al que se lleva cada zona en la textura neutra (0 a 1).
TARGET = {"cuerpo": 0.78, "forro": 0.72, "cordones": 0.8, "detalles": 0.75, "mediasuela": 0.9, "suela": 0.8}

gltf = json.loads((DIR / "scene.gltf").read_text())
buf = (DIR / "scene.bin").read_bytes()


def accessor(i):
    a = gltf["accessors"][i]
    view = gltf["bufferViews"][a["bufferView"]]
    size = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    dtype = np.uint32 if a["componentType"] == 5125 else np.float32
    off = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    return np.frombuffer(buf, dtype, a["count"] * size, off).reshape(-1, size)


prim = gltf["meshes"][0]["primitives"][0]
uv = accessor(prim["attributes"]["TEXCOORD_0"])
tris = accessor(prim["indices"]).reshape(-1, 3)

# Islas UV (unión de vértices que comparten triángulo).
parent = np.arange(len(uv))


def find(x):
    root = x
    while parent[root] != root:
        root = parent[root]
    while parent[x] != root:
        parent[x], x = root, parent[x]
    return root


for a, b, c in tris:
    ra = find(a)
    parent[find(b)] = ra
    parent[find(c)] = ra
island_of = np.array([find(v) for v in tris[:, 0]])

src = Image.open(DIR / "textures/NikeShoe_baseColor.jpeg").convert("RGB")
W, H = src.size
rgb = np.asarray(src).astype(np.float32) / 255


def island_mask(tri_ids):
    mask = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(mask)
    for t in tri_ids:
        pts = [(uv[v, 0] * W, uv[v, 1] * H) for v in tris[t]]
        draw.polygon(pts, fill=255)
    return np.asarray(mask) > 0


def classify(u, v, color):
    r, g, b = color
    if r - b > 0.08 and v > 0.42:
        return "suela"
    if (r + g + b) / 3 > 0.55 and v > 0.34:
        return "mediasuela"
    if 0.12 < v < 0.36 and u > 0.27 and not (v < 0.22 and u < 0.56):
        return "cordones"
    if v > 0.33 and u < 0.45 and (r + g + b) / 3 > 0.3:
        return "cuerpo"
    if 0.095 < v < 0.22 and 0.29 < u < 0.56:
        return "cuerpo"
    if u < 0.1 or (0.55 < u < 0.71 and 0.1 < v < 0.3) or (0.22 < u < 0.53 and v < 0.22):
        return "detalles"
    return "forro"


zones = np.zeros(len(tris), np.uint8)
zone_mask = {z: np.zeros((H, W), bool) for z in ZONES}
for island in np.unique(island_of):
    ids = np.nonzero(island_of == island)[0]
    mask = island_mask(ids)
    color = rgb[mask].mean(0) if mask.any() else np.zeros(3)
    centre = uv[tris[ids].ravel()].mean(0)
    zone = classify(centre[0], centre[1], color)
    zones[ids] = ZONES.index(zone)
    zone_mask[zone] |= mask
    print(f"isla {island:6d} tris {len(ids):5d} uv {centre.round(2)} color {color.round(2)} -> {zone}")

(DIR / "zones.bin").write_bytes(zones.tobytes())

# Textura neutra: luminancia de la original, igualada por zona.
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
out = np.full((H, W), 0.8, np.float32)
for zone, mask in zone_mask.items():
    if not mask.any():
        continue
    # Se agranda un poco la máscara para cubrir el sangrado de los bordes.
    grown = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
    mean = lum[mask].mean()
    std = lum[mask].std() + 1e-4
    # Conserva el detalle (contraste local) pero limita su amplitud.
    detail = np.clip((lum - mean) / std, -2.5, 2.5) * 0.09
    out[grown] = (TARGET[zone] + detail)[grown]
out = np.clip(out, 0, 1)
Image.fromarray((out * 255).astype(np.uint8), "L").convert("RGB").save(
    DIR / "textures/NikeShoe_neutral.jpg", quality=88, optimize=True
)
print({z: int((zones == i).sum()) for i, z in enumerate(ZONES)})

# Texturas livianas para la web: normal y oclusión en JPG.
tex = DIR / "textures"
Image.open(tex / "NikeShoe_normal.png").convert("RGB").save(tex / "NikeShoe_normal.jpg", quality=90, optimize=True)
occlusion = Image.open(tex / "NikeShoe_metallicRoughness.png").convert("RGB").getchannel("R")
Image.merge("RGB", (occlusion, occlusion, occlusion)).save(tex / "NikeShoe_occlusion.jpg", quality=88, optimize=True)

# configurador.gltf: la misma malla con la textura neutra y sin mapa metálico,
# porque el acabado (mate, satinado, metálico) lo pone el configurador.
cfg = json.loads((DIR / "scene.gltf").read_text())
cfg["images"] = [
    {"uri": "textures/NikeShoe_neutral.jpg"},
    {"uri": "textures/NikeShoe_occlusion.jpg"},
    {"uri": "textures/NikeShoe_normal.jpg"},
]
sampler = cfg["textures"][0].get("sampler")
cfg["textures"] = [{"source": i, **({"sampler": sampler} if sampler is not None else {})} for i in range(3)]
cfg["materials"] = [{
    "name": "Configurable",
    "doubleSided": True,
    "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 0.6},
    "occlusionTexture": {"index": 1},
    "normalTexture": {"index": 2},
}]
(DIR / "configurador.gltf").write_text(json.dumps(cfg))
print("configurador.gltf listo")
