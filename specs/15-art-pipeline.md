# Spec 15: Art Pipeline

## Overview

All art is pre-generated using AI image tools and stored as static assets. No runtime image generation. This keeps the game fast and predictable.

## Asset Categories

### 1. Courtroom Scene
- **Background:** Single illustrated courtroom (1920x1080)
- **Furniture sprites:** Judge bench, witness stand, jury box seats, counsel tables, gallery
- **Variants:** Standard courtroom, federal courtroom, small-town courtroom (future)
- **Style:** 2D illustrated, warm wood tones, dramatic lighting, Slay the Spire aesthetic

**Generation prompt template:**
```
2D illustrated courtroom interior, stylized game art, warm wood paneling, 
dramatic overhead lighting, empty [judge bench/witness stand/jury box], 
top-down slight angle, clean lines, rich colors, game UI background style
```

### 2. Card Art (200+ unique images)
- **Size:** 300x420px (standard card ratio)
- **Frame:** Colored border by type (blue=evidence, red=objection, gold=tactic, green=witness, purple=wild)
- **Art area:** 280x200px illustration
- **Text area:** Name, cost icons, description, effect

**Card art generation batches:**

| Category | Count | Style |
|----------|-------|-------|
| Evidence items | 30 | Realistic objects with dramatic lighting |
| Legal concepts | 20 | Abstract/symbolic illustrations |
| Tactics | 25 | Dynamic action scenes |
| Witness types | 15 | Character portraits in spotlight |
| Wild cards | 10 | Dramatic courtroom moments |

**Prompt template:**
```
Game card illustration, 2D stylized art, [subject description], 
dramatic lighting, rich saturated colors, clean composition, 
card game art style similar to Slay the Spire, no text
```

### 3. Character Portraits

#### Juror Portraits (18 base characters × 7 expressions = 126 images)
- **Size:** 128x128px (in jury box), 256x256px (detail view)
- **Expressions:** neutral, skeptical, sympathetic, angry, confused, bored, shocked
- **Diversity:** Varied ages, ethnicities, genders
- **Style:** Bust portrait, illustrated, expressive, consistent art style across all

**Generation approach:**
1. Generate base neutral portrait per character
2. Use image-to-image variation for each expression
3. Maintain consistency within each character's set

**Prompt template:**
```
Portrait bust illustration of [demographic description], [expression], 
2D stylized game art, clean background, expressive face, 
consistent art style, courtroom setting
```

#### Judge Portraits (6 judges × 4 expressions = 24 images)
- Expressions: neutral, attentive, disapproving, angry
- Style: Formal, robed, authoritative

#### Witness Portraits (20 witnesses × 6 expressions = 120 images)
- Expressions: neutral, nervous, confident, crying, angry, defensive
- Style: Varied, character-specific

#### Opposing Counsel Portraits (6 counsels × 4 expressions = 24 images)
- Expressions: confident, neutral, worried, desperate

### 4. UI Elements
- Card back design (1 image)
- Resource icons (CP shield, PP book, $ money)
- Phase banners ("CROSS-EXAMINATION", "OBJECTION!", etc.)
- Gavel animation frames (5 frames)
- Button sprites (play, end turn, menu)
- Dialog box nine-slice frames
- Notification frames

## Art Style Guide

### Color Palette
```
Primary:     #2C1810 (dark wood)
Secondary:   #8B6914 (gold accent)
Background:  #1A0F0A (deep shadow)
Evidence:    #2563EB (blue)
Objection:   #DC2626 (red)
Tactic:      #D97706 (gold/amber)
Witness:     #059669 (green)
Wild:        #7C3AED (purple)
Text:        #F5F0E8 (warm white)
CP:          #3B82F6 (credibility blue)
PP:          #10B981 (preparation green)
```

### Style Consistency
- **Line weight:** Medium, visible outlines
- **Shading:** Cell-shaded with 2-3 tone levels
- **Lighting:** Dramatic, from above (courtroom lights)
- **Proportions:** Slightly stylized (larger heads, expressive features)
- **Background treatment:** Soft focus, muted colors behind sharp foreground

## Asset File Structure

```
public/assets/
├── courtroom/
│   ├── background.png           # Full courtroom bg (1920x1080)
│   ├── judge-bench.png          # Furniture sprite
│   ├── witness-stand.png
│   ├── jury-box.png
│   ├── counsel-table-left.png
│   ├── counsel-table-right.png
│   └── gallery.png
├── cards/
│   ├── frames/
│   │   ├── evidence-frame.png
│   │   ├── objection-frame.png
│   │   ├── tactic-frame.png
│   │   ├── witness-frame.png
│   │   └── wild-frame.png
│   ├── art/
│   │   ├── police-report.png
│   │   ├── dna-evidence.png
│   │   ├── ... (200+ card art images)
│   │   └── bombshell-revelation.png
│   └── card-back.png
├── jurors/
│   ├── juror-01/
│   │   ├── neutral.png
│   │   ├── skeptical.png
│   │   ├── sympathetic.png
│   │   ├── angry.png
│   │   ├── confused.png
│   │   ├── bored.png
│   │   └── shocked.png
│   └── juror-18/
│       └── ...
├── judges/
│   └── judge-01/
│       ├── neutral.png
│       ├── attentive.png
│       ├── disapproving.png
│       └── angry.png
├── witnesses/
│   └── witness-01/
│       └── ...
├── counsel/
│   └── counsel-01/
│       └── ...
├── ui/
│   ├── icons/
│   │   ├── cp-icon.png
│   │   ├── pp-icon.png
│   │   └── budget-icon.png
│   ├── banners/
│   │   ├── cross-examination.png
│   │   ├── objection.png
│   │   └── verdict.png
│   ├── gavel/
│   │   ├── gavel-01.png
│   │   ├── gavel-02.png
│   │   ├── gavel-03.png
│   │   ├── gavel-04.png
│   │   └── gavel-05.png
│   └── dialog/
│       ├── bubble-9slice.png
│       └── panel-9slice.png
└── audio/
    ├── sfx/
    │   ├── gavel.mp3
    │   ├── objection.mp3
    │   ├── card-play.mp3
    │   ├── card-draw.mp3
    │   └── murmur.mp3
    └── music/
        ├── pretrial.mp3
        ├── trial-calm.mp3
        ├── trial-tense.mp3
        ├── deliberation.mp3
        └── verdict.mp3
```

## Generation Workflow

### Phase 1 (MVP): Placeholder Art
- Use solid color rectangles with text labels
- Card frames are colored borders with type name
- Portraits are colored circles with expression text
- Get gameplay working before art

### Phase 2: AI Generation Sprint
- Generate all courtroom assets (1 day)
- Generate card art in batches of 20 (3-5 days)
- Generate character portraits (2-3 days)
- Generate UI elements (1 day)

### Phase 3: Art Polish
- Review all generated art for consistency
- Re-generate outliers that don't match style
- Create sprite sheets for animations
- Optimize file sizes (PNG compression, WebP where supported)

## Tools

- **DALL-E 3 / Midjourney:** Primary generation
- **Stable Diffusion (img2img):** Expression variations from base portraits
- **Photoshop/GIMP:** Post-processing, frame composition, sprite sheets
- **TinyPNG:** Asset compression
