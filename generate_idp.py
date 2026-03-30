#!/usr/bin/env python3
"""
generate_idp.py — Player Individual Development Plan Generator

Usage:
    python generate_idp.py transcript.txt \
        --name "Player Name" \
        --position "Defender" \
        --duration "12 months" \
        --focus "Assert & Progress"

Requires:
    pip install anthropic reportlab
    export ANTHROPIC_API_KEY=sk-ant-...
"""

import argparse
import json
import os
import re
import sys

# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate a player IDP (PDF + HTML) from a raw transcript."
    )
    parser.add_argument("transcript", help="Path to the raw transcript text file")
    parser.add_argument("--name",       required=True,  help="Player name")
    parser.add_argument("--position",   required=True,  help="Player position (e.g. Defender)")
    parser.add_argument("--duration",   default="12 months", help="Plan duration (default: 12 months)")
    parser.add_argument("--focus",      default="Development", help="Focus phrase (e.g. Assert & Progress)")
    parser.add_argument("--output-dir", default=".",    help="Output directory (default: current dir)")
    return parser.parse_args()


# ─── CLAUDE API ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a youth soccer development expert. Given a raw voice memo transcript of a player IDP (Individual Development Plan), extract and structure the information into a clean JSON object. Return ONLY valid JSON, no markdown, no explanation.

JSON structure:
{
  "playerName": "string",
  "position": "string",
  "duration": "string",
  "focus": "string",
  "mantra": "short 3-5 word game day focus phrase",
  "strengths": [
    { "title": "short title", "body": "1-2 sentence description" }
  ],
  "improvements": [
    { "title": "short title", "body": "1-2 sentence description" }
  ],
  "plan": [
    { "badge": "Next 30 days", "badgeType": "purple", "title": "Technical — ...", "bullets": ["bullet 1", "bullet 2", "bullet 3"] },
    { "badge": "In training", "badgeType": "amber", "title": "...", "bullets": ["..."] },
    { "badge": "12-month goal", "badgeType": "teal", "title": "...", "bullets": ["..."] }
  ],
  "microHabits": [
    { "num": "15", "desc": "description of habit" },
    { "num": "10", "desc": "description of habit" },
    { "num": "20", "desc": "description of habit" }
  ],
  "gameDayFocus": "Short sentence with key action highlighted — the key phrase goes after a dash",
  "goalVision": "2-3 sentence paragraph describing the 12-month vision for this player",
  "parentNote": "2-3 sentence note to parents about how to support the player"
}

Fill in playerName, position, duration, and focus using the provided values unless the transcript overrides them.
Keep titles short (3-5 words). Keep bullet points concise (one clear idea each).
badgeType must be one of: purple, amber, teal, blue"""


def call_claude(name, position, duration, focus, transcript):
    try:
        import anthropic
    except ImportError:
        sys.exit("Error: 'anthropic' package not installed. Run: pip install anthropic")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("Error: ANTHROPIC_API_KEY environment variable not set.")

    client = anthropic.Anthropic(api_key=api_key)

    user_msg = f"""Player name: {name}
Position: {position}
Duration: {duration}
Focus: {focus}

