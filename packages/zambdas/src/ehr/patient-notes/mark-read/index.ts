import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { TASK_NOTE_READ_BY_TAG_SYSTEM, TASK_NOTE_TAG, toNoteDto } from '../../../shared/notes';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

export const MarkTaskNotesReadSchema = z.object({
  taskId: z.string().uuid(),
});

const ZAMBDA_NAME = 'mark-task-notes-read';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateWithSchema(MarkTaskNotesReadSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const callerId = await getMyPractitionerId(input.headers?.Authorization?.replace('Bearer ', '') ?? '', secrets);

  const notes = await getAllFhirSearchPages<Communication>(
    {
      resourceType: 'Communication',
      params: [
        { name: 'based-on', value: `Task/${taskId}` },
        { name: '_tag', value: TASK_NOTE_TAG },
        { name: 'status', value: 'completed' },
      ],
    },
    oystehr
  );

  // Appended: getPatchOperationForNewMetaTag would replace the other readers' tags, which share this system.
  const requests = notes
    .filter((note) => toNoteDto(note, callerId).isUnread)
    .map((note) =>
      getPatchBinary({
        resourceId: note.id!,
        resourceType: 'Communication',
        patchOperations: [
          { op: 'add', path: '/meta/tag/-', value: { system: TASK_NOTE_READ_BY_TAG_SYSTEM, code: callerId } },
        ],
      })
    );
  if (requests.length > 0) await oystehr.fhir.transaction({ requests });

  return {
    body: JSON.stringify({ marked: requests.length }),
    statusCode: 200,
  };
});
