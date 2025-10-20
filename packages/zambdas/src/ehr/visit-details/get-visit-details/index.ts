import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Consent,
  DocumentReference,
  Encounter,
  Flag,
  Location,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Schedule,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ConsentDetails,
  DISPLAY_DATE_FORMAT,
  EHRVisitDetails,
  FHIR_RESOURCE_NOT_FOUND,
  flattenQuestionnaireAnswers,
  getConsentAndRelatedDocRefsForAppointment,
  getEmailForIndividual,
  getFullestAvailableName,
  getNameFromScheduleResource,
  getSecret,
  getTimezone,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PersistedFhirResource,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
  Timezone,
  TIMEZONES,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

const ZAMBDA_NAME = 'get-visit-details';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const effectInput = await complexValidation(validatedParameters, oystehr);
    console.debug('complexValidation success', JSON.stringify(effectInput));

    const resources = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(resources),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = (input: EffectInput): EHRVisitDetails => {
  const { appointment, patient, encounter, flags, consents, qr, location, schedule, scheduleOwner, guarantorResource } =
    input;

  const firstConsent = consents && consents.length > 0 ? consents[0] : undefined;

  let visitTimezone: Timezone = TIMEZONES[0];

  if (schedule) {
    visitTimezone = getTimezone(schedule);
  } else if (location) {
    visitTimezone = getTimezone(location);
  }

  let responsiblePartyName: string | null = null;
  let responsiblePartyEmail: string | null = null;
  if (guarantorResource) {
    responsiblePartyName = getFullestAvailableName(guarantorResource) || null;
    responsiblePartyEmail = getEmailForIndividual(guarantorResource) || null;
  }

  const output: EHRVisitDetails = {
    appointment,
    patient,
    encounter,
    flags,
    visitTimezone,
    visitLocationName: undefined,
    consentDetails: firstConsent ? makeConsentDetails(firstConsent, visitTimezone, qr) : null,
    qrId: qr.id,
    visitLocationId: location?.id,
    responsiblePartyName,
    responsiblePartyEmail,
  };

  if (schedule) {
    output.visitTimezone = getTimezone(schedule);
  } else if (location) {
    output.visitTimezone = getTimezone(location);
  }

  if (scheduleOwner) {
    output.visitLocationName = getNameFromScheduleResource(scheduleOwner) || undefined;
  }

  return output;
};

interface EffectInput {
  appointment: Appointment;
  patient: Patient;
  encounter: Encounter;
  flags: Flag[];
  qr: PersistedFhirResource<QuestionnaireResponse>;
  consents?: Consent[];
  docRefs?: DocumentReference[];
  schedule?: Schedule;
  scheduleOwner?: ScheduleOwnerFhirResource;
  location?: Location;
  guarantorResource?: Patient | RelatedPerson | undefined;
}

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<EffectInput> => {
  const { appointmentId } = input;

  const searchResults = (
    await oystehr.fhir.search<
      Appointment | Patient | Encounter | Flag | Consent | QuestionnaireResponse | Location | Schedule
    >({
      resourceType: 'Appointment',
      params: [
        { name: '_id', value: appointmentId },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_include',
          value: 'Appointment:location',
        },
        {
          name: '_include',
          value: 'Appointment:slot',
        },
        {
          name: '_revinclude:iterate',
          value: 'Encounter:appointment',
        },
        { name: '_revinclude:iterate', value: 'Flag:encounter' },
        { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
        {
          name: '_include:iterate',
          value: 'Slot:schedule',
        },
      ],
    })
  ).unbundle();
  const appointment = searchResults.find((resource) => resource.resourceType === 'Appointment') as Appointment;
  const patient = searchResults.find((resource) => resource.resourceType === 'Patient') as Patient;
  const encounter = searchResults.find((resource) => resource.resourceType === 'Encounter') as Encounter;
  const location = searchResults.find((resource) => resource.resourceType === 'Location') as Location | undefined;
  const flags = searchResults.filter((resource) => resource.resourceType === 'Flag') as Flag[];
  const qr = searchResults.find(
    (resource) => resource.resourceType === 'QuestionnaireResponse'
  ) as PersistedFhirResource<QuestionnaireResponse>;
  const schedule = searchResults.find((resource) => resource.resourceType === 'Schedule') as Schedule | undefined;

  if (!appointment) {
    throw FHIR_RESOURCE_NOT_FOUND('Appointment');
  }
  if (!patient || !patient.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  if (!encounter || !encounter.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }
  if (!qr || !qr.id) {
    throw FHIR_RESOURCE_NOT_FOUND('QuestionnaireResponse');
  }

  let scheduleOwner: ScheduleOwnerFhirResource | undefined = undefined;

  if (schedule?.actor && schedule.actor.length > 0 && schedule.actor[0].reference) {
    const [resourceType, id] = schedule.actor[0].reference.split('/');
    if (resourceType && id) {
      scheduleOwner = searchResults.find((resource) => resource.resourceType === resourceType && resource.id === id) as
        | ScheduleOwnerFhirResource
        | undefined;
    }
  }

  const [docRefsAndConsents, accountResources] = await Promise.all([
    getConsentAndRelatedDocRefsForAppointment(
      {
        appointmentId,
        patientId: patient.id,
      },
      oystehr
    ),
    getAccountAndCoverageResourcesForPatient(patient.id, oystehr),
  ]);
  const { guarantorResource } = accountResources;
  return {
    appointment,
    patient,
    encounter,
    flags,
    qr,
    location,
    schedule,
    scheduleOwner,
    guarantorResource,
    ...docRefsAndConsents,
  };
};

const makeConsentDetails = (
  consent: Consent,
  timezone: Timezone,
  questionnaireResponse: QuestionnaireResponse
): ConsentDetails | null => {
  const flattenedPaperwork = flattenQuestionnaireAnswers(questionnaireResponse.item || []);
  const signature = flattenedPaperwork.find((item) => item.linkId === 'signature')?.answer?.[0]?.valueString;
  const fullName = flattenedPaperwork.find((question) => question.linkId === 'full-name')?.answer?.[0]?.valueString;
  const relationshipToPatient = flattenedPaperwork.find(
    (question) => question.linkId === 'consent-form-signer-relationship'
  )?.answer?.[0]?.valueString;

  const ipAddress = questionnaireResponse?.extension?.find(
    (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'
  )?.valueString;

  // todo: check if consent has contained signer data  https://github.com/masslight/ottehr/issues/4376

  const dateISO = consent.dateTime;
  let date: string | undefined = undefined;

  if (dateISO) {
    date = DateTime.fromISO(dateISO).setZone(timezone).toFormat(DISPLAY_DATE_FORMAT);
  }

  if (signature && fullName && relationshipToPatient && date) {
    return {
      signature,
      fullName,
      relationshipToPatient,
      date,
      ipAddress,
    };
  }

  return null;
};

interface Input {
  userToken: string;
  appointmentId: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
  // at some point and it should always be available, so throwing it in the input interface anticipatorily
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { appointmentId } = JSON.parse(input.body);

  if (!appointmentId) {
    throw MISSING_REQUIRED_PARAMETERS(['appointmentId']);
  }

  if (isValidUUID(appointmentId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('appointmentId');
  }

  return {
    secrets,
    userToken,
    appointmentId,
  };
};
