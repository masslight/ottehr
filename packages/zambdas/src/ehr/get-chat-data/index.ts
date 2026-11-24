import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location, Person, RelatedPerson } from 'fhir/r4b';
import { LOCATION_REVIEW_LINK_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getSMSNumberForIndividual } from 'utils/lib/fhir/patient';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { ChatVisitData, GetChatDataInputSchema, GetChatDataResponse } from 'utils/lib/types/api/chat-data.types';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { buildSmsRecipients, isUserRelatedPerson } from '../../shared/chat-recipients';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { lambdaResponse } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getPersonPhone } from '../patient-account/get-login-phone-numbers';

const ZAMBDA_NAME = 'get-chat-data';

let m2mToken: string;

type GetChatDataParams = ValidatedZambdaInput<typeof GetChatDataInputSchema>;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(GetChatDataInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  return lambdaResponse(200, await performEffect(oystehr, params));
});

export const performEffect = async (oystehr: Oystehr, params: GetChatDataParams): Promise<GetChatDataResponse> => {
  const { patientId, encounterId } = params;
  const [recipients, visit] = await Promise.all([
    getRecipients(oystehr, patientId),
    encounterId ? getVisitData(oystehr, patientId, encounterId) : undefined,
  ]);
  return { recipients, ...(visit ? { visit } : {}) };
};

const getRecipients = async (oystehr: Oystehr, patientId: string): Promise<GetChatDataResponse['recipients']> => {
  const resources = (
    await oystehr.fhir.search<RelatedPerson | Person>({
      resourceType: 'RelatedPerson',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: 'relationship', value: 'user-relatedperson' },
        { name: '_revinclude', value: 'Person:link' },
      ],
    })
  ).unbundle();

  const relatedPersons = resources.filter(
    (resource): resource is RelatedPerson =>
      resource.resourceType === 'RelatedPerson' &&
      Boolean(resource.id) &&
      resource.patient?.reference === `Patient/${patientId}` &&
      isUserRelatedPerson(resource)
  );

  const phonesByRelatedPersonRef: Record<string, Set<string>> = {};
  const addPhone = (ref: string, phone: string | undefined): void => {
    if (phone) (phonesByRelatedPersonRef[ref] ??= new Set<string>()).add(phone);
  };
  relatedPersons.forEach((rp) => addPhone(`RelatedPerson/${rp.id}`, getSMSNumberForIndividual(rp)));
  resources.forEach((resource) => {
    if (resource.resourceType !== 'Person') return;
    const phone = getPersonPhone(resource);
    resource.link?.forEach((link) => {
      const ref = link.target?.reference;
      if (ref?.startsWith('RelatedPerson/')) addPhone(ref, phone);
    });
  });

  return buildSmsRecipients(relatedPersons, phonesByRelatedPersonRef);
};

const getVisitData = async (
  oystehr: Oystehr,
  patientId: string,
  encounterId: string
): Promise<ChatVisitData | undefined> => {
  const resources = (
    await oystehr.fhir.search<Encounter | Appointment | Location>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:location' },
        { name: '_include', value: 'Encounter:appointment' },
      ],
    })
  ).unbundle();

  // The encounter must be this patient's, so a caller can't read another patient's visit through this endpoint.
  const encounter = resources.find((r): r is Encounter => r.resourceType === 'Encounter');
  if (encounter?.subject?.reference !== `Patient/${patientId}`) return undefined;

  const location = resources.find((r): r is Location => r.resourceType === 'Location');
  const appointment = resources.find((r): r is Appointment => r.resourceType === 'Appointment');

  return {
    appointmentStart: appointment?.start,
    locationName: location?.name,
    locationReviewLink: location?.extension?.find((ext) => ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL)?.valueUrl,
    officePhone: standardizePhoneNumber(location?.telecom?.find((t) => t.system === 'phone')?.value),
    supportPhone: location?.extension?.find((ext) => ext.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString,
  };
};
