---
name: ORWELL Politician Profile
description: Condensed political identity and sourced evidence on neutral paper.
colors:
  pan-purple: "#59348b"
  pan-gold: "#fdc80c"
  pan-name-ink: "#fff1a4"
  party-fallback: "#52525b"
  paper: "#faf9f5"
  ink: "#161616"
  muted: "#64616a"
  rule: "#bdb8c0"
  contrast-dark: "#101010"
  contrast-light: "#ffffff"
  accent-dark: "#28232e"
  action-ink: "#111111"
  focus-gold: "#b98016"
typography:
  display:
    fontFamily: "IndexDisplay, Impact, sans-serif"
    fontSize: "clamp(150px, 16vw, 246px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.025em"
  given-name:
    fontFamily: "IndexNarrow, Arial, sans-serif"
    fontSize: "clamp(45px, 5.3vw, 82px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.025em"
  headline:
    fontFamily: "IndexDisplay, Impact, sans-serif"
    fontSize: "clamp(30px, 3.25vw, 49px)"
    fontWeight: 400
    lineHeight: 1.07
    letterSpacing: "-.025em"
  body:
    fontFamily: "IndexNarrow, Arial, sans-serif"
    fontSize: "16px"
  biography:
    fontFamily: "IndexNarrow, Arial, sans-serif"
    fontSize: "19px"
    lineHeight: 1.3
  label:
    fontFamily: "IndexNarrow, Arial, sans-serif"
    fontSize: "12px"
    letterSpacing: ".08em"
  source:
    fontFamily: "IndexNarrow, Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.5
rounded:
  square: "0px"
spacing:
  compact: "12px"
  section-mobile: "20px"
  section-inner: "22px"
  section-tablet: "24px"
  page-desktop: "36px"
components:
  compare:
    backgroundColor: "{colors.action-ink}"
    textColor: "{colors.contrast-light}"
    rounded: "{rounded.square}"
    padding: "20px 24px"
  evidence-section:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "20px 0 16px"
  source-note:
    textColor: "{colors.muted}"
    typography: "{typography.source}"
  search-field:
    backgroundColor: "transparent"
    rounded: "{rounded.square}"
    padding: "7px 12px"
---

# Design System: ORWELL Politician Profile

## Overview

**Creative North Star: "The Political Index"**

A condensed political index on neutral paper. Party colors identify the person, while fine rules organize evidence into a dense, readable profile. This system records the implemented politician profile only; it does not redefine the directory, comparison pages, or inherited detailed record panels.

The September 14 approved composition governs this surface. Self-hosted Anton and Oswald approximate its letterforms because no original font file accompanied the reference. Official ORWELL and party marks remain unchanged.

**Key Characteristics:**

- Large condensed identity typography and a close portrait.
- Party-colored identity fields above neutral evidence sections.
- Flat ruled structure with visible source notes and explicit missing coverage.

## Colors

Strong party identity sits against warm neutral paper; the body palette stays stable between people.

### Primary

PAN Purple and PAN Gold fill the name field and metadata band, respectively. PAN Name Ink provides the warm pale name foreground. For all other groups, `profileTheme` supplies the primary and secondary colors from the party record; secondary falls back to primary and a missing primary uses Party Fallback. These data values are not a second hardcoded palette.

The foreground helper chooses Contrast Dark or Contrast Light by comparing contrast ratios using relative luminance. Large count accents use the primary when it accepts light text, otherwise Accent Dark. PAN retains its explicit name foreground. The active tab and archive bars use the party primary.

### Neutral

Paper is the shared evidence ground. Ink carries record text; Muted carries source notes and incomplete coverage. Rule separates evidence sections. Action Ink and Contrast Light define the compare action. Focus Gold is the keyboard outline. Minor border variants exist in individual rows but do not form a separate reusable palette.

**The Party Field Rule.** Use party color for identity fields, active tabs, and archive bars; keep evidence on neutral paper. PAN uses its dedicated purple and gold; other groups use sourced database colors.

## Typography

**Display Font:** IndexDisplay, the self-hosted Anton file at `/fonts/anton.ttf`, with Impact and sans-serif fallbacks.

**Body Font:** IndexNarrow, the self-hosted variable Oswald file at `/fonts/oswald.ttf`, with Arial and sans-serif fallbacks. Both use `font-display: swap`. The retained detailed record panels explicitly use Arial; they are not the profile's display system.

Anton supplies uppercase surnames, section titles and large counts. Oswald carries the given name, biography, metadata and evidence rows. This is a large jump between identity and reading type rather than a uniform modular scale.

### Hierarchy

The frontmatter display token is the desktop surname's starting size above 1200px. Each rendered line uses its measured fitted size and line height, so the token is not a fixed guarantee of rendered dimensions. Between 901px and 1200px, single-line surnames start at `clamp(160px,17.3vw,268px)` and multiline surnames at `clamp(62px,8.5vw,130px)`. Above 1200px, the final desktop surname rule overrides that multiline starting size; fitting still resolves each line separately.

