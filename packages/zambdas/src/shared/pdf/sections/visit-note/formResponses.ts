import { FormPlacement, formResponseLines } from 'utils/lib/helpers/practice-managed-questionnaires';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { drawBlockHeader } from '../../helpers/render/blockHeader';
import { drawRegularText } from '../../helpers/render/regularText';
import { createConfiguredSection } from '../../pdf-common';
import { FormResponseLines, PdfSection, PdfStyles, QuestionnaireForms } from '../../types';

/** The visit's forms with the given placement, as printed question/answer lines. */
export const composeFormResponses = (
  forms: StandaloneFormDTO[] | undefined,
  placement: FormPlacement
): FormResponseLines[] =>
  (forms ?? [])
    .filter((form) => form.placement === placement)
    .map((form) => ({ title: form.questionnaireTitle, lines: formResponseLines(form) }));

export const drawFormResponses = (
  client: Parameters<typeof drawRegularText>[0],
  styles: PdfStyles,
  forms: FormResponseLines[]
): void => {
  forms.forEach((form) => {
    drawBlockHeader(client, styles, form.title, styles.textStyles.blockSubHeader);
    form.lines.forEach(({ question, answer }) => drawRegularText(client, styles, `${question} - ${answer}`));
  });
};

export const createQuestionnairesSection = <TData extends { questionnaires?: QuestionnaireForms }>(): PdfSection<
  TData,
  QuestionnaireForms
> =>
  createConfiguredSection(null, () => ({
    title: 'Questionnaires',
    dataSelector: (data) => data.questionnaires,
    shouldRender: (sectionData) => sectionData.forms.length > 0,
    render: (client, data, styles) => {
      drawFormResponses(client, styles, data.forms);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
