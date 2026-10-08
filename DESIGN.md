---
name: ORWELL Political Index
description: Condensed political identity and sourced research workspaces on ruled paper.
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
  workspace-green: "#244b42"
  comparison-green: "#315b35"
  workspace-action: "#192d24"
  workspace-ground: "#f6f7f4"
  coverage-surface: "#edf0eb"
  difference-surface: "#e9f1d9"
  table-identity: "#f5f6f2"
  workspace-muted: "#56655e"
  workspace-rule: "#bac2b9"
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
  workspace-title:
    fontFamily: "IndexDisplay, Impact, sans-serif"
    fontSize: "48px"
    fontWeight: 400
  workspace-body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
  workspace-label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
  workspace-metric:
    fontFamily: "IndexNarrow, Arial, sans-serif"
    fontSize: "44px"
    fontWeight: 400
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
  workspace-selected:
    backgroundColor: "{colors.workspace-green}"
    textColor: "{colors.contrast-light}"
    rounded: "{rounded.square}"
    padding: "12px 20px"
  coverage-notice:
    backgroundColor: "{colors.coverage-surface}"
    textColor: "{colors.workspace-muted}"
    rounded: "{rounded.square}"
    padding: "18px 24px"
  workspace-field:
    backgroundColor: "{colors.contrast-light}"
    textColor: "{colors.workspace-green}"
    rounded: "{rounded.square}"
    padding: "10px"
    height: "42px"
  search-field:
    backgroundColor: "transparent"
    rounded: "{rounded.square}"
    padding: "7px 12px"
---

# Design System: ORWELL Political Index

## Overview

**Creative North Star: "The Political Index"**

A condensed political index on neutral paper. Party colors identify the person, while fine rules organize evidence into a dense, readable profile. This record covers the politician profile and the implemented comparison, social intelligence and Panama election workspaces. The profile preserves its party identity; research workspaces use neutral reading surfaces and green controls.

The September 14 approved composition governs the profile surface. Self-hosted Anton and Oswald approximate its letterforms because no original font file accompanied the reference. Official ORWELL and party marks remain unchanged. The research extension follows that incumbent world and supplied interaction references; no generated composition or FORM seed was selected.

**Key Characteristics:**

- Large condensed identity typography and a close portrait.
- Party-colored identity fields above neutral evidence sections.
- Flat ruled structure with visible source notes and explicit missing coverage.
- Horizontal research tables with sticky identity, dated provenance and native ES / EN / PT copy.

## Colors

Strong party identity sits against warm neutral paper; the body palette stays stable between people.

### Primary

PAN Purple and PAN Gold fill the name field and metadata band, respectively. PAN Name Ink provides the warm pale name foreground. For all other groups, `profileTheme` supplies the primary and secondary colors from the party record; secondary falls back to primary and a missing primary uses Party Fallback. These data values are not a second hardcoded palette.

The foreground helper chooses Contrast Dark or Contrast Light by comparing contrast ratios using relative luminance. Large count accents use the primary when it accepts light text, otherwise Accent Dark. PAN retains its explicit name foreground. The active tab and archive bars use the party primary.

### Neutral

Paper is the shared evidence ground. Ink carries record text; Muted carries source notes and incomplete coverage. Rule separates evidence sections. Action Ink and Contrast Light define the compare action. Focus Gold is the keyboard outline. Minor border variants exist in individual rows but do not form a separate reusable palette.

**The Party Field Rule.** Use party color for identity fields, active tabs, and archive bars; keep evidence on neutral paper. PAN uses its dedicated purple and gold; other groups use sourced database colors.

### Research workspace extension

Workspace Green marks selected election controls, archive filters and focus. Comparison Green marks the active comparison view and reference action; pale Difference Surface identifies known values that differ from the first profile. Coverage Surface frames limitations and collection context. Workspace Ground is the archive and election background, while comparison retains Paper. White fields, pale sticky identity cells and muted green-gray provenance retain the flat paper character. Chart series use a categorical palette from the implementation, independent of party identity; color is paired with authentic platform marks in the legend.

**The Known Difference Rule.** Highlight a comparison cell only when its known value differs from the known reference value. Keep missing evidence visibly separate; gendered forms of the same office are semantically equal.

## Typography

