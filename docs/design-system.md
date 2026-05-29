# ManchQ Design System

A reference document for producing marketing collateral, landing pages, social
posts, and any other visual or written material that should feel like part of
the ManchQ app — not generic SaaS output.

**How to use this:** paste this whole file (or the relevant section) into a
Claude chat as context before asking for marketing output. The model will use
the colors, typography, tone, and visual patterns described here instead of
defaulting to generic stock SaaS aesthetics.

---

## 1. Brand identity at a glance

**ManchQ** is a mobile-first, AI-powered dance studio management app for
small-to-mid studio owners. The brand voice is **confident, warm, and
unfussy** — like the founder who actually knows your day looks like running
between classes with a phone in one hand.

**Three brand pillars:**

1. **AI does the boring stuff** — Smart Add parses your schedule from plain
   English; Smart Announce drafts your parent messages. Owners stay focused
   on dancing, not data entry.
2. **Works the way you work** — Mobile-first, one-thumb friendly, no
   modal hopping, tap-to-edit anywhere.
3. **Real studios, real recitals** — From the first batch to the wrapped
   recital, ManchQ tracks the full lifecycle of a studio's year.

**One-liner:** *"The AI-powered dance studio app for owners who'd rather be
in the studio than at their laptop."*

---

## 2. Color palette

### Brand colors

| Name             | Hex          | Use for                                                                  |
|------------------|--------------|--------------------------------------------------------------------------|
| **Purple**       | `#7C3AED`    | Primary brand color. Buttons, focus rings, accent borders, link text     |
| **Magenta**      | `#D946EF`    | Brand accent. Gradient endpoint, decorative highlights, sparkles         |
| **Brand gradient** | `linear-gradient(135deg, #7C3AED 0%, #D946EF 100%)` | CTAs, hero text fills, badges, headers — the "ManchQ moment" |

### Surface system (dark — default)

| Name              | Hex          | Use for                                              |
|-------------------|--------------|------------------------------------------------------|
| `--page-bg`       | `#080411`    | App background — near-black with a violet undertone  |
| `--card`          | `#16101f`    | Card backgrounds, primary content surfaces           |
| `--surface`       | `#1e1530`    | Inputs, secondary surfaces, hover state              |
| `--surface-2`     | `#241939`    | Nested surfaces (chips inside cards)                 |
| `--border`        | `#2a1f3d`    | Card / input borders                                 |
| `--hairline`      | `rgba(255,255,255,0.08)` | Subtle dividers between sections           |
| `--text`          | `#f3f3f7`    | Primary text                                         |
| `--muted`         | `#9b8aab`    | Secondary text, labels, helper copy                  |

### Surface system (light)

| Name              | Hex          |
|-------------------|--------------|
| `--page-bg`       | `#e8e6f0`    |
| `--card`          | `#ffffff`    |
| `--surface`       | `#f3f4f6`    |
| `--border`        | `#e5e7eb`    |
| `--text`          | `#111827`    |
| `--muted`         | `#6b7280`    |

### Semantic colors

| Name      | Hex        | Use                                       |
|-----------|------------|-------------------------------------------|
| Success   | `#10B981`  | Confirmed RSVPs, attendance present, OK   |
| Warning   | `#FBBF24`  | To-Dos, pending tasks, "needs attention"  |
| Danger    | `#EF4444`  | Delete confirmations, absences, errors    |
| Featured  | `#F59E0B`  | Star (favorite, featured recital)         |

### Event-type colors

| Type         | Hex        |
|--------------|------------|
| Class        | `#6a7fdb`  |
| Recital      | `#D946EF` (magenta — special)  |
| Rehearsal    | `#f4a041`  |
| Workshop     | `#52c4a0`  |
| Performance  | `#D946EF`  |

---

## 3. Typography

### Type families

- **Body / UI:** Open Sans (weights 400, 500, 600, 700, 800)
- **Display / Elegant:** Playfair Display (weights 500, 700), italic — used
  for hero headings, "elegant" treatments (onboarding wizard titles, public
  recital page headers, occasional brand moments)
