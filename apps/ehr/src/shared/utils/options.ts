import {
  inHouseMedicationsMedicationApplianceRoutes,
  medicationApplianceLocations,
  medicationApplianceRoutes,
} from 'utils/lib/types/api/medication-administration.types';

export const BASE_ROUTE_OPTIONS = Object.entries(medicationApplianceRoutes)
  .map(([_, value]) => ({
    code: value.code,
    name: value.display ?? '',
  }))
  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

export const IN_HOUSE_MEDICATION_ROUTE_OPTIONS = Object.entries(inHouseMedicationsMedicationApplianceRoutes)
  .map(([_, value]) => ({
    code: value.code,
    name: value.display ?? '',
  }))
  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

export const LOCATION_OPTIONS = Object.entries(medicationApplianceLocations)
  .map(([_, value]) => ({
    code: value.code,
    name: value.name ?? '',
  }))
  ?.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
