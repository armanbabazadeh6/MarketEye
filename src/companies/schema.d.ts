/** Domain contracts for curated records. Numeric screening weights use [0, 1]. */
export interface Provenance {
  source: string;
  sourceUrl: string;
  confidence: number;
}
export interface GeoPoint {
  latitude: number;
  longitude: number;
}
export interface CompanyLocation extends GeoPoint, Provenance {
  id: string;
  name: string;
  region: string;
  type:
    | "headquarters"
    | "office"
    | "factory"
    | "supplier"
    | "datacenter"
    | "port"
    | "airport"
    | "mine"
    | "logistics"
    | "infrastructure";
  importance: number;
  description: string;
  relationship: "confirmed" | "supplier-context" | "context-only";
  supplierId?: string;
  dependencyId?: string;
}
export interface SupplierRelationship extends Provenance {
  id: string;
  name: string;
  category: string;
  criticality: number;
  locationIds: string[];
  statement: string;
}
export interface CompanyDependency {
  id: string;
  name: string;
  importance: number;
  supplierId?: string;
  potentialImpact: string;
}
export interface Company {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  description: string;
  thesis: string;
  color: string;
  reviewedAt: string;
  coordinatePolicy: string;
  focus: GeoPoint & { height: number };
  locations: CompanyLocation[];
  suppliers: SupplierRelationship[];
  dependencies: CompanyDependency[];
  regions: { name: string; role: string; level: string }[];
  unknowns: string[];
}
export interface MarketEvent extends GeoPoint, Provenance {
  id: string;
  type:
    | "earthquake"
    | "weather"
    | "shipping"
    | "fire"
    | "airport"
    | "infrastructure"
    | "geopolitical"
    | "news"
    | "other";
  title: string;
  description: string;
  severity: number;
  radiusKm: number;
  timestamp: string;
  evidenceType: "observation" | "model-estimate" | "historical observation";
  stale?: boolean;
  metadata: Record<string, unknown>;
}
export interface CompanyExposure {
  companyTicker: string;
  eventId: string;
  score: number;
  severity: "low" | "medium" | "high" | "critical";
  distanceKm: number;
  affectedLocations: string[];
  affectedDependencies: string[];
  positiveFactors: string[];
  mitigatingFactors: string[];
  confidence: number;
  explanation: string;
  unknowns: string[];
  factors: {
    severity: number;
    proximity: number;
    importance: number;
    confidence: number;
    freshness: number;
  };
}
