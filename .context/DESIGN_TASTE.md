# DESIGN_TASTE.md — Team taste compass

> Required for `creative-designer` and `frontend-designer`. Read before every design decision.
> This file is copied by `/ai-team:team-init` from the plugin's own template
> (`${CLAUDE_PLUGIN_ROOT}/.context/DESIGN_TASTE.md`) into your project's `.context/`
> the first time it is missing. The section below is THIS project's taste, not the
> plugin's — fill in the `TBD` fields before the first real design task. Everything
> after that section is generic design reference knowledge (typography, color theory,
> 2025 trends) the owner may edit, trim, or override; it is not a substitute for the
> project-specific fields.

## Project-specific taste (fill in before first design task)

- **Palette:** TBD — primary / secondary / accent hex values for this brand.
- **Typography:** TBD — heading typeface, body typeface, licensed or brand-mandated fonts.
- **References:** TBD — competitor sites, mood boards, or existing brand assets to match.
- **Prohibitions:** TBD — colors, styles, or patterns this project must avoid (legal,
  competitor overlap, past user feedback).

> Version: 2.0 · Date: 2026-07-01 (template)

---

## Philosophy — five principles

1. **Bold > safe.** A strong choice always beats an averaged one. Neutral design does not exist — it is simply bad.
2. **Space is luxury.** White space communicates quality. Dense = cheap.
3. **One focus.** One element fights for attention. Everything else supports, not competes.
4. **Mobile first.** 80% of traffic is mobile. Design for 375px, adapt up to desktop.
5. **Emotion before meaning.** Visual creates mood in 300ms — before the brain reads text.

---

## Typography

**Rules (do not break):**
- Maximum 2 typefaces: one for headings, one for body.
- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48 / 64 / 96px (8px grid).
- Line height: 1.4–1.6 for body text, 1.0–1.2 for headings.
- Minimum 2 steps difference between levels (not 16px vs 18px — that is not hierarchy).
- One dominant size per screen.

**What tastes good in 2025:**
- Oversized headings (96–128px, intentionally breaking the grid).
- Gradient / metallic effect on display text.
- Tight tracking on large headings: `letter-spacing: -0.02em`.
- Variable fonts with weight animation on hover.
- Mix: serif display + sans-serif body (a classic that does not die).

**Anti-patterns:**
- 3+ typefaces in one layout.
- All text the same size — no hierarchy.
- ALL CAPS everywhere — screams without meaning.
- Light-grey text on white background — unreadable, and that is not minimalism.

---

## Color

**60 / 30 / 10 system:**
- 60% — dominant (background, structure).
- 30% — secondary (dividers, UI elements).
- 10% — accent (CTA, key data points, branding).

**Psychology cheat sheet:**

| Color | Association | Application |
|---|---|---|
| Deep navy | Trust, stability | Fintech, B2B SaaS, banking |
| Green | Growth, money, health | Finance, wellness, eco |
| Red | Urgency, energy | Sales, food, aggressive CTAs |
| Orange | Warmth, accessibility | Retail, mobile apps |
| Purple | Premium, creativity | Luxury tech, beauty |
| Black | Luxury, power | Fashion, premium B2C |

**Contrast:** minimum 4.5:1 for normal text, 3:1 for large text (WCAG AA). Always verify.

**Gradients 2025:** mesh gradients (aurora), glassmorphism overlay, subtle colored shadows.

**Do not:**
- Rainbow of colors in one layout.
- Pastel shades without purpose (looks like a kindergarten).
- White text on yellow / light-blue — kills contrast.

---

## Grid and spacing

- Base: **8px grid** (8, 16, 24, 32, 48, 64, 96, 128).
- Mobile padding: minimum 20px on each side.
- Touch target height: minimum 48px.
- Gap between sections: 64–96px (not 24px — that suffocates).

**Layouts:**
- **Z-pattern** — landing pages with visuals (eye: left→right, diagonal, left→right).
- **F-pattern** — text pages, news, blogs.
- **Bento grid** — dashboards, product pages, portfolios (2025 trend).
- **Single column** — mobile-first, email, stories.

---

## Performance creatives (ads: FB / IG / TikTok)

**Creative structure:**
1. **Hook** (first 0.3 sec static / 3 sec video) — one emotional punch, one question or provocation.
2. **Problem / Benefit** — short, specific, no jargon.
3. **Proof** — a number, a face, before/after, client logos.
4. **CTA** — one action, verb first ("Try", "Download", "See the price").

**Static rules (breaking these = losing impressions):**
- Maximum **5–10 words** on the image — the rest goes in the ad text.
- **One visual focus:** product / face / number — not three at once.
- High-contrast text: overlay under the copy when needed.
- Formats: 4:5 (IG Feed), 9:16 (Stories / Reels / TikTok), 1:1 (FB Feed).
- Branding ≤ 10% of the area — visible but not screaming.

**Platform specifics:**

