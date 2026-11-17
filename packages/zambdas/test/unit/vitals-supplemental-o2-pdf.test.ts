import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeObservationResource } from '../../src/shared/chart-data';
import { clinicalDocumentAssetPaths, createClinicalDocumentStyles } from '../../src/shared/pdf/clinical-document-theme';
import { renderPdf } from '../../src/shared/pdf/pdf-common';
import { PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import { progressNoteDataToText } from '../../src/shared/pdf/progress-note-text';
import {
  composeVitalsForDischargeSummary,
  createVitalsSectionForDischargeSummary,
} from '../../src/shared/pdf/sections/discharge-summary/vitals';
import { composeVitals, createVitalsSection } from '../../src/shared/pdf/sections/visit-note/vitals';
import {
  PdfClient,
  PdfData,
  PdfStyles,
  ProgressNoteData,
  ProgressNoteVisitDataInput,
  VitalsDataInDischargeSummary,
} from '../../src/shared/pdf/types';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const { OnRoomAir, OnSupplementalO2 } = VitalsOxygenSatObservationMethod;

const savedAndReloaded = (dto: VitalsObservationDTO, at: string): VitalsObservationDTO => {
  const observation = {
    ...makeObservationResource(
      'encounter-1',
      'patient-1',
      'practitioner-1',
      undefined,
      dto,
      PATIENT_VITALS_META_SYSTEM,
      undefined,
      undefined,
      undefined
    ),
    effectiveDateTime: at,
  };
  const reloaded = makeVitalsObservationDTO(observation);
  if (!reloaded) throw new Error('expected the saved vital to be read back');
  return reloaded;
};

const oxygenSat = (
  value: number,
  observationMethod: VitalsOxygenSatObservationMethod | undefined,
  supplementalO2: Extract<VitalsObservationDTO, { field: VitalFieldNames.VitalOxygenSaturation }>['supplementalO2'],
  at: string
): VitalsObservationDTO =>
  savedAndReloaded({ field: VitalFieldNames.VitalOxygenSaturation, value, observationMethod, supplementalO2 }, at);

const chartWith = (vitalsObservations: VitalsObservationDTO[]): AllChartData => ({
  chartData: { patientId: 'patient-1' } as GetChartDataResponse,
  additionalChartData: { patientId: 'patient-1', vitalsObservations } as GetChartDataResponse,
});

const supplementalReading = (): VitalsObservationDTO =>
  oxygenSat(
    98,
    OnSupplementalO2,
    { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula },
    '2024-04-28T17:18:00.000Z'
  );

const fromPackageRoot = (paths: Record<string, string> | undefined): Record<string, string> | undefined =>
  paths && Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, join(__dirname, '..', '..', path)]));

