import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Secrets,
  InHouseLabDTO,
  convertActivityDefinitionToTestItem,
  PRACTITIONER_CODINGS,
  getFullestAvailableName,
  DiagnosisDTO,
  getTimezone,
  fetchLabOrderPDFs,
  fetchDocumentReferencesForDiagnosticReports,
  LabOrderPDF,
} from 'utils';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import {
  Task,
  ActivityDefinition,
  Encounter,
  Practitioner,
  Provenance,
  ServiceRequest,
  Location,
  FhirResource,
  Specimen,
  Observation,
  DiagnosticReport,
} from 'fhir/r4b';
import { determineOrderStatus, buildOrderHistory, getSpecimenDetails } from '../shared/inhouse-labs';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`get-in-house-lab-order-detail started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: { serviceRequestId: string; secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    secrets = validatedParameters.secrets;
    const { serviceRequestId } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const {
      serviceRequest,
      specimen,
      tasks,
      diagnosticReport,
      provenances,
      observations,
      attendingPractitionerName,
      currentPractitionerName,
      attendingPractitionerId,
      currentPractitionerId,
      timezone,
    } = await (async () => {
      const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

      const [
        myPractitionerId,
        { serviceRequest, encounter, diagnosticReport, specimen, timezone, tasks, provenances, observations },
      ] = await Promise.all([
        getMyPractitionerId(oystehrCurrentUser),
        oystehr.fhir
          .search<FhirResource>({
            resourceType: 'ServiceRequest',
            params: [
              { name: '_id', value: serviceRequestId },
              { name: '_include', value: 'ServiceRequest:encounter' },
              { name: '_include:iterate', value: 'Encounter:location' },
              { name: '_revinclude', value: 'Task:based-on' },
              { name: '_revinclude', value: 'Provenance:target' },
              { name: '_include', value: 'ServiceRequest:specimen' },
              { name: '_revinclude', value: 'DiagnosticReport:based-on' },
              { name: '_include:iterate', value: 'DiagnosticReport:result' },
            ],
          })
          .then((bundle) => {
            const resources = bundle.unbundle();
            return parseResources(resources);
          }),
      ]);

      if (!encounter) {
        throw new Error('Encounter not found');
      }

      const practitionerId = encounter.participant
        ?.find(
          (participant) =>
            participant.type?.find(
              (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
            )
        )
        ?.individual?.reference?.replace('Practitioner/', '');

      const attendingPractitionerPromise = practitionerId
        ? oystehr.fhir.get<Practitioner>({
            resourceType: 'Practitioner',
            id: practitionerId,
          })
        : Promise.resolve(null);

      const currentPractitionerPromise = myPractitionerId
        ? oystehr.fhir.get<Practitioner>({
            resourceType: 'Practitioner',
            id: myPractitionerId,
          })
        : Promise.resolve(null);

      const [attendingPractitioner, currentPractitioner] = await Promise.all([
        attendingPractitionerPromise,
        currentPractitionerPromise,
      ]);

      const attendingPractitionerName = attendingPractitioner
        ? getFullestAvailableName(attendingPractitioner) || ''
        : '';

      const currentPractitionerName = currentPractitioner ? getFullestAvailableName(currentPractitioner) || '' : '';

      const attendingPractitionerId = attendingPractitioner?.id || '';
      const currentPractitionerId = currentPractitioner?.id || '';

      return {
        serviceRequest,
        specimen,
        tasks,
        provenances,
        diagnosticReport,
        observations,
        attendingPractitionerName,
        currentPractitionerName,
        attendingPractitionerId,
        currentPractitionerId,
        timezone,
      };
    })();

    if (!serviceRequest || !serviceRequest.id) throw new Error('service request is missing');

    const adCanonicalUrl = serviceRequest?.instantiatesCanonical?.join('');
    if (!adCanonicalUrl) {
      // todo better error
      throw new Error('service request is missing instantiatesCanonical');
    }

    const activityDefinitionSearch = (
      await oystehr.fhir.search<ActivityDefinition>({
        resourceType: 'ActivityDefinition',
        params: [
          { name: 'url', value: adCanonicalUrl },
          { name: 'status', value: 'active' },
        ],
      })
    ).unbundle();

    if (activityDefinitionSearch.length !== 1)
      throw new Error(`Found ${activityDefinitionSearch.length} ActivityDefinition resources, there should only be 1`);

    const testItem = convertActivityDefinitionToTestItem(activityDefinitionSearch[0], observations);

    // Determine order status, info, and history
    const orderStatus = determineOrderStatus(serviceRequest, tasks);

    const diagnoses: DiagnosisDTO[] =
      serviceRequest?.reasonCode?.map((reason) => ({
        code: reason.coding?.[0]?.code || '',
        display: reason.coding?.[0]?.display || reason.text || '',
        isPrimary: false, // todo: we don't show this info in the UI, but better to have it here
      })) || [];

    const testName = serviceRequest?.code?.text || '';

    const notes = serviceRequest?.note?.[0]?.text;

    const orderHistory = buildOrderHistory(provenances, specimen);

    let resultsPDF: LabOrderPDF | undefined;
    if (diagnosticReport) {
      const resultsDocumentReferences = await fetchDocumentReferencesForDiagnosticReports(oystehr, [diagnosticReport]);
      const resultsPDFs = await fetchLabOrderPDFs(resultsDocumentReferences, m2mtoken);
      resultsPDF = resultsPDFs.filter((resultPDF) => resultPDF.diagnosticReportId === diagnosticReport.id)[0];
    }

    // todo better validations needed here
    // if (resultsPDFs.length > 1) {
    //   throw new Error('more than one results pdf');
    // }

    const response: InHouseLabDTO = {
      serviceRequestId,
      name: testItem.name,
      status: orderStatus,
      diagnosis: diagnoses.map((d) => `${d.code} ${d.display}`).join(', '),
      diagnosisDTO: diagnoses,
      labDetails: testItem,
      providerName: attendingPractitionerName,
      providerId: attendingPractitionerId,
      currentUserName: currentPractitionerName,
      currentUserId: currentPractitionerId,
      resultsPDFUrl: resultsPDF?.url,
      orderInfo: {
        diagnosis: diagnoses,
        testName,
        notes,
        status: orderStatus,
      },
      orderHistory,

      // todo: implement specimen retrieval
      specimen: specimen ? getSpecimenDetails(specimen) : undefined,

      notes: notes || '',
      timezone,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error processing in-house lab order resources:', error);
    await topLevelCatch('get-create-in-house-lab-order-resources', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};

const parseResources = (
  resources: FhirResource[]
): {
  serviceRequest: ServiceRequest;
  encounter: Encounter;
  location?: Location;
  specimen?: Specimen;
  diagnosticReport?: DiagnosticReport;
  timezone: string;
  tasks: Task[];
  provenances: Provenance[];
  observations: Observation[];
} => {
  let serviceRequest: ServiceRequest | undefined;
  let encounter: Encounter | undefined;
  let location: Location | undefined;
  let diagnosticReport: DiagnosticReport | undefined;
  let specimen: Specimen | undefined;
  const tasks: Task[] = [];
  const provenances: Provenance[] = [];
  const observations: Observation[] = [];

  resources.forEach((r) => {
    if (r.resourceType === 'ServiceRequest') serviceRequest = r;
    if (r.resourceType === 'Encounter') encounter = r;
    if (r.resourceType === 'Location') location = r;
    if (r.resourceType === 'DiagnosticReport') diagnosticReport = r;
    if (r.resourceType === 'Specimen') specimen = r;
    if (r.resourceType === 'Task') tasks.push(r);
    if (r.resourceType === 'Provenance') provenances.push(r);
    if (r.resourceType === 'Observation') observations.push(r);
  });

  const missingResources: string[] = [];
  if (!serviceRequest) missingResources.push('service request');
  if (!encounter) missingResources.push('encounter');
  if (tasks.length === 0) missingResources.push('task');
  if (!serviceRequest || !encounter || tasks.length === 0) {
    throw new Error(`Missing resources: ${missingResources.join(',')}`);
  }

  // todo figure this out
  const timezone = location ? getTimezone(location) : 'America/New_York';

  return {
    serviceRequest,
    encounter,
    location,
    diagnosticReport,
    specimen,
    timezone,
    tasks,
    provenances,
    observations,
  };
};
