import {
  Appointment,
  Coding,
  Communication,
  Coverage,
  DiagnosticReport,
  Location,
  Organization,
  Practitioner,
  Provenance,
  Questionnaire,
  QuestionnaireResponse,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import {
  LAB_DR_TYPE_TAG,
  LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY,
  LAB_ORDER_LEVEL_NOTE_CATEGORY,
  LAB_ORDER_TASK,
  LABS_COMMUNICATION_CATEGORY_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  PSC_HOLD_CONFIG,
  RELATED_SPECIMEN_DEFINITION_SYSTEM,
  SPECIMEN_CODING_CONFIG,
  SR_REVOKED_REASON_EXT,
} from 'utils/lib/types/data/labs/labs.constants';
import { ExternalLabsStatus, LabOrderDetailedPageDTO, LabOrderListPageDTO } from 'utils/lib/types/data/labs/labs.types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  extractLabResources,
  mapResourcesToLabOrderDTOs,
  parseAccessionNumbers,
  parseAccountNumber,
  parseDiagnoses,
  parseDx,
  parseIsPSC,
  parseLabOrderAddedDate,
  parseLabOrderLastResultReceivedDate,
  parseLabOrdersHistory,
  parseLabOrderStatus,
  parseLabOrderStatusWithSpecificTask,
  parseLResultsDetails,
  parsePaginationFromResponse,
  parsePatientLabItems,
  parsePerformed,
  parsePerformedDate,
  parsePractitionerIdFromServiceRequest,
  parsePractitionerIdFromTask,
  parsePractitionerName,
  parsePractitionerNameFromServiceRequest,
  parseProvenancesForHistory,
  parseQuestionnaireResponseItems,
  parseResultByTask,
  parseResultDetails,
  parseResults,
  parseReviewerNameFromProvenance,
  parseReviewerNameFromTask,
  parseReviewProvenanceForTask,
  parseSamples,
  parseTaskReceivedAndReviewedAndCorrectedHistory,
  parseTaskReceivedOrCorrectedInfo,
  parseTaskReviewedInfo,
  parseTasks,
  parseVisitDate,
} from '../../src/ehr/lab/external/get-lab-orders/helpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SR_ID = 'sr-1';
const SR_REF = `ServiceRequest/${SR_ID}`;

const taskCoding = (code: string): Coding => ({ system: LAB_ORDER_TASK.system, code });

const makeServiceRequest = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: SR_ID,
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'CBC', display: 'Complete Blood Count' }] },
  requester: { reference: 'Practitioner/prac-1' },
  ...overrides,
});

const makeResult = (
  id: string,
  status: DiagnosticReport['status'],
  opts: { code?: string; reflex?: boolean; accession?: string } = {}
): DiagnosticReport => ({
  resourceType: 'DiagnosticReport',
  id,
  status,
  basedOn: [{ reference: SR_REF }],
  code: { coding: [{ code: opts.code ?? 'CBC', display: 'CBC' }], text: `Test ${id}` },
  ...(opts.reflex && {
    meta: { tag: [{ system: LAB_DR_TYPE_TAG.system, code: 'reflex', display: LAB_DR_TYPE_TAG.display.reflex }] },
  }),
  ...(opts.accession && {
    identifier: [{ use: 'usual', type: { coding: [{ code: 'FILL' }] }, value: opts.accession }],
  }),
});

const makeTask = (
  id: string,
  code: string,
  status: Task['status'],
  basedOn: string,
  authoredOn: string,
  overrides: Partial<Task> = {}
): Task => ({
  resourceType: 'Task',
  id,
  status,
  intent: 'order',
  code: { coding: [taskCoding(code)] },
  basedOn: [{ reference: basedOn }],
  authoredOn,
  ...overrides,
});

const makePst = (status: Task['status'] = 'completed', authoredOn = '2026-01-01T10:00:00.000Z'): Task =>
  makeTask('task-pst', LAB_ORDER_TASK.code.preSubmission, status, SR_REF, authoredOn);

const makePractitioner = (id: string, given: string, family: string): Practitioner => ({
  resourceType: 'Practitioner',
  id,
  name: [{ given: [given], family }],
});

const makeProvenance = (id: string, activity: Coding, recorded: string, who = 'Practitioner/prac-1'): Provenance => ({
  resourceType: 'Provenance',
  id,
  target: [{ reference: SR_REF }],
  recorded,
  activity: { coding: [activity] },
  agent: [{ who: { reference: who } }],
});

const practitioners = [makePractitioner('prac-1', 'Jane', 'Doe'), makePractitioner('prac-2', 'John', 'Roe')];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// parseResults / parseTasks
// ---------------------------------------------------------------------------

