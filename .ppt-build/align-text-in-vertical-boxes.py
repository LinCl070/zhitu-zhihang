from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


SOURCE = Path(r"D:\基于大模型的教育管理应用创新赛\output\images\职业智能就业推荐系统_顺时针旋转90度.png")
OUTPUT = Path(r"D:\基于大模型的教育管理应用创新赛\output\images\职业智能就业推荐系统_旋转90度_文字沿框排列.png")


image = Image.open(SOURCE).convert("RGB")
pixels = np.asarray(image)
gray = np.asarray(image.convert("L"))
white = gray >= 235
visited = np.zeros(white.shape, dtype=bool)
height, width = white.shape
components: list[tuple[int, int, int, int, int]] = []

for y in range(height):
    for x in range(width):
        if not white[y, x] or visited[y, x]:
            continue
        queue = deque([(x, y)])
        visited[y, x] = True
        min_x = max_x = x
        min_y = max_y = y
        area = 0
        while queue:
            cx, cy = queue.popleft()
            area += 1
            min_x = min(min_x, cx)
            max_x = max(max_x, cx)
            min_y = min(min_y, cy)
            max_y = max(max_y, cy)
            for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                if 0 <= nx < width and 0 <= ny < height and white[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        box_w = max_x - min_x + 1
        box_h = max_y - min_y + 1
        rectangularity = area / (box_w * box_h)
        if area >= 250 and box_w >= 18 and box_h >= 18 and rectangularity >= 0.68:
            components.append((min_x, min_y, max_x + 1, max_y + 1, area))

canvas = image.copy()
adjusted = 0

for x0, y0, x1, y1, _ in components:
    box_w = x1 - x0
    box_h = y1 - y0
    if box_h < box_w * 1.35:
        continue

    margin = max(2, min(box_w, box_h) // 14)
    crop = pixels[y0:y1, x0:x1].copy()
    crop_gray = gray[y0:y1, x0:x1]
    dark = crop_gray < 205
    dark[:margin, :] = False
    dark[-margin:, :] = False
    dark[:, :margin] = False
    dark[:, -margin:] = False
    ys, xs = np.where(dark)
    if len(xs) < 3:
        continue

    tx0, tx1 = xs.min(), xs.max() + 1
    ty0, ty1 = ys.min(), ys.max() + 1
    text_rgb = crop[ty0:ty1, tx0:tx1]
    text_gray = crop_gray[ty0:ty1, tx0:tx1]
    alpha = np.clip(255 - text_gray, 0, 255).astype(np.uint8)
    rgba = np.dstack([text_rgb, alpha])
    text_layer = Image.fromarray(rgba, "RGBA").transpose(Image.Transpose.ROTATE_270)

    inner_w = max(1, box_w - 2 * margin)
    inner_h = max(1, box_h - 2 * margin)
    scale = min(1.0, inner_w / text_layer.width, inner_h / text_layer.height)
    if scale < 1.0:
        text_layer = text_layer.resize(
            (max(1, round(text_layer.width * scale)), max(1, round(text_layer.height * scale))),
            Image.Resampling.LANCZOS,
        )

    canvas.paste((255, 255, 255), (x0, y0, x1, y1))
    paste_x = x0 + (box_w - text_layer.width) // 2
    paste_y = y0 + (box_h - text_layer.height) // 2
    canvas.paste(text_layer, (paste_x, paste_y), text_layer)
    adjusted += 1

canvas.save(OUTPUT, optimize=True)
print(f"adjusted_boxes={adjusted}")
print(OUTPUT)
