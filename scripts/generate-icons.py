#!/usr/bin/env python3
"""生成 TaskBoard 的全套应用图标（PNG / ICO / ICNS / Store 徽标）与网页 favicon。

设计语言（与 src/index.css 的深色主题一致）：
  - 深色圆角底板（--bg / --panel 色系）
  - 2x2 四象限任务格：左上「重要不紧急」= 强调绿（--q2 #34d399）并带勾选
  - 小尺寸做光学补偿：格子间距随尺寸放大，避免 16px 下粘成一坨

用法：
    python scripts/generate-icons.py
依赖：Pillow、numpy
"""

from __future__ import annotations

import math
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "src-tauri" / "icons"
PUBLIC_DIR = ROOT / "public"

# ---------------------------------------------------------------- 设计常量（1024 画布）
DESIGN = 1024
SS = 2  # 几何超采样倍数（2048 画布 → 下采样到 1024，得到干净的边缘）

RADIUS = 224          # 底板圆角
MARGIN = 172          # 四宫格外边距
GRID = DESIGN - 2 * MARGIN
CELL_RATIO = 0.211    # 格子圆角 / 格子边长
GAP = 56              # 标准间距（大尺寸）

CHECK = ((0.24, 0.54), (0.43, 0.72), (0.78, 0.30))  # 勾选折线，相对格子坐标
CHECK_W = 0.12        # 勾选线宽 / 格子边长

BG_DARK, BG_LIGHT = (6, 10, 14), (24, 35, 47)         # #060a0e → #18232f
CELL_DARK, CELL_LIGHT = (30, 42, 54), (48, 64, 82)    # #1e2a36 → #304052（空格子：面板）
ACC_DARK, ACC_LIGHT = (16, 185, 129), (74, 222, 128)  # #10b981 → #4ade80
INK = (4, 20, 14)                                    # 勾选墨色
GLOW = (52, 211, 153)


