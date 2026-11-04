import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter, Location, Organization, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getReferralDetails,
  getReferralRecipientContactId,
  getReferralSpecialty,
  getReferralStatus,
  getReferralUrgency,
  isReferralServiceRequest,
  REFERRAL_FORM_DOC_REF_DOCTYPE,
  REFERRAL_ORDER_TYPE_TAG_TOKEN,
} from 'utils/lib/fhir/referral';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { AdHocReferralRow, AdHocReferralsInput } from 'utils/lib/types/adhoc/datasets/referrals';
import { REFERRAL_DEFAULTS, REFERRAL_TASK } from 'utils/lib/types/api/referrals/referrals.types';
import { fetchScopedResources, presentFullName } from '../adhoc-report';
import { mapReferralRecipient } from '../referrals/recipient';

const uniq = (values: (string | undefined)[]): string[] =>
  Array.from(new Set(values.filter((value): value is string => !!value)));

const isReferralForm = (document: DocumentReference): boolean =>
  !!document.type?.coding?.some(
    (coding) =>
      coding.system === REFERRAL_FORM_DOC_REF_DOCTYPE.system && coding.code === REFERRAL_FORM_DOC_REF_DOCTYPE.code
  );

// The full fetch+map pipeline, separated from auth/transport so fixture tests can run it against a
// stubbed Oystehr client and assert the mapped rows parse with the endpoint's Zod schema.
export async function fetchAdHocReferralRows(
  oystehr: Oystehr,
  params: AdHocReferralsInput
): Promise<AdHocReferralRow[]> {
  const { dateRange, includeTask } = params;

  // Anchored on the referral's own `authoredOn` (created date), not on a visit: a referral made from the
  // patient record has no appointment to anchor on.
  const serviceRequests = (
    await getAllFhirSearchPages<ServiceRequest>(
      {
        resourceType: 'ServiceRequest',
        params: [
          { name: '_tag', value: REFERRAL_ORDER_TYPE_TAG_TOKEN },
          { name: 'authored', value: `ge${dateRange.start}` },
          { name: 'authored', value: `le${dateRange.end}` },
        ],
      },
      oystehr
    )
  ).filter(isReferralServiceRequest);

  const referralRefs = serviceRequests.map((sr) => `ServiceRequest/${sr.id}`);
  const encounterIds = uniq(serviceRequests.map((sr) => removePrefix('Encounter/', sr.encounter?.reference ?? '')));
  const organizationIds = uniq(serviceRequests.map(getReferralRecipientContactId));
  const practitionerIds = uniq(
    serviceRequests.map((sr) => removePrefix('Practitioner/', sr.requester?.reference ?? ''))
  );

  const [encounters, organizations, practitioners, relatedDocuments, tasks] = await Promise.all([
    fetchScopedResources<Encounter>(oystehr, 'Encounter', '_id', encounterIds, [
      { name: '_elements', value: 'id,appointment,location' },
    ]),
    fetchScopedResources<Organization>(oystehr, 'Organization', '_id', organizationIds),
    fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', practitionerIds, [
      { name: '_elements', value: 'id,name' },
    ]),
    // The form and the filed responses both relate to the ServiceRequest; the form is told apart by its type.
    fetchScopedResources<DocumentReference>(oystehr, 'DocumentReference', 'related', referralRefs, [
      { name: 'status', value: 'current' },
      { name: '_elements', value: 'id,date,type,context' },
    ]),
    includeTask
      ? fetchScopedResources<Task>(oystehr, 'Task', 'based-on', referralRefs, [
          { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${REFERRAL_TASK.category}` },
        ])
      : Promise.resolve([] as Task[]),
  ]);

  const encounterById = new Map(encounters.map((encounter) => [encounter.id ?? '', encounter]));
  const organizationById = new Map(organizations.map((organization) => [organization.id ?? '', organization]));
  const practitionerById = new Map(practitioners.map((practitioner) => [practitioner.id ?? '', practitioner]));
  // The first filed response per referral, by the document's own date.
  const firstResponseAtByReferralRef = new Map<string, string>();
  for (const document of relatedDocuments) {
    if (isReferralForm(document) || !document.date) continue;
    for (const ref of document.context?.related ?? []) {
      if (!ref.reference?.startsWith('ServiceRequest/')) continue;
      const earliest = firstResponseAtByReferralRef.get(ref.reference);
      if (!earliest || document.date < earliest) firstResponseAtByReferralRef.set(ref.reference, document.date);
    }
  }
  // The newest task per referral: a review task may follow the await-response task.
  const taskByReferralRef = new Map<string, Task>();
  for (const task of [...tasks].sort((a, b) => (a.authoredOn ?? '').localeCompare(b.authoredOn ?? ''))) {
    const ref = task.basedOn?.find((basedOn) => basedOn.reference?.startsWith('ServiceRequest/'))?.reference;
    if (ref) taskByReferralRef.set(ref, task);
  }

  const locationIds = uniq(
    encounters.map((encounter) =>
      removePrefix('Location/', encounter.location?.find((loc) => loc.location.reference)?.location.reference ?? '')
    )
  );
  const locations = await fetchScopedResources<Location>(oystehr, 'Location', '_id', locationIds, [
    { name: '_elements', value: 'id,name' },
  ]);
  const locationById = new Map(locations.map((location) => [location.id ?? '', location]));

  const rows: AdHocReferralRow[] = [];

  for (const serviceRequest of serviceRequests) {
    const details = getReferralDetails(serviceRequest);
    const encounterId = removePrefix('Encounter/', serviceRequest.encounter?.reference ?? '');
    const encounter = encounterId ? encounterById.get(encounterId) : undefined;
    const locationId = removePrefix(
      'Location/',
      encounter?.location?.find((loc) => loc.location.reference)?.location.reference ?? ''
    );
    const recipientContactId = getReferralRecipientContactId(serviceRequest);
    const organization = recipientContactId ? organizationById.get(recipientContactId) : undefined;
    const recipient = organization ? mapReferralRecipient(organization) : undefined;
    const referringProviderId = removePrefix('Practitioner/', serviceRequest.requester?.reference ?? '');
    const referringProvider = referringProviderId ? practitionerById.get(referringProviderId) : undefined;

    const responseReceivedAt = firstResponseAtByReferralRef.get(`ServiceRequest/${serviceRequest.id}`) ?? null;
    const sentAt = details?.sentAt ?? null;
    const daysSentToResponse =
      sentAt && responseReceivedAt
        ? Math.round(DateTime.fromISO(responseReceivedAt).diff(DateTime.fromISO(sentAt), 'days').days)
        : null;

    const row: AdHocReferralRow = {
      referralId: serviceRequest.id ?? '',
      patientId: removePrefix('Patient/', serviceRequest.subject?.reference ?? '') ?? '',
      encounterId: encounterId ?? null,
      appointmentId: removePrefix('Appointment/', encounter?.appointment?.[0]?.reference ?? '') ?? null,
      locationId: locationId ?? null,
      locationName: (locationId && locationById.get(locationId)?.name) || '',
      specialty: getReferralSpecialty(serviceRequest),
      recipientContactId: recipientContactId ?? null,
      recipientName: recipient?.name || serviceRequest.performer?.[0]?.display || '',
      referringProviderId: referringProviderId ?? null,
      referringProviderName: presentFullName(referringProvider) || serviceRequest.requester?.display || '',
      urgency: getReferralUrgency(serviceRequest),
      whatIsAsked: details?.whatIsAsked ?? REFERRAL_DEFAULTS.whatIsAsked,
      whoSchedules: details?.whoSchedules ?? REFERRAL_DEFAULTS.whoSchedules,
      responseRequested: details?.responseRequested ?? REFERRAL_DEFAULTS.responseRequested,
      status: getReferralStatus(serviceRequest),
      createdAt: serviceRequest.authoredOn ?? '',
      sentAt,
      responseReceivedAt,
      closedAt: details?.closedAt ?? null,
      closeReason: details?.closeReason ?? null,
      daysSentToResponse,
    };

    if (includeTask) {
      const task = taskByReferralRef.get(`ServiceRequest/${serviceRequest.id}`);
      row.taskId = task?.id ?? null;
      row.taskStatus = task?.status ?? null;
      row.overdueAt = task?.restriction?.period?.end ?? null;
      row.assignee = task?.owner?.display ?? '';
    }

    rows.push(row);
  }

  return rows;
}
