import { mapVitalsToDisplay } from 'utils/lib/helpers/visit-note/map-vitals-to-display.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { drawBlockHeader } from '../../helpers/render/blockHeader';
import { drawRegularText } from '../../helpers/render/regularText';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, PdfSection, ProgressNoteVisitDataInput, Vitals } from '../../types';

/**
 * Display label for each vital, plus the free-text notes bucket that shares the `vitals` object.
 * Shared by the PDF renderer and the plain-text serialization used for the AI note review, so the
 * two can never drift apart.
 */
export const VITAL_LABELS: { [value in VitalFieldNames]: string } & { notes: string } = {
  [VitalFieldNames.VitalTemperature]: 'Temperature',
  [VitalFieldNames.VitalHeartbeat]: 'Heartbeat',
  [VitalFieldNames.VitalRespirationRate]: 'Respiration rate',
  [VitalFieldNames.VitalBloodPressure]: 'Blood pressure',
  [VitalFieldNames.VitalOxygenSaturation]: 'Oxygen saturation',
  [VitalFieldNames.VitalWeight]: 'Weight',
  [VitalFieldNames.VitalHeight]: 'Height',
  [VitalFieldNames.VitalBMI]: 'BMI',
  [VitalFieldNames.VitalVision]: 'Vision',
  [VitalFieldNames.VitalLastMenstrualPeriod]: 'Last Menstrual Period',
  notes: 'Vitals notes',
};

export const composeVitals: DataComposer<ProgressNoteVisitDataInput, Vitals> = ({
  allChartData,
  appointmentPackage,
}) => {
  const { additionalChartData } = allChartData;
  const { timezone } = appointmentPackage;

  const vitalsData = additionalChartData?.vitalsObservations
    ? mapVitalsToDisplay(additionalChartData.vitalsObservations, true, timezone)
    : undefined;

  const vitalsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.VITALS)
    ?.map((note) => note.text);

  if (!vitalsData && (!vitalsNotes || vitalsNotes.length === 0)) {
    return {};
  }

  return {
    vitals: {
      ...(vitalsData ?? {}),
      ...(vitalsNotes && vitalsNotes.length > 0 ? { notes: vitalsNotes } : {}),
    },
  };
};

export const createVitalsSection = <TData extends { encounter?: EncounterInfo; vitals?: Vitals }>(): PdfSection<
  TData,
  Vitals
> => {
  return createConfiguredSection(null, () => ({
    title: 'Vitals',
    dataSelector: (data) => data.vitals,
    shouldRender: (sectionData, rootData) => {
      if (rootData?.encounter?.isFollowup) return false;

      const vitals = sectionData.vitals;
      if (!vitals) return false;

      const { notes, ...vitalValues } = vitals;

      const hasVitalsValues = Object.values(vitalValues).some((arr) => Array.isArray(arr) && arr.length > 0);

      const hasNotes = Array.isArray(notes) && notes.length > 0;

      return hasVitalsValues || hasNotes;
    },
    render: (client, data, styles) => {
      const vitalLabelMapper = VITAL_LABELS;

      Object.keys(vitalLabelMapper)
        .filter((name) => data.vitals?.[name as VitalFieldNames] && data.vitals?.[name as VitalFieldNames]!.length > 0)
        .forEach((vitalName) => {
          drawBlockHeader(
            client,
            styles,
            vitalLabelMapper[vitalName as VitalFieldNames],
            styles.textStyles.blockSubHeader
          );
          data.vitals?.[vitalName as VitalFieldNames]?.forEach((record) => {
            // DOT vision screening records are multi-line (MCSA-5875 layout); render each line separately.
            record.split('\n').forEach((line) => {
              drawRegularText(client, styles, line);
            });
          });
        });

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
