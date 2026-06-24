import { DiagnosticReport, ServiceRequest } from 'fhir/r4b';
import {
  ORDER_TYPE_CODE_SYSTEM,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
} from 'utils';
import { describe, expect, test } from 'vitest';
import {
  getMostRecentReport,
  makeRadiologyDTO,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../src/shared/radiology';

// bare minimum resources just to test these helpers

const makeReport = (status: DiagnosticReport['status'], issued?: string): DiagnosticReport => ({
  resourceType: 'DiagnosticReport',
  status,
  code: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '18748-4',
        display: 'Diagnostic imaging study',
      },
    ],
  },
  ...(issued && { issued }),
});

const makeHtmlReport = (status: DiagnosticReport['status'], data: string, issued?: string): DiagnosticReport => ({
  ...makeReport(status, issued),
  presentedForm: [{ contentType: 'text/html', data }],
});

const makeOrderDetailExtension = (code: string, value: string): NonNullable<ServiceRequest['extension']>[number] => ({
  url: SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
  extension: [
    {
      url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
      extension: [
        {
          url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
          valueCodeableConcept: { coding: [{ code }] },
        },
        {
          url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
          valueString: value,
        },
      ],
    },
  ],
});

const makeServiceRequest = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  status: 'active',
  intent: 'order',
  subject: {},
  id: 'sr-1',
  meta: {
    tag: [
      {
        system: ORDER_TYPE_CODE_SYSTEM,
        code: 'radiology',
      },
    ],
  },
  ...overrides,
});

describe('getMostRecentReport', () => {
  test('returns undefined for an empty array', () => {
    expect(getMostRecentReport([])).toBeUndefined();
  });

  test('returns the single report when only one exists', () => {
    const report = makeReport('final', '2024-01-01T00:00:00Z');
    expect(getMostRecentReport([report])).toBe(report);
  });

  test('returns the report with the latest issued date', () => {
    const older = makeReport('final', '2024-01-01T00:00:00Z');
    const middle = makeReport('final', '2024-03-01T00:00:00Z');
    const newer = makeReport('final', '2024-06-01T00:00:00Z');
    expect(getMostRecentReport([older, newer, middle])).toBe(newer);
    expect(getMostRecentReport([older, middle, newer])).toBe(newer);
    expect(getMostRecentReport([newer, older, middle])).toBe(newer);
  });

  test('skips a report with no issued date in favour of one that has it', () => {
    const withDate = makeReport('final', '2024-01-01T00:00:00Z');
    const withoutDate = makeReport('final');
    expect(getMostRecentReport([withoutDate, withDate])).toBe(withDate);
    expect(getMostRecentReport([withDate, withoutDate])).toBe(withDate);
  });

  test('returns the first report when none have an issued date (reduce fall-through)', () => {
    const a = makeReport('final');
    const b = makeReport('final');
    expect(getMostRecentReport([a, b])).toBe(a);
  });
});

describe('takeMostRecentPreliminaryReport', () => {
  test('returns undefined for an empty array', () => {
    expect(takeMostRecentPreliminaryReport([])).toBeUndefined();
  });

  test('returns undefined when no reports have preliminary status', () => {
    const reports = [makeReport('final', '2024-01-01T00:00:00Z'), makeReport('amended', '2024-02-01T00:00:00Z')];
    expect(takeMostRecentPreliminaryReport(reports)).toBeUndefined();
  });

  test('returns the single preliminary report', () => {
    const report = makeReport('preliminary', '2024-01-01T00:00:00Z');
    expect(takeMostRecentPreliminaryReport([report])).toBe(report);
  });

  test('returns the most recent of several preliminary reports', () => {
    const older = makeReport('preliminary', '2024-01-01T00:00:00Z');
    const newer = makeReport('preliminary', '2024-05-01T00:00:00Z');
    expect(takeMostRecentPreliminaryReport([older, newer])).toBe(newer);
  });

  test('ignores non-preliminary reports when selecting', () => {
    const prelim = makeReport('preliminary', '2024-01-01T00:00:00Z');
    const final = makeReport('final', '2024-12-01T00:00:00Z');
    expect(takeMostRecentPreliminaryReport([prelim, final])).toBe(prelim);
  });
});

