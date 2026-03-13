import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { addOperation, getSecret, replaceOperation, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'file-inbound-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start`);

  try {
    const { secrets, taskId, patientId, folderId, documentName, pdfUrl } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    // Fetch the target folder List
    const folderList = await oystehr.fhir.get<List>({
      resourceType: 'List',
      id: folderId,
    });

    if (!folderList) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Folder List/${folderId} not found` }),
      };
    }

    // Create DocumentReference pointing to the existing fax PDF
    console.log(`[${ZAMBDA_NAME}] creating DocumentReference for patient ${patientId}, folder ${folderId}`);
    const docRef = await oystehr.fhir.create<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      date: DateTime.now().setZone('UTC').toISO() ?? '',
      description: documentName,
      subject: {
        reference: `Patient/${patientId}`,
      },
      content: [
        {
          attachment: {
            url: pdfUrl,
            contentType: 'application/pdf',
            title: documentName,
          },
        },
      ],
    });

    const documentRefId = docRef.id;
    console.log(`[${ZAMBDA_NAME}] created DocumentReference/${documentRefId}`);

    if (!documentRefId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create DocumentReference' }),
      };
    }

    // Add DocumentReference to the folder List
    const updatedEntries = [...(folderList.entry ?? [])];
    updatedEntries.push({
      date: DateTime.now().setZone('UTC').toISO() ?? '',
      item: {
        type: 'DocumentReference',
        reference: `DocumentReference/${documentRefId}`,
      },
    });

    const operations: Operation[] = [
      folderList.entry && folderList.entry.length > 0
        ? replaceOperation('/entry', updatedEntries)
        : addOperation('/entry', updatedEntries),
    ];

    await oystehr.fhir.patch<List>({
      resourceType: 'List',
      id: folderId,
      operations,
    });

    console.log(`[${ZAMBDA_NAME}] patched folder List/${folderId}`);

    // Mark the task as completed
    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: taskId,
      operations: [replaceOperation('/status', 'completed')],
    });

    console.log(`[${ZAMBDA_NAME}] completed Task/${taskId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ documentRefId, folderId }),
    };
  } catch (error: any) {
    console.error(`[${ZAMBDA_NAME}] error:`, error);
    console.error(`[${ZAMBDA_NAME}] error message:`, error?.message);
    console.error(`[${ZAMBDA_NAME}] error cause:`, JSON.stringify(error?.cause));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
