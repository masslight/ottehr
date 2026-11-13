import { CardErrorDialog } from 'ui-components/lib/components/paperwork/form-components/credit-card/CardErrorDialog';
import { useCreditCardStore } from 'ui-components/lib/components/paperwork/hooks/useCreditCardStore';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Card cannot be saved (paperwork credit-card field)',
  source: 'packages/ui-components/lib/components/paperwork/form-components/credit-card/CardErrorDialog.tsx',
  base: 'ui-components intake CustomDialog',
  kind: 'confirm',
  where:
    'Patient paperwork (PagedQuestionnaire) when saving a credit card fails. In the EHR it is only mounted, closed, inside PagedQuestionnaire (EditFormResponseDialog, QuestionnairePreview).',
  setup: () => {
    useCreditCardStore.setState({ showCardErrorDialog: true, cardSaveError: 'Your card was declined.' });
  },
  notes:
    'FORCED STATE: opened by setting useCreditCardStore directly; nothing in apps/ehr/src imports this dialog and EHR forms have no credit-card field to trigger it. Rendered under the EHR theme, not the intake theme where it normally appears. Also the only use of ui-components intake/CustomDialog.',
  render: () => <CardErrorDialog onContinueAnyway={() => undefined} />,
});
