import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, DocumentReference, List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { addOperation, OTTEHR_MODULE, replaceOperation } from 'utils';
import { makeZ3Url, Secrets, ZambdaInput } from 'zambda-utils';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { createPresignedUrl } from '../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const logIt = (msg: string): void => {
  console.log(`[create-upload-document-url]: ${msg}`);
};

const UNIVERSAL_DEVICE_IDENTIFIER_CODE = 'UDI';

export interface CreateUploadPatientDocumentInput {
  secrets: Secrets | null;
  userToken: string;
  patientId: string;
  fileFolderId: string;
  fileName: string;
}

export interface CreateUploadPatientDocumentOutput {
  z3Url: string;
  presignedUploadUrl: string;
  documentRefId: string;
  folderId: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  logIt(`handler() start.`);
  try {
    const validatedInput = validateRequestParameters(input);
    const { secrets, patientId, fileFolderId, fileName } = validatedInput;
    logIt(`validatedInput => `);
    logIt(JSON.stringify(validatedInput));

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    logIt(`Got m2mToken`);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    // const token = m2mtoken;

    logIt('fetching list .......');
    const listAndPatientResource = await getListAndPatientResource(fileFolderId, oystehr);
    logIt('Got list resource');

    const documentsFolder: List | undefined = listAndPatientResource.list;

    if (!documentsFolder) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Can't fetch List resource with id=${fileFolderId}` }),
      };
    }

    const folderId = documentsFolder.identifier?.find((id) => {
      return id.type?.coding?.at(0)?.code === UNIVERSAL_DEVICE_IDENTIFIER_CODE && id.value;
    });
    const folderName = folderId?.value;
    if (!folderName) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `Found List resource with id=${fileFolderId} but it does not have Folder identifier`,
        }),
      };
    }

    logIt(`Folder name => [${folderName}]`);

    const fileZ3Url = makeZ3Url({ secrets, patientID: patientId, bucketName: folderName, fileName });
    const presignedFileUploadUrl = await createPresignedUrl(m2mtoken, fileZ3Url, 'upload');

    logIt(`created fileZ3Url: [${fileZ3Url}] :: presignedFileUploadUrl: [${presignedFileUploadUrl}]`);

    // const alterationRequests: BatchInputPostRequest<UpdateResourcesData>[] = [];

    const docRefReq = createDocumentReferenceRequest({
      patientId: patientId,
      folder: documentsFolder,
      documentReferenceData: {
        attachmentInfo: {
          fileUrl: fileZ3Url,
          fileTitle: fileName,
        },
      },
    });

    logIt(`making DocumentReference ...`);

    const results = await oystehr.fhir.transaction<DocumentReference>({
      requests: [docRefReq],
    });

    logIt(`making DocumentReference results => `);
    logIt(JSON.stringify(results));

    const docRef = results.entry?.[0]?.resource;
    if (!docRef || docRef?.resourceType !== 'DocumentReference') {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `Can't create a DocumentReference resource for the file ${fileName}`,
        }),
      };
    }

    const documentRefId = docRef.id;
    logIt(`created DocumentReference id = [${documentRefId}]`);
    if (!documentRefId) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `Can't create a DocumentReference resource for the file ${fileName} - empty documentRefId`,
        }),
      };
    }

    const updatedFolderEntries = [...(documentsFolder.entry ?? [])];
    updatedFolderEntries.push({
      date: DateTime.now().setZone('UTC').toISO() ?? '',
      item: {
        type: 'DocumentReference',
        reference: `DocumentReference/${documentRefId}`,
      },
    });

    const operations: Operation[] = [];

    operations.push(
      documentsFolder.entry && documentsFolder.entry?.length > 0
        ? replaceOperation('/entry', updatedFolderEntries)
        : addOperation('/entry', updatedFolderEntries)
    );

    logIt(`patching documents folder List ...`);

    const listPatchResult = await oystehr.fhir.patch<List>({
      resourceType: 'List',
      id: documentsFolder.id ?? '',
      operations: operations,
    });

    logIt(`patch results => `);
    logIt(JSON.stringify(listPatchResult));

    // const updatedFolder: List = { ...documentsFolder, entry: updatedFolderEntries };
    // await oystehr.fhir.patch<List>()

    const response: CreateUploadPatientDocumentOutput = {
      z3Url: fileZ3Url,
      presignedUploadUrl: presignedFileUploadUrl,
      documentRefId: documentRefId,
      folderId: fileFolderId,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('create-upload-document-url', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    logIt(`handler() end`);
  }
};

type ListAndPatientResource = {
  list?: List;
  patient?: Patient;
};

async function getListAndPatientResource(listId: string, oystehr: Oystehr): Promise<ListAndPatientResource> {
  const resources = (
    await oystehr.fhir.search<List | Patient>({
      resourceType: 'List',
      params: [
        {
          name: '_id',
          value: listId!,
        },
        {
          name: '_include',
          value: 'List:subject',
        },
      ],
    })
  ).unbundle();

  const lists: List[] = resources.filter((resource) => resource.resourceType === 'List') as List[];
  const listItem = lists?.at(0);

  const patients: Patient[] = resources.filter((resource) => resource.resourceType === 'Patient') as Patient[];
  const patientItem = patients?.at(0);

  return {
    list: listItem,
    patient: patientItem,
  };
}

type CreateDocRefInput = {
  patientId: string;
  folder: List;
  documentReferenceData: {
    attachmentInfo: { fileUrl: string; fileTitle: string; fileMimeType?: string };
  };
};

function createDocumentReferenceRequest(input: CreateDocRefInput): BatchInputPostRequest<DocumentReference> {
  logIt('createDocumentReference()');
  const { patientId, folder, documentReferenceData } = input;
  const { attachmentInfo } = documentReferenceData;

  const attachmentData = {
    url: attachmentInfo.fileUrl,
    contentType: attachmentInfo.fileMimeType,
    title: attachmentInfo.fileTitle,
  };
  const writeDRFullUrl = randomUUID();
  logIt(`writeDRFullUrl=${writeDRFullUrl}`);
  const references = {
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
  //   if (taskContext && writeDRFullUrl) {
  const writeDocRefReq: BatchInputPostRequest<DocumentReference> = {
    method: 'POST',
    fullUrl: writeDRFullUrl,
    url: '/DocumentReference',
    resource: {
      resourceType: 'DocumentReference',
      meta: {
        tag: [{ code: OTTEHR_MODULE.TM }],
      },
      date: DateTime.now().setZone('UTC').toISO() ?? '',
      status: 'current',
      type: resolveDocumentReferenceType({ folder: folder }),
      content: [{ attachment: { ...attachmentData } }],
      ...references,
    },
  };

  return writeDocRefReq;
}

//TODO:
const resolveDocumentReferenceType = ({ folder }: { folder: List }): CodeableConcept | undefined => {
  console.log(folder);
  return;
};