At 900px and below, given names use `clamp(30px,7vw,54px)`, single-line surnames use `clamp(85px,22vw,150px)`, and multiline surnames use `clamp(38px,8.5vw,78px)`. Section headings become 35px. Desktop biography is 19px with a 1.3 line height; on mobile it is 19px with 1.35 line height. Facts and rows use the body role. Small provenance uses the source role. Metadata labels are uppercase with the label tracking; their values are 23px on wide desktop and 20px below 1201px.

**The Bounded Name Rule.** Preserve every character of the public name. Wrap the surname at whole-word boundaries, limit horizontal compression to 0.72, then reduce font size when more fitting is needed.

The component packs surname words into lines of up to 13 characters where possible. A single longer word stays intact and fits to the container. Canvas measurement includes letter spacing; fitting waits for font readiness and responds to ResizeObserver. The full name remains the accessible heading label. Given names retain their original case and may wrap at narrow widths.

## Layout

The desktop profile uses a left identity column of `minmax(280px,26%)` beside a flexible evidence area. At 1700px and above the left column is 400px. Desktop evidence has 36px horizontal padding; the summary is a 1.18:1 two-column grid. Profile and social sections divide their label and content into a 130px label column and flexible content, with a 22px gap. The archive spans both summary columns.

At 1200px and below, inner labels stack above their content, evidence padding drops to 24px, and metadata becomes a three-column grid. At 900px and below the profile itself becomes one column, metadata uses two columns, and evidence sections stack. The identity area becomes a two-column name/portrait row with 20px padding. Desktop sidebar detail links are hidden in that mobile identity area; relevant profile information continues in the evidence area. Tabs scroll horizontally, and the header search occupies its own row.

Portraits sit below the desktop name field and overlap it using a negative top margin; the portrait frame has a 0.96 aspect ratio. The mobile portrait frame uses 0.8 and a 280px maximum height. Preserve image fallbacks. Individual editorial crops are record-specific, not a reusable global treatment.

## Elevation & Depth

This profile uses flat color regions, thin borders, and portrait overlap. It does not use card shadows. The biography, documents, social accounts and archive remain part of one ruled paper surface. On devices without reduced-motion preference, links transition opacity over 0.15s with ease timing and reach 0.8 opacity on hover. Keyboard focus uses a 3px Focus Gold outline with 4px offset.

## Shapes

The structural language is square: rectangular fields, ruled rows and square compare actions. One-pixel separators provide alignment and hierarchy. Small official marks and platform icons retain their native geometry. No rounded-card vocabulary is established by this profile.

## Components

### Compare action

A square, dark link with white text and an inline scale SVG. Desktop padding is the frontmatter value; it tightens at the intermediate breakpoint, then spans both metadata columns while remaining content-width on mobile. It shares the profile's link hover and keyboard focus behavior.

### Search field

A thin rectangular outline around a transparent input and SVG search control. Desktop width is `min(28vw,385px)`; mobile width is 100%. It inherits the narrow face and header foreground. This is the header's existing functional input, not a decorative search illustration.

### Tab navigation

Unfilled rectangular buttons in a horizontal row, with a bottom rule and a 6px party-colored active marker. They use `aria-selected` state; overflow remains scrollable. On mobile the row is 55px high, with 17px labels. Preserve the associated panel behavior rather than treating tabs as static headings.

### Evidence sections

Flat containers bounded by thin shared rules. Titles use the display face; source notes stay adjacent to their evidence. Document rows pair an inline file SVG, readable label and outward arrow. Social rows pair the stored platform icon, account identity, status and outward arrow. These are linked records, not floating cards. Large counts support document and account totals.

**The Evidence Rule.** Keep source notes and missing-data states visible within their corresponding evidence section. Absence and loading failure have distinct text.

### Identity and archive

The identity heading uses the bounded fitting component described in Typography. Party fields receive their colors as article-level custom properties. Archive statistics use large condensed numerals, neutral explanatory labels, and primary-colored horizontal bars; the caution strip mixes the secondary color with white. The archive period and source remain visible so historical material is distinguishable from current directory identity.

## Do's and Don'ts

### Do:

- Do use the canonical ORWELL vector and existing party marks.
- Do derive party foregrounds from the implemented contrast calculation, retaining the PAN-specific foreground.
- Do remeasure surname lines after fonts load and when their container resizes.
- Do preserve whole surname words and accents when fitting names.
- Do collapse the evidence grid into a single column at the mobile breakpoint.

### Don't:

- Don't generate or redraw official marks.
- Don't apply one party palette to every profile.
- Don't compress surname text below the implemented horizontal floor.
- Don't imply that missing records, imported archive dates, or stored counts establish current office coverage.
- Don't promote the one-person portrait crop into a universal portrait rule.
