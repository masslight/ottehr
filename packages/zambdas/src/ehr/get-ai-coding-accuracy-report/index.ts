import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import {
  getAttendingPractitionerId,
  getPatientFirstName,
  getPatientLastName,
  getProviderNameWithProfession,
  OTTEHR_MODULE,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { AI_CODING_SUGGESTION_CODE, AI_CODING_SUGGESTION_SYSTEM } from '../recommend-billing-suggestions/index';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'get-ai-coding-accuracy-report';

interface SuggestionRecord {
  suggestions: {
    icdCodes: { code: string; description: string; reason: string }[];
    cptCodes: { code: string; description: string; reason: string }[];
    emCode: { code: string; description: string; upcodingSuggestion: string }[];
    codingSuggestions: string;
  };
  inputSnapshot: {
    diagnoses: { code: string; display?: string; isPrimary?: boolean }[] | undefined;
    billing: { code: string; display?: string }[] | undefined;
  };
  timestamp: string;
}

export interface AiCodingAccuracyRow {
  encounterId: string;
  appointmentId: string;
  patientName: string;
  appointmentStart: string;
  location: string;
  provider: string;
  suggestionCount: number;
  suggestedIcd: string[];
  actualIcd: string[];
  suggestedCpt: string[];
  actualCpt: string[];
  suggestedEm: string[];
  actualEm: string;
  icdValidRate: string;
  icdInvalidRate: string;
  cptValidRate: string;
  cptInvalidRate: string;
  emMatch: boolean;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  const { dateRange, locationIds, secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  // Search for appointments in date range with encounters and document references
  let allResources: (Appointment | Encounter | Patient | Location | Practitioner | DocumentReference)[] = [];
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
    { name: '_revinclude:iterate', value: 'DocumentReference:encounter' },
    { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
    { name: '_sort', value: 'date' },
    { name: '_count', value: pageSize.toString() },
  ];

  if (locationIds && locationIds.length > 0) {
    baseSearchParams.push({
      name: 'location',
      value: locationIds.map((id) => `Location/${id}`).join(','),
    });
  }

  let searchBundle = await oystehr.fhir.search<
    Appointment | Encounter | Patient | Location | Practitioner | DocumentReference
  >({
    resourceType: 'Appointment',
    params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
  });

  let pageCount = 1;
  let pageResources = searchBundle.unbundle();
  allResources = allResources.concat(pageResources);

  while (searchBundle.link?.find((link) => link.relation === 'next')) {
    offset += pageSize;
    pageCount++;
    if (pageCount > 100) break;

    searchBundle = await oystehr.fhir.search<
      Appointment | Encounter | Patient | Location | Practitioner | DocumentReference
    >({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });
    pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);
  }

  // Separate by type
  const encounters = allResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const appointments = allResources.filter((r): r is Appointment => r.resourceType === 'Appointment');
  const patients = allResources.filter((r): r is Patient => r.resourceType === 'Patient');
  const locations = allResources.filter((r): r is Location => r.resourceType === 'Location');
  const practitioners = allResources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  const documentReferences = allResources.filter((r): r is DocumentReference => r.resourceType === 'DocumentReference');

  // Lookup maps
  const patientMap = new Map(patients.map((p) => [`Patient/${p.id}`, p]));
  const locationMap = new Map(locations.map((l) => [`Location/${l.id}`, l]));
  const practitionerMap = new Map(practitioners.map((p) => [p.id!, p]));
  const appointmentMap = new Map(appointments.map((a) => [`Appointment/${a.id}`, a]));

  const EM_CODE_SET = new Set(['99202', '99203', '99204', '99205', '99212', '99213', '99214', '99215']);

  // Group all AI suggestion DocumentReferences by encounter
  const encounterSuggestionsMap = new Map<string, DocumentReference[]>();
  documentReferences.forEach((docRef) => {
    const encounterRef = docRef.context?.encounter?.[0]?.reference;
    if (!encounterRef) return;
    const isAiSuggestion = docRef.type?.coding?.some(
      (coding) => coding.system === AI_CODING_SUGGESTION_SYSTEM && coding.code === AI_CODING_SUGGESTION_CODE
    );
    if (!isAiSuggestion) return;

    const existing = encounterSuggestionsMap.get(encounterRef) || [];
    existing.push(docRef);
    encounterSuggestionsMap.set(encounterRef, existing);
  });

  // Build report rows — one per encounter, aggregating all suggestion runs
  const rows: AiCodingAccuracyRow[] = [];

  for (const encounter of encounters) {
    if (!encounter.id) continue;
    const suggestionDocRefs = encounterSuggestionsMap.get(`Encounter/${encounter.id}`);
    if (!suggestionDocRefs || suggestionDocRefs.length === 0) continue;

    // Decode all suggestion records for this encounter
    const records: SuggestionRecord[] = [];
    for (const docRef of suggestionDocRefs) {
      const attachmentData = docRef.content?.[0]?.attachment?.data;
      if (!attachmentData) continue;
      try {
        records.push(JSON.parse(Buffer.from(attachmentData, 'base64').toString('utf8')));
      } catch {
        continue;
      }
    }
    if (records.length === 0) continue;

    // Sort by timestamp to identify first and last
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Union all suggested codes across all runs
    const allSuggestedIcd = new Set<string>();
    const allSuggestedCpt = new Set<string>();
    const allSuggestedEm = new Set<string>();
    for (const record of records) {
      (record.suggestions.icdCodes || []).forEach((c) => allSuggestedIcd.add(c.code));
      (record.suggestions.cptCodes || []).forEach((c) => allSuggestedCpt.add(c.code));
      (record.suggestions.emCode || []).forEach((c) => allSuggestedEm.add(c.code));
    }

    // Actual codes from the most recent run's inputSnapshot (latest chart state)
    const lastRecord = records[records.length - 1];
    const actualDiagnoses = lastRecord.inputSnapshot.diagnoses || [];
    const actualBilling = lastRecord.inputSnapshot.billing || [];
    const actualIcdCodes = new Set(actualDiagnoses.map((d) => d.code));
    const actualCptCodes = new Set(actualBilling.filter((b) => !EM_CODE_SET.has(b.code)).map((b) => b.code));
    const actualEmCode = actualBilling.find((b) => EM_CODE_SET.has(b.code))?.code || '';

    // For ICD codes, consider a match if the base code (before the period) matches
    // e.g. S42.001A and S42.002A both have base "S42" and count as a match
    const icdBaseMatch = (code: string, codeSet: Set<string>): boolean => {
      if (codeSet.has(code)) return true;
      const base = code.split('.')[0];
      if (base && base !== code) {
        return [...codeSet].some((c) => c.split('.')[0] === base);
      }
      return false;
    };

    // Coverage = what % of actual codes were suggested by the AI at any point
    const icdMatched = [...actualIcdCodes].filter((c) => icdBaseMatch(c, allSuggestedIcd)).length;
    const icdValidRate = actualIcdCodes.size > 0 ? `${icdMatched}/${actualIcdCodes.size}` : '';
    const icdSuggestedMatched = [...allSuggestedIcd].filter((c) => icdBaseMatch(c, actualIcdCodes)).length;
    const icdMissed = allSuggestedIcd.size > 0 ? allSuggestedIcd.size - icdSuggestedMatched : 0;
    const icdInvalidRate = allSuggestedIcd.size > 0 ? `${icdMissed}/${allSuggestedIcd.size}` : '';
    const cptMatched = [...actualCptCodes].filter((c) => allSuggestedCpt.has(c)).length;
    const cptValidRate = actualCptCodes.size > 0 ? `${cptMatched}/${actualCptCodes.size}` : '';
    const cptMissed = allSuggestedCpt.size > 0 ? allSuggestedCpt.size - cptMatched : 0;
    const cptInvalidRate = allSuggestedCpt.size > 0 ? `${cptMissed}/${allSuggestedCpt.size}` : '';
    const emMatch = actualEmCode ? allSuggestedEm.has(actualEmCode) : false;

    // Find the appointment for this encounter
    const appointmentRef = encounter.appointment?.[0]?.reference;
    const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;
    if (!appointment) continue;

    const patientRef = encounter.subject?.reference;
    const patient = patientRef ? patientMap.get(patientRef) : undefined;
    const patientName = patient ? `${getPatientLastName(patient)}, ${getPatientFirstName(patient)}` : 'Unknown';

    const locationRef = encounter.location?.[0]?.location?.reference;
    const location = locationRef ? locationMap.get(locationRef) : undefined;

    const practitionerId = getAttendingPractitionerId(encounter);
    const practitioner = practitionerId ? practitionerMap.get(practitionerId) : undefined;
    const providerName = practitioner ? getProviderNameWithProfession(practitioner) : 'Unknown';

    rows.push({
      encounterId: encounter.id,
      appointmentId: appointment.id!,
      patientName,
      appointmentStart: appointment.start || '',
      location: location?.name || 'Unknown',
      provider: providerName,
      suggestionCount: records.length,
      suggestedIcd: [...allSuggestedIcd],
      actualIcd: [...actualIcdCodes],
      suggestedCpt: [...allSuggestedCpt],
      actualCpt: [...actualCptCodes],
      suggestedEm: [...allSuggestedEm],
      actualEm: actualEmCode,
      icdValidRate,
      icdInvalidRate,
      cptValidRate,
      cptInvalidRate,
      emMatch,
    });
  }

  // Summary: average coverage (% of actual codes that were suggested)
  const totalEncounters = rows.length;
  const rowsWithActualIcd = rows.filter((r) => r.actualIcd.length > 0);
  const rowsWithActualCpt = rows.filter((r) => r.actualCpt.length > 0);
  const rowsWithActualEm = rows.filter((r) => r.actualEm);

  const avgIcdCoverage =
    rowsWithActualIcd.length > 0
      ? rowsWithActualIcd.reduce((sum, r) => {
          const [matched, total] = r.icdValidRate.split('/').map(Number);
          return sum + (total > 0 ? matched / total : 0);
        }, 0) / rowsWithActualIcd.length
      : 0;
  const rowsWithSuggestedIcd = rows.filter((r) => r.icdInvalidRate);
  const rowsWithSuggestedCpt = rows.filter((r) => r.cptInvalidRate);
  const avgIcdMissRate =
    rowsWithSuggestedIcd.length > 0
      ? rowsWithSuggestedIcd.reduce((sum, r) => {
          const [missed, total] = r.icdInvalidRate.split('/').map(Number);
          return sum + (total > 0 ? missed / total : 0);
        }, 0) / rowsWithSuggestedIcd.length
      : 0;
  const avgCptCoverage =
    rowsWithActualCpt.length > 0
      ? rowsWithActualCpt.reduce((sum, r) => {
          const [matched, total] = r.cptValidRate.split('/').map(Number);
          return sum + (total > 0 ? matched / total : 0);
        }, 0) / rowsWithActualCpt.length
      : 0;
  const avgCptMissRate =
    rowsWithSuggestedCpt.length > 0
      ? rowsWithSuggestedCpt.reduce((sum, r) => {
          const [missed, total] = r.cptInvalidRate.split('/').map(Number);
          return sum + (total > 0 ? missed / total : 0);
        }, 0) / rowsWithSuggestedCpt.length
      : 0;
  const emMatchRate =
    rowsWithActualEm.length > 0 ? rowsWithActualEm.filter((r) => r.emMatch).length / rowsWithActualEm.length : 0;

  return {
    statusCode: 200,
    body: JSON.stringify({
      encounters: rows,
      summary: {
        totalEncounters,
        icdValidRate: Math.round(avgIcdCoverage * 100),
        icdInvalidRate: Math.round(avgIcdMissRate * 100),
        cptValidRate: Math.round(avgCptCoverage * 100),
        cptInvalidRate: Math.round(avgCptMissRate * 100),
        emMatchRate: Math.round(emMatchRate * 100),
      },
    }),
  };
});