- **Monospace:** system mono — only for code-like values (passwords,
  IDs in admin views)

### Type scale (mobile reference)

| Role            | Family             | Size    | Weight  | Letter-spacing  | Notes                                                       |
|-----------------|--------------------|---------|---------|-----------------|-------------------------------------------------------------|
| Hero            | Playfair Display   | 28px    | 500     | -0.4px          | Gradient-painted accent word, italic optional               |
| H1              | Open Sans          | 26-30px | 800     | -0.3 to -0.4px  | Section page titles                                         |
| H2              | Open Sans          | 22px    | 800     | -0.02em         | Section headers, e.g. "UPCOMING RECITALS"                   |
| H3              | Open Sans          | 18px    | 800     | -0.2px          | Card titles                                                 |
| Body            | Open Sans          | 14px    | 400-600 | -                | Paragraphs, form fields                                     |
| Small           | Open Sans          | 12-13px | 500-700 | -                | Helper text, metadata                                       |
| Micro / label   | Open Sans          | 10-11px | 700     | 0.07-0.18em     | UPPERCASE — section eyebrows, field labels, taglines        |

### Signature typographic moments

- **Gradient-painted headline word** — single word in a headline gets the
  purple→magenta gradient (`background: linear-gradient(135deg, #7C3AED 0%, #D946EF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`). Used in onboarding "Step *inside*", "Smart *Messages*", "Have *Fun*".
- **Playfair Display + italic** — for "elegant" moments only, never for
  body or UI. Use on a wrapped recital page, hero numbers, or first-page
  welcome screens.
- **Tight uppercase eyebrows** — 10-11px, weight 700, letter-spacing
  0.07-0.18em, color either `--muted` or `--magenta`. Used above any
  serious headline.

---

## 4. Iconography

### Style