# ---------------------------------------------------------------- 绘图工具
def gradient(size: int, c0, c1, angle: float = 225.0, seed: int = 7) -> Image.Image:
    """线性渐变，c1 指向 angle 方向（默认左下→右上，即左上最亮）。带 1 LSB 抖动防色带。"""
    xs, ys = np.meshgrid(
        np.arange(size, dtype=np.float32), np.arange(size, dtype=np.float32)
    )
    u = xs / (size - 1) * 2.0 - 1.0
    v = ys / (size - 1) * 2.0 - 1.0
    rad = math.radians(angle)
    d = u * math.cos(rad) + v * math.sin(rad)
    d = (d - d.min()) / (d.max() - d.min())

    c0 = np.asarray(c0, dtype=np.float32)
    c1 = np.asarray(c1, dtype=np.float32)
    arr = c0[None, None, :] + (c1 - c0)[None, None, :] * d[..., None]
    rng = np.random.default_rng(seed)
    arr = arr + rng.uniform(-0.6, 0.6, size=(size, size, 1)).astype(np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def sbox(box):
    return [box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS]


def cache_key(gap: float) -> float:
    return round(gap, 2)


_render_cache: dict[float, Image.Image] = {}


def render(gap: float = GAP) -> Image.Image:
    """在 1024 设计空间渲染，返回 1024x1024 RGBA。"""
    gap = cache_key(gap)
    if gap in _render_cache:
        return _render_cache[gap]

    S = DESIGN * SS
    cell = (GRID - gap) / 2.0
    radius = cell * CELL_RATIO

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # 1. 底板：圆角方形 + 对角渐变
    board_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(board_mask).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=RADIUS * SS, fill=255
    )
    board = gradient(DESIGN, BG_DARK, BG_LIGHT).resize((S, S), Image.BICUBIC).convert("RGBA")
    canvas.paste(board, (0, 0), board_mask)

    # 2. 强调格下方的绿色辉光
    gx, gy = MARGIN, MARGIN
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        sbox((gx - cell * 0.12, gy - cell * 0.12, gx + cell * 1.12, gy + cell * 1.12)),
        fill=GLOW + (92,),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(cell * 0.17 * SS))
    glow.putalpha(ImageChops.multiply(glow.getchannel("A"), board_mask))
    canvas = Image.alpha_composite(canvas, glow)

    # 3. 四宫格
    step = cell + gap
    cells = [
        (MARGIN, MARGIN, True),                 # 左上：重要不紧急（强调）
        (MARGIN + step, MARGIN, False),
        (MARGIN, MARGIN + step, False),
        (MARGIN + step, MARGIN + step, False),
    ]

    for x, y, accent in cells:
        tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        fill = gradient(DESIGN, ACC_DARK, ACC_LIGHT) if accent else gradient(DESIGN, CELL_DARK, CELL_LIGHT)
        fill = fill.resize((S, S), Image.BICUBIC).convert("RGBA")
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            sbox((x, y, x + cell, y + cell)), radius=radius * SS, fill=255
        )
        tile.paste(fill, (0, 0), mask)
        # 极细的内描边，让空格子在大尺寸下有"面板"质感
        rim = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        inset = 1.6 * SS
        ImageDraw.Draw(rim).rounded_rectangle(
            [x * SS + inset, y * SS + inset, (x + cell) * SS - inset, (y + cell) * SS - inset],
            radius=(radius - 1.6) * SS,
            outline=(255, 255, 255, 46 if accent else 34),
            width=max(1, int(1.6 * SS)),
        )
        rim.putalpha(ImageChops.multiply(rim.getchannel("A"), mask))
        canvas = Image.alpha_composite(canvas, tile)
        canvas = Image.alpha_composite(canvas, rim)

    # 4. 勾选（左上格）
    pts = [(MARGIN + u * cell, MARGIN + v * cell) for u, v in CHECK]
    pts = [(p[0] * SS, p[1] * SS) for p in pts]
    width = max(2, int(round(CHECK_W * cell * SS)))
    mark = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    md = ImageDraw.Draw(mark)
    md.line(pts, fill=INK + (255,), width=width, joint="curve")
    cap = width / 2.0
    for px, py in (pts[0], pts[-1]):
        md.ellipse([px - cap, py - cap, px + cap, py + cap], fill=INK + (255,))
    canvas = Image.alpha_composite(canvas, mark)

    # 5. 底板边缘高光（大尺寸下可见）
    edge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=RADIUS * SS, outline=(255, 255, 255, 22), width=max(1, int(1.5 * SS))
    )
    canvas = Image.alpha_composite(canvas, edge)

    master = canvas.resize((DESIGN, DESIGN), Image.LANCZOS)
    _render_cache[gap] = master
    return master


def optical_gap(size: int) -> float:
    """小尺寸放大间距，保证 16/24/32px 下四宫格不粘在一起。"""
    if size >= 64:
        return GAP
    if size >= 40:
        return 76
    if size >= 28:
        return 92
    return 108


def icon(size: int) -> Image.Image:
    return render(optical_gap(size)).resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- 输出：PNG
PNG_TARGETS = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
}
SQUARE_LOGOS = {
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}


def write_png_files() -> list[tuple[str, int, int]]:
    written = []
    for name, size in {**PNG_TARGETS, **SQUARE_LOGOS}.items():
        path = ICON_DIR / name
        img = icon(size)
        img.save(path, format="PNG", optimize=True)
        written.append((name, size, path.stat().st_size))
    return written


