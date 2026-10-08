# Independent QA: social identity next batch — 2026-10-08

I reviewed all ten dossier records, reopened the available official and candidate sources, re-queried the production account/archive summary and the active Monitor Politics registry read-only, and visually compared every current profile image I could retrieve with its local directory image. No production data changed. Full per-account evidence is in [`/tmp/orwell-social-next-batch-qa.json`](/tmp/orwell-social-next-batch-qa.json).

**Result: 1 accepted, 9 unresolved, 0 rejected, 0 unchecked.** Ernesto Cedeño Alvarado’s Facebook ownership is supported by his own website linking the exact page. The remaining records lack direct owner/institution links or have conflicting identity evidence. The batch is also stale for Jorge Bloise’s old Facebook record: that account is no longer in the current production directory.

## Material corrections to the batch

- **Ernesto Cedeño Alvarado, Facebook `cedenoabogado`: accept ownership.** His [professional website](https://ernestocedeno.com/) identifies Dr. Ernesto Cedeño Alvarado and links the exact Facebook page with the label “Facebook oficial de Ernesto Cedeño”; its JSON-LD `sameAs` repeats the exact URL. [Voto Informado](https://voto2024.espaciocivico.org/es/candidatos/diputado/ernesto-cedeno-alvarado) also lists the exact Facebook URL beside the candidate profile for circuit 8-4. This is direct owner-controlled evidence absent from the batch’s listed source set. The current Facebook page was blocked during this check, so its present profile image remains unverified; use the platform icon until that image can be checked.
- **Alaín Cedeño, Facebook `aIaindiputado`: keep unresolved, but revise the evidence record.** [Voto Informado](https://voto2024.espaciocivico.org/es/candidatos/diputado/alain-cedeno) directly links this exact Facebook URL and gives circuit 8-6. The profile bio was reported to say circuit 8-10. Candidate-supplied civic evidence corroborates the target but does not alone prove control under the existing audit rule, and the circuit conflict remains open. The current Facebook image visually matches the local avatar, which does not resolve ownership.
- **Jony Guevara, Instagram `joanguevara8_1`: remains unresolved.** His [Voto Informado candidate page](https://voto2024.espaciocivico.org/es/candidatos/diputado/jony-guevara) corroborates circuit 8-1 and the relevant districts, but it does not link this Instagram account. The profile image and local avatar visually match, but that is not an owner cross-link.
- **Jorge Bloise, Facebook `jorgebloise`: unresolved and stale.** His [owner Linktree](https://linktr.ee/jorgebloisei) describes him as a circuit 8-4 deputy and links a different professional Facebook page. It neither links the old `/jorgebloise` page nor proves that it belongs to someone else. Production no longer contains the old directory record after the accepted destination correction. The old disabled Monitor mapping persists; do not restore the account or transfer its avatar/archive to the replacement.

## Avatar and archive checks

The live read-only production queries returned 225 directory accounts and 6,476 social archive rows; the latest overall archive publication was October 6, 2026. The nine target rows still present in the current directory have zero matches in the Panama archive. The batch had also recorded zero for Jorge’s old URL, but that target has since been removed; there is no current directory count for it. These are matching-archive counts, not public activity or dormancy results.

Current public images visually matched local images for Mayín Correa, Osmán Gómez’s Instagram, Alaín Cedeño, Carlos Saldaña, Jony Guevara, and Jorge Bloise’s old Facebook. Ricardo Vigil’s current X image matches the stored default egg silhouette; it carries no identity information. Osmán’s TikTok image could not be checked because TikTok returned no profile image metadata. Yesica Romero’s TikTok still has no directory avatar or public image metadata. Ernesto Cedeño’s Facebook image could not be checked because Meta blocked the profile fetch. No avatar was changed.

I re-ran the public Monitor Politics entity query independently. Seven accounts have exact but disabled Monitor rows, with the recorded dates and avatar flags reproduced; three have no exact mapping: Yesica Romero, Carlos Saldaña and Jony Guevara. The inactive rows all need their disable reason/error history checked before any collection change. Osmán’s two Monitor rows have no Monitor avatar; Mayín’s row has no scrape date or Monitor avatar. Monitor metadata flags do not prove that an avatar matches the current public profile.

For Osmán’s Instagram, the research pass recorded 331 public posts while ORWELL has zero matching Panama archive posts. A fresh Instagram profile fetch was blocked in QA, so I preserve that captured observation as research evidence rather than claim a new live post-count check. This distinction still shows why the archive zero must not be called public inactivity.

## Per-account decisions

| Account | QA decision | Key evidence or gap |
|---|---|---|
| Yesica Romero · TikTok `yessicaromero856` | Unresolved | Official and candidate sources identify her and link X, not this TikTok. No current profile image metadata; no Monitor mapping. |
| Mayín Correa · X `CorreaMayin` | Unresolved | MINGOB confirms governor and province; no official/owner cross-link to this X handle. Current image matches local avatar. Monitor row disabled with no scrape date/avatar. |
| Osmán Gómez · Instagram `osmangomez2330` | Unresolved | Official role/circuit plus matching self-bio, but no inbound owner link. Current image matches local avatar; inactive Monitor row has no avatar. |
| Osmán Gómez · TikTok `osmangomez2330` | Unresolved | Platform page supplied no profile metadata; same handle as Instagram does not transfer ownership. Directory avatar and Monitor image remain unverified. |
| Alaín Cedeño · Facebook `aIaindiputado` | Unresolved | Voto Informado directly links exact account; circuit 8-6 candidate record conflicts with reported Facebook bio circuit 8-10. Current/local image match is not ownership proof. |
| Carlos Saldaña · X `HDCarlitin` | Unresolved | Official role and circuit corroborated; exact profile is self-described only. Current image matches local avatar; no Monitor mapping. |
| Jony Guevara · Instagram `joanguevara8_1` | Unresolved | Candidate page corroborates circuit but does not link exact account. Current image matches local avatar; no Monitor mapping. |
| Jorge Bloise · Facebook `jorgebloise` | Unresolved; stale target | Owner hub links a separate professional page. Old row absent in current production; old Monitor row remains disabled. Do not restore or transfer its archive. |
| Ricardo Vigil · X `rickyv644` | Unresolved | Official deputy by same name exists, but X bio says only “sup”; alternate-handle lead is unverified. Public and stored images are a generic default. |
| Ernesto Cedeño · Facebook `cedenoabogado` | Accept ownership; avatar unresolved | Owner’s professional website links exact Facebook and names it official; candidate profile independently corroborates circuit 8-4. Current Facebook image blocked; Monitor row disabled. |

All ownership, avatar, archive and Monitor detail is itemized in the JSON ledger. The directory’s prior `CONFIRMED`/`PROBABLE` verdicts were not treated as independent evidence.
