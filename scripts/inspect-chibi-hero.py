"""Measure the chibi atlas gutters and preserve authored ground roots; never edit PNGs."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
batch = root / "art-source/chibi-runtime-v1"
# Reviewed source-sheet origins. These are NOT per-frame visible-foot bounds.
# Each row keeps its baseline through flight, crouch and collapse; all actions
# keep a single source scale. X follows the authored regular column spacing.
origins = {
    "run": {"x": 96, "step": 191, "ground": [201, 398, 602, 803, 1006]},
    "walk": {"x": 98, "step": 191, "ground": [201, 399, 611, 809, 1005]},
    "melee": {"x": 96, "step": 192, "ground": [202, 399, 602, 800, 996]},
    "ranged": {"x": 101, "step": 190, "ground": [210, 410, 611, 813, 1007]},
    "states": {"x": 96, "step": 190, "ground": [203, 398, 602, 803, 1000]},
}
# The generated E-view recovery turns toward the camera. Reuse complete E-view
# recovery/ready poses rather than rotate parts or display a wrong facing.
# The same source fix also applies to W through whole-body mirroring.
recovery_aliases = {
    "melee": {21: 18, 22: 16, 23: 16},
    "ranged": {23: 16},
}
definitions, measurements = [], {}
for name, origin in origins.items():
    source = batch / f"{name}.png"
    runtime = root / f"EmberDemo/assets/resources/art/chibi-v1/{name}.png"
    assert source.read_bytes() == runtime.read_bytes(), f"Source/runtime differ: {name}"
    im = Image.open(source)
    assert im.mode == "RGBA" and im.size == (1536, 1024), name
    alpha = im.getchannel("A")
    mask = alpha.point(lambda a: 255 if a >= 128 else 0)
    w, h = im.size
    ys = [0]
    for row in range(1, 5):
        expected = h * row / 5
        candidates = range(round(expected - 35), round(expected + 35))
        ys.append(min(candidates, key=lambda y:
            mask.crop((0, y, w, y + 1)).histogram()[255] * w + abs(y - expected)))
    ys.append(h)
    frames, measured_rows = [], []
    for row in range(5):
        y0, y1 = ys[row:row + 2]
        band = mask.crop((0, y0, w, y1))
        occupied = [bool(band.crop((x, 0, x + 1, y1 - y0)).getbbox()) for x in range(w)]
        cuts = [0]
        for col in range(1, 8):
            expected = w * col / 8
            candidates = range(round(expected - 60), round(expected + 60))
            cut = min(candidates, key=lambda x:
                sum(occupied[max(0, x - 2):min(w, x + 3)]) * w + abs(x - expected))
            assert not any(occupied[cut - 2:cut + 3]), (name, row, col, "No clear gutter")
            cuts.append(cut)
        cuts.append(w)
        row_frames = []
        for col in range(8):
            x0, x1 = cuts[col:col + 2]
            bbox = band.crop((x0, 0, x1, y1 - y0)).getbbox()
            assert bbox, (name, row, col)
            anchor = [(origin["x"] + origin["step"] * col - x0) / (x1 - x0),
                      (y1 - origin["ground"][row]) / (y1 - y0)]
            assert all(0 <= v <= 1 for v in anchor), (name, row, col, anchor)
            frames.append({"rect": [x0, y0, x1 - x0, y1 - y0], "anchor": anchor})
            row_frames.append({"bbox": list(bbox), "footBottom": y0 + bbox[3]})
        measured_rows.append({"cuts": cuts, "groundY": origin["ground"][row], "frames": row_frames})
    hist = alpha.histogram()
    assert hist[0] / (w * h) > .15, name
    for target, original in recovery_aliases.get(name, {}).items():
        frames[target] = {**frames[original]}
    definitions.append({
        "id": f"hero-{name}", "path": runtime.relative_to(root).as_posix(),
        "grid": [8, 5], "height": 72, "scale": .4,
        "poses": [f"{direction}:{col}" for direction in ["S", "SE", "E", "NE", "N"] for col in range(8)],
        "frames": frames,
    })
    measurements[name] = {
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "size": [w, h],
        "transparentPixels": hist[0], "fractionalAlphaPixels": sum(hist[1:255]),
        "origin": origin, "rowCuts": ys, "rows": measured_rows,
        "recoveryFrameAliases": recovery_aliases.get(name, {}),
    }
for file, value in [("atlas-definitions.json", definitions), ("alignment.json", measurements)]:
    out = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path = batch / file
    if args.check:
        assert path.read_text() == out, f"Stale {path}"
    else:
        path.write_text(out)
print(f"{'Checked' if args.check else 'Measured'} 200 chibi frames, shared scale .4; PNGs untouched.")
