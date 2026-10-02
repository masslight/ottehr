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

/**
 * Preliminary-read suggestion templates. A template's text carries `{blank}` tokens, each naming a choice
 * list; `{side}` is filled from the order's laterality instead.
 */
export interface PreliminaryReadChoiceList {
  /** Popover heading */
  title: string;
  /** Most common first; `''` renders as "(none)" and contributes nothing to the sentence */
  options: string[];
  /** Starting value for a patient under 18 (defaults to the first option) */
  childDefault?: string;
  /** Dropped from the template entirely for adult patients */
  childOnly?: boolean;
  /** Entries of `options` offered only for patients under 18 (pediatric fracture types); removed for adults */
  childOnlyOptions?: string[];
}

export interface PreliminaryReadTemplate {
  name: string;
  text: string;
}

export interface PreliminaryReadRegion {
  name: string;
  /** Base CPT codes (no laterality suffix) that use this region's templates */
  cptCodes: string[];
  /** Negative read first, then the positive reads */
  templates: PreliminaryReadTemplate[];
}

export interface PreliminaryReadTemplatesConfig {
  choices: Record<string, PreliminaryReadChoiceList>;
  regions: PreliminaryReadRegion[];
}
