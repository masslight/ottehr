import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BOOKING_CONFIG,
  CONSENT_ATTESTATION_SIG_TYPE,
  DOB_DATE_FORMAT,
  EHRVisitDetails,
  FHIR_EXTENSION,
  getAttestedConsentFromEncounter,
  getReasonForVisitAndAdditionalDetailsFromAppointment,
  getReasonForVisitFromAppointment,
  getUnconfirmedDOBIdx,
  isValidUUID,
  REASON_ADDITIONAL_MAX_CHAR,
  UpdateVisitDetailsInput,
} from 'utils';
import { assert, inject } from 'vitest';
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import QRInput from '../data/questionnaire-response-1.json';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';
import { cleanupTestScheduleResources, makeTestPatient, persistTestPatient } from '../helpers/testScheduleUtils';

describe('saving and getting visit details', () => {
  let oystehr: Oystehr;
  let token: string;
  let processId: string;

  interface MakeTestResourcesParams {
    processId: string;
    oystehr: Oystehr;
    addDays?: number;
    existingPatientId?: string;
    patientAge?: { units: 'years' | 'months'; value: number };
    patientSex?: 'male' | 'female';
    unconfirmedDob?: string;
  }

  const makeTestResources = async ({
    processId,
    oystehr,
    addDays = 0,
    patientAge,
    existingPatientId,
    patientSex,
    unconfirmedDob,
  }: MakeTestResourcesParams): Promise<{
    encounter: Encounter;
    appointment: Appointment;
    qr: QuestionnaireResponse;
    patient?: Patient;
  }> => {
    let patientId = existingPatientId;
    let testPatient: Patient | undefined;
    if (!patientId) {
      const partialPatient: Partial<Patient> = {};
      if (patientAge) {
        const now = DateTime.now();
        const birthDate = now.minus({ [patientAge.units]: patientAge.value });
        partialPatient.birthDate = birthDate.toFormat(DOB_DATE_FORMAT);
      }
      if (patientSex) {
        partialPatient.gender = patientSex;
      }
      testPatient = await persistTestPatient({ patient: makeTestPatient(partialPatient), processId }, oystehr);
      expect(testPatient).toBeDefined();
      patientId = testPatient.id;
    }
    expect(patientId).toBeDefined();
    assert(patientId);
    const now = DateTime.now().plus({ days: addDays });
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'fulfilled',
      start: now.toISO(),
      end: now.plus({ minutes: 15 }).toISO(),
      participant: [
        {
          actor: {
            reference: `Patient/${patientId}`,
          },
          status: 'accepted',
        },
      ],
      extension: unconfirmedDob
        ? [
            {
              url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
              valueString: unconfirmedDob,
            },
          ]
        : undefined,
    };
    const batchInputApp: BatchInputPostRequest<Appointment> = {
      method: 'POST',
      resource: appointment,
      url: 'Appointment',
      fullUrl: `urn:uuid:${randomUUID()}`,
    };
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      appointment: [
        {
          reference: `${batchInputApp.fullUrl}`,
        },
      ],
      period: {
        start: now.toISO(),
      },
    };
    const batchInputEnc: BatchInputPostRequest<Encounter> = {
      method: 'POST',
      resource: encounter,
      url: 'Encounter',
    };

    try {
      const batchResults =
        (
          await oystehr.fhir.transaction<Appointment | Encounter>({
            requests: [batchInputApp, batchInputEnc],
          })
        ).entry?.flatMap((entry) => entry.resource ?? []) || [];
      expect(batchResults).toBeDefined();
      const createdEncounter = batchResults.find((entry) => entry.resourceType === 'Encounter') as Encounter;
      expect(createdEncounter?.id).toBeDefined();
      assert(createdEncounter);
      const createdAppointment = batchResults.find((entry) => entry.resourceType === 'Appointment') as Appointment;
      expect(createdAppointment?.id).toBeDefined();
      assert(createdAppointment);

      const testQR = {
        ...QRInput,
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${createdEncounter.id}` },
      } as QuestionnaireResponse;

      const createdQR = await oystehr.fhir.create(testQR);
      expect(createdQR).toBeDefined();
      expect(createdQR.id).toBeDefined();

      return { encounter: createdEncounter, patient: testPatient, appointment: createdAppointment, qr: createdQR };
    } catch (error) {
      expect(error).toBeUndefined();
      throw new Error(`Error creating test resources: ${error}`);
    }
  };

  const getVisitDetails = async (appointmentId: string): Promise<EHRVisitDetails> => {
    const visitDetailsOutput = (
      await oystehr.zambda.execute({
        id: 'EHR-GET-VISIT-DETAILS',
        appointmentId,
      })
    ).output as EHRVisitDetails;
    return visitDetailsOutput;
  };

  const updateVisitDetails = async (input: UpdateVisitDetailsInput): Promise<void> => {
    // implement when needed
    await oystehr.zambda.execute({
      id: 'EHR-UPDATE-VISIT-DETAILS',
      ...input,
    });
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

    await ensureM2MPractitionerProfile(token);

    expect(oystehr).toBeDefined();
    expect(oystehr.fhir).toBeDefined();
    expect(oystehr.zambda).toBeDefined();
  });
  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    // this will clean up everything connect to the test patient too
    await cleanupTestScheduleResources(processId, oystehr);
  });

  test.concurrent('can save and retrieve reason for visit', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'male',
    });
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();

    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.encounter).toBeDefined();
    expect(visitDetails.appointment).toBeDefined();
    const reasonForVisit = getReasonForVisitFromAppointment(appointment);
    expect(reasonForVisit).toBeUndefined();

    const randomIndex = Math.floor(Math.random() * BOOKING_CONFIG.reasonForVisitOptions.length);
    const reasonText = BOOKING_CONFIG.reasonForVisitOptions[randomIndex];

    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        reasonForVisit: reasonText,
      },
    });

    const updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    const newReasonForVisit = getReasonForVisitFromAppointment(updatedVisitDetails.appointment);
    expect(newReasonForVisit).toBeDefined();
    expect(newReasonForVisit).toEqual(reasonText);
  });
  test.concurrent('can save and retrieve additionalDetails', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'male',
    });
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();

    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.encounter).toBeDefined();
    expect(visitDetails.appointment).toBeDefined();
    const reasonForVisit = getReasonForVisitFromAppointment(appointment);
    expect(reasonForVisit).toBeUndefined();

    const randomIndex = Math.floor(Math.random() * BOOKING_CONFIG.reasonForVisitOptions.length);
    const reasonText = BOOKING_CONFIG.reasonForVisitOptions[randomIndex];

    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        reasonForVisit: reasonText,
      },
    });

    let updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    const newReasonForVisit = getReasonForVisitFromAppointment(updatedVisitDetails.appointment);
    expect(newReasonForVisit).toBeDefined();
    expect(newReasonForVisit).toEqual(reasonText);

    // main reason for visit stays the same when not included in update
    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        additionalDetails: 'Mom says speech a bit slurred',
      },
    });
    updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    const { reasonForVisit: newReasonForVisit2, additionalDetails: newAdditionalDetails } =
      getReasonForVisitAndAdditionalDetailsFromAppointment(updatedVisitDetails.appointment);
    expect(newReasonForVisit2).toBeDefined();
    expect(newReasonForVisit2).toEqual(newReasonForVisit);
    expect(newAdditionalDetails).toBeDefined();
    expect(newAdditionalDetails).toEqual('Mom says speech a bit slurred');

    const randomIndex2 = Math.floor(Math.random() * BOOKING_CONFIG.reasonForVisitOptions.length);
    const reasonText2 = BOOKING_CONFIG.reasonForVisitOptions[randomIndex2];

    // both main reason for visit and additional details updated when both included
    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        additionalDetails: 'Mom says brother is very sorry',
        reasonForVisit: reasonText2,
      },
    });
    updatedVisitDetails = await getVisitDetails(appointment.id!);

    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    const { reasonForVisit: newReasonForVisit3, additionalDetails: newAdditionalDetails2 } =
      getReasonForVisitAndAdditionalDetailsFromAppointment(updatedVisitDetails.appointment);
    expect(newReasonForVisit3).toBeDefined();
    expect(newReasonForVisit3).toEqual(reasonText2);
    expect(newAdditionalDetails2).toBeDefined();
    expect(newAdditionalDetails2).toEqual('Mom says brother is very sorry');

    // additional details removed when set to empty string
    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        additionalDetails: '',
        reasonForVisit: reasonText, // set back to original reason
      },
    });
    updatedVisitDetails = await getVisitDetails(appointment.id!);

    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    const { reasonForVisit: newReasonForVisit4, additionalDetails: newAdditionalDetails3 } =
      getReasonForVisitAndAdditionalDetailsFromAppointment(updatedVisitDetails.appointment);
    expect(newReasonForVisit4).toBeDefined();
    expect(newReasonForVisit4).toEqual(reasonText);
    expect(newAdditionalDetails3).toBeUndefined();
  });
  test.concurrent('can save and retrieve patient name', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment, patient } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'female',
    });
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();
    expect(patient).toBeDefined();
    expect(patient?.name).toBeDefined();
    expect(patient?.name?.length).toBeGreaterThan(0);
    const originalName = patient?.name?.[0];
    expect(originalName).toBeDefined();
    expect(originalName?.given).toBeDefined();
    expect(originalName?.given?.length).toBeGreaterThan(0);
    const originalFirstName = originalName?.given?.[0];
    expect(originalFirstName).toBeDefined();

    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.patient).toBeDefined();
    expect(visitDetails.patient.name).toBeDefined();
    expect(visitDetails.patient.name?.[0]).toEqual(originalName);

    const newFirstName = `UpdatedFirstName${randomUUID().substring(0, 5)}`;
    const newMiddleName = `UpdatedMiddleName${randomUUID().substring(0, 5)}`;
    const newLastName = `UpdatedLastName${randomUUID().substring(0, 5)}`;
    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        patientName: {
          first: newFirstName,
          middle: newMiddleName,
          last: newLastName,
        },
      },
    });

    const updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    expect(updatedVisitDetails.patient).toBeDefined();
    expect(updatedVisitDetails.patient.name).toBeDefined();
    expect(updatedVisitDetails.patient.name?.length).toBeGreaterThan(0);
    const updatedName = updatedVisitDetails.patient.name?.[0];
    expect(updatedName).toBeDefined();
    expect(updatedName).not.toEqual(originalName);
    expect(updatedName?.given).toBeDefined();
    expect(updatedName?.given?.length).toBeGreaterThan(1);
    expect(updatedName?.given?.[0]).toEqual(newFirstName);
    expect(updatedName?.given?.[1]).toEqual(newMiddleName);
    expect(updatedName?.family).toBeDefined();
    expect(updatedName?.family).toEqual(newLastName);
  });
  test.concurrent('can save and retrieve confirmed DOB', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment, patient } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 5 },
      unconfirmedDob: '2022-02-02',
    });
    const originalBirthDate = DateTime.now().minus({ years: 5 }).toISODate();
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();
    expect(patient).toBeDefined();
    expect(patient?.birthDate).toBeDefined();
    expect(patient?.birthDate).toEqual(originalBirthDate);
    expect(originalBirthDate).toBeDefined();
    expect(getUnconfirmedDOBIdx(appointment)).toBeDefined();
    expect(getUnconfirmedDOBIdx(appointment)).toEqual(0);

    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.patient).toBeDefined();
    expect(visitDetails.patient.birthDate).toBeDefined();
    expect(visitDetails.patient.birthDate).toEqual(originalBirthDate);

    const newBirthDate = '2017-02-02';
    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        confirmedDob: newBirthDate,
      },
    });
    const updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    expect(updatedVisitDetails.patient).toBeDefined();
    expect(updatedVisitDetails.patient.birthDate).toBeDefined();
    expect(updatedVisitDetails.patient.birthDate).toEqual(newBirthDate);
    expect(getUnconfirmedDOBIdx(updatedVisitDetails.appointment)).toBeUndefined();
  });
  test.concurrent('can save and retrieve authorized non-legal guardians', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 1 },
      patientSex: 'male',
    });
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();

    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.encounter).toBeDefined();
    expect(visitDetails.appointment).toBeDefined();
    expect(visitDetails.patient).toBeDefined();
    const authorizedGuardians = visitDetails.patient?.extension?.find(
      (e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
    )?.valueString;
    expect(authorizedGuardians).toBeUndefined();
    const guardiansText = 'Uncle Rico';
    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        authorizedNonLegalGuardians: guardiansText,
      },
    });
    const { patient: updatedPatient } = await getVisitDetails(appointment.id!);
    expect(updatedPatient).toBeDefined();
    const updatedAuthorizedGuardians = updatedPatient?.extension?.find(
      (e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
    )?.valueString;
    expect(updatedAuthorizedGuardians).toBeDefined();
    expect(updatedAuthorizedGuardians).toEqual(guardiansText);
  });
  test.concurrent('can save and retrieve consent attestation', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 1 },
      patientSex: 'male',
    });
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();

    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.encounter).toBeDefined();
    expect(visitDetails.appointment).toBeDefined();
    expect(visitDetails.patient).toBeDefined();
    expect(visitDetails.consentIsAttested).toBe(false);

    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        consentForms: {
          consentAttested: true,
        },
      },
    });
    const updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.consentIsAttested).toBe(true);
    const { encounter: updatedEncounter } = updatedVisitDetails;
    expect(updatedEncounter).toBeDefined();
    const consentSig = getAttestedConsentFromEncounter(updatedEncounter);
    expect(consentSig).toBeDefined();
    assert(consentSig);
    expect(consentSig?.type).toBeDefined();
    expect(consentSig?.type?.length).toBeGreaterThan(0);
    const consentSigType = consentSig?.type?.[0];
    expect(consentSigType).toBeDefined();
    assert(consentSigType);
    expect(consentSigType.code).toEqual(CONSENT_ATTESTATION_SIG_TYPE.code);
    expect(consentSigType.system).toEqual(CONSENT_ATTESTATION_SIG_TYPE.system);
    expect(consentSig.who).toBeDefined();
    expect(consentSig.who?.reference).toBeDefined();
    expect(consentSig.who?.reference?.split('/')[0]).toBe('Practitioner');
    expect(isValidUUID(consentSig.who?.reference?.split('/')[1] ?? '')).toBe(true);
    expect(consentSig.when).toBeDefined();
    const when = DateTime.fromISO(consentSig.when!).toISODate();
    const today = DateTime.now().toISODate();
    expect(when).toEqual(today);
  });

  test.concurrent('can save all visit details at once and retrieve them', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { encounter, appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 },
      patientSex: 'female',
    });
    expect(encounter).toBeDefined();
    expect(appointment).toBeDefined();
    const visitDetails = await getVisitDetails(appointment.id!);
    expect(visitDetails).toBeDefined();
    expect(visitDetails.encounter).toBeDefined();
    expect(visitDetails.appointment).toBeDefined();
    expect(visitDetails.patient).toBeDefined();
    expect(visitDetails.consentIsAttested).toBe(false);

    const randomIndex = Math.floor(Math.random() * BOOKING_CONFIG.reasonForVisitOptions.length);
    const reasonForVisit = BOOKING_CONFIG.reasonForVisitOptions[randomIndex];
    const guardiansText = 'Aunt Becky';
    const newBirthDate = '2020-05-05';
    const newFirstName = `AllAtOnceFirst${randomUUID().substring(0, 5)}`;
    const newMiddleName = `AllAtOnceMiddle${randomUUID().substring(0, 5)}`;
    const newLastName = `AllAtOnceLast${randomUUID().substring(0, 5)}`;

    await updateVisitDetails({
      appointmentId: appointment.id!,
      bookingDetails: {
        reasonForVisit,
        authorizedNonLegalGuardians: guardiansText,
        confirmedDob: newBirthDate,
        patientName: {
          first: newFirstName,
          middle: newMiddleName,
          last: newLastName,
        },
        consentForms: {
          consentAttested: true,
        },
      },
    });

    const updatedVisitDetails = await getVisitDetails(appointment.id!);
    expect(updatedVisitDetails).toBeDefined();
    expect(updatedVisitDetails.appointment).toBeDefined();
    expect(updatedVisitDetails.patient).toBeDefined();
    expect(updatedVisitDetails.consentIsAttested).toBe(true);

    const updatedReasonForVisit = getReasonForVisitFromAppointment(updatedVisitDetails.appointment);
    expect(updatedReasonForVisit).toBeDefined();
    expect(updatedReasonForVisit).toEqual(reasonForVisit);

    const updatedAuthorizedGuardians = updatedVisitDetails.patient?.extension?.find(
      (e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
    )?.valueString;
    expect(updatedAuthorizedGuardians).toBeDefined();
    expect(updatedAuthorizedGuardians).toEqual(guardiansText);

    expect(updatedVisitDetails.patient.birthDate).toBeDefined();
    expect(updatedVisitDetails.patient.birthDate).toEqual(newBirthDate);

    expect(updatedVisitDetails.patient.name).toBeDefined();
    expect(updatedVisitDetails.patient.name?.length).toBeGreaterThan(0);
    const updatedName = updatedVisitDetails.patient.name?.[0];
    expect(updatedName).toBeDefined();
    expect(updatedName?.given).toBeDefined();
    expect(updatedName?.given?.length).toBeGreaterThan(1);
    expect(updatedName?.given?.[0]).toEqual(newFirstName);
    expect(updatedName?.given?.[1]).toEqual(newMiddleName);
    expect(updatedName?.family).toBeDefined();
    expect(updatedName?.family).toEqual(newLastName);

    const { encounter: updatedEncounter } = updatedVisitDetails;
    expect(updatedEncounter).toBeDefined();
    const consentSig = getAttestedConsentFromEncounter(updatedEncounter);
    expect(consentSig).toBeDefined();
    assert(consentSig);
    expect(consentSig?.type).toBeDefined();
    expect(consentSig?.type?.length).toBeGreaterThan(0);
    const consentSigType = consentSig?.type?.[0];
    expect(consentSigType).toBeDefined();
    assert(consentSigType);
    expect(consentSigType.code).toEqual(CONSENT_ATTESTATION_SIG_TYPE.code);
    expect(consentSigType.system).toEqual(CONSENT_ATTESTATION_SIG_TYPE.system);
    expect(consentSig.who).toBeDefined();
    expect(consentSig.who?.reference).toBeDefined();
    expect(consentSig.who?.reference?.split('/')[0]).toBe('Practitioner');
    expect(isValidUUID(consentSig.who?.reference?.split('/')[1] ?? '')).toBe(true);
    expect(consentSig.when).toBeDefined();
    const when = DateTime.fromISO(consentSig.when!).toISODate();
    const today = DateTime.now().toISODate();
    expect(when).toEqual(today);
  });

  test.concurrent('fails gracefully when given invalid appointment id', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: 'invalid',
        bookingDetails: {
          authorizedNonLegalGuardians: 'Cousin Sal',
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe('"appointmentId" value must be a valid UUID');
    }
    try {
      await updateVisitDetails({
        appointmentId: randomUUID(),
        bookingDetails: {
          authorizedNonLegalGuardians: 'Cousin Sal',
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe('The requested Appointment resource could not be found');
    }
  });

  test.concurrent('fails gracefully when no booking details are provided', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {},
      });
    } catch (error) {
      expect((error as Error).message).toBe('at least one field in bookingDetails must be provided');
    }
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: undefined as any,
      });
    } catch (error) {
      expect((error as Error).message).toBe('The following required parameters were missing: bookingDetails');
    }
  });

  test.concurrent('fails gracefully when given invalid reason for visit', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          reasonForVisit: 'gum in my hair',
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe('reasonForVisit, "gum in my hair", is not a valid option');
    }
  });

  test.concurrent('fails gracefully when given invalid additional details', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    const randomIndex = Math.floor(Math.random() * BOOKING_CONFIG.reasonForVisitOptions.length);
    const reasonText = BOOKING_CONFIG.reasonForVisitOptions[randomIndex];
    let errorFound = false;
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          reasonForVisit: reasonText,
          additionalDetails: 7 as any,
        },
      });
    } catch (error) {
      errorFound = true;
      expect((error as Error).message).toBe(`additionalDetails must be a string`);
    }
    expect(errorFound).toBe(true);
    errorFound = false;
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          reasonForVisit: reasonText,
          additionalDetails: 'A'.repeat(REASON_ADDITIONAL_MAX_CHAR + 1),
        },
      });
    } catch (error) {
      errorFound = true;
      expect((error as Error).message).toBe(
        `additionalDetails must be at most ${REASON_ADDITIONAL_MAX_CHAR} characters`
      );
    }
    expect(errorFound).toBe(true);
  });

  test.concurrent('fails gracefully when given invalid dob', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          confirmedDob: 'not-a-date',
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`confirmedDob, "not-a-date", is not a valid iso date string`);
    }
  });

  test.concurrent('fails gracefully when given invalid name', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          patientName: {
            first: 'First',
            middle: 7,
            last: 'Last',
          } as any,
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"patientName.middle" must be a string`);
    }
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          patientName: {
            first: 8,
            middle: 'Middle',
            last: 'Last',
          } as any,
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"patientName.first" must be a string`);
    }
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          patientName: {
            first: 'First',
            middle: 'Middle',
            last: 3,
          } as any,
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"patientName.last" must be a string`);
    }
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          patientName: {} as any,
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"patientName" must have at least one field defined`);
    }
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          patientName: '14' as any,
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"patientName" must be an object`);
    }
  });
  test.concurrent('fails gracefully when given invalid consentForms object', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          consentForms: {
            consentAttested: 'yes' as any,
          },
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`consentForms.consentAttested must be a boolean`);
    }
  });
  test.concurrent('fails gracefully when given invalid authorizedNonLegalGuardians', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    try {
      await updateVisitDetails({
        appointmentId: appointment.id!,
        bookingDetails: {
          authorizedNonLegalGuardians: {} as any,
        },
      });
    } catch (error) {
      expect((error as Error).message).toBe(`authorizedNonLegalGuardians must be a string`);
    }
  });
});