const { initialPage } = PDF_CLIENT_STYLES;
const PAGE_RIGHT_BOUND = initialPage.width - (initialPage.pageMargins.right ?? 0);

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discharge summary PDF — SpO2', () => {
  const renderDischargeVitals = async (vitalsObservations: VitalsObservationDTO[]): Promise<string> => {
    const data: PdfData & { vitals: VitalsDataInDischargeSummary } = {
      vitals: composeVitalsForDischargeSummary({ allChartData: chartWith(vitalsObservations) }),
    };
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    drawText.mockClear();
    await renderPdf(
      data,
      {
        header: { title: 'DISCHARGE SUMMARY' },
        assetPaths: {
          fonts: fromPackageRoot(clinicalDocumentAssetPaths.fonts),
          icons: fromPackageRoot(clinicalDocumentAssetPaths.icons),
        },
        styleFactory: createClinicalDocumentStyles,
        sections: [createVitalsSectionForDischargeSummary()],
      },
      ''
    );
    for (const [text, options] of drawText.mock.calls) {
      const width = options?.font?.widthOfTextAtSize(text, options.size ?? 0) ?? 0;
      expect((options?.x ?? 0) + width, `"${text}" runs past the right margin`).toBeLessThanOrEqual(
        PAGE_RIGHT_BOUND + 0.5
      );
    }
    return drawText.mock.calls
      .map(([text]) => text)
      .join(' ')
      .replace(/\s+/g, ' ');
  };

  it('composes the latest reading with its supplemental O2 details', () => {
    const composed = composeVitalsForDischargeSummary({
      allChartData: chartWith([oxygenSat(95, OnRoomAir, undefined, '2024-04-28T15:00:00.000Z'), supplementalReading()]),
    });
    expect(composed.vitals.oxygenSat).toBe('98% (On supplemental O2 - 4.5 L/min - Nasal Cannula)');
  });

  it('prints the details in the Oxygen Sat cell of the rendered PDF', async () => {
    const text = await renderDischargeVitals([supplementalReading()]);
    expect(text).toContain('Oxygen Sat: 98% (On supplemental O2 - 4.5 L/min - Nasal Cannula)');
  });

  it('prints the Other description', async () => {
    const text = await renderDischargeVitals([
      oxygenSat(
        93,
        OnSupplementalO2,
        { deliveryType: VitalsSupplementalO2DeliveryType.Other, deliveryTypeOther: 'Face tent' },
        '2024-04-28T17:18:00.000Z'
      ),
    ]);
    expect(text).toContain('Oxygen Sat: 93% (On supplemental O2 - Other: Face tent)');
  });

  it('wraps a long reading inside its column without losing text', async () => {
    const longDescription = 'Heated humidified high-flow blender through an oxygen hood';
    const text = await renderDischargeVitals([
      oxygenSat(
        93,
        OnSupplementalO2,
        {
          flowRate: 12.5,
          deliveryType: VitalsSupplementalO2DeliveryType.Other,
          deliveryTypeOther: longDescription,
        },
        '2024-04-28T17:18:00.000Z'
      ),
    ]);
    expect(text).toContain(`Oxygen Sat: 93% (On supplemental O2 - 12.5 L/min - Other: ${longDescription})`);
  });

  it('prints legacy and room air readings as before', async () => {
    expect(
      await renderDischargeVitals([oxygenSat(94, OnSupplementalO2, undefined, '2024-04-28T17:18:00.000Z')])
    ).toContain('Oxygen Sat: 94% (On supplemental O2) ');
    expect(
      await renderDischargeVitals([
        oxygenSat(
          97,
          OnRoomAir,
          { flowRate: 3, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula },
          '2024-04-28T17:18:00.000Z'
        ),
      ])
    ).toContain('Oxygen Sat: 97% (On room air) ');
  });
});

describe('visit note PDF — SpO2', () => {
  const composeNoteVitals = (vitalsObservations: VitalsObservationDTO[]): ReturnType<typeof composeVitals> =>
    composeVitals({
      allChartData: chartWith(vitalsObservations),
      appointmentPackage: { timezone: 'America/New_York' },
    } as ProgressNoteVisitDataInput);

  const renderNoteVitals = (vitalsObservations: VitalsObservationDTO[]): string[] => {
    const drawText = vi.fn();
    const client = {
      drawText,
      drawSeparatedLine: vi.fn(),
      getTextDimensions: vi.fn().mockReturnValue({ height: 10, width: 100 }),
      getY: vi.fn().mockReturnValue(700),
      addNewPage: vi.fn(),
    } as unknown as PdfClient;
    const style = { fontSize: 12, spacing: 1, newLineAfter: true };
    const styles = {
      textStyles: { blockSubHeader: style, regularText: style, subHeader: style },
      lineStyles: { separator: {} },
    } as unknown as PdfStyles;
    createVitalsSection().render(client, composeNoteVitals(vitalsObservations), styles, {} as never);
    return drawText.mock.calls.map(([text]) => text);
  };

  it('draws the reading with its supplemental O2 details under Oxygen saturation', () => {
    const lines = renderNoteVitals([supplementalReading()]);
    const header = lines.indexOf('Oxygen saturation');
    expect(header).toBeGreaterThanOrEqual(0);
    expect(lines[header + 1]).toMatch(/ - 98% \(On supplemental O2 - 4\.5 L\/min - Nasal Cannula\)$/);
  });

  it('keeps every reading of the visit, each with its own details', () => {
    const lines = renderNoteVitals([
      oxygenSat(91, OnSupplementalO2, { flowRate: 2 }, '2024-04-28T15:00:00.000Z'),
      oxygenSat(96, OnRoomAir, undefined, '2024-04-28T16:00:00.000Z'),
    ]);
    expect(lines.filter((line) => line.includes('%'))).toEqual([
      expect.stringMatching(/ - 91% \(On supplemental O2 - 2 L\/min\)$/),
      expect.stringMatching(/ - 96% \(On room air\)$/),
    ]);
  });

  it('passes the same text to the AI note review', () => {
    const text = progressNoteDataToText({ vitals: composeNoteVitals([supplementalReading()]) } as ProgressNoteData);
    expect(text).toMatch(/Oxygen saturation: .* - 98% \(On supplemental O2 - 4\.5 L\/min - Nasal Cannula\)/);
  });
});
