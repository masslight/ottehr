import { DiagnosticReport, DocumentReference, ServiceRequest } from 'fhir/r4b';
import fs from 'fs';
import { LAB_DR_TYPE_TAG, LAB_RESULT_HL7_DOC_REF_CODING_CODE, LabType } from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';

// Grabs all of the DiagnosticReports for a given order number, their ServiceRequest, and the transmission DocRef
// npm run get-lab-sr-dr-docref ['local' | 'dev' | 'development' | 'testing' | 'staging'] [orderNumber]

interface GroupedResources {
  testName: string;
  diagnosticReportRef: string;
  resultType: Omit<LabType, 'in-house'> | undefined;
  serviceRequestIdRef?: string;
  documentReferenceInfo: {
    documentReferenceRef: string;
    documentReferenceType: string;
    lastUpdated: string;
    status: string;
    hl7?: string;
  }[];
}

const EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];

const main = async (): Promise<void> => {
  if (process.argv.length !== 4) {
    console.log(`exiting, incorrect number of arguments passed\n`);
    console.log(`Usage: npm run get-lab-sr-dr-docref [orderNumber] [${EXAMPLE_ENVS.join(' | ')}]\n`);
    process.exit(1);
  }

  const ENV = process.argv[3];
  const orderNumber = process.argv[2];

  let envConfig;
  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  } catch (error) {
    console.error(`Error parsing secrets for ENV '${ENV}'. Error: ${JSON.stringify(error)}`);
  }

  const token = await getAuth0Token(envConfig);
  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehr = createOystehrClient(token, envConfig);

  const resources = (
    await oystehr.fhir.search<ServiceRequest | DiagnosticReport | DocumentReference>({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: 'identifier',
          value: `${orderNumber}`, // order number or accession number
        },
        {
          name: '_include',
          value: 'DiagnosticReport:based-on',
        },
        {
          name: '_revinclude',
          value: 'DocumentReference:related',
        },
      ],
    })
  ).unbundle();

  // console.log(`Resources: ${JSON.stringify(resources, undefined, 2)}`);

  const allDiagnosticReports = resources.filter((res): res is DiagnosticReport => {
    return res.resourceType === 'DiagnosticReport';
  });

  const emptyGroupedResources: GroupedResources = {
    testName: '',
    diagnosticReportRef: '',
    resultType: undefined,
    documentReferenceInfo: [],
  };

  const resourcesByDiagnosticReportRef = new Map<string, GroupedResources>();

  allDiagnosticReports.forEach((dr) => {
    const srRef = dr.basedOn?.find((basedOn) => basedOn.reference?.startsWith('ServiceRequest/'))?.reference;

    const resultType = dr.meta?.tag?.find((tag) => tag.system === LAB_DR_TYPE_TAG.system)?.code ?? LabType.external;

    const drRef = `DiagnosticReport/${dr.id}`;
    const testName = dr.code.coding?.[0]?.display ?? '';
    resourcesByDiagnosticReportRef.set(drRef, {
      ...emptyGroupedResources,
      testName,
      diagnosticReportRef: drRef,
      ...(srRef ? { serviceRequestIdRef: srRef } : {}),
      resultType,
    });
  });

  resources.forEach((res) => {
    if (res.resourceType === 'DocumentReference') {
      const documentReferenceRef = `DocumentReference/${res.id}`;
      const docRefDrRef = res.context?.related?.find((related) => related.reference?.startsWith('DiagnosticReport/'))
        ?.reference;
      if (!docRefDrRef) return;

      const groupedResources = resourcesByDiagnosticReportRef.get(docRefDrRef);
      if (!groupedResources) {
        console.warn(`${documentReferenceRef} has a related DR but that DR wasn't in our map`);
        return;
      }
      const existingDocRefInfo = [...groupedResources.documentReferenceInfo];

      const docRefTypeCoding = res.type?.coding?.[0];
      if (!docRefTypeCoding) {
        console.warn(`No docRefCoding for ${documentReferenceRef}`);
        return;
      }
      const isHL7Transmission =
        docRefTypeCoding.system === LAB_RESULT_HL7_DOC_REF_CODING_CODE.system &&
        docRefTypeCoding.code === LAB_RESULT_HL7_DOC_REF_CODING_CODE.code;

      // the transmission docRef is being superseded so we'll have a different branch of logic for that
      if (!isHL7Transmission && res.status === 'current') {
        // if (docRefTypeCoding.system !== LAB_RESULT_DOC_REF_CODING_CODE.system && docRefTypeCoding.code !== LAB_RESULT_DOC_REF_CODING_CODE.code) return;
        existingDocRefInfo.push({
          documentReferenceRef,
          documentReferenceType: docRefTypeCoding.display ?? '',
          lastUpdated: res.meta?.lastUpdated ?? '',
          status: res.status,
        });
      } else if (isHL7Transmission) {
        const hl7B64 = res.content.find((cont) => cont.attachment.contentType === 'hl7')?.attachment.data;

        existingDocRefInfo.push({
          documentReferenceRef,
          documentReferenceType: docRefTypeCoding.display ?? '',
          lastUpdated: res.meta?.lastUpdated ?? '',
          status: res.status,
          hl7: hl7B64 ? safeDecodeBase64String(hl7B64) : 'No HL7 found',
        });
      }

      resourcesByDiagnosticReportRef.set(docRefDrRef, {
        ...groupedResources,
        documentReferenceInfo: existingDocRefInfo,
      });
    }
  });

  console.log(`Found ${allDiagnosticReports.length} DiagnosticReport resources:\n\n`);
  for (const [key, resources] of resourcesByDiagnosticReportRef.entries()) {
    console.log(`Resources for: ${key}`);
    console.log(JSON.stringify(resources, undefined, 2));
    console.log();
  }
};

main().catch((error) => {
  console.log(error, JSON.stringify(error, null, 2));
  throw error;
});

/**
 * Safely decode a base64 encoded string. If the input is not base64 encoded, it is returned as is.
 * @param input a string that is maybe base64 encoded
 * @returns
 */
function safeDecodeBase64String(input: string): string {
  const buff = Buffer.from(input, 'base64');
  if (buff.toString('base64') !== input) {
    return input;
  }
  return buff.toString('utf-8');
}