| Platform | Style | What actually works |
|---|---|---|
| **Meta (FB/IG)** | Polished AI creatives OK | Before/after, numbers, social proof |
| **TikTok** | UGC > polish | Raw iPhone footage, captions, real people |
| **YouTube** | Provocative headline | 5-sec hook before skip, then story |
| **Display** | Maximum simplicity | 1 headline + 1 CTA + logo |

**Creative formulas:**
- **PAS:** Problem → Agitate → Solution.
- **Before/After:** the highest-converting format for many verticals.
- **Social Proof:** "47,000 customers already…" — a specific number always beats "thousands".

**Creative anti-patterns:**
- Polished AI gloss on TikTok — the algorithm detects and reduces reach.
- More than 10 words on the image — Meta cuts impressions.
- Stock photos: handshakes, lightbulbs, people in a boardroom — banner blindness.
- Feature instead of Benefit: "Supports 500 formats" → "Opens any file".
- CTA at the very end — the user left before that.

---

## Web / Landing page

**Above the fold (only this, nothing else):**
- H1: main benefit, ≤ 10 words.
- Sub: specifics or social proof, ≤ 20 words.
- Hero visual: product in context or a face with real emotion.
- CTA: one button, visible without scrolling.

**Scroll narrative:**
```
Problem → Solution → How it works → Proof → CTA → FAQ → Footer CTA
```

**Conversion elements:**
- Numbers > words: "47% faster" > "significantly faster".
- Social proof next to the CTA, not in a separate section.
- Client logos — trust anchors.
- Guarantee / security next to the payment form.

**Speed:** every 100ms of delay ≈ ~1% conversion loss. Do not overload with fonts and scripts.

---

## 2025 trends (apply selectively, 2–3 per layout)

| Trend | Essence | When appropriate |
|---|---|---|
| **Neobrutalism** | Hard borders, high contrast, no ornament | Startups, dev-tools, bold branding |
| **Bold Typography** | Oversized display, gradient text | Hero sections, creative headlines |
| **Glassmorphism** | Frosted-glass panels, `backdrop-filter: blur` | Cards, overlays, dark UI |
| **Bento Grid** | Asymmetric card grid | Product pages, dashboards |
| **Kinetic Type** | Animated text as a design element | Websites, video creatives |
| **Dark + Neon** | Dark background with bright accents | Tech, gaming, premium |
| **Micro-interactions** | Subtle hover / transition effects | Web apps, mobile |
| **Aurora / Mesh Gradient** | Living multi-color gradients | Hero backgrounds, abstract creatives |

Rule: test a trend on real users. Function beats trend.

---

## Style Prompt system (for AI generation)

Separate **STYLE** and **CONTENT** — this enables reliable style transfer between images.

```
STYLE:   [visual aesthetics, lighting, color palette, technique, mood]
CONTENT: [what is shown: object, context, action, environment]
```

**Example:**
```
STYLE:   cinematic lighting, deep blue and gold palette, dark luxury,
         sharp focus, editorial photography, 35mm film grain
CONTENT: confident woman in business attire, looking at camera,
         blurred city background at night
```

**Tools for the creative conveyor:**

| Tool | API | Best for |
|---|---|---|
| **Flux 1.1 Pro** | ✅ | Prompt accuracy, photorealism, people |
| **Ideogram** | ✅ | Text on image (posters, banners with copy) |
| **GPT Image 1.5** | ✅ | Complex composition, readable text |
| **Midjourney v7** | ❌ no API | WOW art for hero (manual only) |

**Economics:** 100 creative variants = $2–5 compute vs $500–5,000 traditional.
Generate 20–50 variants and let the platform algorithm pick the winner.

---

## Palettes by vertical

| Vertical | Dominant | Accent | Tone |
|---|---|---|---|
| **Fintech / Banking** | Deep navy `#0A1628` | Gold `#F5A623` | Trust, seriousness |
| **Health / Wellness** | White `#FFFFFF` | Sage `#87AE73` | Cleanliness, natural |
| **E-commerce** | Brand-dependent | Red / Orange | Urgency, discounts |
| **B2B SaaS** | Dark `#1A1A2E` | Electric blue `#4FACFE` | Professionalism, tech |
| **Beauty / Fashion** | Skin `#F5E6D3` | Neutral / Gold | Luxury, elegance |
| **Gaming** | Dark `#0D0D0D` | Neon green / purple | Energy, immersion |
| **EdTech** | White / light grey | Bright blue / coral | Friendliness, accessibility |

---

## Anti-patterns (what makes design bad)

- Three or more typefaces.
- Text over a busy image without overlay.
- Center-aligned text in long blocks (hard to read).
- No visual hierarchy — everything the same size.
- Low contrast between text and background.
- Inconsistent spacing (mixing 12px, 15px, 20px).
- Rainbow colors without a system.
- Cliché stock photos.
- Animation for its own sake (no purpose — it annoys).
