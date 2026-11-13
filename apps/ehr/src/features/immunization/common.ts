import { RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getEmergencyContactSummary } from 'utils/lib/fhir/emergency-contact';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { EMERGENCY_CONTACT_RELATIONSHIPS } from 'utils/lib/types/api/medication-administration.types';
import { ImmunizationEmergencyContact, ImmunizationOrder } from 'utils/lib/types/data/immunization/types';

export interface AdministrationType {
  type: string;
  label: string;
}

export const ADMINISTERED: AdministrationType = {
  type: 'administered',
  label: 'Administered',
};

export const NOT_ADMINISTERED: AdministrationType = {
  type: 'administered-not',
  label: 'Not Administered',
};

export const PARTLY_ADMINISTERED: AdministrationType = {
  type: 'administered-partly',
  label: 'Partly Administered',
};

export function ordersRecentFirstComparator(orderA: ImmunizationOrder, orderB: ImmunizationOrder): number {
  return (
    DateTime.fromISO(orderB.details.orderedDateTime).toMillis() -
    DateTime.fromISO(orderA.details.orderedDateTime).toMillis()
  );
}

const joinEmergencyContactParts = (parts: (string | undefined)[]): string | undefined => {
  const filled = parts.map((part) => part?.trim()).filter(Boolean);
  return filled.length > 0 ? filled.join(' | ') : undefined;
};

export const formatPaperworkEmergencyContact = (relatedPerson: RelatedPerson | undefined): string | undefined => {
  if (!relatedPerson) return undefined;
  const { relationship, fullName, phone } = getEmergencyContactSummary(relatedPerson);
  return joinEmergencyContactParts([relationship, fullName, formatPhoneNumberDisplay(phone)]);
};

export const formatRecordedEmergencyContact = (
  contact: ImmunizationEmergencyContact | undefined
): string | undefined => {
  if (!contact) return undefined;
  return joinEmergencyContactParts([
    EMERGENCY_CONTACT_RELATIONSHIPS.find((relationship) => relationship.code === contact.relationship)?.display ??
      contact.relationship,
    contact.fullName,
    formatPhoneNumberDisplay(contact.mobile),
  ]);
};
