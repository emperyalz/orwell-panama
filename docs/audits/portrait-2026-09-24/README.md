# Political profile portrait audit — 24 September 2026

Scope: all 91 records returned by the production Convex `politicians:list` query on `fleet-vole-527`. This is a visual review of the portraits as they appear in the current editorial profile layout, not an identity verification or a new image-generation run. The [shortlist contact sheet](./shortlist.jpg) shows every item below.

## Result

| Status | Count | Next action |
| --- | ---: | --- |
| Existing portrait fits the formal flag-backed layout | 74 | Keep |
| Image missing and currently renders initials | 8 | Find and verify source portraits |
| Existing image visually inconsistent | 9 | Search for a better authentic portrait first; edit only if needed |

### Missing portraits (8)

| ID | Person | Role | Source lead |
| --- | --- | --- | --- |
| ALC-004 | Diógenes Galván | Mayor | Existing social account photos are leads, not verified portrait assets |
| ALC-005 | Eloy Chong | Mayor | Existing social account photos are leads |
| ALC-010 | Eric Jaén | Mayor | Existing social account photos are leads |
| ALC-002 | Irma Hernández Berrío | Mayor | Existing social account photos are leads |
| DEP-009 | Jairo Salazar | Deputy | Assembly profile URL in database, plus social account photos |
| ALC-006 | Joaquín De León | Mayor | Government URL in database should be checked against the person's current identity and role |
| DEP-025 | José Luis Varela | Deputy | Assembly profile URL in database, plus social account photos |
| ALC-003 | Stefany Dayan Peñalba | Mayor | Existing social account photos are leads |

These records have `hasHeadshot: false`; their referenced `/images/headshots/{ID}.jpg` files are absent. Do not flip the flag until a valid asset exists.

### Existing images to replace or improve (9)

| ID | Person | Issue | Preferred treatment |
| --- | --- | --- | --- |
| LDR-PRD | Balbina Herrera | Dim, red-tinted event crop with another person behind her | Find a clean, current formal portrait; controlled edit if necessary |
| LDR-PP | Cirilo Salas | Tight low-detail event headshot in casual blue shirt | Find a sharper formal portrait; controlled edit if necessary |
| LDR-MOLIRENA | Francisco Alemán | Busy rally scene, casual shirt, small subject | Find a clean formal source; controlled edit if necessary |
| LDR-ALZ | José Muñoz Molina | News interview frame with microphone and crowded background | Find a clean formal source; controlled edit if necessary |
| LDR-MOCA | Ricardo Lombana | Low-detail, tight face crop; formal clothing already present | Prefer a higher-resolution authentic portrait and recrop |
| LDR-RM | Ricardo Martinelli | Casual close crop and background figures | Prefer a formal authentic portrait; controlled edit if necessary |
| LDR-CD | Yanibel Ábrego | Small, soft crop; incomplete body framing and no consistent setting | Prefer a higher-resolution formal portrait and recrop |
| ALC-001 | Mayer Mizrachi | Formal attire, but party-graphic background and close crop break the portrait system | Search for an authentic full-length or upper-body portrait; a deterministic background treatment may suffice |
| DEP-040 | Paulette Thomas | Flag-backed portrait but casual T-shirt amid formal legislative portraits | Check for an authentic formal Assembly portrait before considering a clothing edit |

The four sticky-note screenshots specifically show Balbina Herrera, Cirilo Salas, Eloy Chong, and Eric Jaén. All four are in this shortlist.

## Source research added 24 September 2026

The temporary `/retratos` review page and [`portrait-review.json`](../../../src/data/portrait-review.json) now pair each of the 17 people with two or three additional photographs and links to their original pages. There are 50 accessible references in total. Each image URL was fetched and visually checked for the intended person; they are **research references**, not approved publication assets. One false image-search match for Cirilo Salas and one for Joaquín De León were removed during review. Paulette Thomas's Espacio Cívico image was the same photograph already on the site, so it was replaced by a distinct reference.

Two data issues surfaced while sourcing. Joaquín De León's database `officialGovUrl` points to a Darién governor page rather than his mayoral office in David; it must not be used to verify his portrait. The Assembly profile URLs for Jairo Salazar and José Luis Varela could not be fetched during this pass, so those rows rely on account and editorial references pending institutional confirmation.

Publishing a source photograph or using it as the basis of a final edited portrait still requires a rights and provenance decision. A source URL and a successful thumbnail fetch do not establish reuse permission.

## Production workflow and spend controls

1. **Source and identity pass.** For each of the 17, gather two or three images from official government, party, or personally controlled channels, keeping URL, capture date, rights/usage notes, and an unmodified copy. Verify the face across sources. Check current office and identity because an incorrect source photo is worse than a blank.
2. **Use authentic photographs whenever possible.** A better official or self-published portrait should replace a poor crop directly. Try deterministic crop, exposure, and background treatment before an image model. This costs no image-generation calls. Preserve existing good portraits.
3. **Pilot only the cases that truly need reconstruction.** Use the built-in image editor on two difficult, well-sourced people first, with the source portrait as the edit target and other verified views as identity references. One candidate per person. Preserve face, age, hair, complexion, and proportions; change only clothing, framing, lighting, and background. Do not invent insignia or imply a synthetic portrait is an official government photograph.
4. **Review at the actual site crop.** Compare side by side with the 74 accepted portraits, including mobile crop. Reject distorted faces, changed identity, invented jewelry/insignia, implausible hands, or low-detail enlargements. Regenerate only rejected candidates, not entire batches.
5. **Publish with provenance.** Keep original files and source links. Mark AI-edited portraits in site metadata or a visible source note, while preserving the original-source reference. Add a consistent portrait treatment through the layout; any Panama flag graphic should be a separate, genuine visual asset rather than a fabricated official photo background.

**Ceiling:** 17 candidates, not 91 generation jobs. The initial audit used contact sheets and local image tools, with zero generated images. After sourcing, the expected number of image edits should be lower than 17. Run a two-person pilot, estimate the remaining calls from that result, then process approved candidates one at a time. This keeps both image spend and Codex context usage bounded. No replacement was generated or published during this audit; the sticky note should remain unresolved until assets are reviewed and applied.