TRANSCRIPT:
{transcript}"""

    print("Sending transcript to Claude...")
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}]
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    clean = re.sub(r"```json|```", "", raw).strip()
    return json.loads(clean)


# ─── HTML EXPORT ──────────────────────────────────────────────────────────────

def esc(s):
    if not s:
        return ""
    return (str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;"))


def render_infographic_html(d):
    strength_cards = "".join(f"""
    <div class="card green">
      <h4><span class="dot" style="background:#38A050;"></span>{esc(s['title'])}</h4>
      <p>{esc(s['body'])}</p>
    </div>""" for s in (d.get("strengths") or []))

    improv_cards = "".join(f"""
    <div class="card amber">
      <h4><span class="dot" style="background:#F0A020;"></span>{esc(s['title'])}</h4>
      <p>{esc(s['body'])}</p>
    </div>""" for s in (d.get("improvements") or []))

    plan_rows = "".join(f"""
    <div class="plan-item">
      <div class="plan-badge {p.get('badgeType','purple')}">{esc(p['badge'])}</div>
      <div class="plan-content">
        <h4>{esc(p['title'])}</h4>
        <ul>{"".join(f'<li>{esc(b)}</li>' for b in (p.get('bullets') or []))}</ul>
      </div>
    </div>""" for p in (d.get("plan") or []))

    micro_cards = "".join(f"""
    <div class="micro-card">
      <div class="num">{esc(m['num'])}</div>
      <div class="desc">{esc(m['desc'])}</div>
    </div>""" for m in (d.get("microHabits") or []))

    gd_parts = (d.get("gameDayFocus") or "").split("—")
    if len(gd_parts) > 1:
        gd_text = f'<span>{esc(gd_parts[0].strip())}</span> — {esc(gd_parts[1].strip())}'
    else:
        gd_text = esc(d.get("gameDayFocus") or "")

    infographic = f"""<div id="infographic">
    <div class="ig-header">
      <div>
        <h1>{esc(d.get('playerName','Player'))} <span>IDP</span></h1>
        <div class="sub">Individual Development Plan &middot; 2026 &middot; Coaching Staff</div>
      </div>
      <div style="text-align:right;">
        <div class="pos-badge">{esc(d.get('position','Field Player'))}</div>
        <span class="phase">Phase: {esc(d.get('focus','Development'))}</span>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="val">Development</div><div class="lbl">Current phase</div></div>
      <div class="stat-card"><div class="val">{esc(d.get('focus','—'))}</div><div class="lbl">Focus</div></div>
      <div class="stat-card"><div class="val">{esc(d.get('duration','12 months'))}</div><div class="lbl">Plan duration</div></div>
      <div class="stat-card"><div class="val">{esc(d.get('mantra','Play with intent'))}</div><div class="lbl">Mantra</div></div>
    </div>

    <div class="sec-label">Keep doing — strengths to build on</div>
    <div class="card-grid">{strength_cards}</div>

    <hr class="divider">

    <div class="sec-label">Areas to improve</div>
    <div class="card-grid">{improv_cards}</div>

    <hr class="divider">

    <div class="sec-label">Development plan</div>
    <div class="plan-list">{plan_rows}</div>

    <div class="micro-label">Home micro-habits — daily</div>
    <div class="micro-grid">{micro_cards}</div>

    <div class="gameday" style="margin-top:8px;">
      <div class="gd-label">Game day focus</div>
      <div class="gd-text">{gd_text}</div>
    </div>

    <div class="sec-label" style="margin-top:1.5rem;">12-month goal</div>
    <div class="goal-banner">
      <div class="timeline">12-month<br>vision</div>
      <p>{esc(d.get('goalVision',''))}</p>
    </div>

    <div class="parent-note">
      <div class="plabel">Note for parents</div>
      <p>{esc(d.get('parentNote',''))}</p>
    </div>
  </div>"""

    css = """