describe('parseResults', () => {
  test('sorts results into ordered/reflex by status', () => {
    const results = [
      makeResult('dr-final', 'final'),
      makeResult('dr-corrected', 'corrected', { code: 'OTHER' }),
      makeResult('dr-cancelled', 'cancelled'),
      makeResult('dr-reflex-prelim', 'preliminary', { reflex: true, code: 'RFX' }),
      makeResult('dr-reflex-final', 'final', { reflex: true, code: 'RFX2' }),
      makeResult('dr-reflex-cancelled', 'cancelled', { reflex: true }),
      makeResult('dr-unknown', 'registered'),
      { ...makeResult('dr-other-sr', 'final'), basedOn: [{ reference: 'ServiceRequest/other' }] },
    ];

    const parsed = parseResults(makeServiceRequest(), results);

    expect(parsed.orderedFinalAndCorrectedResults.map((r) => r.id)).toEqual(['dr-final', 'dr-corrected']);
    expect(parsed.orderedCancelledResults.map((r) => r.id)).toEqual(['dr-cancelled']);
    expect(parsed.reflexPrelimResults.map((r) => r.id)).toEqual(['dr-reflex-prelim']);
    expect(parsed.reflexFinalAndCorrectedResults.map((r) => r.id)).toEqual(['dr-reflex-final']);
    expect(parsed.reflexCancelledResults.map((r) => r.id)).toEqual(['dr-reflex-cancelled']);
    expect(parsed.orderedPrelimResults).toEqual([]);
  });

  test('drops a preliminary result once a final result with the same code exists', () => {
    const parsed = parseResults(makeServiceRequest(), [
      makeResult('dr-prelim', 'preliminary'),
      makeResult('dr-prelim-other', 'preliminary', { code: 'OTHER' }),
      makeResult('dr-final', 'final'),
      makeResult('dr-reflex-prelim', 'preliminary', { reflex: true, code: 'RFX' }),
      makeResult('dr-reflex-final', 'final', { reflex: true, code: 'RFX' }),
    ]);

    expect(parsed.orderedPrelimResults.map((r) => r.id)).toEqual(['dr-prelim-other']);
    expect(parsed.reflexPrelimResults).toEqual([]);
  });

  test('skips results without an id', () => {
    const { id: _id, ...noId } = makeResult('x', 'final');
    expect(parseResults(makeServiceRequest(), [noId as DiagnosticReport]).orderedFinalAndCorrectedResults).toEqual([]);
  });

  test('requires a ServiceRequest id and code', () => {
    expect(() => parseResults(makeServiceRequest({ id: undefined }), [])).toThrow('ServiceRequest ID is required');
    expect(() => parseResults(makeServiceRequest({ code: { coding: [] } }), [])).toThrow(
      'ServiceRequest code is required'
    );
  });
});

