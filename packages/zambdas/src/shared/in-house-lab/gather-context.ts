import Oystehr from '@oystehr/sdk';
import { Account, Coverage, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import { CreateInHouseLabEnconuterResource, getAttendingPractitionerId, getFullestAvailableName, Secrets } from 'utils';
import { accountIsPatientBill, getPrimaryInsurance } from '../../ehr/lab/shared/labs';
import { TemplateEncounterResource } from '../../ehr/shared/template-helpers';
import { getMyPractitionerId } from '..';

export interface InHouseLabOrderContext {
  encounter: Encounter;
  patient: Patient;
  coverage: Coverage | undefined;
  location: Location | undefined;
  attendingPractitionerId: string;
  attendingPractitionerName: string | undefined;
  currentUserPractitionerId: string;
  currentUserPractitionerName: string | undefined;
}

/**
 * Fetches everything the shared in-house-lab order builder needs about a visit
 * and the user placing the order:
 *
 *   - The Encounter and its Patient/Location.
 *   - The active Coverage (selected via the patient's Account).
 *   - The Encounter's attending Practitioner (id + display name).
 *   - The current user's Practitioner (id + display name), resolved from the
 *     authenticated user's token.
 *
 * The create-in-house-lab-order zambda and apply-template both need this same
 * context, so it lives next to build-order.ts. Throws if any of the strictly
 * required resources (Encounter, Patient, Account, attending Practitioner,
 * user Practitioner) can't be resolved - those represent misconfiguration
 * that should surface as a clear error rather than silently producing a
 * malformed order.
 *
 * Only grabs the patient billing account.
 */
export async function gatherInHouseLabOrderContext(input: {
  oystehr: Oystehr;
  encounterId: string;
  encounterResources: TemplateEncounterResource[] | CreateInHouseLabEnconuterResource[];
  userToken: string;
  secrets: Secrets | null;
}): Promise<InHouseLabOrderContext> {
  const { oystehr, encounterId, userToken, secrets, encounterResources } = input;

  const currentUserPractitionerIdPromise = async (): Promise<string> => {
    try {
      return await getMyPractitionerId(userToken, secrets);
    } catch {
      throw new Error(
        'Resource configuration error - user placing this in-house lab order must have a Practitioner resource linked'
      );
    }
  };

  const currentUserPractitionerId = await currentUserPractitionerIdPromise();

  const encounters: Encounter[] = [];
  const patients: Patient[] = [];
  const locations: Location[] = [];
  const coverages: Coverage[] = [];
  const accounts: Account[] = [];
  for (const resource of encounterResources) {
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    else if (resource.resourceType === 'Patient') patients.push(resource);
    else if (resource.resourceType === 'Location') locations.push(resource);
    else if (resource.resourceType === 'Coverage' && resource.status === 'active') coverages.push(resource);
    else if (resource.resourceType === 'Account' && resource.status === 'active' && accountIsPatientBill(resource)) {
      accounts.push(resource);
    }
  }

  const encounter = encounters.find((e) => e.id === encounterId);
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  if (patients.length !== 1) {
    throw new Error(`Patient not found, results contain ${patients.length} patients`);
  }
  const patient = patients[0];

  if (accounts.length !== 1) {
    throw new Error(`Account not found, results contain ${accounts.length} accounts`);
  }
  const account = accounts[0];

  const attendingPractitionerId = getAttendingPractitionerId(encounter);
  if (!attendingPractitionerId) throw new Error('Attending practitioner not found on encounter');

  const [currentUserPractitioner, attendingPractitioner] = await Promise.all([
    oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: currentUserPractitionerId }),
    oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: attendingPractitionerId }),
  ]);

  return {
    encounter,
    patient,
    coverage: getPrimaryInsurance(account, coverages),
    location: locations[0],
    attendingPractitionerId,
    attendingPractitionerName: getFullestAvailableName(attendingPractitioner),
    currentUserPractitionerId,
    currentUserPractitionerName: getFullestAvailableName(currentUserPractitioner),
  };
}
