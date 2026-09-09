import { mapVitalsToDisplay } from 'utils/lib/helpers/visit-note/map-vitals-to-display.helper';
import { getDotVisionScreeningLines } from 'utils/lib/helpers/vitals/vitals-vision.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsVisionObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, VitalsDataInDischargeSummary } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeVitalsForDischargeSummary: DataComposer<
  { allChartData: AllChartData },
  VitalsDataInDischargeSummary
> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;

  const vitals = additionalChartData?.vitalsObservations
    ? mapVitalsToDisplay(additionalChartData.vitalsObservations, false)
    : undefined;

  // The Vision grid cell should show the latest Snellen acuity reading only; DOT screening is
  // rendered as its own block. Vision entries are either acuity or DOT (saved separately).
  const visionObservations = (additionalChartData?.vitalsObservations ?? []).filter(
    (obs): obs is VitalsVisionObservationDTO => obs.field === VitalFieldNames.VitalVision
  );
  const latestDotEntry = visionObservations
    .filter((obs) => getDotVisionScreeningLines(obs.dotVisionScreening).length > 0)
    .at(-1);

  const acuityDisplayLines = visionObservations
    .filter((obs) => getDotVisionScreeningLines(obs.dotVisionScreening).length === 0)
    .map((obs) => {
      const parts: string[] = [];
      if (obs.leftEyeVisionText) parts.push(`Left eye: ${obs.leftEyeVisionText}`);
      if (obs.rightEyeVisionText) parts.push(`Right eye: ${obs.rightEyeVisionText}`);
      if (obs.bothEyesVisionText) parts.push(`Both eyes: ${obs.bothEyesVisionText}`);
      return parts.join('; ');
    })
    .filter((line) => line.length > 0);

  return {
    vitals: {
      temp: vitals?.['vital-temperature']?.at(-1) ?? '',
      hr: vitals?.['vital-heartbeat']?.at(-1) ?? '',
      rr: vitals?.['vital-respiration-rate']?.at(-1) ?? '',
      bp: vitals?.['vital-blood-pressure']?.at(-1) ?? '',
      oxygenSat: vitals?.['vital-oxygen-sat']?.at(-1) ?? '',
      weight: vitals?.['vital-weight']?.at(-1) ?? '',
      height: vitals?.['vital-height']?.at(-1) ?? '',
      bmi: vitals?.['vital-bmi']?.at(-1) ?? '',
      vision: acuityDisplayLines.at(-1) ?? '',
      dotVisionScreening: getDotVisionScreeningLines(latestDotEntry?.dotVisionScreening, { includeDocument: true }),
      lastMenstrualPeriod: vitals?.['vital-last-menstrual-period']?.at(-1) ?? '',
    },
  };
};

export const createVitalsSectionForDischargeSummary = <
  TData extends { vitals?: VitalsDataInDischargeSummary },
>(): PdfSection<TData, VitalsDataInDischargeSummary> => {
  return createConfiguredSection(null, () => ({
    title: 'Vitals',
    dataSelector: (data) => data.vitals,
    shouldRender: (sectionData) =>
      Object.values(sectionData.vitals || {}).some((val) => (Array.isArray(val) ? val.length > 0 : !!val)),
    render: (client, data, styles) => {
      const vitals = [
        ['Temp', data.vitals.temp, 'Oxygen Sat', data.vitals.oxygenSat],
        ['HR', data.vitals.hr, 'Weight', data.vitals.weight],
        ['RR', data.vitals.rr, 'Height', data.vitals.height],
        ['BP', data.vitals.bp, 'BMI', data.vitals.bmi],
        ['Last Menstrual Period', data.vitals.lastMenstrualPeriod, 'Vision', data.vitals.vision],
      ];

      const leftX = client.getLeftBound();
      const colGap = 5;
      const colWidth = (client.getRightBound() - leftX - colGap) / 2;
      const rightX = leftX + colWidth + colGap;

      const rowSpacing = 6;

      // Track the row's page/Y explicitly rather than assuming both columns stay on the
      // same page: if column 1 overflows onto a new page, column 2 must follow it there
      // instead of resuming at the stale pre-break Y
      let rowStartPage = client.getCurrentPageIndex();
      let rowStartY = client.getY();

      vitals.forEach(([label1, value1, label2, value2]) => {
        client.setPageByIndex(rowStartPage);
        client.setY(rowStartY);

        client.drawTextSequential(
          `${label1}: `,
          {
            ...styles.textStyles.bold,
            newLineAfter: false,
          },
          {
            leftBound: leftX,
            rightBound: leftX + colWidth,
          }
        );

        const label1Width = client.getTextDimensions(`${label1}: `, styles.textStyles.bold).width;
        client.drawTextSequential(
          `${value1}`,
          {
            ...styles.textStyles.regular,
            newLineAfter: true,
          },
          {
            leftBound: leftX + label1Width,
            rightBound: leftX + label1Width + colWidth,
          }
        );

        const col1EndPage = client.getCurrentPageIndex();
        const col1EndY = client.getY();

        if (!label2) {
          rowStartPage = col1EndPage;
          rowStartY = col1EndY - rowSpacing;
          return;
        }

        client.setPageByIndex(col1EndPage);
        client.setY(col1EndPage === rowStartPage ? rowStartY : client.getPageTopY());
        client.drawTextSequential(
          `${label2}: `,
          {
            ...styles.textStyles.bold,
            newLineAfter: false,
          },
          {
            leftBound: rightX,
            rightBound: rightX + colWidth,
          }
        );

        const label2Width = client.getTextDimensions(`${label2}: `, styles.textStyles.bold).width;
        client.drawTextSequential(
          `${value2}`,
          {
            ...styles.textStyles.regular,
            newLineAfter: true,
          },
          {
            leftBound: rightX + label2Width,
            rightBound: rightX + label2Width + colWidth,
          }
        );

        const col2EndPage = client.getCurrentPageIndex();
        const col2EndY = client.getY();

        if (col2EndPage !== col1EndPage) {
          rowStartPage = col2EndPage;
          rowStartY = col2EndY - rowSpacing;
        } else {
          rowStartPage = col1EndPage;
          rowStartY = Math.min(col1EndY, col2EndY) - rowSpacing;
        }
      });

      client.setPageByIndex(rowStartPage);
      client.setY(rowStartY);

      const dotLines = data.vitals.dotVisionScreening ?? [];
      if (dotLines.length > 0) {
        client.drawTextSequential('DOT Vision Screening', { ...styles.textStyles.bold, newLineAfter: true });
        dotLines.forEach((line) => {
          client.drawTextSequential(line, { ...styles.textStyles.regular, newLineAfter: true });
        });
      }

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
