import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput, checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { DiagnosticReport, DocumentReference, FhirResource, ServiceRequest } from 'fhir/r4b';
import {
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  LAB_ORDER_PLACER_ID_SYSTEM,
  LabOrderResultPDFConfig,
  GetLabOrderResultRes,
  flattenBundleResources,
} from 'utils';
import { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { getLabOrderResultPDFConfig } from './helpers';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, encounter } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    // todo get this from a const, waiting for pdf logic to merge
    const LAB_RESULT_CODE = '51991-8';

    const docRefSearch: BatchInputRequest<FhirResource> = {
      method: 'GET',
      url: `/DocumentReference?type=${LAB_RESULT_CODE}&encounter=${encounter.id}&_include:iterate=DocumentReference:related&_include:iterate=DiagnosticReport:based-on`,
    };
    const activeLabServiceRequestSearch: BatchInputRequest<FhirResource> = {
      method: 'GET',
      url: `/ServiceRequest?encounter=Encounter/${encounter.id}&status=active`,
    };

    const searchResults: Bundle<FhirResource> = await oystehr.fhir.batch({
      requests: [docRefSearch, activeLabServiceRequestSearch],
    });
    const resources = flattenBundleResources<FhirResource>(searchResults);

    const documentReferences: DocumentReference[] = [];
    const activeServiceRequests: ServiceRequest[] = [];
    const serviceRequestMap: Record<string, ServiceRequest> = {};
    const diagnosticReportMap: Record<string, DiagnosticReport> = {};

    resources.forEach((resource) => {
      if (resource.resourceType === 'DocumentReference') documentReferences.push(resource as DocumentReference);
      if (resource.resourceType === 'ServiceRequest') {
        serviceRequestMap[`ServiceRequest/${resource.id}`] = resource as ServiceRequest;
        if (resource.status === 'active') activeServiceRequests.push(resource);
      }
      if (resource.resourceType === 'DiagnosticReport')
        diagnosticReportMap[`DiagnosticReport/${resource.id}`] = resource as DiagnosticReport;
    });

    const labOrderResults: GetLabOrderResultRes['labOrderResults'] = [];
    const reflexOrderResults: LabOrderResultPDFConfig[] = [];

    for (const docRef of documentReferences) {
      const diagnosticReportRef = docRef.context?.related?.find(
        (related) => related.reference?.startsWith('DiagnosticReport')
      )?.reference;
      if (diagnosticReportRef) {
        const relatedDR = diagnosticReportMap[diagnosticReportRef];
        const isReflex = relatedDR.meta?.tag?.find((t) => t.system === 'result-type' && t.display === 'reflex');
        const serviceRequestRef = relatedDR?.basedOn?.find((based) => based.reference?.startsWith('ServiceRequest'))
          ?.reference;
        if (serviceRequestRef) {
          const relatedSR = serviceRequestMap[serviceRequestRef];
          const orderNumber = relatedSR.identifier?.find((id) => id.system === LAB_ORDER_PLACER_ID_SYSTEM)?.value;
          const activityDef = relatedSR.contained?.find((resource) => resource.resourceType === 'ActivityDefinition');
          const testName = activityDef?.code?.coding?.find((c) => c.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display;
          const labName = activityDef?.publisher;
          let formattedName = `${testName} / ${labName}`;
          if (isReflex) {
            const reflexTestName = relatedDR.code.coding?.[0].display;
            formattedName = `${reflexTestName ? reflexTestName : 'Name missing'} (reflex)`;
          }

          const resultsConfigs = await getLabOrderResultPDFConfig(docRef, formattedName, m2mtoken, orderNumber);
          if (isReflex) {
            reflexOrderResults.push(...resultsConfigs);
          } else {
            labOrderResults.push(...resultsConfigs);
          }
        } else {
          // todo what to do here for unsolicited results
          // maybe we don't need to handle these for mvp
          console.log('no serviceRequestRef for', docRef.id);
        }
      } else {
        console.log('no diagnosticReportRef for', docRef.id);
        // something has gone awry during the document reference creation if there is no diagnostic report linked
        // so this shouldnt happen but if it does we will still surface the report
        const formattedName = 'Lab order result pdf - missing details';
        const resultsConfigs = await getLabOrderResultPDFConfig(docRef, formattedName, m2mtoken);
        labOrderResults.push(...resultsConfigs);
      }
    }

    // map reflex tests to their original ordered test
    reflexOrderResults.forEach((reflexRes) => {
      const ogOrderResIdx = labOrderResults.findIndex(
        (res) => res?.orderNumber && res.orderNumber === reflexRes.orderNumber
      );
      if (!labOrderResults[ogOrderResIdx].reflexResults) {
        labOrderResults[ogOrderResIdx].reflexResults = [reflexRes];
      } else {
        labOrderResults[ogOrderResIdx].reflexResults.push(reflexRes);
      }
    });

    // todo confirm this logic is sound
    const resultsPending = activeServiceRequests.length > 0;

    return {
      statusCode: 200,
      body: JSON.stringify({ labOrderResults, resultsPending }),
    };
  } catch (error: any) {
    await topLevelCatch('get-lab-order-results', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching lab orders: ${error}` }),
    };
  }
};
