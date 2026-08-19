import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { EmployeeDetails } from 'utils/lib/types/api/get-employees/get-employees.types';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { toProviderDetails, useGetEmployeesWithDetails } from './useGetEmployees';

export interface AssignedProvider {
  /** Practitioner id referenced by the encounter's Attender participant, if any. */
  assignedProviderId?: string;
  /** Employee record behind that Practitioner, when it could be resolved. */
  assignedProviderEmployee?: EmployeeDetails;
  /** Display name for the assigned provider, for use in messages. Empty when unresolved. */
  assignedProviderName: string;
  /** True when a provider is assigned and can still be selected as one. */
  isAssignedProviderEligible: boolean;
  /** True when someone is assigned but can no longer be selected as a provider — a stale assignment. */
  isAssignedProviderStale: boolean;
}

/**
 * Resolves the encounter's assigned provider (the Attender participant) and whether that assignment
 * is still valid.
 *
 * Neither a role change nor a deactivation touches the encounter, so the Attender participant
 * lingers and a bare presence check on it keeps reporting an assigned provider — while the header's
 * Provider picker, which lists only assignable providers, renders blank. That gap is the bug: the
 * visit looks unassigned but stays chartable and signable.
 *
 * Eligibility is therefore membership of the provider roster rather than a hand-rolled role check.
 * `providers` is the exact list the picker offers, so the gate and the dropdown cannot drift apart —
 * it already encodes "holds the Provider role, is Active, and isn't customer support", and it will
 * keep encoding whatever that list means in future.
 */
export const useAssignedProvider = (): AssignedProvider => {
  const { encounter } = useAppointmentData();
  const { data: employees } = useGetEmployeesWithDetails();

  const assignedProviderId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  const assignedProviderProfile = assignedProviderId ? `Practitioner/${assignedProviderId}` : undefined;

  // Looked up in `all` rather than `providers` so an assignee who has dropped off the roster is
  // still resolvable — that is what separates "no longer assignable" from "not an employee at all",
  // and it supplies the name for the alert.
  const assignedProviderEmployee = assignedProviderProfile
    ? employees?.all.find((employee) => employee.profile === assignedProviderProfile)
    : undefined;
  const isOnProviderRoster =
    employees?.providers.some((provider) => provider.profile === assignedProviderProfile) ?? false;

  // Fail open when the employee list hasn't resolved (still loading, request failed, or no zambda
  // client): a slow or broken employee fetch must never lock charting on an otherwise valid visit.
  // Only an employee we positively resolved and who is off the roster blocks the flow.
  const isAssignedProviderStale = Boolean(assignedProviderEmployee) && !isOnProviderRoster;

  return {
    assignedProviderId,
    assignedProviderEmployee,
    assignedProviderName: assignedProviderEmployee ? toProviderDetails(assignedProviderEmployee).name : '',
    isAssignedProviderEligible: Boolean(assignedProviderId) && !isAssignedProviderStale,
    isAssignedProviderStale,
  };
};
