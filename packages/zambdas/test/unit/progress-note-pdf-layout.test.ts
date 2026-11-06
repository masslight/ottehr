/**
 * Renders the visit note for the golden chart through the real render config and checks the layout
 * matches the discharge summary / visit details PDFs (OTR-3429): their font sizes, the compact header
 * and the two-column visit details, so a printed note takes as few pages as the other documents.
 */
import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { visitNoteToLegacyChartData } from 'utils/lib/helpers/visit-note/visit-note-to-chart-data.helper';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildVisitNote } from '../../src/shared/chart-sections/visit-note';
import { renderPdf } from '../../src/shared/pdf/pdf-common';
import { PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import { composeProgressNoteData, progressNoteRenderConfig } from '../../src/shared/pdf/progress-note-pdf';
import { createProgressNoteVisitDetailsSection } from '../../src/shared/pdf/sections/visit-note/progressNoteVisitDetails';
import { PdfSection, ProgressNoteData, ProgressNoteInput } from '../../src/shared/pdf/types';
import {
  buildGoldenChartResources,
  GOLDEN_IDS,
  GOLDEN_NOW,
  GoldenChartResources,
} from './fixtures/chart-data-golden.fixture';
import { createGoldenFhirServer } from './fixtures/golden-fhir-server';

const fromPackageRoot = (paths: Record<string, string> | undefined): Record<string, string> | undefined =>
  paths && Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, join(__dirname, '..', '..', path)]));

const { initialPage } = PDF_CLIENT_STYLES;
const PAGE_LEFT_BOUND = initialPage.pageMargins.left ?? 0;
const PAGE_RIGHT_BOUND = initialPage.width - (initialPage.pageMargins.right ?? 0);

interface DrawnText {
  text: string;
  size: number;
  x: number;
  y: number;
  width: number;
  page: PDFPage;
}

const renderedAssetPaths = {
  fonts: fromPackageRoot(progressNoteRenderConfig.assetPaths.fonts),
  icons: fromPackageRoot(progressNoteRenderConfig.assetPaths.icons),
};

/** Renders with the visit note config and returns every text fragment drawn on the PDF pages. */
const renderAndCapture = async (
  data: ProgressNoteData,
  sections = progressNoteRenderConfig.sections
): Promise<DrawnText[]> => {
  const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
  drawText.mockClear();
  await renderPdf(data, { ...progressNoteRenderConfig, assetPaths: renderedAssetPaths, sections }, '');
  const drawn = drawText.mock.instances.map((page, index) => {
    const [rawText, options] = drawText.mock.calls[index];
    // the pdf client ends every wrapped line with a space
    const text = rawText.trimEnd();
    const size = options?.size ?? 0;
    const width = options?.font?.widthOfTextAtSize(text, size) ?? 0;
    return { text, size, x: options?.x ?? 0, y: options?.y ?? 0, width, page: page as PDFPage };
  });
  drawText.mockRestore();
  return drawn;
};

const expectInsideMargins = (drawn: DrawnText[]): void => {
  for (const item of drawn) {
    expect(item.x, `"${item.text}" starts left of the margin`).toBeGreaterThanOrEqual(PAGE_LEFT_BOUND - 0.5);
    expect(item.x + item.width, `"${item.text}" runs past the right margin`).toBeLessThanOrEqual(
      PAGE_RIGHT_BOUND + 0.5
    );
  }
};

