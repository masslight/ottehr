import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { GetPatientNotesOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { PATIENT_NOTE_TAG, TASK_NOTE_TAG, toNoteDto } from '../../../shared/notes';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

export const GetPatientNotesSchema = z
  .object({
    patientId: z.string().uuid().optional(),
    taskIds: z.array(z.string().uuid()).min(1).max(100).optional(),
    offset: z.number().int().min(0).default(0),
    pageSize: z.number().int().min(1).max(100).default(20),
  })
  .refine((params) => !!params.patientId !== !!params.taskIds, {
    message: 'Exactly one of patientId or taskIds is required',
  });

const ZAMBDA_NAME = 'get-patient-notes';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, taskIds, offset, pageSize, secrets } = validateWithSchema(GetPatientNotesSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  if (taskIds) {
    // All notes on the Tasks board's tasks at once; whether a note is unread depends on who asks.
    const callerId = await getMyPractitionerId(input.headers?.Authorization?.replace('Bearer ', '') ?? '', secrets);
    const resources = await getAllFhirSearchPages<Communication>(
      {
        resourceType: 'Communication',
        params: [
          { name: 'based-on', value: taskIds.map((taskId) => `Task/${taskId}`).join(',') },
          { name: '_tag', value: TASK_NOTE_TAG },
          { name: 'status', value: 'completed' },
          { name: '_sort', value: '-sent' },
        ],
      },
      oystehr
    );
    const output: GetPatientNotesOutput = { notes: resources.map((note) => toNoteDto(note, callerId)), hasMore: false };
    return { body: JSON.stringify(output), statusCode: 200 };
  }

  const bundle = await oystehr.fhir.search<Communication>({
    resourceType: 'Communication',
    params: [
      { name: 'subject', value: `Patient/${patientId}` },
      { name: '_tag', value: PATIENT_NOTE_TAG },
      { name: 'status', value: 'completed' },
      { name: '_sort', value: '-sent' },
      { name: '_count', value: String(pageSize) },
      { name: '_offset', value: String(offset) },
    ],
  });

  const resources = bundle.unbundle();
  const hasMore = bundle.link?.some((link) => link.relation === 'next') ?? false;

  const output: GetPatientNotesOutput = { notes: resources.map((resource) => toNoteDto(resource)), hasMore };

  return {
    body: JSON.stringify(output),
    statusCode: 200,
  };
});
