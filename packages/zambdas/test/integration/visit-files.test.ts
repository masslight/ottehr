import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Attachment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import { join } from 'path';
import {
  chooseJson,
  DOB_DATE_FORMAT,
  EHRImageUploadType,
  FHIR_EXTENSION,
  GetPresignedFileURLInput,
  UpdateVisitFilesInput,
  VisitDocuments,
} from 'utils';
import { assert, inject } from 'vitest';
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import QRInput from '../data/questionnaire-response-1.json';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';
import { cleanupTestScheduleResources, makeTestPatient, persistTestPatient } from '../helpers/testScheduleUtils';

// 'insurance-card-front-2' // 'insurance-card-back-2' // 'photo-id-front' // 'photo-id-back'
describe('saving card files from EHR', () => {
  let oystehr: Oystehr;
  let token: string;
  let processId: string;
  const z3ObjectsToCleanUp: string[] = [];

  interface MakeTestResourcesParams {
    processId: string;
    oystehr: Oystehr;
    addDays?: number;
    existingPatientId?: string;
    patientAge?: { units: 'years' | 'months'; value: number };
    patientSex?: 'male' | 'female';
    unconfirmedDob?: string;
  }

  const makeCardInZ3AndReturnAttachment = async (
    cardType: EHRImageUploadType,
    appointmentId: string
  ): Promise<Attachment> => {
    let file: File;
    if (`${cardType}`.includes('front')) {
      const filePath = join(__dirname, '..', 'data', 'files', '00InsuranceCard.png');
      const fileBuffer = readFileSync(filePath);
      file = new File([Uint8Array.from(fileBuffer)], cardType, { type: 'image/png' });
    } else {
      const filePath = join(__dirname, '..', 'data', 'files', '00Insurance_back.jpg');
      const fileBuffer = readFileSync(filePath);
      file = new File([Uint8Array.from(fileBuffer)], cardType, { type: 'image/jpg' });
    }

    const { presignedURL, z3URL } = await (async () => {
      const response = await oystehr!.zambda.executePublic({
        id: 'get-presigned-file-url',
        appointmentID: appointmentId,
        fileType: cardType,
        fileFormat: file.type.split('/')[1] as GetPresignedFileURLInput['fileFormat'],
      });
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    })();
    await fetch(presignedURL, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });
    z3ObjectsToCleanUp.push(z3URL);

    return {
      url: z3URL,
      title: cardType,
      creation: DateTime.now().toISO(),
    };
  };
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

  const getVisitFiles = async (appointmentId: string): Promise<VisitDocuments> => {
    const visitFilesOutput = (
      await oystehr.zambda.execute({
        id: 'GET-VISIT-FILES',
        appointmentId,
      })
    ).output as VisitDocuments;
    return visitFilesOutput;
  };

  const updateVisitFiles = async (input: UpdateVisitFilesInput): Promise<void> => {
    // implement when needed
    await oystehr.zambda.execute({
      id: 'UPDATE-VISIT-FILES',
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
    for (const z3Url of z3ObjectsToCleanUp) {
      const path = z3Url.split('z3/')[1];
      const bucketName = path.split('/')[0];
      const objectPath = path.split('/').slice(1).join('/');
      try {
        await oystehr.z3.deleteObject({ bucketName, 'objectPath+': objectPath });
      } catch (error) {
        console.error('Error deleting z3 object:', error);
      }
    }
  });

  test.concurrent('can save and retrieve primary insurance front and back', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'male',
    });
    expect(appointment).toBeDefined();
    assert(appointment.id);

    const visitFiles = await getVisitFiles(appointment.id);
    const { photoIdCards, insuranceCards, insuranceCardsSecondary } = visitFiles;
    expect(photoIdCards).toBeDefined();
    expect(insuranceCards).toBeDefined();
    expect(insuranceCardsSecondary).toBeDefined();
    expect(photoIdCards.length).toBe(0);
    expect(insuranceCards.length).toBe(0);
    expect(insuranceCardsSecondary.length).toBe(0);

    const frontAttachment = await makeCardInZ3AndReturnAttachment('insurance-card-front', appointment.id);
    await updateVisitFiles({
      appointmentId: appointment.id,
      fileType: 'insurance-card-front',
      attachment: frontAttachment,
    });

    const filesWithFront = await getVisitFiles(appointment.id);
    expect(filesWithFront.insuranceCards.length).toBe(1);
    expect(filesWithFront.insuranceCards[0].z3Url).toBe(frontAttachment.url);
    expect(filesWithFront.insuranceCards[0].type).toBe('insurance-card-front');

    const backAttachment = await makeCardInZ3AndReturnAttachment('insurance-card-back', appointment.id);
    await updateVisitFiles({
      appointmentId: appointment.id,
      fileType: 'insurance-card-back',
      attachment: backAttachment,
    });

    const filesWithBack = await getVisitFiles(appointment.id);
    expect(filesWithBack.insuranceCards.length).toBe(2);
    const backCard = filesWithBack.insuranceCards.find((card) => card.type === 'insurance-card-back');
    expect(backCard).toBeDefined();
    assert(backCard);
    expect(backCard.z3Url).toBe(backAttachment.url);
  });

  test.concurrent('can save when providing patient id instead of appointment id', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment, patient } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'male',
    });
    expect(appointment).toBeDefined();
    assert(appointment.id);
    expect(patient).toBeDefined();
    assert(patient?.id);

    const visitFiles = await getVisitFiles(appointment.id);
    const { photoIdCards, insuranceCards, insuranceCardsSecondary } = visitFiles;
    expect(photoIdCards).toBeDefined();
    expect(insuranceCards).toBeDefined();
    expect(insuranceCardsSecondary).toBeDefined();
    expect(photoIdCards.length).toBe(0);
    expect(insuranceCards.length).toBe(0);
    expect(insuranceCardsSecondary.length).toBe(0);

    const frontAttachment = await makeCardInZ3AndReturnAttachment('insurance-card-front', appointment.id);
    await updateVisitFiles({
      patientId: patient.id,
      fileType: 'insurance-card-front',
      attachment: frontAttachment,
    });

    const filesWithFront = await getVisitFiles(appointment.id);
    expect(filesWithFront.insuranceCards.length).toBe(1);
    expect(filesWithFront.insuranceCards[0].z3Url).toBe(frontAttachment.url);
    expect(filesWithFront.insuranceCards[0].type).toBe('insurance-card-front');

    const backAttachment = await makeCardInZ3AndReturnAttachment('insurance-card-back', appointment.id);
    await updateVisitFiles({
      patientId: patient.id,
      fileType: 'insurance-card-back',
      attachment: backAttachment,
    });

    const filesWithBack = await getVisitFiles(appointment.id);
    expect(filesWithBack.insuranceCards.length).toBe(2);
    const backCard = filesWithBack.insuranceCards.find((card) => card.type === 'insurance-card-back');
    expect(backCard).toBeDefined();
    assert(backCard);
    expect(backCard.z3Url).toBe(backAttachment.url);
  });

  test.concurrent('can save and retrieve secondary insurance front and back', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'male',
    });
    expect(appointment).toBeDefined();
    assert(appointment.id);

    const visitFiles = await getVisitFiles(appointment.id);
    const { photoIdCards, insuranceCards, insuranceCardsSecondary } = visitFiles;
    expect(photoIdCards).toBeDefined();
    expect(insuranceCards).toBeDefined();
    expect(insuranceCardsSecondary).toBeDefined();
    expect(photoIdCards.length).toBe(0);
    expect(insuranceCards.length).toBe(0);
    expect(insuranceCardsSecondary.length).toBe(0);

    const FRONT_CARD_NAME = 'insurance-card-front-2';
    const BACK_CARD_NAME = 'insurance-card-back-2';

    const frontAttachment = await makeCardInZ3AndReturnAttachment(FRONT_CARD_NAME, appointment.id);
    await updateVisitFiles({
      appointmentId: appointment.id,
      fileType: FRONT_CARD_NAME,
      attachment: frontAttachment,
    });

    const filesWithFront = await getVisitFiles(appointment.id);
    expect(filesWithFront.insuranceCardsSecondary.length).toBe(1);
    expect(filesWithFront.insuranceCardsSecondary[0].z3Url).toBe(frontAttachment.url);
    expect(filesWithFront.insuranceCardsSecondary[0].type).toBe(FRONT_CARD_NAME);

    const backAttachment = await makeCardInZ3AndReturnAttachment(BACK_CARD_NAME, appointment.id);
    await updateVisitFiles({
      appointmentId: appointment.id,
      fileType: BACK_CARD_NAME,
      attachment: backAttachment,
    });

    const filesWithBack = await getVisitFiles(appointment.id);
    expect(filesWithBack.insuranceCardsSecondary.length).toBe(2);
    const backCard = filesWithBack.insuranceCardsSecondary.find((card) => card.type === BACK_CARD_NAME);
    expect(backCard).toBeDefined();
    assert(backCard);
    expect(backCard.z3Url).toBe(backAttachment.url);
  });

  test.concurrent('can save and retrieve id card front and back', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 30 },
      patientSex: 'male',
    });
    expect(appointment).toBeDefined();
    assert(appointment.id);

    const visitFiles = await getVisitFiles(appointment.id);
    const { photoIdCards, insuranceCards, insuranceCardsSecondary } = visitFiles;
    expect(photoIdCards).toBeDefined();
    expect(insuranceCards).toBeDefined();
    expect(insuranceCardsSecondary).toBeDefined();
    expect(photoIdCards.length).toBe(0);
    expect(insuranceCards.length).toBe(0);
    expect(insuranceCardsSecondary.length).toBe(0);

    const FRONT_CARD_NAME = 'photo-id-front';
    const BACK_CARD_NAME = 'photo-id-back';

    const frontAttachment = await makeCardInZ3AndReturnAttachment(FRONT_CARD_NAME, appointment.id);
    await updateVisitFiles({
      appointmentId: appointment.id,
      fileType: FRONT_CARD_NAME,
      attachment: frontAttachment,
    });

    const filesWithFront = await getVisitFiles(appointment.id);
    expect(filesWithFront.photoIdCards.length).toBe(1);
    expect(filesWithFront.photoIdCards[0].z3Url).toBe(frontAttachment.url);
    expect(filesWithFront.photoIdCards[0].type).toBe(FRONT_CARD_NAME);

    const backAttachment = await makeCardInZ3AndReturnAttachment(BACK_CARD_NAME, appointment.id);
    await updateVisitFiles({
      appointmentId: appointment.id,
      fileType: BACK_CARD_NAME,
      attachment: backAttachment,
    });

    const filesWithBack = await getVisitFiles(appointment.id);
    expect(filesWithBack.photoIdCards.length).toBe(2);
    const backCard = filesWithBack.photoIdCards.find((card) => card.type === BACK_CARD_NAME);
    expect(backCard).toBeDefined();
    assert(backCard);
    expect(backCard.z3Url).toBe(backAttachment.url);
  });

  test.concurrent('update fails gracefully when all required parameters are missing', async () => {
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
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: undefined as any,
        attachment: undefined as any,
      });
    } catch (error) {
      expect((error as Error).message).toBe('The following required parameters were missing: fileType, attachment');
    }
  });

  test.concurrent('update fails gracefully when given invalid appointment id', async () => {
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
    const attachment = {
      url: 'http://example.com',
      title: 'insurance-card-front',
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: 'invalid',
        attachment,
        fileType: 'insurance-card-front',
      });
    } catch (error) {
      expect((error as Error).message).toBe('"appointmentId" must be a valid UUID.');
    }
    try {
      await updateVisitFiles({
        appointmentId: randomUUID(),
        attachment,
        fileType: 'insurance-card-front',
      });
    } catch (error) {
      expect((error as Error).message).toBe('The requested Appointment resource could not be found');
    }
  });

  test.concurrent('update fails gracefully when no attachment is provided', async () => {
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
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: undefined as any,
      });
    } catch (error) {
      expect((error as Error).message).toBe('The following required parameters were missing: attachment');
    }
  });

  test.concurrent('update fails gracefully when given invalid patient id', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment, patient } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });
    expect(appointment).toBeDefined();
    expect(patient).toBeDefined();
    try {
      await updateVisitFiles({
        patientId: 'invalid',
        attachment: {
          url: 'http://example.com',
          title: 'insurance-card-front',
          creation: DateTime.now().toISO(),
        },
        fileType: 'insurance-card-front',
      });
    } catch (error) {
      expect((error as Error).message).toBe('"patientId" must be a valid UUID.');
    }
    try {
      await updateVisitFiles({
        patientId: randomUUID(),
        attachment: {
          url: 'http://example.com',
          title: 'insurance-card-front',
          creation: DateTime.now().toISO(),
        },
        fileType: 'insurance-card-front',
      });
    } catch (error) {
      expect((error as Error).message).toBe('The requested Patient resource could not be found');
    }
  });

  test.concurrent('update fails gracefully when no fileType is provided', async () => {
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
    const attachment = {
      url: 'http://example.com',
      title: 'insurance-card-front',
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: undefined as any,
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe('The following required parameters were missing: fileType');
    }
  });

  test.concurrent('update fails gracefully when invalid fileType is provided', async () => {
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
    const attachment = {
      url: 'http://example.com',
      title: 'insurance-card-front',
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'costco-card-front' as any,
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe(
        '"fileType" is invalid. must be one of photo-id-front, photo-id-back, insurance-card-front, insurance-card-back, insurance-card-front-2, insurance-card-back-2'
      );
    }
  });

  test.only('update fails gracefully when attachment has missing fields', async () => {
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
    let attachment = {
      url: undefined as any,
      title: 'insurance-card-front',
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe(
        `"attachment" must be an object with "url", "title", and "creation" fields`
      );
    }
    attachment = {
      url: 'http://example.com',
      title: undefined as any,
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe(
        `"attachment" must be an object with "url", "title", and "creation" fields`
      );
    }

    attachment = {
      url: 'http://example.com',
      title: 'insurance-card-front',
      creation: undefined as any,
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe(
        `"attachment" must be an object with "url", "title", and "creation" fields`
      );
    }
  });

  test.only('update fails gracefully when invalid attachment.url is provided', async () => {
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
    const attachment = {
      url: '',
      title: 'insurance-card-front',
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe('"attachment.url" must be a non-empty string.');
    }
  });

  test.only('update fails gracefully when invalid attachment.type is provided', async () => {
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

    const attachment = {
      url: 'http://example.com',
      title: '',
      creation: DateTime.now().toISO(),
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe('"attachment.title" must be a non-empty string.');
    }
  });

  test.only('update fails gracefully when invalid attachment.creation is provided', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });

    let attachment = {
      url: 'http://example.com',
      title: 'insurance-card-front',
      creation: 'not-a-date',
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"attachment.creation" must be a valid ISO date string.`);
    }
    attachment = {
      url: 'http://example.com',
      title: 'insurance-card-front',
      creation: '',
    };
    try {
      await updateVisitFiles({
        appointmentId: appointment.id!,
        fileType: 'insurance-card-front',
        attachment: attachment,
      });
    } catch (error) {
      expect((error as Error).message).toBe(`"attachment.creation" must be a valid ISO date string.`);
    }
  });

  test.only('get fails gracefully when invalid appointmentId is provided', async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not run test!');
    }
    const { appointment } = await makeTestResources({
      processId,
      oystehr,
      patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
      patientSex: 'female',
    });

    await getVisitFiles(appointment.id!);
    try {
      await getVisitFiles(undefined as any);
    } catch (error) {
      expect((error as Error).message).toBe(`The following required parameters were missing: appointmentId`);
    }
    try {
      await getVisitFiles('1234');
    } catch (error) {
      expect((error as Error).message).toBe(`"appointmentId" value must be a valid UUID`);
    }
  });
});
