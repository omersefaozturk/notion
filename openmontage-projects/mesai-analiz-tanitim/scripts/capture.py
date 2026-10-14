#!/usr/bin/env python3
"""Drive the real BDKS Mesai Analizi page in Chromium and capture the shots the
tutorial video is built from.

Every frame in the video is a real screenshot of the page: no mock-ups. For each
step we record the viewport image plus the CSS-pixel boxes of the elements the
video points at, so the composition can zoom, ring and place a cursor on them.

Outputs:
    assets/shots/<id>.png     1440x900 viewport at 2x (2880x1800)
    build/shots.json          per-shot focus box, highlight boxes, cursor target
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "assets" / "mesai-analiz.html").as_uri()
SHOTS = ROOT / "assets" / "shots"
VIEWPORT = {"width": 1440, "height": 900}
SCALE = 2


async def box(page, selector):
    try:
        el = page.locator(selector).first
        if await el.count() == 0:
            return None
        b = await el.bounding_box()
    except Exception:
        return None
    if not b:
        return None
    return [round(b["x"], 1), round(b["y"], 1), round(b["width"], 1), round(b["height"], 1)]


async def grow(b, pad=14):
    if not b:
        return None
    x, y, w, h = b
    return [max(0, x - pad), max(0, y - pad), w + pad * 2, h + pad * 2]


async def shot(page, shots, sid, focus=None, highlights=(), cursor=None, click=False, note=""):
    SHOTS.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(SHOTS / f"{sid}.png"))
    entry = {
        "id": sid,
        "image": f"shots/{sid}.png",
        "focus": await grow(await box(page, focus), 26) if focus else None,
        "highlights": [b for b in [await grow(await box(page, h), 10) for h in highlights] if b],
        "cursor": None,
        "click": click,
        "note": note,
    }
    if cursor:
        b = await box(page, cursor)
        if b:
            entry["cursor"] = [round(b[0] + b[2] / 2, 1), round(b[1] + b[3] / 2, 1)]
    shots.append(entry)
    print(f"  captured {sid}{' (click)' if click else ''}")


async def main():
    shots: list[dict] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
        )
        page = await browser.new_page(viewport=VIEWPORT, device_scale_factor=SCALE)
        await page.goto(PAGE)
        await page.wait_for_timeout(1500)

        # 1 - the landing page: what the tool answers
        await shot(page, shots, "s01_landing", note="açılış")
        # 2 - where the BDKS export goes
        await shot(page, shots, "s02_drop", focus="#drop", highlights=["#drop"], cursor="#drop")
        # 3 - the sample-data button
        await shot(page, shots, "s03_demo", focus=".land-actions", highlights=["#demoBtn"],
                   cursor="#demoBtn", click=True)

        await page.click("#demoBtn")
        await page.wait_for_timeout(1800)

        # 4 - the overview as a whole
        await shot(page, shots, "s04_overview", note="genel bakış")
        # 5 - the headline balance + the averages
        await shot(page, shots, "s05_hero", focus="#pane-overview .headline",
                   highlights=["#pane-overview .verdict", "#pane-overview .stats"])
        # 6 - what to look at: the warnings panel
        await shot(page, shots, "s06_flags", focus="#pane-overview .grid .panel:last-child",
                   highlights=["#pane-overview .grid .panel:last-child"])
        # 7 - the net / presence switch in the toolbar
        await shot(page, shots, "s07_metric", focus="#metricSeg", highlights=["#metricSeg"],
                   cursor="#metricSeg", click=True)

        # 8 - the balance matrix
        await page.click('button[data-pane="matrix"]')
        await page.wait_for_timeout(1200)
        await shot(page, shots, "s08_matrix", highlights=["#pane-matrix .mx-tools"], note="bakiye tablosu")

        # 9 - one person's detail
        await page.click('button[data-pane="person"]')
        await page.wait_for_timeout(1200)
        await shot(page, shots, "s09_person", focus="#pane-person .grid.split-b",
                   highlights=["#pane-person .plist", "#pane-person .grid.split-b"], note="kişi detayı")

        # 10 - the day-by-day evidence
        await page.click('button[data-pane="days"]')
        await page.wait_for_timeout(1200)
        await shot(page, shots, "s10_days", highlights=["#pane-days .filters"], note="günlük kayıtlar")

        # 11 - the rules drawer, on the break allowance
        await page.click("#setBtn")
        await page.wait_for_timeout(1000)
        await shot(page, shots, "s11_rules", focus="#cfgBreak", highlights=["#cfgBreak"],
                   cursor="#cfgBreak", click=True, note="kurallar")

        # 12 - change the break allowance and watch every number move
        await page.fill("#cfgBreak", "45")
        await page.dispatch_event("#cfgBreak", "input")
        await page.dispatch_event("#cfgBreak", "change")
        await page.wait_for_timeout(1200)
        await shot(page, shots, "s12_rules_changed", focus="#cfgBreak", highlights=["#cfgBreak"],
                   note="45 dk mola")

        await page.click("#cfgClose")
        await page.wait_for_timeout(800)
        await page.click('button[data-pane="overview"]')
        await page.wait_for_timeout(1200)
        await shot(page, shots, "s13_recalc", focus="#pane-overview .headline",
                   highlights=["#pane-overview .verdict"], note="anında yeniden hesap")

        # 13 - export, and the privacy promise
        await shot(page, shots, "s14_export", focus="#expBtn", highlights=["#expBtn"],
                   cursor="#expBtn", note="Excel'e aktar")

        await browser.close()

    meta = {
        "page": "BDKS Mesai Analizi",
        "viewport": VIEWPORT,
        "scale": SCALE,
        "shots": shots,
    }
    (ROOT / "build").mkdir(exist_ok=True)
    (ROOT / "build" / "shots.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[capture] {len(shots)} shots -> {ROOT / 'build' / 'shots.json'}")


if __name__ == "__main__":
    asyncio.run(main())
