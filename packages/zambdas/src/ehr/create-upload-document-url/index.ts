import { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { Secrets } from 'utils/lib/secrets';
import { addOperation, replaceOperation } from 'utils/lib/helpers/operations';
import { isCustomFolderList } from 'utils/lib/fhir/list';
import { isSyntheticFolderId, parseSyntheticFolderId } from 'utils/lib/types/data/custom-folder.types';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { makeZ3Url } from '../../shared/presigned-file-urls/helpers';
import { createPresignedUrl } from '../../shared/z3Utils';
import {
  findOrCreatePatientCustomFolderList,
  findOrCreatePatientSystemFolderList,
  getListAndPatientResource,
} from '../shared/patient-document-folders';
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
  // Internal name of the custom folder. When the patient has no per-patient List
  // for this folder yet (synthetic folder backed only by the catalog), we use this
  // to look up the catalog entry and lazily create the List.
  internalName?: string;
}

export interface CreateUploadPatientDocumentOutput {
  z3Url: string;
  presignedUploadUrl: string;
  documentRefId: string;
  folderId: string;
}
const ZAMBDA_NAME = 'create-upload-document';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  logIt(`handler() start.`);
  const validatedInput = validateRequestParameters(input);
  const { secrets, patientId, fileFolderId, fileName, internalName } = validatedInput;
  logIt(`validatedInput => `);
  logIt(JSON.stringify(validatedInput));

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  logIt(`Got m2mToken`);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  logIt('fetching list .......');
  let documentsFolder: List | undefined;
  // A "real" fileFolderId is a FHIR resource id; the client sends a sentinel
  // (`synthetic:${internalName}`) when the per-patient List doesn't exist yet.
  const isSynthetic = !fileFolderId || isSyntheticFolderId(fileFolderId);
  if (!isSynthetic) {
    documentsFolder = (await getListAndPatientResource(fileFolderId, oystehr)).list;
  }
  // Fall back to the embedded internalName if the client omitted the explicit field.
  const resolvedInternalName = internalName ?? parseSyntheticFolderId(fileFolderId);
  if (isSynthetic && (typeof resolvedInternalName !== 'string' || resolvedInternalName.length === 0)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'internalName is required (non-empty string) when fileFolderId is a synthetic folder id',
      }),
    };
  }
  if (!documentsFolder && resolvedInternalName) {
    logIt(`per-patient List missing for "${resolvedInternalName}" — looking up / creating lazily`);
    // A synthetic id can refer to either a system folder (FOLDERS_CONFIG) or a custom
    // folder (catalog). Try the system path first; it returns undefined for non-system
    // names so we fall through to the custom path.
    documentsFolder =
      (await findOrCreatePatientSystemFolderList({ patientId, internalName: resolvedInternalName, oystehr })) ??
      (await findOrCreatePatientCustomFolderList({ patientId, internalName: resolvedInternalName, oystehr }));
  }
  logIt('Got list resource');

  if (!documentsFolder) {
    if (isSynthetic) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `Custom folder "${resolvedInternalName}" not found in catalog (it may have been deleted or renamed)`,
        }),
      };
    }
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: `List resource not found (fileFolderId=${fileFolderId})`,
      }),
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

  const sanitizedFileName = sanitizeFileNameForZ3(fileName);
  // Custom folders all share a single Z3 bucket and are namespaced by an
  // {internalName}/ path segment. System folders keep one-bucket-per-folder.
  const isCustomFolder = isCustomFolderList(documentsFolder);
  const fileZ3Url = isCustomFolder
    ? makeZ3Url({
        secrets,
        patientID: patientId,
        bucketName: BUCKET_NAMES.CUSTOM_FOLDERS,
        folderName,
        fileName: sanitizedFileName,
      })
    : makeZ3Url({ secrets, patientID: patientId, bucketName: folderName, fileName: sanitizedFileName });
  const presignedFileUploadUrl = await createPresignedUrl(m2mToken, fileZ3Url, 'upload');

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
    folderId: documentsFolder.id ?? fileFolderId,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

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
