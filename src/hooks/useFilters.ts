"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMemo, useCallback } from "react";
import type { Politician, FilterState } from "@/lib/types";

export function useFilters(politicians: Politician[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: FilterState = {
    search: searchParams.get("search") || "",
    role: (searchParams.get("role") as FilterState["role"]) || "",
    province: searchParams.get("province") || "",
    party: searchParams.get("party") || "",
    sort: (searchParams.get("sort") as FilterState["sort"]) || "",
  };

  const setFilter = useCallback(
    (key: keyof FilterState, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const RANK_ORDER: Record<string, number> = {
    President: 0,
    Governor: 1,
    Mayor: 2,
    Deputy: 3,
  };

  const filtered = useMemo(() => {
    const results = politicians.filter((p) => {
      if (
        filters.search &&
        !p.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      if (filters.role && p.roleCategory !== filters.role) return false;
      if (filters.province && p.province !== filters.province) return false;
      if (filters.party && p.party !== filters.party) return false;
      return true;
    });

    const sort = filters.sort || "rank";
    return [...results].sort((a, b) => {
      switch (sort) {
        case "rank":
          return (RANK_ORDER[a.roleCategory] ?? 9) - (RANK_ORDER[b.roleCategory] ?? 9);
        case "firstName_asc":
          return a.name.split(" ")[0].localeCompare(b.name.split(" ")[0]);
        case "firstName_desc":
          return b.name.split(" ")[0].localeCompare(a.name.split(" ")[0]);
        case "lastName_asc":
          return a.name.split(" ").slice(-1)[0].localeCompare(b.name.split(" ").slice(-1)[0]);
        case "lastName_desc":
          return b.name.split(" ").slice(-1)[0].localeCompare(a.name.split(" ").slice(-1)[0]);
        case "role_asc":
          return a.role.localeCompare(b.role);
        case "role_desc":
          return b.role.localeCompare(a.role);
        case "province_asc":
          return a.province.localeCompare(b.province);
        case "province_desc":
          return b.province.localeCompare(a.province);
        case "party_asc":
          return a.party.localeCompare(b.party);
        case "party_desc":
          return b.party.localeCompare(a.party);
        default:
          return 0;
      }
    });
  }, [politicians, filters]);

  const hasActiveFilters = !!(
    filters.search ||
    filters.role ||
    filters.province ||
    filters.party
  );

  return { filters, setFilter, resetFilters, filtered, hasActiveFilters };
}