**Display Font:** IndexDisplay, the self-hosted Anton file at `/fonts/anton.ttf`, with Impact and sans-serif fallbacks.

**Body Font:** IndexNarrow, the self-hosted variable Oswald file at `/fonts/oswald.ttf`, with Arial and sans-serif fallbacks. Both use `font-display: swap`. The profile record panels now use IndexNarrow through the final profile stylesheet override, with IndexDisplay section headings.

Anton supplies uppercase surnames, section titles and large counts. Oswald carries the given name, biography, metadata and evidence rows. This is a large jump between identity and reading type rather than a uniform modular scale.

### Hierarchy

The frontmatter display token is the desktop surname's starting size above 1200px. Each rendered line uses its measured fitted size and line height, so the token is not a fixed guarantee of rendered dimensions. Between 901px and 1200px, single-line surnames start at `clamp(160px,17.3vw,268px)` and multiline surnames at `clamp(62px,8.5vw,130px)`. Above 1200px, the final desktop surname rule overrides that multiline starting size; fitting still resolves each line separately.

At 900px and below, given names use `clamp(30px,7vw,54px)`, single-line surnames use `clamp(85px,22vw,150px)`, and multiline surnames use `clamp(38px,8.5vw,78px)`. Section headings become 35px. Desktop biography is 19px with a 1.3 line height; on mobile it is 19px with 1.35 line height. Facts and rows use the body role. Small provenance uses the source role. Metadata labels are uppercase with the label tracking; their values are 23px on wide desktop and 20px below 1201px.

**The Bounded Name Rule.** Preserve every character of the public name. Wrap the surname at whole-word boundaries, limit horizontal compression to 0.72, then reduce font size when more fitting is needed.

The component packs surname words into lines of up to 13 characters where possible. A single longer word stays intact and fits to the container. Canvas measurement includes letter spacing; fitting waits for font readiness and responds to ResizeObserver. The full name remains the accessible heading label. Given names retain their original case and may wrap at narrow widths.

### Research hierarchy

Research page titles use IndexDisplay at the workspace-title size; comparison uses `clamp(34px,4vw,48px)`. Intelligence and election titles reduce to 34px below 701px. Inter supplies workspace prose, filters, table cells and source links. Comparison table text is 13px with tabular numerals; header names are 18px, reducing to 16px on mobile. Intelligence metrics use IndexNarrow at the workspace-metric size, reducing to 34px on mobile; the latest date is 26px. Election vote totals use IndexNarrow at 24px. The shared header retains IndexNarrow.

## Layout

The desktop profile uses a left identity column of `minmax(280px,26%)` beside a flexible evidence area. At 1700px and above the left column is 400px. Desktop evidence has 36px horizontal padding; the summary is a 1.18:1 two-column grid. Profile and social sections divide their label and content into a 130px label column and flexible content, with a 22px gap. The archive spans both summary columns.

At 1200px and below, inner labels stack above their content, evidence padding drops to 24px, and metadata becomes a three-column grid. At 900px and below the profile itself becomes one column, metadata uses two columns, and evidence sections stack. The identity area becomes a two-column name/portrait row with 20px padding. Desktop sidebar detail links are hidden in that mobile identity area; relevant profile information continues in the evidence area. Tabs scroll horizontally, and the header search occupies its own row.

Portraits sit below the desktop name field and overlap it using a negative top margin; the portrait frame has a 0.96 aspect ratio. The mobile portrait frame uses 0.8 and a 280px maximum height. Preserve image fallbacks. Individual editorial crops are record-specific, not a reusable global treatment.

### Research workspace layout

Comparison uses a maximum 1800px shell with 40px desktop gutters and 18px gutters below 721px. Its table preserves one person per column, up to eight selections, with 215px person columns and a 220px sticky row-label column. Below 721px these become 190px and 140px. Sticky headers retain identity while the focusable, labeled region scrolls both ways within 74vh (75vh mobile). Visible arrow controls advance horizontally; reduced motion switches scrolling to immediate movement.

Archive intelligence and elections use the shared 1240px container, expanding to 1320px at 1400px, with 32px desktop and 18px mobile gutters. Intelligence filters form four columns, then two below 701px. Its metric strip has three columns, then stacks; source examples form three columns, then one. The chart is 340px tall, then 260px. The tabular alternative preserves a 560px minimum width on mobile. Account coverage keeps the person column sticky. Election controls stack below 701px; the election table retains an 860px minimum width and a sticky person column (180px mobile) within a focusable horizontal region. Scroll hints explain how to reach votes and sources.

