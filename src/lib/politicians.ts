import politiciansData from "@/data/politicians.json";
import type { Politician } from "./types";

const politicians: Politician[] = politiciansData as unknown as Politician[];

export function getAllPoliticians(): Politician[] {
  return politicians;
}

export function getPoliticianById(id: string): Politician | undefined {
  return politicians.find((p) => p.id === id);
}

export function getPoliticianBySlug(slug: string): Politician | undefined {
  return politicians.find((p) => p.slug === slug);
}

export function getAllPoliticianIds(): string[] {
  return politicians.map((p) => p.id);
}

export function getUniqueParties(): string[] {
  return [...new Set(politicians.map((p) => p.party))].sort();
}

export function getUniqueProvinces(): string[] {
  return [...new Set(politicians.map((p) => p.province))].filter(Boolean).sort();
}

export function getTotalAccounts(): number {
  return politicians.reduce((sum, p) => sum + p.accounts.length, 0);
}