describe('visit note PDF layout — golden chart data', () => {
  let drawn: DrawnText[];
  let input: ProgressNoteInput;

  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const fixture: GoldenChartResources = buildGoldenChartResources();
    const server = createGoldenFhirServer([...fixture.resources, fixture.patient, fixture.appointment]);
    const note = await buildVisitNote({ oystehr: server.oystehr, m2mToken: 'token' }, GOLDEN_IDS.encounterId);
    const chartData = visitNoteToLegacyChartData(note, { module: 'in-person' });
    input = {
      patient: fixture.patient,
      encounter: fixture.encounter,
      allChartData: {
        chartData: chartData.chartData,
        additionalChartData: chartData.additionalChartData,
        medicationOrders: [],
        immunizationOrders: [],
      },
      appointmentPackage: {
        appointment: fixture.appointment,
        encounter: fixture.encounter,
        patient: fixture.patient,
        practitioners: [fixture.practitioner],
        timezone: 'America/Chicago',
        listResources: [],
      },
      questionnaireResponse: undefined,
      upcomingFollowUps: [],
      signed: true,
    };

    drawn = await renderAndCapture(composeProgressNoteData(input));
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const find = (text: string): DrawnText => {
    const match = drawn.find((item) => item.text === text);
    expect(match, `"${text}" is drawn`).toBeDefined();
    return match!;
  };

  it('uses the discharge summary type scale: 12pt body, 14pt section titles, 16pt header', () => {
    expect(Math.max(...drawn.map((item) => item.size))).toBe(16);
    expect(find('VISIT NOTE').size).toBe(16);
    expect(find('Visit Details').size).toBe(14);
    expect(find('Gradual onset, worse with swallowing').size).toBe(12);
    const bodySizes = new Set(drawn.filter((item) => item.size < 14).map((item) => item.size));
    expect([...bodySizes].sort()).toEqual([10, 12]);
  });

  it("shows the guardian's paperwork phone, as the old patient section did, before the patient's own", () => {
    const withPhones = (guardianNumber: string | undefined, patientPhone: string | undefined): string | undefined =>
      composeProgressNoteData({
        ...input,
        appointmentPackage: {
          ...input.appointmentPackage,
          patient: {
            ...input.appointmentPackage.patient!,
            telecom: patientPhone ? [{ system: 'phone', value: patientPhone }] : undefined,
          },
          questionnaireResponse: {
            resourceType: 'QuestionnaireResponse',
            status: 'completed',
            item: guardianNumber ? [{ linkId: 'guardian-number', answer: [{ valueString: guardianNumber }] }] : [],
          },
        },
      }).patient.phone;

    expect(withPhones('2025550123', '3125550199')).toBe('(202) 555-0123');
    expect(withPhones(undefined, '3125550199')).toBe('(312) 555-0199');
    // not a US number, so it cannot be standardized: printed as entered rather than dropped
    expect(withPhones('+44 20 7946 0958', '3125550199')).toBe('+44 20 7946 0958');
    expect(withPhones(undefined, undefined)).toBeUndefined();
  });

  it('puts the patient in the compact header instead of a separate "Patient information" section', () => {
    expect(drawn.some((item) => item.text.startsWith('DOB: '))).toBe(true);
    // the golden patient has no friendly ID, so there is no empty "PID:" line
    expect(drawn.some((item) => item.text.startsWith('PID'))).toBe(false);
    expect(drawn.some((item) => item.text === 'Patient information')).toBe(false);
  });

  it('lays visit details out in two columns', () => {
    const reason = find('Reason for visit:');
    const visitState = find('Visit State:');
    const middle = (PAGE_LEFT_BOUND + PAGE_RIGHT_BOUND) / 2;
    expect(reason.y).toBe(visitState.y);
    expect(reason.x).toBe(PAGE_LEFT_BOUND);
    expect(visitState.x).toBeGreaterThan(middle);
  });

  it('gives the unbreakable visit ID the full width, below both columns', () => {
    const visitIdLabel = find('Visit ID:');
    const visitId = find(GOLDEN_IDS.appointmentId);
    expect(visitIdLabel.x).toBe(PAGE_LEFT_BOUND);
    expect(visitId.y).toBe(visitIdLabel.y);
    expect(visitIdLabel.y).toBeLessThan(find('Signed on:').y);
  });

  it('numbers every page in the bottom margin', () => {
    const pages = [...new Set(drawn.map((item) => item.page))];
    const pageNumbers = drawn.filter((item) => /^Page \d+ of \d+$/.test(item.text));
    expect(pageNumbers.map((item) => item.text)).toEqual(
      pages.map((_page, index) => `Page ${index + 1} of ${pages.length}`)
    );
    pageNumbers.forEach((item) => expect(item.y).toBeLessThan(initialPage.pageMargins.bottom ?? 0));
  });

  it('keeps every line inside the page margins', () => {
    expectInsideMargins(drawn);
  });
});

