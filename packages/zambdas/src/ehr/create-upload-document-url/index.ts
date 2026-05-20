import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, DocumentReference, List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  addOperation,
  BUCKET_NAMES,
  createCustomPatientDocumentList,
  fetchCustomFoldersCatalog,
  isCustomFolderList,
  isSyntheticFolderId,
  OTTEHR_MODULE,
  parseSyntheticFolderId,
  replaceOperation,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createPresignedUrl } from '../../shared/z3Utils';
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
  const oystehr = createOystehrClient(m2mToken, secrets);

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
    documentsFolder = await findOrCreatePatientCustomFolderList({
      patientId,
      internalName: resolvedInternalName,
      oystehr,
    });
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

type ListAndPatientResource = {
  list?: List;
  patient?: Patient;
};

async function findOrCreatePatientCustomFolderList(args: {
  patientId: string;
  internalName: string;
  oystehr: Oystehr;
}): Promise<List | undefined> {
  const { patientId, internalName, oystehr } = args;

  const existing = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'title', value: internalName },
      ],
    })
  ).unbundle()[0];
  if (existing) {
    logIt(`findOrCreatePatientCustomFolderList: found existing List ${existing.id} for "${internalName}"`);
    return existing;
  }

  // Resolve display name from the catalog rather than trusting the client.
  const catalog = await fetchCustomFoldersCatalog(oystehr);
  const def = catalog.find((d) => d.internalName === internalName);
  if (!def) {
    logIt(`findOrCreatePatientCustomFolderList: "${internalName}" not in catalog — refusing to create`);
    return undefined;
  }

  // Plain create: the SDK has no support for FHIR conditional create (If-None-Exist),
  // so the search-above + create-here pair is technically racy. In practice the race
  // window is tiny and only matters if the same admin uploads twice to the same lazy
  // folder concurrently. Worst case is two Lists with the same title; the read path
  // de-dupes by internalName so the user sees one folder, but one of the two upload
  // entries can be briefly hidden until reconciled. Acceptable for now.
  const created = await oystehr.fhir.create<List>(
    createCustomPatientDocumentList(`Patient/${patientId}`, def.internalName)
  );
  logIt(`findOrCreatePatientCustomFolderList: created List ${created.id} for "${internalName}"`);
  return created;
}

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

const sanitizeFileNameForZ3 = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9+!\-_'()\\.@$]/g, '_');
};
