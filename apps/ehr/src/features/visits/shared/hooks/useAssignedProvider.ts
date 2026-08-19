import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { EmployeeDetails, isProvider } from 'utils/lib/types/api/get-employees/get-employees.types';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { toProviderDetails, useGetEmployeesWithDetails } from './useGetEmployees';

export interface AssignedProvider {
  /** Practitioner id referenced by the encounter's Attender participant, if any. */
  assignedProviderId?: string;
  /** Employee record behind that Practitioner, when it could be resolved. */
  assignedProviderEmployee?: EmployeeDetails;
  /** Display name for the assigned provider, for use in messages. Empty when unresolved. */
  assignedProviderName: string;
  /** True when a provider is assigned and still holds the Provider role. */
  isAssignedProviderEligible: boolean;
  /** True when someone is assigned but has since lost the Provider role — a stale assignment. */
  isAssignedProviderStale: boolean;
}

/**
 * Resolves the encounter's assigned provider (the Attender participant) and whether that assignment
 * is still valid.
 *
 * Changing an employee's role from Provider to something else (e.g. Clinician) does not touch the
 * encounter, so the Attender participant lingers and a bare presence check on it keeps reporting an
 * assigned provider. The role is the thing that actually decides who may hold the slot, so read it
 * rather than the participant alone — otherwise the visit stays chartable and signable under a
 * provider who can no longer be selected as one.
 */
export const useAssignedProvider = (): AssignedProvider => {
  const { encounter } = useAppointmentData();
  const { data: employees } = useGetEmployeesWithDetails();

  const assignedProviderId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  const assignedProviderEmployee = assignedProviderId
    ? employees?.all.find((employee) => employee.profile === `Practitioner/${assignedProviderId}`)
    : undefined;

  // Fail open when the employee list hasn't resolved (still loading, request failed, or no zambda
  // client): a slow or broken employee fetch must never lock charting on an otherwise valid visit.
  // Only a positively-resolved employee who no longer holds the Provider role blocks the flow.
  const isAssignedProviderStale = assignedProviderEmployee ? !isProvider(assignedProviderEmployee) : false;

  return {
    assignedProviderId,
    assignedProviderEmployee,
    assignedProviderName: assignedProviderEmployee ? toProviderDetails(assignedProviderEmployee).name : '',
    isAssignedProviderEligible: Boolean(assignedProviderId) && !isAssignedProviderStale,
    isAssignedProviderStale,
  };
};
