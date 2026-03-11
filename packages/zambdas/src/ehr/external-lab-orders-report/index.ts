import { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Bundle,
  Encounter,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
  ServiceRequest,
} from 'fhir/r4b';
import {
  getInPersonVisitStatus,
  getPatientFirstName,
  getPatientLastName,
  getSecret,
  LabsRadsProdsReportZambdaOutput,
  OrderCategory,
  OrderReportItem,
  OrderSummaryItem,
  OTTEHR_MODULE,
  PSC_HOLD_CONFIG,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'external-lab-orders-report';

const ORDER_TYPE_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/order-type-tag';
const PROCEDURE_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/Procedure/procedure-type';

/** Classify a ServiceRequest as lab, radiology, or procedure based on meta tags */
function classifyServiceRequest(sr: ServiceRequest): OrderCategory | null {
  const tags = sr.meta?.tag || [];

  // Radiology: tagged with order-type-tag system + 'radiology' code
  if (tags.some((t) => t.system === ORDER_TYPE_CODE_SYSTEM && t.code === 'radiology')) {
    return 'radiology';
  }

  // Procedure: tagged with meta code 'procedure'
  if (tags.some((t) => t.code === 'procedure')) {
    return 'procedure';
  }

  // Lab: has contained ActivityDefinition (external lab order pattern)
  if (sr.contained?.some((c) => c.resourceType === 'ActivityDefinition')) {
    return 'lab';
  }

  return null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters;
  try {
    validatedParameters = validateRequestParameters(input);
    const { dateRange, locationId, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log('Searching for completed encounters in date range:', dateRange, 'location:', locationId);

    // Step 1: Fetch completed encounters
    let allResources: (Appointment | Encounter | Patient | Location | Practitioner)[] = [];
    let offset = 0;
    const pageSize = 1000;

    const baseSearchParams = [
      { name: 'date', value: `ge${dateRange.start}` },
      { name: 'date', value: `le${dateRange.end}` },
      { name: 'status', value: 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist' },
      { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
      { name: '_include', value: 'Appointment:patient' },
      { name: '_include', value: 'Appointment:location' },
      { name: '_revinclude', value: 'Encounter:appointment' },
      { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
      { name: '_sort', value: 'date' },
      { name: '_count', value: pageSize.toString() },
    ];

    if (locationId) {
      baseSearchParams.push({ name: 'location', value: `Location/${locationId}` });
    }

    let searchBundle = await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    let pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);

    while (searchBundle.link?.find((link) => link.relation === 'next')) {
      offset += pageSize;
      pageCount++;

      searchBundle = await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner>({
        resourceType: 'Appointment',
        params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
      });

      pageResources = searchBundle.unbundle();
      allResources = allResources.concat(pageResources);

      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }
    }

    // Separate resources by type
    const encounters = allResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
    const appointments = allResources.filter((r): r is Appointment => r.resourceType === 'Appointment');
    const patients = allResources.filter((r): r is Patient => r.resourceType === 'Patient');
    const locations = allResources.filter((r): r is Location => r.resourceType === 'Location');
    const practitioners = allResources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');

    console.log(
      `Found ${encounters.length} encounters, ${appointments.length} appointments, ${patients.length} patients`
    );

    // Create lookup maps
    const appointmentMap = new Map<string, Appointment>();
    appointments.forEach((apt) => {
      if (apt.id) appointmentMap.set(`Appointment/${apt.id}`, apt);
    });

    const patientMap = new Map<string, Patient>();
    patients.forEach((p) => {
      if (p.id) patientMap.set(`Patient/${p.id}`, p);
    });

    const locationMap = new Map<string, Location>();
    locations.forEach((loc) => {
      if (loc.id) locationMap.set(`Location/${loc.id}`, loc);
    });

    const practitionerMap = new Map<string, Practitioner>();
    practitioners.forEach((prac) => {
      if (prac.id) practitionerMap.set(prac.id, prac);
    });

    // Filter to completed encounters — include completed, discharged, and awaiting supervisor approval
    const completedStatuses = ['completed', 'discharged', 'awaiting supervisor approval'];
    const completedEncounters = encounters.filter((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;
      if (!appointment) return false;
      const visitStatus = getInPersonVisitStatus(appointment, encounter, true);
      return completedStatuses.includes(visitStatus);
    });

    console.log(`Found ${completedEncounters.length} completed encounters`);

    if (completedEncounters.length === 0) {
      const response: LabsRadsProdsReportZambdaOutput = {
        message: 'No completed encounters found for the specified date range',
        totalOrders: 0,
        summary: [],
        orders: [],
        dateRange,
        locationId,
      };
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    // Step 2: Fetch ServiceRequests for completed encounters via batch requests
    // Include performer (for lab Organization) in the search
    const encounterIds = completedEncounters.map((e) => e.id).filter(Boolean) as string[];

    const allBatchRequests: BatchInputGetRequest[] = encounterIds.map((encounterId) => ({
      method: 'GET',
      url: `/ServiceRequest?encounter=Encounter/${encounterId}&_include=ServiceRequest:performer:Organization&_count=100`,
    }));

    const BATCH_SIZE = 50;
    const requestBatches: BatchInputGetRequest[][] = [];
    for (let i = 0; i < allBatchRequests.length; i += BATCH_SIZE) {
      requestBatches.push(allBatchRequests.slice(i, i + BATCH_SIZE));
    }

    console.log(`Fetching ServiceRequests for ${encounterIds.length} encounters in ${requestBatches.length} batch(es)`);

    const allBatchResults = await Promise.all(
      requestBatches.map(async (batchRequests, batchIndex) => {
        console.log(`Executing batch ${batchIndex + 1}/${requestBatches.length} with ${batchRequests.length} requests`);
        return await oystehr.fhir.batch<FhirResource>({ requests: batchRequests });
      })
    );

    // Parse batch results
    const serviceRequests: ServiceRequest[] = [];
    const organizations: Organization[] = [];

    allBatchResults.forEach((batchResult) => {
      batchResult.entry?.forEach((entry) => {
        if (
          entry.response?.outcome?.id === 'ok' &&
          entry.resource &&
          entry.resource.resourceType === 'Bundle' &&
          entry.resource.type === 'searchset'
        ) {
          const innerBundle = entry.resource as Bundle;
          innerBundle.entry?.forEach((innerEntry) => {
            if (innerEntry.resource?.resourceType === 'ServiceRequest') {
              serviceRequests.push(innerEntry.resource as ServiceRequest);
            } else if (innerEntry.resource?.resourceType === 'Organization') {
              organizations.push(innerEntry.resource as Organization);
            }
          });
        }
      });
    });

    console.log(`Found ${serviceRequests.length} total ServiceRequests`);

    // Debug: log classification of each ServiceRequest
    serviceRequests.forEach((sr) => {
      const category = classifyServiceRequest(sr);
      const tags = sr.meta?.tag?.map((t) => `${t.system}|${t.code}`).join(', ') || 'no tags';
      console.log(`SR ${sr.id}: status=${sr.status}, intent=${sr.intent}, category=${category}, tags=[${tags}]`);
    });

    // Create organization lookup
    const orgMap = new Map<string, Organization>();
    organizations.forEach((org) => {
      if (org.id) orgMap.set(`Organization/${org.id}`, org);
    });

    // Build encounter-to-appointment map
    const encounterToAppointment = new Map<string, Appointment>();
    completedEncounters.forEach((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;
      if (encounter.id && appointment) {
        encounterToAppointment.set(encounter.id, appointment);
      }
    });

    // Step 3: Classify and build report items
    const orders: OrderReportItem[] = serviceRequests
      .map((sr): OrderReportItem | null => {
        if (!sr.id) return null;

        // Classify the order
        const orderCategory = classifyServiceRequest(sr);
        if (!orderCategory) return null;

        // Skip entered-in-error and revoked
        if (sr.status === 'entered-in-error' || sr.status === 'revoked') return null;

        // Get encounter reference
        const encounterRef = sr.encounter?.reference;
        const encounterId = encounterRef?.replace('Encounter/', '') || '';

        // Get appointment from encounter
        const appointment = encounterToAppointment.get(encounterId);

        // Get patient
        const patientRef = sr.subject?.reference;
        const patient = patientRef ? patientMap.get(patientRef) : undefined;
        const patientName = patient
          ? `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim()
          : 'Unknown';

        // Get order name and code based on category
        let orderName = 'Unknown';
        let orderCode: string | undefined;

        if (orderCategory === 'lab') {
          // Lab: name from contained ActivityDefinition, code from SR.code
          const activityDef = sr.contained?.find((c) => c.resourceType === 'ActivityDefinition');
          if (activityDef && 'title' in activityDef) {
            orderName = (activityDef as { title?: string }).title || 'Unknown';
          }
          if (sr.code?.coding?.[0]) {
            orderCode = sr.code.coding[0].code;
            if (orderName === 'Unknown') {
              orderName = sr.code.coding[0].display || sr.code.coding[0].code || 'Unknown';
            }
          }
        } else if (orderCategory === 'radiology') {
          // Radiology: CPT code from SR.code
          if (sr.code?.coding?.[0]) {
            orderCode = sr.code.coding[0].code;
            orderName = sr.code.coding[0].display || sr.code.coding[0].code || 'Unknown';
          }
        } else if (orderCategory === 'procedure') {
          // Procedure: type from SR.category with procedure-type system
          const procedureTypeCoding = sr.category
            ?.flatMap((cat) => cat.coding || [])
            .find((c) => c.system === PROCEDURE_TYPE_SYSTEM);
          if (procedureTypeCoding) {
            orderName = procedureTypeCoding.display || procedureTypeCoding.code || 'Unknown';
            orderCode = procedureTypeCoding.code;
          }
          // Also check SR.code for CPT
          if (sr.code?.coding?.[0] && orderName === 'Unknown') {
            orderCode = sr.code.coding[0].code;
            orderName = sr.code.coding[0].display || sr.code.coding[0].code || 'Unknown';
          }
        }

        // Get ordering provider (requester)
        let orderingProvider = 'Unknown';
        const requesterRef = sr.requester?.reference;
        if (requesterRef) {
          const practitionerId = requesterRef.replace('Practitioner/', '');
          const practitioner = practitionerMap.get(practitionerId);
          if (practitioner) {
            orderingProvider = `${practitioner.name?.[0]?.given?.[0] || ''} ${
              practitioner.name?.[0]?.family || ''
            }`.trim();
          }
        }

        // Get location from appointment
        let locationName = 'Unknown';
        let locationIdValue: string | undefined;
        const locationRef = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
          ?.reference;
        if (locationRef) {
          const loc = locationMap.get(locationRef);
          locationName = loc?.name || 'Unknown';
          locationIdValue = locationRef.replace('Location/', '');
        }

        // Get diagnoses from reasonCode
        const diagnoses = sr.reasonCode?.map((rc) => rc.coding?.[0]?.display || rc.text || '').filter(Boolean) || [];

        // Get order date
        const orderDate = sr.authoredOn || appointment?.start || '';

        // Lab-specific fields
        let labOrganization: string | undefined;
        let isPSC: boolean | undefined;
        if (orderCategory === 'lab') {
          labOrganization = 'Unknown';
          const performerRef = sr.performer?.[0]?.reference;
          if (performerRef) {
            const org = orgMap.get(performerRef);
            if (org) labOrganization = org.name || 'Unknown';
          }
          isPSC = sr.category?.some((cat) => cat.coding?.some((c) => c.code === PSC_HOLD_CONFIG.code)) || false;
        }

        // Radiology-specific fields
        let isStat: boolean | undefined;
        if (orderCategory === 'radiology') {
          isStat = sr.priority === 'stat';
        }

        return {
          serviceRequestId: sr.id,
          orderCategory,
          orderName,
          orderCode,
          orderDate,
          patientId: patient?.id || '',
          patientName,
          encounterId,
          encounterDate: appointment?.start || '',
          orderingProvider,
          location: locationName,
          locationId: locationIdValue,
          status: sr.status,
          diagnoses,
          labOrganization,
          isPSC,
          isStat,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort by order date descending
    orders.sort((a, b) => {
      const dateA = new Date(a.orderDate || '').getTime();
      const dateB = new Date(b.orderDate || '').getTime();
      return dateB - dateA;
    });

    // Step 4: Build summary aggregation
    const summaryMap = new Map<string, OrderSummaryItem>();
    orders.forEach((order) => {
      const key = `${order.orderCategory}:${order.orderCode || order.orderName}`;
      const existing = summaryMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        summaryMap.set(key, {
          orderName: order.orderName,
          orderCode: order.orderCode,
          orderCategory: order.orderCategory,
          count: 1,
        });
      }
    });

    const summary: OrderSummaryItem[] = Array.from(summaryMap.values()).sort((a, b) => b.count - a.count);

    const labCount = orders.filter((o) => o.orderCategory === 'lab').length;
    const radCount = orders.filter((o) => o.orderCategory === 'radiology').length;
    const procCount = orders.filter((o) => o.orderCategory === 'procedure').length;

    console.log(
      `Report complete: ${orders.length} total orders (${labCount} labs, ${radCount} rads, ${procCount} procs), ${summary.length} unique types`
    );

    const response: LabsRadsProdsReportZambdaOutput = {
      message: `Found ${orders.length} orders (${labCount} labs, ${radCount} radiology, ${procCount} procedures) from ${completedEncounters.length} completed encounters`,
      totalOrders: orders.length,
      summary,
      orders,
      dateRange,
      locationId,
    };

    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
