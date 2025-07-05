import { Reference } from 'fhir/r4b';

export const eligibilityRequirementKeys = [
  'requiresSubscriberId',
  'requiresSubscriberName',
  'requiresSubscriberDOB',
  'requiresRelationshipToSubscriber',
  'requiresInsuranceName',
  'requiresInsuranceCardImage',
  'requiresFacilityNPI',
  'requiresStateUID',
  'enabledEligibilityCheck',
] as const;

export type InsurancePlanRequirementKeys = (typeof eligibilityRequirementKeys)[number];

export type InsurancePlanRequirementKeyBooleans = {
  [key in InsurancePlanRequirementKeys]: boolean;
};

export interface InsurancePlanDTO extends InsurancePlanRequirementKeyBooleans {
  id: string;
  name: string;
  payerId: string;
  ownedBy?: Reference;
}

export interface GetInsurancesResponse {
  insurances: InsurancePlanDTO[];
}
