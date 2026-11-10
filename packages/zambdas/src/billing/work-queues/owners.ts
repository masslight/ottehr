import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { RoleType } from 'utils/lib/types/api/user.types';
import { WorkQueueOwner } from 'utils/lib/types/data/billing/work-queue.schemas';
import { getRoleMembers } from '../../shared/users.helper';
import { fhirName } from '../shared';

const PRACTITIONER_PREFIX = 'Practitioner/';

/**
 * The users a work queue can be assigned to: everyone with the Billing Admin role, identified by
 * their Practitioner profile and named from it (falling back to the user's name). `projectClient`
 * lists the role's users; `fhirClient` reads their Practitioners, which belong to the EHR rather
 * than the billing workspace, so it must not filter searches to billing-tagged resources.
 */
export async function listWorkQueueOwners(projectClient: Oystehr, fhirClient: Oystehr): Promise<WorkQueueOwner[]> {
  const role = (await projectClient.role.list()).find((r) => r.name === RoleType.BillingAdmin);
  if (!role) return [];

  const members = (await getRoleMembers(role.id, projectClient)).filter(
    (m) => m.profile?.startsWith(PRACTITIONER_PREFIX)
  );
  if (members.length === 0) return [];

  const practitionerIds = members.map((m) => m.profile!.slice(PRACTITIONER_PREFIX.length));
  const practitioners = await getAllFhirSearchPages<Practitioner>(
    {
      resourceType: 'Practitioner',
      params: [
        { name: '_id', value: practitionerIds.join(',') },
        { name: '_elements', value: 'id,name' },
      ],
    },
    fhirClient,
    practitionerIds.length
  );
  const nameById = new Map(practitioners.map((p) => [p.id, fhirName(p)]));

  return members
    .map((member, index) => ({
      practitionerId: practitionerIds[index],
      name: nameById.get(practitionerIds[index]) || member.name || practitionerIds[index],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
