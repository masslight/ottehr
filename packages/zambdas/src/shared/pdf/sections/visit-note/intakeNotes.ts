import { NOTE_TYPE } from 'utils';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, IntakeNotes, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeIntakeNotes: DataComposer<{ allChartData: AllChartData }, IntakeNotes> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const intakeNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.INTAKE)
    ?.map((note) => note.text);
  return {
    intakeNotes,
  };
};

export const createIntakeNotesSection = <
  TData extends { encounter?: EncounterInfo; intakeNotes?: IntakeNotes },
>(): PdfSection<TData, IntakeNotes> => {
  return createConfiguredSection(null, () => ({
    title: 'Intake notes',
    dataSelector: (data) => data.intakeNotes,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.intakeNotes?.length,
    render: (client, data, styles) => {
      data.intakeNotes?.forEach((record) => {
        drawRegularText(client, styles, record);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
