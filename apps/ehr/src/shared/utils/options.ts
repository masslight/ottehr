import { medicationApplianceLocations, medicationApplianceRoutes } from 'utils';

export const UNIT_OPTIONS = [
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'mL' },
  { value: 'g', label: 'g' },
  { value: 'cc', label: 'cc' },
  { value: 'unit', label: 'unit' },
  { value: 'application', label: 'application' },
];

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
