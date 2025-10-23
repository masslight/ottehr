import Oystehr from '@oystehr/sdk';
import { MedicationStatement } from 'fhir/r4b';
import { GetChartDataRequest, GetChartDataResponse, SaveChartDataRequest, SaveChartDataResponse } from 'utils';
import { InsertFullAppointmentDataBaseResult, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

let baseResources: InsertFullAppointmentDataBaseResult;

describe('chart-data integration tests', () => {
  let oystehrLocalZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('chart-data.test.ts');
    oystehrLocalZambdas = setup.oystehrLocalZambdas;
    baseResources = setup.baseResources;
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
  });

  describe('chart-data save / get cycle happy paths', () => {
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
});
