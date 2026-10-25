import type { PatentRecord, Paper, ProviderCapability } from "./types";
export type VerificationTier = "A" | "B" | "C" | "D";
export type PatentSearchQuery = {
  text: string;
  jurisdictions?: string[];
  page?: number;
  pageSize?: number;
  language?: string;
};
export type PatentSearchResult = {
  records: PatentRecord[];
  nextPage?: number;
  total?: number;
  warnings: string[];
};
export type PatentClaim = {
  publicationNumber: string;
  text: string;
  claimNumber?: number;
  sourceUrl: string;
  retrievedAt: string;
};
export type PatentLegalStatus = {
  status: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  limitations: string[];
};
export type PatentCitation = {
  from: string;
  to: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
};
export interface PatentProvider {
  id: string;
  name: string;
  jurisdictions: string[];
  authentication: "none" | "required" | "unknown";
  verification: "verified" | "documented" | "experimental";
  capabilities: ProviderCapability[];
  search?: (query: PatentSearchQuery) => Promise<PatentSearchResult>;
  getPatent?: (id: string) => Promise<PatentRecord>;
  getClaims?: (id: string) => Promise<PatentClaim[]>;
  getLegalStatus?: (id: string) => Promise<PatentLegalStatus>;
  getCitations?: (id: string) => Promise<PatentCitation[]>;
}
export interface ResearchProvider {
  id: string;
  search: (text: string, page?: number) => Promise<Paper[]>;
}
export type OrganizationRecord = {
  id: string;
  name: string;
  country?: string;
  aliases: string[];
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  relationships?: { type: string; id: string; name?: string }[];
};
export interface OrganizationProvider {
  id: string;
  search: (name: string) => Promise<OrganizationRecord[]>;
}
export type PatentReference = {
  publicationNumber: string;
  jurisdiction: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
};
export type CitationRecord = {
  id: string;
  citing: string;
  cited: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
};
export type PatentGraphRecord = {
  applicationNumber: string;
  filingDate?: string;
  familyId?: string;
  publications: { number: string; date?: string; url: string }[];
  classifications: string[];
  source: string;
  sourceUrl: string;
  retrievedAt: string;
};
