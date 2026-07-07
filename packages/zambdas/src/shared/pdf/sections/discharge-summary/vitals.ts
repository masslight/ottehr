import { getDotVisionScreeningLines, mapVitalsToDisplay, VitalFieldNames, VitalsVisionObservationDTO } from 'utils';
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
        ['BP', data.vitals.bp, 'Vision', data.vitals.vision],
        ['Last Menstrual Period', data.vitals.lastMenstrualPeriod],
      ];

      const leftX = client.getLeftBound();
      const colGap = 5;
      const colWidth = (client.getRightBound() - leftX - colGap) / 2;
      const rightX = leftX + colWidth + colGap;

      let y = client.getY();

      const lineHeight = styles.textStyles.regular.font.heightAtSize(styles.textStyles.regular.fontSize);
      const rowSpacing = 6;

      vitals.forEach(([label1, value1, label2, value2]) => {
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

        if (!label2) {
          return;
        }

        client.setY(y);
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

        y -= lineHeight + rowSpacing;
        client.setY(y);
      });

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