# ---------------------------------------------------------------- 输出：ICO
def write_ico() -> tuple[Path, list[tuple[int, str]]]:
    """手写 ICO 容器：全部用 DIB 帧（GDI+ / 旧 API / NSIS 全兼容）。"""
    import io

    path = ICON_DIR / "icon.ico"
    spec = [(16, "dib"), (24, "dib"), (32, "dib"), (48, "dib"), (64, "dib"), (128, "dib"), (256, "dib")]

    blobs = b""
    entries = b""
    offset = 6 + 16 * len(spec)
    for size, fmt in spec:
        buf = io.BytesIO()
        # 每一帧都按尺寸单独绘制，16/24/32 才能拿到放大间距的光学补偿版本
        icon(size).save(
            buf, format="ICO", sizes=[(size, size)], bitmap_format="bmp" if fmt == "dib" else "png"
        )
        data = buf.getvalue()
        assert struct.unpack_from("<H", data, 4)[0] == 1, "Pillow 应只写出单帧"
        length, start = struct.unpack_from("<II", data, 14)
        blob = data[start : start + length]
        if fmt == "dib":
            assert blob[:8] != b"\x89PNG\r\n\x1a\n", f"{size} 期望 DIB 帧"
        else:
            assert blob[:8] == b"\x89PNG\r\n\x1a\n", f"{size} 期望 PNG 帧"
        dim = 0 if size >= 256 else size
        entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(blob), offset + len(blobs))
        blobs += blob

    path.write_bytes(struct.pack("<HHH", 0, 1, len(spec)) + entries + blobs)
    return path, spec


# ---------------------------------------------------------------- 输出：ICNS
ICNS_TYPES = [
    (b"icp4", 16),
    (b"icp5", 32),
    (b"icp6", 64),
    (b"ic07", 128),
    (b"ic08", 256),
    (b"ic09", 512),
    (b"ic10", 1024),
    (b"ic11", 32),
    (b"ic12", 64),
    (b"ic13", 256),
    (b"ic14", 512),
]


def write_icns() -> tuple[Path, list[str]]:
    import io

    body = b""
    for typ, size in ICNS_TYPES:
        buf = io.BytesIO()
        icon(size).save(buf, format="PNG", optimize=True)
        data = buf.getvalue()
        body += typ + struct.pack(">I", len(data) + 8) + data
    path = ICON_DIR / "icon.icns"
    path.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)
    return path, [t.decode() for t, _ in ICNS_TYPES]


# ---------------------------------------------------------------- 输出：favicon.svg
def write_svg() -> Path:
    cell = (GRID - GAP) / 2.0
    step = cell + GAP
    r = cell * CELL_RATIO
    pts = [(MARGIN + u * cell, MARGIN + v * cell) for u, v in CHECK]
    path_d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f} L {pts[1][0]:.1f} {pts[1][1]:.1f} L {pts[2][0]:.1f} {pts[2][1]:.1f}"

    def cell_svg(x: float, y: float, fill: str) -> str:
        return (
            f'  <rect x="{x:.1f}" y="{y:.1f}" width="{cell:.1f}" height="{cell:.1f}" rx="{r:.1f}" '
            f'fill="{fill}" stroke="#ffffff" stroke-opacity="0.09" stroke-width="3"/>\n'
        )

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64">\n'
        "  <defs>\n"
        '    <linearGradient id="bg" x1="0" y1="0" x2="0.62" y2="1">\n'
        '      <stop offset="0" stop-color="#18232f"/>\n'
        '      <stop offset="1" stop-color="#060a0e"/>\n'
        "    </linearGradient>\n"
        '    <linearGradient id="cell" x1="0" y1="0" x2="0.55" y2="1">\n'
        '      <stop offset="0" stop-color="#304052"/>\n'
        '      <stop offset="1" stop-color="#1e2a36"/>\n'
        "    </linearGradient>\n"
        '    <linearGradient id="accent" x1="0" y1="0" x2="0.6" y2="1">\n'
        '      <stop offset="0" stop-color="#4ade80"/>\n'
        '      <stop offset="1" stop-color="#10b981"/>\n'
        "    </linearGradient>\n"
        "  </defs>\n"
        f'  <rect width="1024" height="1024" rx="{RADIUS}" fill="url(#bg)"/>\n'
        + cell_svg(MARGIN, MARGIN, "url(#accent)")
        + cell_svg(MARGIN + step, MARGIN, "url(#cell)")
        + cell_svg(MARGIN, MARGIN + step, "url(#cell)")
        + cell_svg(MARGIN + step, MARGIN + step, "url(#cell)")
        + f'  <path d="{path_d}" fill="none" stroke="#04140e" stroke-width="{CHECK_W * cell:.1f}" '
        'stroke-linecap="round" stroke-linejoin="round"/>\n'
        "</svg>\n"
    )
    path = PUBLIC_DIR / "favicon.svg"
    path.write_text(svg, encoding="utf-8")
    return path