describe('takeTheBestFinalDiagnosticReport', () => {
  test('returns undefined for an empty array', () => {
    expect(takeTheBestFinalDiagnosticReport([])).toBeUndefined();
  });

  test('returns undefined when no final/amended/corrected/appended reports exist', () => {
    const reports = [makeReport('preliminary'), makeReport('registered')];
    expect(takeTheBestFinalDiagnosticReport(reports)).toBeUndefined();
  });

  test('returns the most recent final report when no higher-priority status exists', () => {
    const older = makeReport('final', '2024-01-01T00:00:00Z');
    const newer = makeReport('final', '2024-06-01T00:00:00Z');
    expect(takeTheBestFinalDiagnosticReport([older, newer])).toBe(newer);
  });

  test('prefers amended over final', () => {
    const final = makeReport('final', '2024-06-01T00:00:00Z');
    const amended = makeReport('amended', '2024-01-01T00:00:00Z');
    expect(takeTheBestFinalDiagnosticReport([final, amended])).toBe(amended);
  });

  test('prefers corrected over final', () => {
    const final = makeReport('final', '2024-06-01T00:00:00Z');
    const corrected = makeReport('corrected', '2024-01-01T00:00:00Z');
    expect(takeTheBestFinalDiagnosticReport([final, corrected])).toBe(corrected);
  });

  test('prefers appended over final', () => {
    const final = makeReport('final', '2024-06-01T00:00:00Z');
    const appended = makeReport('appended', '2024-01-01T00:00:00Z');
    expect(takeTheBestFinalDiagnosticReport([final, appended])).toBe(appended);
  });

  test('returns the most recent among amended/corrected/appended reports', () => {
    const amended = makeReport('amended', '2024-01-01T00:00:00Z');
    const corrected = makeReport('corrected', '2024-09-01T00:00:00Z');
    const appended = makeReport('appended', '2024-05-01T00:00:00Z');
    expect(takeTheBestFinalDiagnosticReport([amended, corrected, appended])).toBe(corrected);
  });
});

describe('makeRadiologyDTO', () => {
  test('builds a DTO with cpt code and diagnosis from the service request', () => {
    const sr = makeServiceRequest({
      code: { coding: [{ code: '72148', display: 'MRI Lumbar Spine' }] },
      reasonCode: [{ coding: [{ code: 'M54.5', display: 'Low back pain' }] }],
    });

    const dto = makeRadiologyDTO(sr);

    expect(dto.serviceRequestId).toBe('sr-1');
    expect(dto.cptCodeDisplay).toBe('MRI Lumbar Spine');
    expect(dto.studyType).toBe('72148 — MRI Lumbar Spine');
    expect(dto.diagnosis).toBe('M54.5 — Low back pain');
  });

  test('includes preliminary report HTML data when provided', () => {
    const sr = makeServiceRequest();
    const prelimReport = makeHtmlReport('preliminary', 'dGVzdA==');

    const dto = makeRadiologyDTO(sr, prelimReport);

    expect(dto.preliminaryReport).toBe('dGVzdA==');
    expect(dto.finalReport).toBeUndefined();
  });

  test('includes final report HTML data when provided', () => {
    const sr = makeServiceRequest();
    const finalReport = makeHtmlReport('final', 'ZmluYWwgdGVzdA==');

    const dto = makeRadiologyDTO(sr, undefined, finalReport);

    expect(dto.finalReport).toBe('ZmluYWwgdGVzdA==');
    expect(dto.preliminaryReport).toBeUndefined();
  });

  test('ignores non-html attachments when picking report data', () => {
    const sr = makeServiceRequest();
    const report: DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      status: 'final',
      code: {},
      presentedForm: [{ contentType: 'application/pdf', data: 'PdfData==' }],
    };

    const dto = makeRadiologyDTO(sr, undefined, report);

    expect(dto.finalReport).toBeUndefined();
  });

  test('extracts clinical-history from order-detail extensions', () => {
    const sr = makeServiceRequest({
      extension: [makeOrderDetailExtension('clinical-history', 'Patient has back pain')],
    });

    const dto = makeRadiologyDTO(sr);

    expect(dto.clinicalHistory).toBe('Patient has back pain');
  });

  test('extracts studyName from requested-procedure-description extensions', () => {
    const sr = makeServiceRequest({
      extension: [makeOrderDetailExtension('requested-procedure-description', 'MRI without contrast')],
    });

    const dto = makeRadiologyDTO(sr);

    expect(dto.studyName).toBe('MRI without contrast');
  });

  test('extracts both clinical-history and studyName when both extensions are present', () => {
    const sr = makeServiceRequest({
      extension: [
        makeOrderDetailExtension('clinical-history', 'History of injury'),
        makeOrderDetailExtension('requested-procedure-description', 'CT Chest'),
      ],
    });

    const dto = makeRadiologyDTO(sr);

    expect(dto.clinicalHistory).toBe('History of injury');
    expect(dto.studyName).toBe('CT Chest');
  });

  test('returns undefined clinicalHistory and studyName when extensions are absent', () => {
    const sr = makeServiceRequest();

    const dto = makeRadiologyDTO(sr);

    expect(dto.clinicalHistory).toBeUndefined();
    expect(dto.studyName).toBeUndefined();
  });
});
