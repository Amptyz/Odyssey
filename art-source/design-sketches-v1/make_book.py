"""Package the reviewed design boards without altering their PNG pixels."""
from pathlib import Path
import hashlib
import json
import re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
OUTPUT = REPO / "output/pdf/ember-design-sketchbook.pdf"
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8-sig"))
tasks = json.loads((ROOT / "prompts.json").read_text(encoding="utf-8-sig"))
assert len(manifest["monsters"]) == 17
assert len(manifest["equipment"]) == 18
assert len(tasks) == 22

pages = [t for t in tasks if t["kind"].startswith("equipment")]
for monster in manifest["monsters"]:
    pages += [t for t in tasks if t["key"] == monster["id"]]
    pages += [t for t in tasks if t["key"] == monster["id"] + "-skills"]
assert len(pages) == 22 and len({p["path"] for p in pages}) == 22

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(OUTPUT), pageCompression=1)
pdf.setTitle("Project Ember - Monsters and Equipment Design Sketchbook")
pdf.setAuthor("Project Ember / Codex")
pdf.setSubject("17 monsters, 18 equipment icons; concept boards only; current attack ranges x2")
results = []
for index, page in enumerate(pages, 1):
    source = ROOT / page["path"]
    with Image.open(source) as im:
        im.verify()
    with Image.open(source) as im:
        width_px, height_px = im.size
    art_width = 816
    art_height = art_width * height_px / width_px
    width_pt, height_pt = 840, art_height + 46
    pdf.setPageSize((width_pt, height_pt))
    pdf.setFillColor(HexColor("#FAFAF8"))
    pdf.rect(0, 0, width_pt, height_pt, fill=1, stroke=0)
    pdf.drawImage(str(source), 12, 34, width=art_width, height=art_height,
                  preserveAspectRatio=True, mask="auto")
    pdf.setStrokeColor(HexColor("#C8CCC7"))
    pdf.setLineWidth(.5)
    pdf.line(12, 27, width_pt - 12, 27)
    pdf.setFillColor(HexColor("#303942"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(12, 15, "PROJECT EMBER | DESIGN SKETCH | " + page["key"])
    pdf.drawRightString(width_pt - 12, 15, f"{index:02d} / 22")
    pdf.bookmarkPage(page["key"])
    pdf.addOutlineEntry(page["key"], page["key"], 0)
    pdf.showPage()
    results.append({
        "page": index, "key": page["key"], "path": page["path"],
        "pixels": [width_px, height_px],
        "pagePoints": [width_pt, round(height_pt, 4)],
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "pngBytes": source.stat().st_size,
    })
pdf.showOutline()
pdf.save()

reader = PdfReader(str(OUTPUT))
assert len(reader.pages) == len(results)
for actual, expected in zip(reader.pages, results):
    assert abs(float(actual.mediabox.width) - expected["pagePoints"][0]) < .01
    assert abs(float(actual.mediabox.height) - expected["pagePoints"][1]) < .01
    assert expected["key"] in actual.extract_text()
    images = [o.get_object() for o in actual["/Resources"]["/XObject"].get_object().values()
              if o.get_object().get("/Subtype") == "/Image"]
    assert len(images) == 1
    assert [images[0]["/Width"], images[0]["/Height"]] == expected["pixels"]
    expected["pdfEmbeddedAtOriginalResolution"] = True

report = {
    "date": "2026-10-16", "scope": "Static design-board coverage and PDF packaging only",
    "counts": {"monsters": 17, "equipmentIcons": 18, "basicAttacks": 17,
               "specialSkills": sum(len(e["skills"]) for e in manifest["monsters"]),
               "bossSkillBoards": 2, "finalBoards": len(pages), "pdfPages": len(reader.pages)},
    "pdf": OUTPUT.relative_to(REPO).as_posix(),
    "pdfBytes": OUTPUT.stat().st_size,
    "pdfSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    "checks": {"allExpectedFilesPresent": True, "allPngFilesDecode": True,
               "pdfPageCountAndDimensions": True, "fullResolutionEmbedded": True,
               "visualReview": "Pending final PDF rendering review",
               "runtimeIntegration": False},
    "pages": results,
}
(ROOT / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"pdf": str(OUTPUT), "pages": len(reader.pages),
                  "sizeMiB": round(OUTPUT.stat().st_size / 1024**2, 2)}, ensure_ascii=False))