# ---------------------------------------------------------------- 预览图
def write_preview() -> Path:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    pad, gap = 28, 34
    width = pad * 2 + sum(sizes) + gap * (len(sizes) - 1)
    height = pad * 2 + 256
    sheet = Image.new("RGB", (width, height * 2), (11, 15, 20))
    ImageDraw.Draw(sheet).rectangle([0, height, width, height * 2], fill=(242, 244, 247))

    for row in range(2):
        x = pad
        for size in sizes:
            img = icon(size)
            y = row * height + pad + (256 - size) // 2
            sheet.paste(img, (x, y), img)
            x += size + gap
    path = ICON_DIR / "icon-preview.png"
    sheet.save(path, format="PNG", optimize=True)
    return path


# ---------------------------------------------------------------- 校验
def ascii_art(img: Image.Image) -> str:
    ramp = " .:-=+*#%@"
    small = img.convert("L").resize((40, 40), Image.LANCZOS)
    px = small.load()
    lines = []
    for y in range(40):
        lines.append("".join(ramp[min(len(ramp) - 1, px[x, y] * len(ramp) // 256)] for x in range(40)))
    return "\n".join(lines)


def verify(pngs, ico_path, ico_sizes, icns_path, icns_types) -> None:
    print("\n== PNG ==")
    for name, size, bytes_ in pngs:
        with Image.open(ICON_DIR / name) as im:
            assert im.size == (size, size), f"{name}: {im.size} != {(size, size)}"
            assert im.mode in ("RGBA", "RGB"), f"{name}: unexpected mode {im.mode}"
        print(f"  {name:<24} {size:>4}x{size:<4} {bytes_:>7} B  ok")

    print("\n== ICO ==")
    data = ico_path.read_bytes()
    count = struct.unpack_from("<H", data, 4)[0]
    frames = []
    for i in range(count):
        base = 6 + i * 16
        w = data[base] or 256
        length, start = struct.unpack_from("<II", data, base + 8)
        kind = "png" if data[start : start + 4] == b"\x89PNG" else "dib"
        frames.append((w, kind, length))
    assert [(w, k) for w, k, _ in frames] == [(s, f) for s, f in ico_sizes], f"ico frames {frames}"
    assert 6 + 16 * count + sum(l for _, _, l in frames) == len(data), "ico 长度不一致"
    print(f"  icon.ico  {len(data)} B  " + " ".join(f"{w}{'p' if k == 'png' else 'b'}" for w, k, _ in frames) + "  ok")

    print("\n== ICNS ==")
    data = icns_path.read_bytes()
    assert data[:4] == b"icns", "bad icns magic"
    total = struct.unpack_from(">I", data, 4)[0]
    assert total == len(data), f"icns length {total} != {len(data)}"
    off, found = 8, []
    while off < len(data):
        typ = data[off : off + 4].decode("ascii")
        ln = struct.unpack_from(">I", data, off + 4)[0]
        found.append((typ, ln))
        off += ln
    assert [t for t, _ in found] == icns_types, f"icns chunks {[t for t,_ in found]}"
    print(f"  icon.icns {len(data)} B  chunks={[t for t, _ in found]}  ok")


def main() -> int:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    pngs = write_png_files()
    ico_path, ico_spec = write_ico()
    icns_path, icns_types = write_icns()
    svg_path = write_svg()
    preview = write_preview()
    verify(pngs, ico_path, ico_spec, icns_path, icns_types)

    print(f"\n  favicon: {svg_path}")
    print(f"  preview: {preview}")
    print("\n== 1024 母图灰度预览 ==")
    print(ascii_art(render()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
