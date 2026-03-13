import { M2MClientMockType } from 'utils';
import { index as deletePatientInstructionIndex } from '../../src/ehr/delete-patient-instruction';
import { index as getPatientInstructionsIndex } from '../../src/ehr/get-patient-instructions';
import { index as savePatientInstructionIndex } from '../../src/ehr/save-patient-instruction';
import { SECRETS } from '../data/secrets';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('patient-instructions integration tests', () => {
  let token: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('patient-instructions.test.ts', M2MClientMockType.provider);
    cleanup = setup.cleanup;
    token = setup.token;
  });

  afterAll(async () => {
    await cleanup();
  });

  const secrets = {
    ...SECRETS,
    ENVIRONMENT: 'local',
    ORGANIZATION_ID: 'test-org',
    AUTH0_CLIENT: SECRETS.AUTH0_CLIENT_TESTS || process.env.AUTH0_CLIENT,
    AUTH0_SECRET: SECRETS.AUTH0_SECRET_TESTS || process.env.AUTH0_SECRET,
  };

  it('should create, get, update, and delete a patient instruction', async () => {
    // 1. Create instruction
    const createEvent: any = {
      body: JSON.stringify({
        title: 'Test Instruction',
        text: 'This is a test patient instruction.',
      }),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      secrets,
    };

    const createResult = (await savePatientInstructionIndex(createEvent, {} as any, () => {})) as any;
    if (createResult.statusCode !== 200) throw new Error('CREATE FAILED: ' + createResult.body);
    const createdInstruction = JSON.parse(createResult.body);
    if (!createdInstruction.resourceId) throw new Error('ID UNDEFINED. BODY: ' + createResult.body);
    expect(createdInstruction.resourceId).toBeDefined();
    expect(createdInstruction.title).toBe('Test Instruction');

    // 2. Get instructions
    const getEvent: any = {
      body: JSON.stringify({
        type: 'provider',
      }),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      secrets,
    };

    const getResult = (await getPatientInstructionsIndex(getEvent, {} as any, () => {})) as any;
    expect(getResult.statusCode).toBe(200);
    const instructions = JSON.parse(getResult.body);
    expect(Array.isArray(instructions)).toBe(true);
    const foundInstruction = instructions.find((i: any) => i.resourceId === createdInstruction.resourceId);
    expect(foundInstruction).toBeDefined();

    // 3. Update instruction
    const updateEvent: any = {
      body: JSON.stringify({
        instructionId: createdInstruction.resourceId,
        title: 'Updated Instruction',
        text: 'This is an updated test patient instruction.',
      }),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      secrets,
    };

    const updateResult = (await savePatientInstructionIndex(updateEvent, {} as any, () => {})) as any;
    expect(updateResult.statusCode).toBe(200);
    const updatedInstruction = JSON.parse(updateResult.body);
    expect(updatedInstruction.title).toBe('Updated Instruction');

    // 4. Delete instruction
    const deleteEvent: any = {
      body: JSON.stringify({
        instructionId: createdInstruction.resourceId,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      secrets,
    };

    const deleteResult = (await deletePatientInstructionIndex(deleteEvent, {} as any, () => {})) as any;
    expect(deleteResult.statusCode).toBe(200);

    // 5. Verify it's deleted
    const getResultAfterDelete = (await getPatientInstructionsIndex(getEvent, {} as any, () => {})) as any;
    const instructionsAfterDelete = JSON.parse(getResultAfterDelete.body);
    const foundInstructionAfterDelete = instructionsAfterDelete.find(
      (i: any) => i.resourceId === createdInstruction.resourceId
    );
    expect(foundInstructionAfterDelete).toBeUndefined();
  });
});
