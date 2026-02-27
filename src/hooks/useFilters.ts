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

  const filtered = useMemo(() => {
    return politicians.filter((p) => {
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
  }, [politicians, filters]);

  const hasActiveFilters = !!(
    filters.search ||
    filters.role ||
    filters.province ||
    filters.party
  );

  return { filters, setFilter, resetFilters, filtered, hasActiveFilters };
}
