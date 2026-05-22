import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  dispositionCheckboxOptions,
  followUpInOptions,
  getDefaultNote,
  mapDispositionTypeToLabel,
  NOTE_TYPE,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
  REFUSAL_OF_EMS_TRANSPORT_LABEL,
} from 'utils';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { AddendumEntry, PdfSection, PlanData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composePlanData: DataComposer<{ allChartData: AllChartData; encounter?: Encounter }, PlanData> = ({
  allChartData,
  encounter,
}) => {
  const { chartData, additionalChartData } = allChartData;
  const patientInstructions: string[] = [];
  chartData?.instructions?.forEach((item) => {
    if (item?.text) {
      patientInstructions.push(item.text);
    }
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
  const specialty = disposition?.specialty;

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
  // Notes are searched by patient (not encounter), so for a follow-up visit the response includes
  // addendum notes from the parent encounter too. Filter them out when we know which encounter this PDF
  // is for — only show addendum notes that belong to this encounter.
  const currentEncounterId = encounter?.id;
  const addendumNotes: AddendumEntry[] =
    additionalChartData?.notes
      ?.filter((note) => note.type === NOTE_TYPE.ADDENDUM)
      ?.filter((note) => !currentEncounterId || note.encounterId === currentEncounterId)
      ?.map((note) => {
        const deleted = !!note.deleted;
        return {
          text: note.text,
          authorName: note.authorName || note.authorId || 'Unknown',
          // Always show meta.lastUpdated — same as the frontend NoteEntity. For a fresh note that's
          // the create time, for an edited note it's the edit time, and for a soft-deleted note it's
          // the deletion time. Keeping the two surfaces in sync avoids confusion when comparing the
          // EHR view to the generated PDF.
          timestamp: note.lastUpdated,
          edited: !deleted && !!note.edited,
          deleted,
        };
      }) ?? [];
  return {
    patientInstructions,
    disposition: {
      header,
      text,
      [NOTHING_TO_EAT_OR_DRINK_FIELD]: disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD],
      [REFUSAL_OF_EMS_TRANSPORT_FIELD]: disposition?.[REFUSAL_OF_EMS_TRANSPORT_FIELD],
      labService,
      virusTest,
      followUpIn,
      reason,
      specialty,
    },
    subSpecialtyFollowup,
    workSchoolExcuse,
    addendumNote,
    addendumNotes,
  };
};

const hasDisposition = (data: PlanData): boolean =>
  !!(
    data.disposition?.text ||
    data.disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
    data.disposition?.[REFUSAL_OF_EMS_TRANSPORT_FIELD] ||
    data.disposition?.labService ||
    data.disposition?.virusTest ||
    typeof data.disposition?.followUpIn === 'number' ||
    data.disposition?.reason ||
    data.disposition?.specialty
  );

const hasPatientInstructions = (data: PlanData): boolean => Boolean(data.patientInstructions?.some((item) => item));

const hasSubSpecialtyFollowUp = (data: PlanData): boolean =>
  Boolean(data.subSpecialtyFollowup && data.subSpecialtyFollowup.length);

const hasWorkSchoolExcuse = (data: PlanData): boolean => Boolean(data.workSchoolExcuse && data.workSchoolExcuse.length);

const hasAddendum = (data: PlanData): boolean => !!data.addendumNote || (data.addendumNotes?.length ?? 0) > 0;

const hasAnyPlanBlock = (data?: PlanData): boolean =>
  !!data &&
  (hasPatientInstructions(data) ||
    hasDisposition(data) ||
    hasSubSpecialtyFollowUp(data) ||
    hasWorkSchoolExcuse(data) ||
    hasAddendum(data));

const formatAddendumTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '';
  const dt = DateTime.fromISO(timestamp);
  return dt.isValid ? dt.toFormat('MM/dd/yyyy hh:mm a') : '';
};

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

        if (data.disposition.specialty) {
          drawRegularText(client, styles, data.disposition.specialty);
        }
        if (data.disposition.text) {
          drawRegularText(client, styles, data.disposition.text);
        }
        if (data.disposition[NOTHING_TO_EAT_OR_DRINK_FIELD]) {
          drawRegularText(client, styles, NOTHING_TO_EAT_OR_DRINK_LABEL);
        }
        if (data.disposition[REFUSAL_OF_EMS_TRANSPORT_FIELD]) {
          drawRegularText(client, styles, REFUSAL_OF_EMS_TRANSPORT_LABEL);
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
        if (data.addendumNote) {
          drawRegularText(client, styles, data.addendumNote);
        }
        data.addendumNotes?.forEach((entry) => {
          const timestamp = formatAddendumTimestamp(entry.timestamp);
          if (entry.deleted) {
            const tombstone = [timestamp, entry.authorName, 'deleted the note'].filter(Boolean).join(' ');
            drawRegularText(client, styles, tombstone);
            return;
          }
          drawRegularText(client, styles, entry.text);
          const attribution = [timestamp, `by ${entry.authorName}`, entry.edited ? '(edited)' : '']
            .filter(Boolean)
            .join(' ');
          if (attribution) {
            drawRegularText(client, styles, attribution);
          }
        });
      }
    },
  }));
};