#infographic{font-family:'Barlow',sans-serif;font-size:15px;color:#EDF2F7;background:#0D1B2A;border-radius:10px;padding:2rem;}
.ig-header{display:grid;grid-template-columns:1fr auto;align-items:end;gap:1rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(255,255,255,0.15);margin-bottom:1.5rem;}
.ig-header h1{font-family:'Barlow Condensed',sans-serif;font-size:42px;font-weight:800;line-height:1;color:#EDF2F7;}
.ig-header h1 span{color:#22A882;}
.ig-header .sub{font-size:12px;color:#64748B;margin-top:5px;font-family:'Barlow Condensed',sans-serif;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;}
.ig-header .pos-badge{display:inline-block;background:#0D2E25;border:1px solid #1B8A6B;color:#22A882;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:5px 12px;border-radius:4px;}
.ig-header .phase{display:block;font-size:11px;color:#64748B;font-family:'Barlow Condensed',sans-serif;letter-spacing:0.08em;text-transform:uppercase;margin-top:6px;text-align:right;}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:1.5rem;}
.stat-card{background:#1A2E44;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;}
.stat-card .val{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;color:#EDF2F7;line-height:1.2;}
.stat-card .lbl{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;margin-top:3px;font-family:'Barlow Condensed',sans-serif;font-weight:500;}
.sec-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748B;margin-bottom:8px;margin-top:1.5rem;}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.card{border-radius:8px;padding:12px 14px;border:1px solid rgba(255,255,255,0.08);}
.card.green{background:#0D2214;border-color:rgba(56,160,80,0.2);}
.card.amber{background:#2E1E05;border-color:rgba(212,135,10,0.2);}
.card h4{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#EDF2F7;margin-bottom:4px;display:flex;align-items:center;gap:6px;}
.card .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.card p{font-size:12px;color:#94A3B8;line-height:1.5;}
.divider{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:1.5rem 0 0;}
.plan-list{display:flex;flex-direction:column;gap:6px;}
.plan-item{display:grid;grid-template-columns:100px 1fr;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);}
.plan-badge{display:flex;align-items:center;justify-content:center;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:10px 7px;line-height:1.3;}
.plan-badge.purple{background:#1A1230;color:#7357C8;border-right:1px solid rgba(115,87,200,0.2);}
.plan-badge.amber{background:#2E1E05;color:#F0A020;border-right:1px solid rgba(212,135,10,0.2);}
.plan-badge.teal{background:#0D2E25;color:#22A882;border-right:1px solid rgba(27,138,107,0.2);}
.plan-badge.blue{background:#0D1E2E;color:#60A5FA;border-right:1px solid rgba(96,165,250,0.2);}
.plan-content{background:#1A2E44;padding:10px 14px;}
.plan-content h4{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#EDF2F7;margin-bottom:5px;}
.plan-content ul{list-style:none;display:flex;flex-direction:column;gap:3px;}
.plan-content ul li{font-size:12px;color:#94A3B8;display:flex;gap:7px;align-items:flex-start;line-height:1.45;}
.plan-content ul li::before{content:'—';color:#64748B;flex-shrink:0;}
.micro-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#60A5FA;display:flex;align-items:center;gap:6px;margin-bottom:8px;margin-top:1.5rem;}
.micro-label::after{content:'';flex:1;height:1px;background:rgba(96,165,250,0.2);}
.micro-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
.micro-card{background:#0D1E2E;border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:12px 14px;text-align:center;}
.micro-card .num{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:800;color:#60A5FA;line-height:1;}
.micro-card .desc{font-size:11px;color:#94A3B8;margin-top:4px;line-height:1.4;}
.gameday{background:#1A2E44;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-top:8px;}
.gameday .gd-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748B;white-space:nowrap;}
.gameday .gd-text{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:#EDF2F7;}
.gameday .gd-text span{color:#22A882;}
.goal-banner{background:#0D2E25;border:1px solid rgba(27,138,107,0.35);border-radius:10px;padding:16px 18px;margin-top:8px;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;}
.goal-banner .timeline{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#22A882;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;}
.goal-banner p{font-size:13px;color:#94A3B8;line-height:1.55;}
.goal-banner p strong{color:#22A882;font-weight:600;}
.parent-note{margin-top:1.5rem;border-left:3px solid rgba(255,255,255,0.15);padding:10px 16px;background:#1A2E44;border-radius:0 8px 8px 0;}
.parent-note .plabel{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748B;margin-bottom:6px;}
.parent-note p{font-size:12px;color:#94A3B8;line-height:1.6;font-style:italic;}
"""

    player_name = d.get("playerName", "Player")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(player_name)} — IDP 2026</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0;}}
body{{background:#0D1B2A;color:#EDF2F7;font-family:'Barlow',sans-serif;font-size:15px;line-height:1.6;padding:2rem 1.5rem 3rem;max-width:900px;margin:0 auto;}}
{css}
</style>
</head>
<body>
{infographic}
</body>
</html>"""


def export_html(d, output_path):
    html = render_infographic_html(d)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML saved: {output_path}")


# ─── PDF GENERATION ───────────────────────────────────────────────────────────

def build_pdf(d, output_path):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import pt
        from reportlab.lib.colors import HexColor, white, black
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    except ImportError:
        sys.exit("Error: 'reportlab' package not installed. Run: pip install reportlab")

    # ── Color palette ──────────────────────────────────────────────────────────
    NAVY       = HexColor("#0D1B2A")
    NAVY_MID   = HexColor("#1A2E44")
    NAVY_LIGHT = HexColor("#243B55")
    TEAL       = HexColor("#22A882")
    TEAL_DARK  = HexColor("#1B8A6B")
    TEAL_FAINT = HexColor("#0D2E25")
    AMBER      = HexColor("#F0A020")
    AMBER_DARK = HexColor("#D4870A")
    AMBER_FAINT= HexColor("#2E1E05")
    GREEN      = HexColor("#38A050")
    GREEN_DARK = HexColor("#2D7A3E")
    GREEN_FAINT= HexColor("#0D2214")
    PURPLE     = HexColor("#7357C8")
    PURPLE_DARK= HexColor("#5A3FA0")
    PURPLE_FAINT=HexColor("#1A1230")
    BLUE       = HexColor("#60A5FA")
    BLUE_FAINT = HexColor("#0D1E2E")
    TEXT       = HexColor("#EDF2F7")
    TEXT_MUTED = HexColor("#94A3B8")
    TEXT_DIM   = HexColor("#64748B")
    BORDER     = HexColor("#1E2D3D")

    PAGE_W, PAGE_H = A4
    MARGIN = 28 * pt
    CONTENT_W = PAGE_W - 2 * MARGIN

    # ── Background callback ────────────────────────────────────────────────────
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.restoreState()

    # ── Styles ─────────────────────────────────────────────────────────────────
    def style(name, **kw):
        defaults = dict(
            fontName="Helvetica", fontSize=10, textColor=TEXT,
            leading=14, spaceAfter=0, spaceBefore=0, alignment=TA_LEFT
        )
        defaults.update(kw)
        return ParagraphStyle(name, **defaults)

    S_PLAYER  = style("player",  fontName="Helvetica-Bold", fontSize=32, textColor=TEXT, leading=36)
    S_SUB     = style("sub",     fontName="Helvetica",      fontSize=8,  textColor=TEXT_DIM,   leading=11, spaceBefore=3)
    S_POS     = style("pos",     fontName="Helvetica-Bold", fontSize=9,  textColor=TEAL,       leading=12, alignment=TA_RIGHT)
    S_PHASE   = style("phase",   fontName="Helvetica",      fontSize=8,  textColor=TEXT_DIM,   leading=10, alignment=TA_RIGHT, spaceBefore=3)
    S_STAT_V  = style("statv",   fontName="Helvetica-Bold", fontSize=12, textColor=TEXT,       leading=14)
    S_STAT_L  = style("statl",   fontName="Helvetica",      fontSize=7,  textColor=TEXT_DIM,   leading=9,  spaceBefore=2)
    S_SECTION = style("section", fontName="Helvetica-Bold", fontSize=7,  textColor=TEXT_DIM,   leading=9,  spaceBefore=10)
    S_CARD_T  = style("cardt",   fontName="Helvetica-Bold", fontSize=9,  textColor=TEXT,       leading=11)
    S_CARD_B  = style("cardb",   fontName="Helvetica",      fontSize=8,  textColor=TEXT_MUTED, leading=11, spaceBefore=2)
    S_BADGE   = style("badge",   fontName="Helvetica-Bold", fontSize=7,  textColor=TEXT_DIM,   leading=9,  alignment=TA_CENTER)
    S_PLAN_T  = style("plant",   fontName="Helvetica-Bold", fontSize=9,  textColor=TEXT,       leading=11)
    S_PLAN_B  = style("planb",   fontName="Helvetica",      fontSize=8,  textColor=TEXT_MUTED, leading=11, spaceBefore=1)
    S_MICRO_N = style("micron",  fontName="Helvetica-Bold", fontSize=20, textColor=BLUE,       leading=22, alignment=TA_CENTER)
    S_MICRO_D = style("microd",  fontName="Helvetica",      fontSize=7,  textColor=TEXT_MUTED, leading=10, alignment=TA_CENTER, spaceBefore=2)
    S_GD_LBL  = style("gdlbl",  fontName="Helvetica-Bold", fontSize=7,  textColor=TEXT_DIM,   leading=9)
    S_GD_TEXT = style("gdtext", fontName="Helvetica-Bold", fontSize=12, textColor=TEXT,       leading=15)
    S_GOAL_LBL= style("goallbl",fontName="Helvetica-Bold", fontSize=8,  textColor=TEAL,       leading=10)
    S_GOAL_P  = style("goalp",  fontName="Helvetica",      fontSize=8,  textColor=TEXT_MUTED, leading=12, spaceBefore=3)
    S_PN_LBL  = style("pnlbl",  fontName="Helvetica-Bold", fontSize=7,  textColor=TEXT_DIM,   leading=9)
    S_PN_P    = style("pnp",    fontName="Helvetica-Oblique", fontSize=8, textColor=TEXT_MUTED, leading=12, spaceBefore=3)

    story = []

    # ── 1. Header ──────────────────────────────────────────────────────────────
    player_name = d.get("playerName", "Player")
    position    = d.get("position", "Field Player")
    focus       = d.get("focus", "Development")

    name_para  = Paragraph(f'{player_name} <font color="#22A882">IDP</font>', S_PLAYER)
    sub_para   = Paragraph("INDIVIDUAL DEVELOPMENT PLAN &bull; 2026 &bull; COACHING STAFF", S_SUB)
    pos_para   = Paragraph(position.upper(), S_POS)
    phase_para = Paragraph(f"Phase: {focus}", S_PHASE)

    header_table = Table(
        [[
            [name_para, sub_para],
            [pos_para, phase_para]
        ]],
        colWidths=[CONTENT_W * 0.65, CONTENT_W * 0.35]
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), NAVY),
        ("VALIGN",        (0,0), (0,0),  "BOTTOM"),
        ("VALIGN",        (1,0), (1,0),  "BOTTOM"),
        ("ALIGN",         (1,0), (1,0),  "RIGHT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("LINEBELOW",     (0,0), (-1,-1), 0.5, HexColor("#243B55")),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # ── 2. Stats bar ───────────────────────────────────────────────────────────
    duration = d.get("duration", "12 months")
    mantra   = d.get("mantra", "Play with intent")

    def stat_cell(val, lbl):
        return [Paragraph(str(val), S_STAT_V), Paragraph(lbl.upper(), S_STAT_L)]

    stats_data = [[
        stat_cell("Development", "Current Phase"),
        stat_cell(focus, "Focus"),
        stat_cell(duration, "Plan Duration"),
        stat_cell(mantra, "Mantra"),
    ]]
    stats_table = Table(stats_data, colWidths=[CONTENT_W / 4] * 4, rowHeights=[42])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), NAVY_MID),
        ("ROUNDEDCORNERS",(0,0), (-1,-1), [4,4,4,4]),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LINEAFTER",     (0,0), (2,0),   0.5, BORDER),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 14))

    # ── 3. Strengths ───────────────────────────────────────────────────────────
    story.append(Paragraph("KEEP DOING — STRENGTHS TO BUILD ON", S_SECTION))
    story.append(Spacer(1, 5))

    strengths = d.get("strengths") or []
    def card_cell(item, dot_color):
        title = Paragraph(
            f'<font color="{dot_color.hexval()}">&#9679;</font>  {item.get("title","")}',
            S_CARD_T
        )
        body = Paragraph(item.get("body", ""), S_CARD_B)
        return [title, body]

    if strengths:
        pairs = [strengths[i:i+2] for i in range(0, len(strengths), 2)]
        for pair in pairs:
            row = [card_cell(pair[0], GREEN)]
            if len(pair) > 1:
                row.append(card_cell(pair[1], GREEN))
            else:
                row.append([""])
            t = Table([row], colWidths=[(CONTENT_W - 6) / 2] * 2)
            t.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (0,0), GREEN_FAINT),
                ("BACKGROUND",    (1,0), (1,0), GREEN_FAINT),
                ("LEFTPADDING",   (0,0), (-1,-1), 10),
                ("RIGHTPADDING",  (0,0), (-1,-1), 10),
                ("TOPPADDING",    (0,0), (-1,-1), 8),
                ("BOTTOMPADDING", (0,0), (-1,-1), 8),
                ("VALIGN",        (0,0), (-1,-1), "TOP"),
                ("LINEAFTER",     (0,0), (0,0),   0.5, BORDER),
                ("BOX",           (0,0), (0,0),   0.5, GREEN_DARK),
                ("BOX",           (1,0), (1,0),   0.5, GREEN_DARK),
            ]))
            story.append(t)
            story.append(Spacer(1, 5))

    story.append(HRFlowable(width=CONTENT_W, thickness=0.5, color=BORDER, spaceAfter=6, spaceBefore=6))

    # ── 4. Improvements ────────────────────────────────────────────────────────
    story.append(Paragraph("AREAS TO IMPROVE", S_SECTION))
    story.append(Spacer(1, 5))

    improvements = d.get("improvements") or []
    if improvements:
        pairs = [improvements[i:i+2] for i in range(0, len(improvements), 2)]
        for pair in pairs:
            row = [card_cell(pair[0], AMBER)]
            if len(pair) > 1:
                row.append(card_cell(pair[1], AMBER))
            else:
                row.append([""])
            t = Table([row], colWidths=[(CONTENT_W - 6) / 2] * 2)
            t.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (0,0), AMBER_FAINT),
                ("BACKGROUND",    (1,0), (1,0), AMBER_FAINT),
                ("LEFTPADDING",   (0,0), (-1,-1), 10),
                ("RIGHTPADDING",  (0,0), (-1,-1), 10),
                ("TOPPADDING",    (0,0), (-1,-1), 8),
                ("BOTTOMPADDING", (0,0), (-1,-1), 8),
                ("VALIGN",        (0,0), (-1,-1), "TOP"),
                ("LINEAFTER",     (0,0), (0,0),   0.5, BORDER),
                ("BOX",           (0,0), (0,0),   0.5, AMBER_DARK),
                ("BOX",           (1,0), (1,0),   0.5, AMBER_DARK),
            ]))
            story.append(t)
            story.append(Spacer(1, 5))

    story.append(HRFlowable(width=CONTENT_W, thickness=0.5, color=BORDER, spaceAfter=6, spaceBefore=6))

    # ── 5. Development Plan ────────────────────────────────────────────────────
    story.append(Paragraph("DEVELOPMENT PLAN", S_SECTION))
    story.append(Spacer(1, 5))

    BADGE_COLORS = {
        "purple": (PURPLE_FAINT, PURPLE),
        "amber":  (AMBER_FAINT,  AMBER),
        "teal":   (TEAL_FAINT,   TEAL),
        "blue":   (BLUE_FAINT,   BLUE),
    }

    for item in (d.get("plan") or []):
        badge_type  = item.get("badgeType", "purple")
        bg_col, fg_col = BADGE_COLORS.get(badge_type, BADGE_COLORS["purple"])
        badge_style = ParagraphStyle(
            "badge_dyn", fontName="Helvetica-Bold", fontSize=7,
            textColor=fg_col, leading=9, alignment=TA_CENTER
        )
        badge_cell = Paragraph(item.get("badge", "").upper(), badge_style)
        bullets = item.get("bullets") or []
        bullet_paras = [Paragraph(item.get("title",""), S_PLAN_T)]
        for b in bullets:
            bullet_paras.append(Paragraph(f"— {b}", S_PLAN_B))
        plan_row = [[badge_cell], bullet_paras]
        t = Table(
            [[badge_cell, bullet_paras]],
            colWidths=[80, CONTENT_W - 80]
        )
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (0,0), bg_col),
            ("BACKGROUND",    (1,0), (1,0), NAVY_MID),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
            ("RIGHTPADDING",  (0,0), (-1,-1), 10),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("VALIGN",        (0,0), (0,0),  "MIDDLE"),
            ("VALIGN",        (1,0), (1,0),  "TOP"),
            ("LINEAFTER",     (0,0), (0,0),  0.5, fg_col),
            ("BOX",           (0,0), (-1,-1),0.5, BORDER),
        ]))
        story.append(t)
        story.append(Spacer(1, 5))

    story.append(Spacer(1, 4))

    # ── 6. Micro-habits ────────────────────────────────────────────────────────
    story.append(Paragraph(
        '<font color="#60A5FA">HOME MICRO-HABITS — DAILY</font>', S_SECTION
    ))
    story.append(Spacer(1, 5))

    habits = d.get("microHabits") or []
    if habits:
        row = []
        for h in habits[:3]:
            cell = [
                Paragraph(str(h.get("num", "")), S_MICRO_N),
                Paragraph(h.get("desc", ""), S_MICRO_D),
            ]
            row.append(cell)
        while len(row) < 3:
            row.append([""])
        t = Table([row], colWidths=[CONTENT_W / 3] * 3)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), BLUE_FAINT),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
            ("RIGHTPADDING",  (0,0), (-1,-1), 8),
            ("TOPPADDING",    (0,0), (-1,-1), 12),
            ("BOTTOMPADDING", (0,0), (-1,-1), 12),
            ("VALIGN",        (0,0), (-1,-1), "TOP"),
            ("ALIGN",         (0,0), (-1,-1), "CENTER"),
            ("LINEAFTER",     (0,0), (1,0),   0.5, BORDER),
            ("BOX",           (0,0), (-1,-1), 0.5, HexColor("#1E3A5F")),
        ]))
        story.append(t)

    story.append(Spacer(1, 8))

    # ── 7. Game day focus ──────────────────────────────────────────────────────
    gd_raw = d.get("gameDayFocus", "")
    gd_parts = gd_raw.split("—")
    if len(gd_parts) > 1:
        gd_formatted = (
            f'<font color="#22A882">{gd_parts[0].strip()}</font>'
            f' — {gd_parts[1].strip()}'
        )
    else:
        gd_formatted = gd_raw

    gd_table = Table(
        [[
            Paragraph("GAME DAY FOCUS", S_GD_LBL),
            Paragraph(gd_formatted, S_GD_TEXT),
        ]],
        colWidths=[90, CONTENT_W - 90]
    )
    gd_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), NAVY_MID),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 12),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
        ("LINEAFTER",     (0,0), (0,0),   0.5, BORDER),
    ]))
    story.append(gd_table)
    story.append(Spacer(1, 8))

    # ── 8. 12-month goal ───────────────────────────────────────────────────────
    story.append(Paragraph("12-MONTH GOAL", S_SECTION))
    story.append(Spacer(1, 4))

    goal_table = Table(
        [[
            Paragraph("12-MONTH\nVISION", S_GOAL_LBL),
            Paragraph(d.get("goalVision", ""), S_GOAL_P),
        ]],
        colWidths=[70, CONTENT_W - 70]
    )
    goal_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), TEAL_FAINT),
        ("LEFTPADDING",   (0,0), (-1,-1), 14),
        ("RIGHTPADDING",  (0,0), (-1,-1), 14),
        ("TOPPADDING",    (0,0), (-1,-1), 12),
        ("BOTTOMPADDING", (0,0), (-1,-1), 12),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("BOX",           (0,0), (-1,-1), 0.5, TEAL_DARK),
        ("LINEAFTER",     (0,0), (0,0),   0.5, TEAL_DARK),
    ]))
    story.append(goal_table)
    story.append(Spacer(1, 10))

    # ── 9. Parent note ─────────────────────────────────────────────────────────
    pn_table = Table(
        [[
            Paragraph("NOTE FOR PARENTS", S_PN_LBL),
            Paragraph(d.get("parentNote", ""), S_PN_P),
        ]],
        colWidths=[80, CONTENT_W - 80]
    )
    pn_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), NAVY_MID),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 14),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("LINEBEFORE",    (0,0), (0,0),   3, BORDER),
        ("LINEAFTER",     (0,0), (0,0),   0.5, BORDER),
        ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
    ]))
    story.append(pn_table)

    # ── Build PDF ──────────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF saved:  {output_path}")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Read transcript
    try:
        with open(args.transcript, "r", encoding="utf-8") as f:
            transcript = f.read().strip()
    except FileNotFoundError:
        sys.exit(f"Error: Transcript file not found: {args.transcript}")

    if not transcript:
        sys.exit("Error: Transcript file is empty.")

    # Call Claude
    data = call_claude(
        name=args.name,
        position=args.position,
        duration=args.duration,
        focus=args.focus,
        transcript=transcript,
    )

    # Derive output filenames
    safe_name = re.sub(r"[^\w\s-]", "", args.name).strip().replace(" ", "_")
    out_dir = args.output_dir
    os.makedirs(out_dir, exist_ok=True)

    pdf_path  = os.path.join(out_dir, f"{safe_name}_IDP_2026.pdf")
    html_path = os.path.join(out_dir, f"{safe_name}_IDP_2026.html")

    # Export
    build_pdf(data, pdf_path)
    export_html(data, html_path)

    print("\nDone!")


if __name__ == "__main__":
    main()
