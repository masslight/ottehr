import Oystehr from '@oystehr/sdk';
import { MedicationStatement } from 'fhir/r4b';
import {
  DeleteChartDataRequest,
  DeleteChartDataResponse,
  GetChartDataRequest,
  GetChartDataResponse,
  M2MClientMockType,
  SaveChartDataRequest,
  SaveChartDataResponse,
  SchoolWorkNoteExcuseDocDTO,
} from 'utils';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

let baseResources: InsertFullAppointmentDataBaseResult;

describe('chart-data integration tests', () => {
  let oystehrLocalZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('chart-data.test.ts', M2MClientMockType.provider);
    oystehrLocalZambdas = setup.oystehrTestUserM2M;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('get-chart-data happy paths', () => {
    it('should get chart data with no params on base chart-- success', async () => {
      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toBeDefined();
      expect(typedGetChartDataOutput).toHaveProperty('patientId');
      expect(typedGetChartDataOutput.patientId).toEqual(baseResources.patient.id);
      expect(typedGetChartDataOutput).toHaveProperty('conditions');
      expect(typedGetChartDataOutput.conditions).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.conditions?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('medications');
      expect(typedGetChartDataOutput.medications).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.medications?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('allergies');
      expect(typedGetChartDataOutput.allergies).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.allergies?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('surgicalHistory');
      expect(typedGetChartDataOutput.surgicalHistory).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.surgicalHistory?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('examObservations');
      expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.examObservations?.length).toBeGreaterThan(1);
      expect(typedGetChartDataOutput).toHaveProperty('cptCodes');
      expect(typedGetChartDataOutput.cptCodes).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.cptCodes?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('instructions');
      expect(typedGetChartDataOutput.instructions).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.instructions?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('diagnosis');
      expect(typedGetChartDataOutput.diagnosis).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.diagnosis?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('schoolWorkNotes');
      expect(typedGetChartDataOutput.schoolWorkNotes).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.schoolWorkNotes?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('observations');
      expect(typedGetChartDataOutput.observations).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.observations?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('practitioners');
      expect(typedGetChartDataOutput.practitioners).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.practitioners?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('aiPotentialDiagnosis');
      expect(typedGetChartDataOutput.aiPotentialDiagnosis).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiPotentialDiagnosis?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('aiChat');
      expect(typedGetChartDataOutput.aiChat).toBeInstanceOf(Object);
      expect(typedGetChartDataOutput.aiChat?.documents).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiChat?.documents?.length).toEqual(0);
      expect(typedGetChartDataOutput.aiChat?.providers).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiChat?.providers?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('patientInfoConfirmed');
      expect(typedGetChartDataOutput.patientInfoConfirmed).toEqual({
        value: true,
      });
    });

    it('should get chart data with aiPotentialDiagnosis requestedField -- success', async () => {
      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        requestedFields: { aiPotentialDiagnosis: {} },
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toBeDefined();
      expect(typedGetChartDataOutput).toHaveProperty('patientId');
      expect(typedGetChartDataOutput.patientId).toEqual(baseResources.patient.id);
      expect(typedGetChartDataOutput).not.toHaveProperty('conditions');
      expect(typedGetChartDataOutput).toHaveProperty('aiPotentialDiagnosis');
      expect(typedGetChartDataOutput.aiPotentialDiagnosis).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiPotentialDiagnosis?.length).toEqual(0);
    });

    it('should validate shape of examObservations -- success', async () => {
      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('examObservations');
      expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.examObservations?.[0]).toMatchObject({
        resourceId: expect.any(String),
        field: expect.any(String),
        value: expect.any(Boolean),
      });
    });
  });

  describe('chart-data save / get cycle happy paths', () => {
    it('should validate save + get cycle for conditions -- success', async () => {
      const conditionDTO = {
        code: 'H54.8',
        display: 'Legal blindness, as defined in USA',
        current: true,
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        conditions: [conditionDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newCondition = typedSaveChartOutput.chartData.conditions?.[0];
      expect(newCondition).toMatchObject({
        resourceId: expect.any(String),
        ...conditionDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('conditions');
      expect(typedGetChartDataOutput.conditions).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.conditions?.[0]).toEqual(newCondition);
    });

    it('should validate save + get cycle for medications -- success', async () => {
      const medicationDTO = {
        name: 'Azithromycin Oral Suspension Reconstituted (200 MG/5ML)',
        id: '5675',
        type: 'scheduled' as 'scheduled' | 'as-needed' | 'prescribed-medication',
        intakeInfo: { date: '2025-10-16T11:00:00.000Z', dose: '2 l' },
        status: 'active' as Extract<MedicationStatement['status'], 'active' | 'completed'>,
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        medications: [medicationDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newMedication = typedSaveChartOutput.chartData.medications?.[0];
      expect(newMedication).toMatchObject({
        resourceId: expect.any(String),
        ...medicationDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('medications');
      expect(typedGetChartDataOutput.medications).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.medications?.[0]).toEqual(newMedication);
    });

    it('should validate save + get cycle for allergies -- success', async () => {
      const allergyDTO = {
        name: 'Penicillin',
        id: '12345',
        note: 'Causes severe rash',
        current: true,
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        allergies: [allergyDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newAllergy = typedSaveChartOutput.chartData.allergies?.[0];
      expect(newAllergy).toMatchObject({
        resourceId: expect.any(String),
        ...allergyDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('allergies');
      expect(typedGetChartDataOutput.allergies).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.allergies?.[0]).toEqual(newAllergy);
    });

    it('should validate save + get cycle for surgicalHistory -- success', async () => {
      const surgicalHistoryDTO = {
        code: '44950',
        display: 'Appendectomy',
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        surgicalHistory: [surgicalHistoryDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newSurgicalHistory = typedSaveChartOutput.chartData.surgicalHistory?.[0];
      expect(newSurgicalHistory).toMatchObject({
        resourceId: expect.any(String),
        ...surgicalHistoryDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('surgicalHistory');
      expect(typedGetChartDataOutput.surgicalHistory).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.surgicalHistory?.[0]).toEqual(newSurgicalHistory);
    });

    it('should validate save + get cycle for examObservations -- success', async () => {
      const examObservationDTO = {
        field: 'alert',
        value: true,
        note: 'this is the note',
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        examObservations: [examObservationDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newExamObservation = typedSaveChartOutput.chartData.examObservations?.find(
        (obs) => obs.field === examObservationDTO.field
      );
      expect(newExamObservation).toMatchObject({
        resourceId: expect.any(String),
        ...examObservationDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('examObservations');
      expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
      const savedExamObservation = typedGetChartDataOutput.examObservations?.find(
        (obs) => obs.field === examObservationDTO.field
      );
      expect(savedExamObservation).toMatchObject({
        resourceId: expect.any(String),
        field: examObservationDTO.field,
        value: examObservationDTO.value,
      });
    });

    it('should validate save + get cycle for instructions -- success', async () => {
      const instructionDTO = {
        text: 'Take medication with food twice daily',
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        instructions: [instructionDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newInstruction = typedSaveChartOutput.chartData.instructions?.[0];
      expect(newInstruction).toMatchObject({
        resourceId: expect.any(String),
        ...instructionDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('instructions');
      expect(typedGetChartDataOutput.instructions).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.instructions?.[0]).toEqual(newInstruction);
    });

    it('should validate save + get cycle for diagnosis -- success', async () => {
      const diagnosisDTO = {
        code: 'J06.9',
        display: 'Acute upper respiratory infection, unspecified',
        isPrimary: true,
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        diagnosis: [diagnosisDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newDiagnosis = typedSaveChartOutput.chartData.diagnosis?.[0];
      expect(newDiagnosis).toMatchObject({
        resourceId: expect.any(String),
        ...diagnosisDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('diagnosis');
      expect(typedGetChartDataOutput.diagnosis).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.diagnosis?.[0]).toEqual(newDiagnosis);
    });

    it('should validate save + get cycle for cptCodes -- success', async () => {
      const cptCodeDTO = {
        code: '99213',
        display: 'Office or other outpatient visit, established patient, 20-29 minutes',
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        cptCodes: [cptCodeDTO],
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newCptCode = typedSaveChartOutput.chartData.cptCodes?.[0];
      expect(newCptCode).toMatchObject({
        resourceId: expect.any(String),
        ...cptCodeDTO,
      });

      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toHaveProperty('cptCodes');
      expect(typedGetChartDataOutput.cptCodes).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.cptCodes?.[0]).toEqual(newCptCode);
    });
  });

  describe('chart-data delete happy paths', () => {
    it('should validate delete for schoolWorkNotes -- success', async () => {
      // First, save a school work note
      const schoolWorkNoteDTO: SchoolWorkNoteExcuseDocDTO = {
        documentHeader: 'School Work Note',
        providerDetails: {
          name: 'Dr. John Doe, MD',
          credentials: 'MD',
        },
        footerNote: 'This note is valid for 30 days from the date issued.',
        headerNote: 'Please accommodate the following requests.',
        bulletItems: [{ text: 'Extra time for assignments' }, { text: 'Permission to leave class early' }],
        parentGuardianName: 'Jane Doe',
        type: 'school',
      };
      const saveChartInput: SaveChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        newSchoolWorkNote: schoolWorkNoteDTO,
      };
      let saveChartOutput: any;
      try {
        saveChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'SAVE-CHART-DATA',
            ...saveChartInput,
          })
        ).output as SaveChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        saveChartOutput = error as Error;
      }
      expect(saveChartOutput instanceof Error).toBe(false);
      const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
      const newSchoolWorkNote = typedSaveChartOutput.chartData.schoolWorkNotes?.[0];
      expect(newSchoolWorkNote).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        date: expect.any(String),
        published: false,
        type: 'school',
        url: expect.any(String),
      });

      // Now, delete the school work note
      const deleteChartInput: DeleteChartDataRequest = {
        encounterId: baseResources.encounter.id!,
        schoolWorkNotes: [newSchoolWorkNote!],
      };
      let deleteChartOutput: any;
      try {
        deleteChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'DELETE-CHART-DATA',
            ...deleteChartInput,
          })
        ).output as DeleteChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        deleteChartOutput = error as Error;
      }
      expect(deleteChartOutput instanceof Error).toBe(false);

      // Finally, get chart data to ensure the school work note is deleted
      let getChartOutput: any;
      try {
        getChartOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            encounterId: baseResources.encounter.id!,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartOutput = error as Error;
      }
      expect(getChartOutput instanceof Error).toBe(false);
      const typedGetChartOutput = getChartOutput as GetChartDataResponse;
      expect(typedGetChartOutput.schoolWorkNotes).toBeInstanceOf(Array);
      expect(typedGetChartOutput.schoolWorkNotes).toStrictEqual([]);
    });
  });
});
