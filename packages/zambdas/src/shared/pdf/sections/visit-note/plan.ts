import {
  dispositionCheckboxOptions,
  followUpInOptions,
  getDefaultNote,
  mapDispositionTypeToLabel,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
} from 'utils';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, PlanData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composePlanData: DataComposer<{ allChartData: AllChartData }, PlanData> = ({ allChartData }) => {
  const { chartData, additionalChartData } = allChartData;
  const patientInstructions: string[] = [];
  chartData?.instructions?.forEach((item) => {
    if (item.text) patientInstructions.push(item.text);
  });
  const disposition = additionalChartData?.disposition;
  let header = 'Disposition - ';
  let text = '';
  if (disposition?.type) {
    header += mapDispositionTypeToLabel[disposition.type];
    text = disposition.note || getDefaultNote(disposition.type);
  }
  const labService = disposition?.labService?.join(', ') ?? '';
  const virusTest = disposition?.virusTest?.join(', ') ?? '';
  const followUpIn = typeof disposition?.followUpIn === 'number' ? disposition.followUpIn : undefined;
  const reason = disposition?.reason;

  const subSpecialtyFollowup =
    additionalChartData?.disposition?.followUp?.map((followUp) => {
      const display = dispositionCheckboxOptions.find((option) => option.name === followUp.type)!.label;
      let note = '';
      if (followUp.type === 'other') note = `: ${followUp.note}`;
      return `${display} ${note}`;
    }) ?? [];

  const workSchoolExcuse: string[] = [];
  chartData.schoolWorkNotes?.forEach((ws) => {
    if (ws.type === 'school') workSchoolExcuse.push(`There was a school note generated`);
    else workSchoolExcuse.push('There was a work note generated');
  });

  const addendumNote = chartData?.addendumNote?.text;
  return {
    patientInstructions,
    disposition: {
      header,
      text,
      [NOTHING_TO_EAT_OR_DRINK_FIELD]: disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD],
      labService,
      virusTest,
      followUpIn,
      reason,
    },
    subSpecialtyFollowup,
    workSchoolExcuse,
    addendumNote,
  };
};

const hasDisposition = (data: PlanData): boolean =>
  !!(
    data.disposition?.text ||
    data.disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
    data.disposition?.labService ||
    data.disposition?.virusTest ||
    typeof data.disposition?.followUpIn === 'number' ||
    data.disposition?.reason
  );

const hasPatientInstructions = (data: PlanData): boolean =>
  Boolean(data.patientInstructions && data.patientInstructions.length);

const hasSubSpecialtyFollowUp = (data: PlanData): boolean =>
  Boolean(data.subSpecialtyFollowup && data.subSpecialtyFollowup.length);

const hasWorkSchoolExcuse = (data: PlanData): boolean => Boolean(data.workSchoolExcuse && data.workSchoolExcuse.length);

const hasAddendum = (data: PlanData): boolean => !!data.addendumNote;

const hasAnyPlanBlock = (data?: PlanData): boolean =>
  !!data &&
  (hasPatientInstructions(data) ||
    hasDisposition(data) ||
    hasSubSpecialtyFollowUp(data) ||
    hasWorkSchoolExcuse(data) ||
    hasAddendum(data));

export const createPlanSection = <TData extends { plan?: PlanData }>(): PdfSection<TData, PlanData> => {
  return createConfiguredSection(null, () => ({
    title: 'Plan',
    dataSelector: (data) => data.plan,
    shouldRender: (plan) => hasAnyPlanBlock(plan),
    render: (client, data, styles) => {
      if (hasPatientInstructions(data)) {
        drawBlockHeader(client, styles, 'Patient instructions', styles.textStyles.blockSubHeader);
        data.patientInstructions?.forEach((instruction) => {
          drawRegularText(client, styles, instruction);
        });
        client.drawSeparatedLine(styles.lineStyles.separator);
      }

      if (hasDisposition(data)) {
        drawBlockHeader(client, styles, data.disposition.header, styles.textStyles.blockSubHeader);

        if (data.disposition.text) {
          drawRegularText(client, styles, data.disposition.text);
        }
        if (data.disposition[NOTHING_TO_EAT_OR_DRINK_FIELD]) {
          drawRegularText(client, styles, NOTHING_TO_EAT_OR_DRINK_LABEL);
        }
        if (data.disposition.labService) {
          drawRegularText(client, styles, `Lab Services: ${data.disposition.labService}`);
        }
        if (data.disposition.virusTest) {
          drawRegularText(client, styles, `Virus Tests: ${data.disposition.virusTest}`);
        }
        if (typeof data.disposition.followUpIn === 'number') {
          drawRegularText(
            client,
            styles,
            `Follow-up visit ${
              data.disposition.followUpIn === 0
                ? followUpInOptions.find((option) => option.value === data.disposition.followUpIn)?.label
                : `in ${followUpInOptions.find((option) => option.value === data.disposition.followUpIn)?.label}`
            }`
          );
        }
        if (data.disposition.reason) {
          drawRegularText(client, styles, `Reason for transfer: ${data.disposition.reason}`);
        }

        client.drawSeparatedLine(styles.lineStyles.separator);
      }

      if (hasSubSpecialtyFollowUp(data)) {
        drawBlockHeader(client, styles, 'Subspecialty follow-up', styles.textStyles.blockSubHeader);
        data.subSpecialtyFollowup?.forEach((followUp) => {
          drawRegularText(client, styles, followUp);
        });
        client.drawSeparatedLine(styles.lineStyles.separator);
      }

      if (hasWorkSchoolExcuse(data)) {
        drawBlockHeader(client, styles, 'School / Work Excuse', styles.textStyles.blockSubHeader);
        data.workSchoolExcuse?.forEach((item) => {
          drawRegularText(client, styles, item);
        });
        client.drawSeparatedLine(styles.lineStyles.separator);
      }

      if (hasAddendum(data)) {
        drawBlockHeader(client, styles, 'Addendum', styles.textStyles.blockSubHeader);
        drawRegularText(client, styles, data.addendumNote);
      }
    },
  }));
};
