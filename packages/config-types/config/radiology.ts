/**
 * Radiology Configuration Types
 *
 * These types define the contract for radiology study configurations,
 * based on FHIR Coding structures with CPT codes.
 */

/**
 * Radiology study item with code and display name
 * Based on FHIR Coding structure
 */
export interface RadiologyStudy {
  code?: string;
  display?: string;
}

/**
 * Full radiology configuration is an array of studies
 */
export type RadiologyConfig = RadiologyStudy[];
