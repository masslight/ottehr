import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Practitioner } from 'fhir/r4b';
import {
  FaxRecipient,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  GetFaxPacketPreviewOutput,
  getFullestAvailableName,
  PRACTICE_NAME_URL,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { resolveFaxDocumentAvailability } from '../../shared/fax/collect-visit-documents';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-fax-packet-preview';

/** The contained Practitioner id `getPCPPatchOps` writes the patient's primary care physician under. */
const CONTAINED_PCP_ID = 'primary-care-physician';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);
  console.log('get-fax-packet-preview for appointment', validatedInput.appointmentId);

  const authorization = input.headers.Authorization;
  await getUser(authorization.replace('Bearer ', ''), validatedInput.secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

  const output = await performEffect(validatedInput.appointmentId, oystehr);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export const findContainedPcp = (patient: Patient | undefined): Practitioner | undefined =>
  patient?.contained?.find(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.id === CONTAINED_PCP_ID
  );

export const mapPcpToRecipient = (pcp: Practitioner | undefined): FaxRecipient | undefined => {
  if (!pcp) return undefined;

  const faxNumber = pcp.telecom?.find((telecom) => telecom.system === 'fax')?.value?.trim();

  if (!faxNumber) return undefined;

  return {
    name: pcp.name?.length ? getFullestAvailableName(pcp) : undefined,
    organization: pcp.extension?.find((extension) => extension.url === PRACTICE_NAME_URL)?.valueString?.trim(),
    faxNumber,
    phoneNumber: pcp.telecom?.find((telecom) => telecom.system === 'phone')?.value?.trim(),
  };
};

export const performEffect = async (appointmentId: string, oystehr: Oystehr): Promise<GetFaxPacketPreviewOutput> => {
  const resources = (
    await oystehr.fhir.search<Encounter | Appointment | Patient>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: `Appointment/${appointmentId}` },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_include', value: 'Encounter:subject' },
      ],
    })
  ).unbundle();

  const encounter = resources.find((resource): resource is Encounter => resource.resourceType === 'Encounter');
  const appointment = resources.find((resource): resource is Appointment => resource.resourceType === 'Appointment');
  const patient = resources.find((resource): resource is Patient => resource.resourceType === 'Patient');

  if (!appointment?.id || !encounter?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No encounter found for appointment ${appointmentId}`);
  }

  const documents = await resolveFaxDocumentAvailability({
    oystehr,
    appointmentId: appointment.id,
    encounterId: encounter.id,
  });

  const containedPcp = findContainedPcp(patient);
  // A deactivated PCP is not offered as a prefill and does not count as "on file".
  const hasSavedPcp = Boolean(containedPcp && containedPcp.active !== false);

  return {
    documents,
    pcp: hasSavedPcp ? mapPcpToRecipient(containedPcp) : undefined,
    hasSavedPcp,
  };
};
