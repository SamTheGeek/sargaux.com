
# NEW YORK, WITH LOVE  

## Brand & Design System  

October 11, 2026 — Bar Blondeau  

---

## 1. Brand Essence

**Positioning**  
A modern architectural celebration in New York.

**Tone Attributes**

- Structured
- Urban
- Restrained
- Confident
- Warm (but not sentimental)

**Not**

- Romantic script
- Ornate
- Floral-heavy
- Rustic
- Playful

This system should feel like a cultural announcement, not a traditional wedding suite.

---

## 2. Typography System

All typography must be grotesk sans-serif. No serif. No script.

### Primary Typeface

Preferred:

- Helvetica Neue
- Neue Haas Grotesk
- Swiss 721

Web-safe fallback stack:

```css
font-family: "Helvetica Neue", "Neue Haas Grotesk", "Helvetica", "Arial", sans-serif;
```

### Type Hierarchy

#### H1 — Hero / Title

- ALL CAPS
- Slight tracking (+20–40)
- Large scale

Example:

```text
NEW YORK
WITH LOVE
```

#### H2 — Section Headers

- ALL CAPS
- Slightly smaller than H1

Example:

```text
BAR BLONDEAU
COCKTAIL ATTIRE
```

#### Body

- Sentence case (formal back)
- Or ALL CAPS when system-based
- Clean leading
- No italics

#### Numbers

Front format:

```text
10.11.26
```

Back format:

```text
SUNDAY, OCTOBER 11, 2026
6:00 PM
```

Never use decorative weights unless necessary for hierarchy.

---

## 3. Color System

### Primary Palette

#### Warm Cream (Background)

HEX: #F1ECE3  
RGB: 241, 236, 227  

#### Dark Moss (Primary Text + Skyline + QR)

HEX: #2F3F36  
RGB: 47, 63, 54  

#### Burnt Amber (Sun Disc)

HEX: #D96A1E  
RGB: 217, 106, 30  

---

### Secondary Accent (Use Sparingly)

#### Espresso Brown

HEX: #3A2E26  

#### Muted Saffron

HEX: #E2A43A  

---

### Color Rules

- No pure black.
- No bright red.
- No pastel tones.
- QR code must use Dark Moss.
- No gradients.

---

## 4. Graphic Motifs

### 4.1 The Sun Disc

- Perfect geometric circle.
- Flat color.
- No texture.
- No gradient.
- Often cropped by edge.
- Never decorative.

### 4.2 Abstract Skyline Block

- Solid silhouette.
- Rectangular geometry only.
- No windows.
- No linework.
- 25–35% page height when used.
- Dark Moss color.

### 4.3 Horizontal Rule

- Hairline weight.
- Used to separate blocks.
- Never decorative.
- Never doubled.

---

## 5. Layout System

### Alignment

- Left-aligned typography.
- Strong grid.
- Generous margins.
- Avoid centered layouts (unless intentional hero treatment).

### Spacing

- Clear block separation.
- Equal vertical rhythm.
- Symmetry only when deliberate.

Front = Graphic statement.  
Back = Structured document.  

Whitespace is part of the design.

---

## 6. Copy Guidelines

### Approved Language

- “Together with their families”
- “Invite you to celebrate their marriage”
- “Cocktail Attire”
- Direct, declarative language

### Avoid

- Poetic metaphors
- “Happily ever after”
- “To follow”
- Exclamation marks
- Ceremony language

Tone should feel composed and architectural.

---

## 7. QR Code Rules

- Dark Moss color
- No box background
- No reversal
- Minimum 0.25in clear space
- 1–1.25in square on print
- Aligned with grid baseline

No “Scan here” microcopy.

---

## 8. Website Design Guidelines

### Background

Warm Cream.

### Hero

Large:

```text
NEW YORK
WITH LOVE
```

Optional: Burnt Amber sun partially cropped.

### Footer

Abstract skyline block. Couple's names as the copyright block.

### Navigation

Minimal.  
No decorative elements.  
No floral photography.

### Typography on Web

H1:

```css
text-transform: uppercase;
letter-spacing: 0.08em;
```

Body:

```css
line-height: 1.5;
```

---

## 9. Print Specifications

Paper:

- Uncoated warm white stock
- Minimum 110lb cover
- Matte finish only

Ink:

- Matte
- No gloss coating

---

## 10. System Integrity Checklist

Every new design element must pass:

- Is it geometric?
- Is it restrained?
- Is it urban?
- Is it free of decoration?
- Does it respect the grid?

If something feels ornamental, remove it.

---

## 11. Core Identity Lockup

Primary front composition:

```text
NEW YORK
WITH LOVE

10.11.26
```

Back headline:

```text
MARGAUX ANCEL AND SAM GROSS
TOGETHER WITH THEIR FAMILIES
INVITE YOU TO CELEBRATE THEIR MARRIAGE
```

---

## 12. Recommended File Structure

```text
/docs
  brand-identity.md
/assets
  skyline.svg
  sun-disc.svg
/styles
  colors.css
  typography.css
```

End of Brand Specification.
