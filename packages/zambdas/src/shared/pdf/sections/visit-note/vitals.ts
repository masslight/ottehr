import { mapVitalsToDisplay, NOTE_TYPE, VitalFieldNames } from 'utils';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, PdfSection, ProgressNoteVisitDataInput, Vitals } from '../../types';

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
      const vitalLabelMapper: { [value in VitalFieldNames]: string } & { notes: string } = {
        [VitalFieldNames.VitalTemperature]: 'Temperature',
        [VitalFieldNames.VitalHeartbeat]: 'Heartbeat',
        [VitalFieldNames.VitalRespirationRate]: 'Respiration rate',
        [VitalFieldNames.VitalBloodPressure]: 'Blood pressure',
        [VitalFieldNames.VitalOxygenSaturation]: 'Oxygen saturation',
        [VitalFieldNames.VitalWeight]: 'Weight',
        [VitalFieldNames.VitalHeight]: 'Height',
        [VitalFieldNames.VitalVision]: 'Vision',
        [VitalFieldNames.VitalLastMenstrualPeriod]: 'Last Menstrual Period',
        notes: 'Vitals notes',
      };

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
            drawRegularText(client, styles, record);
          });
        });

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
