# Social identity research: politicians with no linked accounts

Examined 2026-10-16. This audit covers exactly DEP-082 Carlos Afú, DEP-081 Gertrudis Rodríguez, and DEP-079 Nelson Jackson Palma. The production profile snapshot lists zero linked accounts for each; that observation does not establish that any person has no social account. No paid collection was activated, no account was registered or linked, and no politician portrait was used as an account avatar.

## Results

| Person | Institutional identity source | Ownership evidence | Outcome |
|---|---|---|---|
| Carlos Afú (DEP-082) | [Assembly profile](https://www.asamblea.gob.pa/Diputados/CARLOS_TITO_AFU); [Voto Informado candidate record](https://voto2024.espaciocivico.org/es/candidatos/diputado/tito-afu) | Voto Informado identifies Tito Afú, circuit 7-1, Los Santos, and CD/Panameñista nomination. It provides no personal account links. The separate [Espacio Cívico deputy profile](https://espaciocivico.org/diputados/carlos-afu) confirms name, party, circuit and province, but its social links point to Espacio Cívico's own channels. A search lead [X @TitoAfu](https://x.com/TitoAfu) is mirrored by a third party with matching name/location and an outbound blog, but no owner or institutional cross-link was found. | **Unresolved** — candidate lead is not attributable on primary evidence. Assembly URL inaccessible in direct reopen. |
| Gertrudis Rodríguez (DEP-081) | [Assembly profile](https://www.asamblea.gob.pa/Diputados/GERTRUDIS_TULE_RODRIGUEZ); [Tribunal Electoral results PDF](https://www.datosabiertos.gob.pa/dataset/8c4c4aef-f154-4f83-86a8-ed261afab29a/resource/a1b5d88e-ee06-4549-86f4-b62cd272ff45/download/cuadro-06-diputado-proclamados.pdf) | Tribunal Electoral names Gertrudis “Tule” Rodriguez as elected in circuit 12.3 for CD. Assembly search-result text lists circuit 12-3, party, suplente and institutional email. The [Espacio Cívico profile](https://espaciocivico.org/diputados/gertrudis-rodriguez) was reopened; its social icons are publisher channels, not hers. No personal profile URL was supported by first-party evidence. | **Unresolved** — no attributable personal URL located; Assembly returned 502 and candidate-guide reopen timed out. |
| Nelson Jackson Palma (DEP-079) | [Assembly profile](https://www.asamblea.gob.pa/Diputados/NELSON_JACKSON); [Panama Canal Authority biography](https://pancanal.com/board-of-directors/nelson-jackson-palma/) | ACP biography names Nelson Jackson Palma and records his deputy service. [Voto Informado](https://voto2024.espaciocivico.org/es/candidatos/diputado/nelson-jackson-palma) identifies circuit 3-2, Colón, and lists the nominating parties; neither opened profile supplies a personal account URL. | **Unresolved** — no attributable personal URL located; Assembly returned 502. |

There is no verified or proven-conflicting account in this batch. “Unresolved” means ownership evidence is insufficient or no attributable candidate URL was located. “Inaccessible” is recorded as a source-access limitation where applicable; it does not mean the person or account is unavailable. None of the research proves that any unlinked profile is registered.

## Snapshot and reproducibility

The inspected raw production observation is [profile-facts-raw-observations.json](profile-facts-raw-observations.json), SHA-256 `636059fe56d3eef9d716d0a47449ec90def9e000965f1e8ca55d4cd269112139`, observed `2026-10-16T02:31:47.194Z`. It has `accounts: []` for all three IDs and records their official Assembly profile URLs. The JSON companion contains the exact quoted evidence passages and URLs per person.

Commands used to inspect it:

```sh
python3 - <<'PY'
import json
p=json.load(open('docs/product-audits/profile-facts-raw-observations.json'))
for x in p['directory']:
    if x.get('externalId') in ['DEP-082','DEP-081','DEP-079']:
        print(x['externalId'], x['name'], 'accounts=',len(x.get('accounts',[])), 'officialGovUrl=',x.get('officialGovUrl'))
PY
```

Primary sources reopened on 2026-10-16: each linked Voto Informado, Espacio Cívico, ACP or Tribunal Electoral profile above, plus the three Assembly URLs. Focused web searches checked name/party/platform combinations for each person. Assembly retrieval failed for all three (inaccessible/502); the Gertrudis candidate guide also timed out. Search results and third-party mirrors are treated only as leads, never proof of ownership.

## Independent review

Independent Claude must reopen the original institutional and owner sources and verify these outcomes before any social-account correction is made. This research submission does not itself satisfy QA acceptance or check the backlog step.
