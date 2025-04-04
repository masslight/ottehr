import { Location } from 'fhir/r4b';

export const isLocationVirtual = (location: Location): boolean => {
  return location.extension?.[0].valueCoding?.code === 'vi';
};
