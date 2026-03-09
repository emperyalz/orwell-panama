import { mutation } from "./_generated/server";

/**
 * Party-code normalisation aliases.
 * The Asamblea voting-record CSVs use abbreviated codes that differ from
 * the official Tribunal Electoral siglas.  This mapping lets us fix them.
 *
 *   PA  → ALZ   (Partido Alianza)
 *   VA  → LP    (Coalición VAMOS — not a party; deputies are Libre Postulación)
 *   MO  → MOCA  (Movimiento Otro Camino)
 *   PN  → PAN   (Partido Panameñista)
 */
const PARTY_CODE_MAP: Record<string, string> = {
  PA: "ALZ",
  VA: "LP",
  MO: "MOCA",
  PN: "PAN",
};

const PARTY_FULL_MAP: Record<string, string> = {
  ALZ: "Partido Alianza",
  LP: "Libre Postulación",
  MOCA: "Movimiento Otro Camino",
  PAN: "Partido Panameñista",
};

/**
 * One-shot migration: normalise legacy party codes across all tables.
 *
 * Tables affected:
 *  • politicians       (party, partyFull)
 *  • deputyVotingProfiles (partyCode)
 *  • deputyBios        (partyCode)
 *
 * Run via the Convex dashboard or CLI:
 *   npx convex run migrations:normalizePartyCodes
 *
 * The mutation is idempotent — running it again is safe.
 */
export const normalizePartyCodes = mutation({
  handler: async (ctx) => {
    const stats = {
      politicians: 0,
      deputyVotingProfiles: 0,
      deputyBios: 0,
    };

    // ─── politicians ───────────────────────────────────────────────────
    const politicians = await ctx.db.query("politicians").collect();
    for (const p of politicians) {
      const newCode = PARTY_CODE_MAP[p.party];
      if (newCode) {
        await ctx.db.patch(p._id, {
          party: newCode,
          partyFull: PARTY_FULL_MAP[newCode] ?? p.partyFull,
          updatedAt: Date.now(),
        });
        stats.politicians++;
      }
    }

    // ─── deputyVotingProfiles ──────────────────────────────────────────
    const profiles = await ctx.db.query("deputyVotingProfiles").collect();
    for (const prof of profiles) {
      const newCode = PARTY_CODE_MAP[prof.partyCode];
      if (newCode) {
        await ctx.db.patch(prof._id, { partyCode: newCode });
        stats.deputyVotingProfiles++;
      }
    }

    // ─── deputyBios ────────────────────────────────────────────────────
    const bios = await ctx.db.query("deputyBios").collect();
    for (const bio of bios) {
      if (bio.partyCode) {
        const newCode = PARTY_CODE_MAP[bio.partyCode];
        if (newCode) {
          await ctx.db.patch(bio._id, { partyCode: newCode });
          stats.deputyBios++;
        }
      }
    }

    // ─── deputyAnalytics (topAllies / topRivals nested partyCode) ─────
    const analytics = await ctx.db.query("deputyAnalytics").collect();
    let analyticsUpdated = 0;
    for (const a of analytics) {
      let changed = false;

      const patchAllies = a.topAllies.map((ally) => {
        const newCode = PARTY_CODE_MAP[ally.partyCode];
        if (newCode) {
          changed = true;
          return { ...ally, partyCode: newCode };
        }
        return ally;
      });

      const patchRivals = a.topRivals.map((rival) => {
        const newCode = PARTY_CODE_MAP[rival.partyCode];
        if (newCode) {
          changed = true;
          return { ...rival, partyCode: newCode };
        }
        return rival;
      });

      if (changed) {
        await ctx.db.patch(a._id, {
          topAllies: patchAllies,
          topRivals: patchRivals,
          updatedAt: Date.now(),
        });
        analyticsUpdated++;
      }
    }

    return {
      message: "Party code normalisation complete",
      updated: { ...stats, deputyAnalytics: analyticsUpdated },
    };
  },
});