describe('parseTasks', () => {
  test('groups tasks by kind and result, most recent first', () => {
    const results = [
      makeResult('dr-final', 'final'),
      makeResult('dr-prelim', 'preliminary', { code: 'OTHER' }),
      makeResult('dr-reflex', 'final', { reflex: true, code: 'RFX' }),
      makeResult('dr-cancelled', 'cancelled', { code: 'CAN' }),
    ];
    const pst = makePst();
    const olderFinal = makeTask(
      't-final-old',
      LAB_ORDER_TASK.code.reviewFinalResult,
      'completed',
      'DiagnosticReport/dr-final',
      '2026-01-02T00:00:00.000Z'
    );
    const newerCorrected = makeTask(
      't-corrected',
      LAB_ORDER_TASK.code.reviewCorrectedResult,
      'ready',
      'DiagnosticReport/dr-final',
      '2026-01-05T00:00:00.000Z'
    );
    const newerFinal = makeTask(
      't-final-new',
      LAB_ORDER_TASK.code.reviewFinalResult,
      'ready',
      'DiagnosticReport/dr-final',
      '2026-01-04T00:00:00.000Z'
    );
    const prelim = makeTask(
      't-prelim',
      LAB_ORDER_TASK.code.reviewPreliminaryResult,
      'ready',
      'DiagnosticReport/dr-prelim',
      '2026-01-03T00:00:00.000Z'
    );
    const reflexFinal = makeTask(
      't-reflex',
      LAB_ORDER_TASK.code.reviewFinalResult,
      'ready',
      'DiagnosticReport/dr-reflex',
      '2026-01-03T00:00:00.000Z'
    );
    const cancelled = makeTask(
      't-cancelled',
      LAB_ORDER_TASK.code.reviewCancelledResult,
      'ready',
      'DiagnosticReport/dr-cancelled',
      '2026-01-06T00:00:00.000Z'
    );

    const parsed = parseTasks({
      tasks: [pst, olderFinal, newerCorrected, newerFinal, prelim, reflexFinal, cancelled],
      serviceRequest: makeServiceRequest(),
      results,
    });

    expect(parsed.taskPST?.id).toBe('task-pst');
    expect(parsed.orderedFinalTasks.map((t) => t.id)).toEqual(['t-final-new', 't-final-old']);
    expect(parsed.orderedCorrectedTasks.map((t) => t.id)).toEqual(['t-corrected']);
    expect(parsed.orderedPrelimTasks.map((t) => t.id)).toEqual(['t-prelim']);
    expect(parsed.reflexFinalTasks.map((t) => t.id)).toEqual(['t-reflex']);
    expect(parsed.orderedCancelledResultsTasks.map((t) => t.id)).toEqual(['t-cancelled']);
    expect(parsed.reflexPrelimTasks).toEqual([]);
  });

  test('returns empty groups for a ServiceRequest without an id', () => {
    const parsed = parseTasks({
      tasks: [makePst()],
      serviceRequest: makeServiceRequest({ id: undefined }),
      results: [],
    });
    expect(parsed.taskPST).toBeNull();
    expect(parsed.orderedFinalTasks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

describe('parseLabOrderStatus', () => {
  const finalResult = makeResult('dr-final', 'final');
  const rfrt = (status: Task['status']): Task =>
    makeTask('t-rfrt', LAB_ORDER_TASK.code.reviewFinalResult, status, 'DiagnosticReport/dr-final', '2026-01-02');

  test.each<[string, ServiceRequest, Task[], DiagnosticReport[], ExternalLabsStatus]>([
    ['pending', makeServiceRequest({ status: 'draft' }), [makePst('ready')], [], ExternalLabsStatus.pending],
    ['ready', makeServiceRequest({ status: 'draft' }), [makePst('completed')], [], ExternalLabsStatus.ready],
    ['sent', makeServiceRequest(), [makePst()], [], ExternalLabsStatus.sent],
    ['prelim', makeServiceRequest(), [makePst()], [makeResult('dr-prelim', 'preliminary')], ExternalLabsStatus.prelim],
    ['received', makeServiceRequest(), [makePst(), rfrt('ready')], [finalResult], ExternalLabsStatus.received],
    ['reviewed', makeServiceRequest(), [makePst(), rfrt('completed')], [finalResult], ExternalLabsStatus.reviewed],
    [
      'corrected',
      makeServiceRequest(),
      [
        makePst(),
        makeTask('t-rcrt', LAB_ORDER_TASK.code.reviewCorrectedResult, 'ready', 'DiagnosticReport/dr-c', '2026-01-02'),
      ],
      [makeResult('dr-c', 'corrected')],
      ExternalLabsStatus.corrected,
    ],
    [
      'cancelled by lab',
      makeServiceRequest(),
      [
        makePst(),
        makeTask('t-can', LAB_ORDER_TASK.code.reviewCancelledResult, 'ready', 'DiagnosticReport/dr-x', '2026-01-02'),
      ],
      [makeResult('dr-x', 'cancelled')],
      ExternalLabsStatus['cancelled by lab'],
    ],
    [
      'rejected abn',
      makeServiceRequest({
        status: 'revoked',
        extension: [{ url: SR_REVOKED_REASON_EXT.url, valueCode: SR_REVOKED_REASON_EXT.valueCode }],
      }),
      [],
      [],
      ExternalLabsStatus['rejected abn'],
    ],
    ['unknown', makeServiceRequest({ status: 'completed' }), [], [], ExternalLabsStatus.unknown],
  ])('%s', (_name, serviceRequest, tasks, results, expected) => {
    expect(parseLabOrderStatus(serviceRequest, tasks, results)).toBe(expected);
  });

  test('sent manually for a manual order', async () => {
    const { MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING } = await import('utils/lib/types/data/labs/labs.constants');
    const manual = makeServiceRequest({ category: [{ coding: [MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING] }] });
    expect(parseLabOrderStatus(manual, [makePst()], [])).toBe(ExternalLabsStatus['sent manually']);
  });

  test('unknown without a ServiceRequest id', () => {
    expect(parseLabOrderStatus(makeServiceRequest({ id: undefined }), [], [])).toBe(ExternalLabsStatus.unknown);
  });
});

describe('parseLabOrderStatusWithSpecificTask', () => {
  const task = (code: string, status: Task['status']): Task => makeTask('t', code, status, 'DiagnosticReport/dr', '');
  const { reviewFinalResult, reviewCorrectedResult, reviewCancelledResult, matchUnsolicitedResult } =
    LAB_ORDER_TASK.code;

  test.each<[string, DiagnosticReport['status'], Task, ServiceRequest | undefined, Task | null, ExternalLabsStatus]>([
    [
      'final + completed',
      'final',
      task(reviewFinalResult, 'completed'),
      makeServiceRequest(),
      null,
      ExternalLabsStatus.reviewed,
    ],
    [
      'final + ready',
      'final',
      task(reviewFinalResult, 'ready'),
      makeServiceRequest(),
      null,
      ExternalLabsStatus.received,
    ],
    [
      'final + completed unsolicited match',
      'final',
      task(matchUnsolicitedResult, 'completed'),
      undefined,
      null,
      ExternalLabsStatus.received,
    ],
    [
      'corrected + ready',
      'corrected',
      task(reviewCorrectedResult, 'ready'),
      makeServiceRequest(),
      null,
      ExternalLabsStatus.corrected,
    ],
    [
      'corrected + completed',
      'corrected',
      task(reviewCorrectedResult, 'completed'),
      makeServiceRequest(),
      null,
      ExternalLabsStatus.reviewed,
    ],
    [
      'cancelled',
      'cancelled',
      task(reviewCancelledResult, 'ready'),
      makeServiceRequest(),
      null,
      ExternalLabsStatus['cancelled by lab'],
    ],
    [
      'preliminary',
      'preliminary',
      task(reviewFinalResult, 'ready'),
      makeServiceRequest(),
      null,
      ExternalLabsStatus.prelim,
    ],
    [
      'pending',
      'registered',
      task(reviewFinalResult, 'ready'),
      makeServiceRequest({ status: 'draft' }),
      makePst('ready'),
      ExternalLabsStatus.pending,
    ],
    ['sent', 'registered', task(reviewFinalResult, 'ready'), makeServiceRequest(), makePst(), ExternalLabsStatus.sent],
    ['unknown', 'registered', task(reviewFinalResult, 'ready'), undefined, null, ExternalLabsStatus.unknown],
  ])('%s', (_name, drStatus, t, serviceRequest, pst, expected) => {
    expect(parseLabOrderStatusWithSpecificTask(makeResult('dr', drStatus), t, serviceRequest, pst)).toBe(expected);
  });

  test('rejected abn for a revoked ServiceRequest', () => {
    const revoked = makeServiceRequest({
      status: 'revoked',
      extension: [{ url: SR_REVOKED_REASON_EXT.url, valueCode: SR_REVOKED_REASON_EXT.valueCode }],
    });
    expect(
      parseLabOrderStatusWithSpecificTask(makeResult('dr', 'final'), task(reviewFinalResult, 'ready'), revoked, null)
    ).toBe(ExternalLabsStatus['rejected abn']);
  });
});

// ---------------------------------------------------------------------------
// Simple field parsers
// ---------------------------------------------------------------------------

describe('diagnoses', () => {
  const sr = makeServiceRequest({
    reasonCode: [{ coding: [{ system: 'icd-10', code: 'J06.9', display: 'Acute URI' }] }, { text: 'Free text reason' }],
  });

  test('parseDiagnoses maps each reason code', () => {
    expect(parseDiagnoses(sr)).toEqual([
      { code: 'J06.9', display: 'Acute URI', system: 'icd-10', isPrimary: false },
      { code: '', display: 'Free text reason', system: '', isPrimary: false },
    ]);
    expect(parseDiagnoses(makeServiceRequest())).toEqual([]);
  });

  test('parseDx joins reason codes into one string', () => {
    expect(parseDx(sr)).toBe('J06.9 Acute URI; Free text reason');
    expect(parseDx(makeServiceRequest())).toBe('');
  });
});

describe('practitioner names', () => {
  test('parsePractitionerName finds the practitioner by id', () => {
    expect(parsePractitionerName('prac-1', practitioners)).toBe('Jane Doe');
    expect(parsePractitionerName('missing', practitioners)).toBe('');
    expect(parsePractitionerName(undefined, practitioners)).toBe('');
    expect(parsePractitionerName('no-name', [{ resourceType: 'Practitioner', id: 'no-name' }])).toBe('');
  });

  test('from the ServiceRequest requester and the Task owner', () => {
    const task = makeTask('t', 'RFRT', 'completed', '', '', { owner: { reference: 'Practitioner/prac-2' } });
    expect(parsePractitionerIdFromServiceRequest(makeServiceRequest())).toBe('prac-1');
    expect(parsePractitionerIdFromServiceRequest(makeServiceRequest({ requester: undefined }))).toBe('');
    expect(parsePractitionerNameFromServiceRequest(makeServiceRequest(), practitioners)).toBe('Jane Doe');
    expect(parsePractitionerIdFromTask(task)).toBe('prac-2');
    expect(parsePractitionerIdFromTask({ ...task, owner: undefined })).toBe('');
    expect(parseReviewerNameFromTask(task, practitioners)).toBe('John Roe');
  });

  test('parseReviewerNameFromProvenance only reads a Practitioner agent', () => {
    const prov = makeProvenance('p', PROVENANCE_ACTIVITY_CODING_ENTITY.review, '2026-01-01');
    expect(parseReviewerNameFromProvenance(prov, practitioners)).toBe('Jane Doe');
    expect(parseReviewerNameFromProvenance({ ...prov, agent: [] }, practitioners)).toBe('');
    expect(
      parseReviewerNameFromProvenance({ ...prov, agent: [{ who: { reference: 'Device/d' } }] }, practitioners)
    ).toBe('');
  });
});

describe('parseIsPSC', () => {
  test('detects the PSC hold coding', () => {
    expect(parseIsPSC(makeServiceRequest({ orderDetail: [{ coding: [PSC_HOLD_CONFIG] }] }))).toBe(true);
    expect(parseIsPSC(makeServiceRequest())).toBe(false);
  });
});

describe('specimen performed', () => {
  const specimen: Specimen = {
    resourceType: 'Specimen',
    id: 'spec-1',
    collection: { collector: { reference: 'Practitioner/prac-2' }, collectedDateTime: '2026-01-01T09:00:00Z' },
  };

  test('parsePerformed and parsePerformedDate read the collection', () => {
    expect(parsePerformed(specimen, practitioners)).toBe('John Roe');
    expect(parsePerformed({ resourceType: 'Specimen' }, practitioners)).toBe('');
    expect(parsePerformedDate(specimen)).toBe('2026-01-01T09:00:00Z');
    expect(parsePerformedDate({ resourceType: 'Specimen' })).toBe('-');
  });
});

describe('parsePaginationFromResponse', () => {
  test('reads page index and totals from the self link', () => {
    expect(
      parsePaginationFromResponse({
        total: 45,
        link: [{ relation: 'self', url: 'https://fhir.test/ServiceRequest?_count=20&_offset=20' }],
      })
    ).toEqual({ currentPageIndex: 1, totalItems: 45, totalPages: 3 });
  });

  test('defaults the offset to the first page', () => {
    expect(
      parsePaginationFromResponse({ total: 5, link: [{ relation: 'self', url: 'https://fhir.test/x?_count=10' }] })
    ).toEqual({ currentPageIndex: 0, totalItems: 5, totalPages: 1 });
  });

  test.each([
    ['no total', { link: [] }],
    ['no self link', { total: 1, link: [{ relation: 'next', url: 'https://fhir.test/x' }] }],
    ['no _count', { total: 1, link: [{ relation: 'self', url: 'https://fhir.test/x' }] }],
    ['negative _count', { total: 1, link: [{ relation: 'self', url: 'https://fhir.test/x?_count=-1' }] }],
  ])('empty pagination when %s', (_name, data) => {
    expect(parsePaginationFromResponse(data)).toEqual({ currentPageIndex: 0, totalItems: 0, totalPages: 0 });
  });
});

describe('parseVisitDate', () => {
  test('uses the appointment created date', () => {
    expect(
      parseVisitDate({ resourceType: 'Appointment', status: 'booked', participant: [], created: '2026-01-01' })
    ).toBe('2026-01-01');
    expect(parseVisitDate(undefined)).toBe('');
  });
});

describe('parseAccessionNumbers', () => {
  test('collects unique accession numbers across result groups', () => {
    const results = [
      makeResult('dr-1', 'final', { accession: 'ACC-1' }),
      makeResult('dr-2', 'preliminary', { accession: 'ACC-1', code: 'OTHER' }),
      makeResult('dr-3', 'cancelled', { accession: 'ACC-2' }),
      makeResult('dr-4', 'final', { code: 'NO-ACC' }),
    ];
    expect(parseAccessionNumbers(makeServiceRequest(), results)).toEqual(['ACC-1', 'ACC-2']);
  });
});

describe('dates', () => {
  test('parseLabOrderAddedDate uses the PST authoredOn', () => {
    expect(parseLabOrderAddedDate(makeServiceRequest(), [makePst('ready', '2026-02-01')], [])).toBe('2026-02-01');
    expect(parseLabOrderAddedDate(makeServiceRequest(), [], [])).toBe('');
  });

  test('parseLabOrderLastResultReceivedDate takes the latest result task', () => {
    const results = [makeResult('dr-final', 'final'), makeResult('dr-prelim', 'preliminary', { code: 'OTHER' })];
    const tasks = [
      makeTask('t1', LAB_ORDER_TASK.code.reviewFinalResult, 'ready', 'DiagnosticReport/dr-final', '2026-03-01'),
      makeTask('t2', LAB_ORDER_TASK.code.reviewPreliminaryResult, 'ready', 'DiagnosticReport/dr-prelim', '2026-03-05'),
    ];
    expect(parseLabOrderLastResultReceivedDate(makeServiceRequest(), results, tasks)).toBe('2026-03-05');
    expect(parseLabOrderLastResultReceivedDate(makeServiceRequest(), [], [])).toBe('');
  });
});

describe('parseAccountNumber', () => {
  const org: Organization = { resourceType: 'Organization', id: 'org-1' };
  const location: Location = { resourceType: 'Location', id: 'loc-1' };
  const sr = makeServiceRequest({
    performer: [{ reference: 'Organization/org-1' }],
    locationReference: [{ reference: 'Location/loc-1' }],
  });

  test.each<[string, ServiceRequest, Organization[], Location[]]>([
    ['no performer', makeServiceRequest({ locationReference: [{ reference: 'Location/loc-1' }] }), [org], [location]],
    ['no location', makeServiceRequest({ performer: [{ reference: 'Organization/org-1' }] }), [org], [location]],
    [
      'too many locations',
      { ...sr, locationReference: [{ reference: 'Location/a' }, { reference: 'Location/b' }] },
      [org],
      [location],
    ],
    ['performer not found', sr, [], [location]],
    ['location not found', sr, [org], []],
  ])('empty when %s', (_name, serviceRequest, organizations, locations) => {
    expect(parseAccountNumber(serviceRequest, organizations, locations)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe('history helpers', () => {
  const reviewProv = makeProvenance('prov-review', PROVENANCE_ACTIVITY_CODING_ENTITY.review, '2026-01-10');
  const reviewedTask = makeTask(
    't-final',
    LAB_ORDER_TASK.code.reviewFinalResult,
    'completed',
    'DiagnosticReport/dr-final',
    '2026-01-05',
    { relevantHistory: [{ reference: 'Provenance/prov-review' }] }
  );

  test('parseProvenancesForHistory finds the provenance for an activity', () => {
    const submitted = makeProvenance('prov-submit', PROVENANCE_ACTIVITY_CODING_ENTITY.submit, '2026-01-02');
    expect(
      parseProvenancesForHistory('ordered', PROVENANCE_ACTIVITY_CODING_ENTITY.submit, practitioners, [submitted])
    ).toEqual([{ action: 'ordered', performer: 'Jane Doe', date: '2026-01-02' }]);
    expect(parseProvenancesForHistory('ordered', PROVENANCE_ACTIVITY_CODING_ENTITY.submit, practitioners, [])).toEqual(
      []
    );
  });

  test('parseReviewProvenanceForTask needs both the link and the review activity', () => {
    const submitLinked = makeProvenance('prov-review', PROVENANCE_ACTIVITY_CODING_ENTITY.submit, '2026-01-10');
    expect(parseReviewProvenanceForTask(reviewedTask, [reviewProv])?.id).toBe('prov-review');
    expect(parseReviewProvenanceForTask(reviewedTask, [submitLinked])).toBeUndefined();
    expect(parseReviewProvenanceForTask({ ...reviewedTask, relevantHistory: [] }, [reviewProv])).toBeUndefined();
  });

  test('parseTaskReviewedInfo and parseTaskReceivedOrCorrectedInfo', () => {
    expect(parseTaskReviewedInfo(reviewedTask, practitioners, [reviewProv])).toEqual({
      action: 'reviewed',
      performer: 'Jane Doe',
      date: '2026-01-10',
    });
    expect(parseTaskReviewedInfo(reviewedTask, practitioners, [])).toBeNull();
    expect(parseTaskReceivedOrCorrectedInfo(reviewedTask)).toEqual({
      action: 'received',
      performer: '',
      date: '2026-01-05',
    });
    expect(parseTaskReceivedOrCorrectedInfo({ ...reviewedTask, code: { coding: [taskCoding('RCRT')] } })?.action).toBe(
      'corrected'
    );
  });

  test('parseTaskReceivedAndReviewedAndCorrectedHistory', () => {
    expect(
      parseTaskReceivedAndReviewedAndCorrectedHistory({ ...reviewedTask, testType: 'ordered' }, practitioners, [
        reviewProv,
      ])
    ).toEqual([
      { action: 'received', performer: '', date: '2026-01-05', testType: 'ordered' },
      { action: 'reviewed', performer: 'Jane Doe', date: '2026-01-10', testType: 'ordered' },
    ]);
    expect(
      parseTaskReceivedAndReviewedAndCorrectedHistory(
        { ...reviewedTask, status: 'ready', testType: 'reflex' },
        practitioners,
        [reviewProv]
      )
    ).toEqual([{ action: 'received', performer: '', date: '2026-01-05', testType: 'reflex' }]);
  });

  test('parseLabOrdersHistory stops after "created" for a pending order', () => {
    const history = parseLabOrdersHistory(
      makeServiceRequest({ status: 'draft' }),
      ExternalLabsStatus.pending,
      [makePst('ready', '2026-01-01')],
      [],
      practitioners,
      [],
      []
    );
    expect(history).toEqual([{ action: 'created', performer: 'Jane Doe', date: '2026-01-01' }]);
  });

  test('parseLabOrdersHistory builds the full timeline, oldest first', () => {
    const results = [makeResult('dr-final', 'final'), makeResult('dr-cancelled', 'cancelled', { code: 'CAN' })];
    const tasks = [
      makePst('completed', '2026-01-01'),
      reviewedTask,
      makeTask(
        't-can',
        LAB_ORDER_TASK.code.reviewCancelledResult,
        'ready',
        'DiagnosticReport/dr-cancelled',
        '2026-01-11'
      ),
    ];
    const provenances = [
      makeProvenance('prov-ready', PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask, '2026-01-02'),
      makeProvenance('prov-submit', PROVENANCE_ACTIVITY_CODING_ENTITY.submit, '2026-01-03', 'Practitioner/prac-2'),
      reviewProv,
      makeProvenance('prov-delete', PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder, '2026-01-12'),
    ];
    const specimens: Specimen[] = [
      {
        resourceType: 'Specimen',
        id: 'spec-1',
        collection: { collector: { reference: 'Practitioner/prac-2' }, collectedDateTime: '2026-01-04' },
      },
    ];

    const history = parseLabOrdersHistory(
      makeServiceRequest(),
      ExternalLabsStatus['cancelled by lab'],
      tasks,
      results,
      practitioners,
      provenances,
      specimens
    );

    expect(history.map((row) => [row.action, row.date])).toEqual([
      ['created', '2026-01-01'],
      ['ready', '2026-01-02'],
      ['ordered', '2026-01-03'],
      ['performed', '2026-01-04'],
      ['received', '2026-01-05'],
      ['reviewed', '2026-01-10'],
      ['cancelled by lab', '2026-01-11'],
      ['deleted', '2026-01-12'],
    ]);
    expect(history.find((row) => row.action === 'performed')?.performer).toBe('John Roe');
  });

  test('parseLabOrdersHistory skips "performed" for a PSC order without a specimen', () => {
    const history = parseLabOrdersHistory(
      makeServiceRequest({ orderDetail: [{ coding: [PSC_HOLD_CONFIG] }] }),
      ExternalLabsStatus.sent,
      [makePst()],
      [],
      practitioners,
      [],
      []
    );
    expect(history.map((row) => row.action)).toEqual(['created']);
  });
});

// ---------------------------------------------------------------------------
// Result details
// ---------------------------------------------------------------------------

describe('result details', () => {
  const results = [
    makeResult('dr-final', 'final'),
    makeResult('dr-reflex', 'preliminary', { reflex: true, code: 'RFX' }),
    makeResult('dr-no-task', 'final', { code: 'LONELY' }),
  ];
  const reviewProv = makeProvenance('prov-review', PROVENANCE_ACTIVITY_CODING_ENTITY.review, '2026-01-10');
  const tasks = [
    makePst(),
    makeTask('t-final', LAB_ORDER_TASK.code.reviewFinalResult, 'completed', 'DiagnosticReport/dr-final', '2026-01-05', {
      relevantHistory: [{ reference: 'Provenance/prov-review' }],
    }),
    makeTask(
      't-reflex',
      LAB_ORDER_TASK.code.reviewPreliminaryResult,
      'ready',
      'DiagnosticReport/dr-reflex',
      '2026-01-07'
    ),
  ];

  test('parseResultByTask matches results the task is based on', () => {
    expect(parseResultByTask(tasks[1], results).map((r) => r.id)).toEqual(['dr-final']);
  });

  test('parseResultDetails needs a task for the result', () => {
    expect(parseResultDetails(results[0], tasks, makeServiceRequest())).toEqual({
      testItem: 'Test dr-final',
      labStatus: ExternalLabsStatus.reviewed,
      diagnosticReportId: 'dr-final',
      taskId: 't-final',
      receivedDate: '2026-01-05',
      alternatePlacerId: undefined,
    });
    expect(parseResultDetails(results[2], tasks, makeServiceRequest())).toBeNull();
  });

  test('parseLResultsDetails attaches review dates and documents, newest first', () => {
    const details = parseLResultsDetails(
      makeServiceRequest(),
      results,
      tasks,
      practitioners,
      [reviewProv],
      [{ diagnosticReportIds: ['dr-final'], presignedURL: 'https://lab-generated' } as any],
      [{ diagnosticReportIds: ['dr-reflex'], presignedURL: 'https://result-pdf' } as any]
    );

    expect(details.map((d) => [d.diagnosticReportId, d.testType, d.resultType])).toEqual([
      ['dr-reflex', 'reflex', 'preliminary'],
      ['dr-final', 'ordered', 'final'],
    ]);
    expect(details[0].resultPdfUrl).toBe('https://result-pdf');
    expect(details[1].reviewedDate).toBe('2026-01-10');
    expect(details[1].labGeneratedResultUrls).toEqual(['https://lab-generated']);
    expect(details[1].resultPdfUrl).toBeNull();
  });

  test('parseLResultsDetails is empty without a ServiceRequest id', () => {
    expect(
      parseLResultsDetails(makeServiceRequest({ id: undefined }), results, tasks, [], [], undefined, undefined)
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Questionnaire, samples, patient lab items
// ---------------------------------------------------------------------------

describe('parseQuestionnaireResponseItems', () => {
  const questionnaire: Questionnaire = {
    resourceType: 'Questionnaire',
    status: 'active',
    item: [
      { linkId: 'text', type: 'text' },
      { linkId: 'bool', type: 'boolean' },
      { linkId: 'date', type: 'date' },
      { linkId: 'dec', type: 'decimal' },
      { linkId: 'int', type: 'integer' },
      { linkId: 'choice', type: 'choice' },
      { linkId: 'url', type: 'url' },
    ],
  };
  const response = (items: QuestionnaireResponse['item']): QuestionnaireResponse => ({
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    item: items,
  });

  test('reads the answer value for each question type', () => {
    const parsed = parseQuestionnaireResponseItems(
      response([
        { linkId: 'text', answer: [{ valueString: 'hello' }] },
        { linkId: 'bool', answer: [{ valueBoolean: true }] },
        { linkId: 'date', answer: [{ valueDate: '2026-01-01' }] },
        { linkId: 'dec', answer: [{ valueDecimal: 1.5 }] },
        { linkId: 'int', answer: [{ valueInteger: 3 }] },
        { linkId: 'choice', answer: [{ valueString: 'A' }] },
      ]),
      questionnaire
    );
    expect(parsed.map((item) => (item as unknown as { response: unknown[] }).response)).toEqual([
      ['hello'],
      [true],
      ['2026-01-01'],
      [1.5],
      [3],
      ['A'],
    ]);
    expect(parseQuestionnaireResponseItems(response(undefined), questionnaire)).toEqual([]);
  });

  test('throws for an unknown question or question type', () => {
    expect(() => parseQuestionnaireResponseItems(response([{ linkId: 'missing' }]), questionnaire)).toThrow(
      'question missing is not found'
    );
    expect(() =>
      parseQuestionnaireResponseItems(response([{ linkId: 'url', answer: [{ valueUri: 'x' }] }]), questionnaire)
    ).toThrow('Unknown question type: url');
  });
});

describe('parseSamples', () => {
  const specimenDefinition = {
    resourceType: 'SpecimenDefinition' as const,
    id: 'sd-1',
    typeTested: [
      {
        preference: 'preferred' as const,
        container: { description: 'Lavender tube', minimumVolumeString: '1 mL' },
        handling: [{ instruction: 'Refrigerate' }],
      },
    ],
    collection: [
      {
        coding: [
          {
            system: SPECIMEN_CODING_CONFIG.collection.system,
            code: SPECIMEN_CODING_CONFIG.collection.code.specimenVolume,
          },
        ],
        text: '3 mL',
      },
      {
        coding: [
          {
            system: SPECIMEN_CODING_CONFIG.collection.system,
            code: SPECIMEN_CODING_CONFIG.collection.code.collectionInstructions,
          },
        ],
        text: 'Invert gently',
      },
    ],
  };
  const makeSr = (contained: ServiceRequest['contained']): ServiceRequest => makeServiceRequest({ contained });
  const activityDefinition = {
    resourceType: 'ActivityDefinition' as const,
    status: 'active' as const,
    specimenRequirement: [{ reference: '#sd-1' }],
  };
  const specimen = (id: string, sdId = 'sd-1'): Specimen => ({
    resourceType: 'Specimen',
    id,
    request: [{ reference: SR_REF }],
    extension: [{ url: RELATED_SPECIMEN_DEFINITION_SYSTEM, valueString: sdId }],
    collection: { collectedDateTime: '2026-01-04' },
  });

  test('builds a sample from the specimen definition and its specimen', () => {
    expect(parseSamples(makeSr([activityDefinition, specimenDefinition]), [specimen('spec-1')])).toEqual([
      {
        specimen: { id: 'spec-1', collectionDate: '2026-01-04' },
        definition: {
          container: 'Lavender tube',
          volume: '3 mL',
          minimumVolume: '1 mL',
          storageRequirements: 'Refrigerate',
          collectionInstructions: 'Invert gently',
        },
      },
    ]);
  });

  test('falls back to "Not specified" for missing definition fields', () => {
    const bare = {
      resourceType: 'SpecimenDefinition' as const,
      id: 'sd-1',
      typeTested: [{ preference: 'alternate' as const }],
    };
    const [sample] = parseSamples(makeSr([activityDefinition, bare]), [specimen('spec-1')]);
    expect(Object.values(sample.definition)).toEqual(Array(5).fill('Not specified'));
  });

  test.each<[string, ServiceRequest, Specimen[]]>([
    ['no contained resources', makeServiceRequest(), []],
    ['no specimen requirement', makeSr([{ ...activityDefinition, specimenRequirement: undefined }]), []],
    ['definition not contained', makeSr([activityDefinition]), [specimen('spec-1')]],
    [
      'definition without typeTested',
      makeSr([activityDefinition, { resourceType: 'SpecimenDefinition', id: 'sd-1' }]),
      [],
    ],
    ['no matching specimen', makeSr([activityDefinition, specimenDefinition]), [specimen('spec-1', 'other')]],
    ['several matching specimens', makeSr([activityDefinition, specimenDefinition]), [specimen('a'), specimen('b')]],
  ])('no samples when %s', (_name, serviceRequest, specimens) => {
    expect(parseSamples(serviceRequest, specimens)).toEqual([]);
  });
});

describe('parsePatientLabItems', () => {
  test('returns unique lab items sorted by display', () => {
    const sr = (code: string, display: string, system = OYSTEHR_LAB_OI_CODE_SYSTEM): ServiceRequest =>
      makeServiceRequest({
        contained: [
          { resourceType: 'ActivityDefinition', status: 'active', code: { coding: [{ system, code, display }] } },
        ],
      });

    expect(
      parsePatientLabItems([
        sr('LIP', 'Lipid Panel'),
        sr('CBC', 'CBC'),
        sr('CBC', 'CBC'),
        sr('X', 'Other', 'other-system'),
      ])
    ).toEqual([
      { code: 'CBC', display: 'CBC' },
      { code: 'LIP', display: 'Lipid Panel' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// extractLabResources / mapResourcesToLabOrderDTOs (parseOrderData)
// ---------------------------------------------------------------------------

describe('extractLabResources', () => {
  test('sorts resources by type and links appointments to their schedule', () => {
    const labSr = makeServiceRequest({
      contained: [{ resourceType: 'ActivityDefinition', id: 'ad', status: 'active' }],
    });
    const nonLabSr = makeServiceRequest({ id: 'sr-no-ad' });
    const orderNote: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      category: [
        { coding: [{ system: LABS_COMMUNICATION_CATEGORY_SYSTEM, code: LAB_ORDER_LEVEL_NOTE_CATEGORY.code }] },
      ],
    };

    const extracted = extractLabResources([
      labSr,
      nonLabSr,
      makePst(),
      { ...makePst(), id: 'cancelled', status: 'cancelled' },
      makeResult('dr', 'final'),
      {
        resourceType: 'Appointment',
        id: 'appt',
        status: 'booked',
        participant: [],
        slot: [{ reference: 'Slot/slot' }],
      },
      { resourceType: 'Slot', id: 'slot', status: 'busy', start: '', end: '', schedule: { reference: 'Schedule/sch' } },
      { resourceType: 'Schedule', id: 'sch', actor: [] },
      { resourceType: 'DocumentReference', id: 'doc', status: 'current', content: [] },
      { resourceType: 'DocumentReference', id: 'old-doc', status: 'superseded', content: [] },
      orderNote,
      { resourceType: 'Coverage', id: 'cov', status: 'active', beneficiary: {}, payor: [] },
    ]);

    expect(extracted.serviceRequests.map((sr) => sr.id)).toEqual([SR_ID]);
    expect(extracted.tasks.map((t) => t.id)).toEqual(['task-pst']);
    expect(extracted.diagnosticReports).toHaveLength(1);
    expect(extracted.documentReferences.map((d) => d.id)).toEqual(['doc']);
    expect(extracted.appointmentScheduleMap.appt?.id).toBe('sch');
    expect(extracted.communications?.orderLevelNotesByUser).toEqual([orderNote]);
    expect(extracted.coverages).toHaveLength(1);
  });

  test('no communications when there are no lab notes', () => {
    expect(extractLabResources([]).communications).toBeUndefined();
  });
});

describe('mapResourcesToLabOrderDTOs', () => {
  const serviceRequest = makeServiceRequest({
    identifier: [{ system: 'https://identifiers.fhir.oystehr.com/lab-order-placer-id', value: 'REQ-1' }],
    encounter: { reference: 'Encounter/enc-1' },
    locationReference: [{ reference: 'Location/loc-1' }],
    insurance: [{ reference: 'Coverage/cov-1' }],
    contained: [
      {
        resourceType: 'ActivityDefinition',
        status: 'active',
        code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'CBC', display: 'Complete Blood Count' }] },
      },
    ],
  });
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: 'appt-1',
    status: 'fulfilled',
    participant: [],
    created: '2026-01-01T08:00:00Z',
  };
  const note = (code: string, text: string): Communication => ({
    resourceType: 'Communication',
    status: 'completed',
    category: [{ coding: [{ system: LABS_COMMUNICATION_CATEGORY_SYSTEM, code }] }],
    basedOn: [{ reference: SR_REF }],
    payload: [{ contentString: text }],
  });
  const coverage: Coverage = { resourceType: 'Coverage', id: 'cov-1', status: 'active', beneficiary: {}, payor: [] };

  const baseInput = {
    serviceRequests: [serviceRequest],
    tasks: [makePst()],
    results: [],
    practitioners,
    encounters: [
      {
        resourceType: 'Encounter' as const,
        id: 'enc-1',
        status: 'finished' as const,
        class: {},
        appointment: [{ reference: 'Appointment/appt-1' }],
      },
    ],
    locations: [{ resourceType: 'Location' as const, id: 'loc-1', name: 'Clinic' }],
    appointments: [appointment],
    provenances: [makeProvenance('prov-submit', PROVENANCE_ACTIVITY_CODING_ENTITY.submit, '2026-01-02')],
    organizations: [],
    questionnaires: [],
    labDocuments: undefined,
    specimens: [],
    appointmentScheduleMap: {},
    communications: {
      orderLevelNotesByUser: [note(LAB_ORDER_LEVEL_NOTE_CATEGORY.code, 'Fasting')],
      clinicalInfoNotesByUser: [note(LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY.code, 'On meds')],
    },
    coverages: [coverage],
    environment: 'local',
  };

  test('maps a list-page DTO', () => {
    const [dto] = mapResourcesToLabOrderDTOs({
      ...baseInput,
      searchBy: { searchBy: { field: 'encounterId', value: 'enc-1' } },
    }) as LabOrderListPageDTO[];

    expect(dto).toMatchObject({
      serviceRequestId: SR_ID,
      appointmentId: 'appt-1',
      orderStatus: ExternalLabsStatus.sent,
      orderAddedDate: '2026-01-01T10:00:00.000Z',
      orderSubmittedDate: '2026-01-02',
      visitDate: '2026-01-01T08:00:00Z',
      orderingPhysician: 'Jane Doe',
      isPSC: false,
      orderLevelNoteByUser: 'Fasting',
      clinicalInfoNoteByUser: 'On meds',
    });
    expect(dto.location?.id).toBe('loc-1');
    expect('history' in dto).toBe(false);
  });

  test('maps a detail-page DTO', () => {
    const [dto] = mapResourcesToLabOrderDTOs({
      ...baseInput,
      // a non-PSC order needs a specimen, parseLabOrdersHistory throws without one
      specimens: [{ resourceType: 'Specimen', id: 'spec-1', collection: { collectedDateTime: '2026-01-03' } }],
      searchBy: { searchBy: { field: 'serviceRequestId', value: SR_ID } },
    }) as LabOrderDetailedPageDTO[];

    expect(dto.history.map((row) => row.action)).toContain('ordered');
    expect(dto.resultsDetails).toEqual([]);
    expect(dto.samples).toEqual([]);
    expect(dto.isGenericOrder).toBe(false);
  });

  test('skips an order that fails to parse instead of failing the whole page', () => {
    const dtos = mapResourcesToLabOrderDTOs({
      ...baseInput,
      serviceRequests: [makeServiceRequest({ id: undefined }), serviceRequest],
      searchBy: { searchBy: { field: 'encounterId', value: 'enc-1' } },
    });
    expect(dtos.map((dto) => dto.serviceRequestId)).toEqual([SR_ID]);
  });
});