## Elevation & Depth

This profile uses flat color regions, thin borders, and portrait overlap. It does not use card shadows. The biography, documents, social accounts and archive remain part of one ruled paper surface. On devices without reduced-motion preference, links transition opacity over 0.15s with ease timing and reach 0.8 opacity on hover. Keyboard focus uses a 3px Focus Gold outline with 4px offset.

Research workspaces likewise use flat surfaces and fine rules. The comparison header's one-pixel shadow is a sticky separator, not a raised-card effect. Intelligence and election focus outlines use Workspace Green at 2px with 3px or 4px offsets; comparison controls use Comparison Green. Area-chart fills are low-opacity categorical color, with animation disabled.

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

### Comparison matrix

A portrait-led, ruled matrix for up to eight people. Profile, Votes, Social and Documents views share the same person headers and authentic party marks. A compact count, add control, reference selection, copy-link action and CSV export sit above the table. Difference filtering ignores nulls and compares normalized office meaning, including Diputado / Diputada as the same office while preserving the displayed form. The first profile establishes cell highlighting; users can reorder the reference. Alternating pale rows support tracking across columns. Archive period, principal or alternate status and recent shared decisions retain their source context. Empty values and unavailable sources have distinct labels.

### Archive intelligence

Filters cover name, person, party, province, platform and month range. The default range is the last twelve months ending at the latest stored month. Authentic platform icons identify filters and chart series, with accessible names and tooltips. Chart and table views expose the same monthly aggregate. Metrics report archived posts, profiles with posts and the latest archived date. Format meters count observable URL or metadata categories, including an explicit unrecorded-format group. Linked source examples pair portrait, platform, publication date and original post. Account coverage separately displays the latest import check and insertion count; account rows distinguish person-platform aggregation from specific account scope. An empty month or zero imported posts does not establish inactivity, public opinion or reach.

### Official election snapshot and career rows

The election surface pairs the authentic Tribunal Electoral / INED mark with the official source name, election date and retrieval date. The provenance anchor is a full-width block: its mark keeps the native aspect ratio at 360px width, bounded by 100% of the available width, with source text below. Row profile actions occupy their own flex line below the winner name, keeping long names and links distinct. The 2024 snapshot contains proclaimed deputies and mayors, with office-type, territory and name search controls. Each row retains election party, territory, obtained votes, published percentage and original CSV source. Deputy percentages preserve the constituency denominator and are not additive in multi-member districts. Profile portraits, links and comparison selection appear only for unambiguous normalized-name and office matches, additionally checked against deputy circuit or available mayor district. The profile career section combines the dated proclamation with the directory update date and explicit scope note. It does not present this result as proof of current tenure or a complete career.

**The Dated Evidence Rule.** Place the source, relevant date and coverage limitation beside each research block. Keep election party distinct from directory party, and publication time distinct from import checks.

## Do's and Don'ts

### Do:

- Do use the canonical ORWELL vector and existing party marks.
- Do derive party foregrounds from the implemented contrast calculation, retaining the PAN-specific foreground.
- Do remeasure surname lines after fonts load and when their container resizes.
- Do preserve whole surname words and accents when fitting names.
- Do collapse the evidence grid into a single column at the mobile breakpoint.
- Do preserve focusable horizontal tables, sticky identity columns and visible scroll hints.
- Do keep workspace interface and limitation copy native in Spanish, English and Portuguese.
- Do pair verified publisher, party and platform marks with accessible identity text.
- Do preserve archive periods, retrieval dates and distinct missing-data states.
- Do bound source marks to their container while preserving native aspect ratio, and keep profile actions below long winner names.

### Don't:

- Don't generate or redraw official marks.
- Don't apply one party palette to every profile.
- Don't compress surname text below the implemented horizontal floor.
- Don't imply that missing records, imported archive dates, or stored counts establish current office coverage.
- Don't promote the one-person portrait crop into a universal portrait rule.

- Don't describe global expansion, earlier careers or dated party changes as shipped coverage.
- Don't treat gendered office labels as substantive comparison differences.
- Don't turn archived volume into popularity, performance or voting-intention scores.