describe('visit note PDF layout — visit details at the bottom of a page', () => {
  const visit: ProgressNoteData['visit'] = {
    visitType: 'initial',
    dateOfService: '1/15/2026, 5:00 AM (CST)',
    reasonForVisit: 'Sore throat and a fever that started three days ago and has been getting worse since',
    provider: 'Provider, Test | MD',
    intakePerson: 'Assistant, Test | MA',
    signedOn: '1/15/2026, 6:00 AM (CST)',
    visitID: GOLDEN_IDS.appointmentId,
    visitState: 'NY',
    insuranceCompany: 'Test Insurance Company of New York',
    // one unbreakable token too wide for a half-page column
    insuranceSubscriberId: 'SUBSCRIBER-0123456789-0123456789',
    address: '123 Long Street Name Apartment 456, Some City',
    personAccompanying: 'Guardian, Test',
  };
  // Leaves room for the section title and about one field line before the bottom margin.
  const pushToPageBottom: PdfSection<ProgressNoteData, true> = {
    dataSelector: () => true,
    render: (client) => client.setY((initialPage.pageMargins.bottom ?? 0) + 45),
  };

  let drawn: DrawnText[];

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    drawn = await renderAndCapture({ visit, encounter: { isFollowup: false } } as ProgressNoteData, [
      pushToPageBottom,
      createProgressNoteVisitDetailsSection(),
    ]);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('runs both columns onto the next page without drawing text over other text', () => {
    expect(new Set(drawn.map((item) => item.page)).size).toBeGreaterThan(1);
    const boxesOverlap = (a: DrawnText, b: DrawnText): boolean =>
      a.page === b.page && Math.abs(a.y - b.y) < Math.min(a.size, b.size) && a.x < b.x + b.width && b.x < a.x + a.width;
    const texts = drawn.filter((item) => item.text && !/^Page \d+ of \d+$/.test(item.text));
    texts.forEach((a, i) =>
      texts.slice(i + 1).forEach((b) => expect(boxesOverlap(a, b), `"${a.text}" overlaps "${b.text}"`).toBe(false))
    );
    texts.forEach((item) => expect(item.y).toBeGreaterThanOrEqual(initialPage.pageMargins.bottom ?? 0));
  });

  it('keeps each row of the two columns together and the full-width rows after them', () => {
    const pages = [...new Set(drawn.map((item) => item.page))];
    // reading order: earlier page first, then top (larger Y) first
    const position = (text: string): [number, number] => {
      const item = drawn.find((candidate) => candidate.text === text);
      expect(item, `"${text}" is drawn`).toBeDefined();
      return [pages.indexOf(item!.page), -item!.y];
    };
    const isBefore = (a: [number, number], b: [number, number]): boolean =>
      a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

    // row 0 is Reason for visit | Insurance Company, row 1 Provider | Visit State, row 2 Intake | Address
    expect(isBefore(position('Insurance Company:'), position('Reason for visit:'))).toBe(false);
    expect(isBefore(position('Insurance Company:'), position('Provider:'))).toBe(true);
    expect(isBefore(position('Visit State:'), position('Intake completed by:'))).toBe(true);
    expect(isBefore(position('Address:'), position('Date of Service:'))).toBe(true);
    // fields that cannot wrap into a column get full-width rows after the columns
    const lastColumnCell = position('Address:');
    ['Person accompanying the minor patient:', 'Visit ID:', 'Subscriber ID:'].forEach((label) => {
      const fullWidth = drawn.find((item) => item.text === label)!;
      expect(fullWidth.x, `"${label}" starts at the left margin`).toBe(PAGE_LEFT_BOUND);
      expect(isBefore(lastColumnCell, position(label)), `"${label}" comes after the columns`).toBe(true);
    });
  });

  it('keeps the long labels and values inside the page margins', () => {
    expect(drawn.some((item) => item.text === 'Guardian, Test')).toBe(true);
    expectInsideMargins(drawn);
  });
});
