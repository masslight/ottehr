import { medicationApplianceLocations, medicationApplianceRoutes } from 'utils';

export const ROUTE_OPTIONS = Object.entries(medicationApplianceRoutes)
  .map(([_, value]) => ({
    value: value.code,
    label: value.display ?? '',
  }))
  ?.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

export const LOCATION_OPTIONS = Object.entries(medicationApplianceLocations)
  .map(([_, value]) => ({
    value: value.code,
    label: value.name ?? '',
  }))
  ?.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
