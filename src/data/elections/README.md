# Official 2024 election identities

`results-2024.json` preserves the Tribunal Electoral winner records and their original source CSV links. `profile-links-2024.json` contains reviewed, one-to-one directory identity links, including provenance for names that differ from the directory.

The reviewed mapping covers all 71 deputies and the seven mayors already in the directory. It restores 24 connections lost by exact-name matching. The other 74 mayor records remain in the election explorer without invented directory profiles.

The matcher requires the reviewed directory ID, normalized directory name, election ID, exact official name, office type and official territory to agree. It fails closed if an identity changes. Unreviewed records retain conservative exact-name and territory matching. The official dataset page and published PDF report are canonical sources; no individual Tribunal profile URL has been verified.

Two reviewed records, Lenin Ulate and Manuel Cheng, have circuit 13-1 in the official election and Assembly records, while the current directory stores 13-3. Their manifest notes record that conflict. This mapping does not silently edit directory metadata.

Validation: `node scripts/verify-election-links.cjs` tests unique attribution, all deputies, unchanged official names, office/name safeguards and official PDF links. The browser check must confirm 71 deputy portraits and profile links and the branded source link in a matched person's Profile and Career views before completion is recorded on the scoreboard.