- **Lucide-style lineart** — 24×24 viewBox, `fill="none"`, `stroke="currentColor"`,
  `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- Never use filled / glyph icons in UI chrome
- For hero-scale illustrations: 170×170 frame, same 24-viewBox icon, scaled
  with `stroke-width="0.8"` (visual stroke ~5-6px) and the brand gradient as
  the stroke fill via `<linearGradient>`. Always wrap in a circular halo:

  ```css
  width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,0.18), rgba(217,70,239,0.05) 72%);
  border: 1.5px solid rgba(217,70,239,0.35);
  box-shadow: 0 0 36px rgba(124,58,237,0.22);
  ```

### Signature icons

- **Sparkles** (Lucide path) — universal symbol of AI features. Use next to
  any AI label ("Smart Add", "Smart Announce"). Path data:
  ```
  m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z
  ```
  Plus 4 short marks: `M5 3v4`, `M19 17v4`, `M3 5h4`, `M17 19h4`.

- **Pencil** — edit affordance throughout the app. Two paths:
  `M12 20h9` and `M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z`.

- **Rocket** (Lucide) — "launch / get started" moments. Final onboarding step.

---

## 5. Layout & spacing

### Scale

| Token  | px   | Use                                          |
|--------|------|----------------------------------------------|
| xs     | 4    | Inline gaps, chip spacing                    |
| sm     | 6-8  | Form field internal padding                  |
| md     | 12-14| Card padding, default gap                    |
| lg     | 16-18| Section padding, between-card gap            |
| xl     | 22-28| Section margins, page padding                |
| xxl    | 36-48| Major section breaks                         |

### Border radius

- **4-7px** — small inline elements (chips inside controls, tiny tags)
- **8-9px** — buttons, inputs, native selects
- **11-12px** — cards, popovers
- **14px** — large content cards (recital cards, batch tiles)
- **18-22px** — modals, full-screen sheets
- **99px (pill)** — chip buttons, segmented toggles, action pills

### Layout patterns

- **Mobile-first** — single column, full-width cards, generous padding
- **Adaptive grids** — `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` for forms; collapses gracefully
- **Cards over tables** — never show a desktop-style table on mobile;
  always re-render as stacked cards
- **Tap-to-edit** — in-place editing patterns are preferred over modals.
  Click a row → expand to editor → click outside → collapse with updated values

---

## 6. Interactive states

| State    | Treatment                                                          |
|----------|--------------------------------------------------------------------|
| Default  | Subtle border `var(--border)`, surface background                  |
| Hover    | Border shifts to `rgba(124,58,237,0.45)`, slight background lift   |
| Focus    | 3px purple glow: `box-shadow: 0 0 0 3px rgba(124,58,237,0.16)`, border `var(--accent)` |
| Active   | Gradient background (the brand gradient), white text               |
| Disabled | Opacity 0.55, no border shift on hover                             |
| Loading  | Subtle pulse animation or "…" suffix on button text                |

**Transitions:** 0.12-0.15s ease for hover/focus/border-color. Never longer
than 0.2s for UI; longer durations (0.4-0.9s) only for hero animations.

---

## 7. Component patterns

### Buttons

- **Primary (gradient CTA)** — purple→magenta gradient, white text, shadow
  `0 2px 12px rgba(124,58,237,0.32)`, weight 700, letter-spacing 0.01em
- **Secondary (surface)** — surface background, border, muted text
- **Ghost** — transparent, border-only, muted text → text + border shift to
  purple on hover
- **Pill button** — border-radius 99px, used for filter chips, segmented toggles
- **Tertiary (dashed)** — dashed border, muted text, used for "Set TBD" and
  other low-emphasis opt-in actions

### Chips

- Pill-shaped, border 1.5px, padding `6px 12px`, font 12px weight 700
- Default: transparent background, muted text, neutral border
- Active: gradient background, white text, no border
- Favorite: amber border + light amber bg, amber text, ★ prefix

### Cards

- Background `var(--card)`, border `1px solid var(--border)`, border-radius 12-14px
- Padding 14-18px
- Shadow only on hover or featured items: `0 4px 20px rgba(124,58,237,0.18)`
- For dark surfaces holding inputs, nest `var(--surface-2)` for the inputs

### Forms

- Floating-label inputs (label sits above field, surface-colored)
- Native `<select>` styled with custom chevron via inline SVG background
- DateField / TimeField as button → popover (chip grid for time, calendar for date)
- Inline tap-to-edit cells with conditional Save/Cancel that only appear
  when the value is dirty

### Modals & sheets

- Mobile: full-screen sheets (`position: fixed; inset: 0;`)
- Desktop: centered with `backdrop-filter: blur(6px)` overlay
- Border-radius 18-22px on the modal body
- Always include a clearly-labeled Cancel + primary action

### Eyebrows

- Tiny uppercase label above a heading
- `font-size: 10-11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase`
- Color: `--magenta` for AI/special moments, `--muted` for ordinary labels

---

## 8. Signature visual moments

These are repeating brand patterns. When marketing collateral needs to feel
distinctly ManchQ, lean on one of these:

1. **The gradient-painted accent word** — single word in a headline lit up
   with the brand gradient. Used in onboarding ("Step *inside*"), public
   recital pages, blog headers. Never overuse — once per headline.

2. **Lineart icon in a glowing halo** — 24-viewBox icon, gradient stroke,
   sitting inside a radial-gradient halo with a magenta hairline border.
   The "ManchQ illustration" pattern. Used on splash, empty states,
   feature explainers.

3. **Phone-frame mock** — when showing the app, frame screenshots inside
   a 380px-wide, black, rounded-corner (26px) "phone" container with a
   blurred dark glow drop-shadow. Adds polish and signals "mobile-first."

4. **Sparkle icon next to AI labels** — Sparkles icon always sits next to
   AI-powered things: "Smart Add", "Smart Announce", "Smart Message".
   The icon is the visual shorthand for "the AI is helping you here."

5. **"Wrapped 🎉" tribute treatment** — past recitals get a celebratory
   block on their public page. The studio's hard work is honored with
   a soft tribute paragraph ("Pulling off this {recital_name} was a labor
   of love..."). Marketing can borrow this tone for "studio milestones"
   or anniversary moments.

6. **Featured recital hero** — the home dashboard's hero is the upcoming
   featured recital with a full-bleed poster background, gradient overlay,
   and bold title at the bottom. The "movie-poster" treatment — great
   reference for landing-page hero sections.

7. **Pill toggle bar** — segmented toggles for switching states (Dark/Light,
   Standard/Elegant, filter chips). Border-radius 99px, 3px inset padding,
   active pill carries the gradient with a soft shadow.

---

## 9. Tone of voice

ManchQ writes the way the founder talks to another studio owner over coffee
— *confident, warm, honest, slightly playful*.

### Do

- **Talk to the reader directly.** "Type your schedule in plain English."
- **Use active verbs.** "Take attendance", "Send a Smart Message", "Plan the recital".
- **Acknowledge real studio life.** "...between classes, on your phone."
  "...running your studio from the floor."
- **Be honest about edges.** "No trial expiry." "No card required."
  "Free for small studios, forever."
- **Use specific words.** "Batch" not "class group". "Recital" not "event".
  "Studio owner" not "user". The product talks to dance studios, not generic SaaS buyers.

### Don't

- ✗ Generic SaaS speak: "best-in-class platform", "powerful suite",
  "unlock the potential"
- ✗ Fake urgency: "Don't miss out!", "Limited time!"
- ✗ Hyperbolic claims: "Revolutionary", "10x faster", "AI-powered everything"
  (yes, even though we DO have AI — restrain the hype)
- ✗ Empty plurals: "solutions", "innovations", "experiences"
- ✗ Stock motivational fluff: "Empower your team", "Transform your workflow"

### Signature phrases & rhythms

- "**Made for studio owners who'd rather be in the studio.**"
- "**Type it in plain English.** AI handles the rest."
- "**One tap.** Attendance done."
- "**No setup. No empty dashboard.** Sample data is loaded from day one."
- "**Built for your phone**, not retrofitted onto it."

### Headline templates that fit the brand

- "**[Verb] without the [pain].**" — e.g. "Plan a recital without the spreadsheet."
- "**The [adjective] way to [do studio thing].**" — e.g. "The quiet way to send 200 parent reminders."
- "**[Number] [thing], [number] taps.**" — e.g. "200 students, 12 batches, one app."

---

## 10. Imagery / illustration guidance

- **Real studio imagery** — dance, mirrors, studios, real performers.
  Avoid corporate stock (handshakes, generic offices, "diverse team
  laughing at laptop").
- **Phone in hand on the studio floor** — the hero image we want associated
  with the brand. Owner working on their phone *in* the studio, mirror in
  background, soft daylight.
- **Posters + recitals as a visual subject** — recital posters in the wild,
  posters on bulletin boards, the magic of preparing for performance.
- **Avoid:** generic flowcharts, abstract gradient blobs, "AI brain" imagery,
  empty-startup illustration sets (Undraw, etc.). Lean into the real world
  of dance.
- **Illustration style for in-app content:** lineart with gradient strokes
  (see section 4) — light, modern, brand-aligned. Never use cartoon-y
  characters or "corporate Memphis" people illustrations.

---

## 11. Quick reference card (paste this for short prompts)

```
ManchQ brand essentials
- Colors: brand gradient purple #7C3AED → magenta #D946EF
- Dark UI: bg #080411, card #16101f, text #f3f3f7, muted #9b8aab
- Type: Open Sans body (400-800), Playfair Display for elegant headings
- Icons: Lucide lineart, 24x24 viewBox, stroke-width 2, currentColor
- Voice: confident, warm, direct. Talk to dance studio owners like a peer.
  Active verbs. Specific words ("batch", "recital", "studio owner").
  No generic SaaS speak. No hyperbole.
- Three pillars: AI does the boring stuff · Works the way you work ·
  Real studios, real recitals.
- Signature moves: gradient-painted accent word in headlines; lineart
  icons in glowing halos; phone-frame screenshots; sparkles next to AI;
  no empty dashboards (sample data from day one).
```

---

*Last updated: 2026-05-27*

When this doc and the product drift apart, the product wins — update the
doc.
