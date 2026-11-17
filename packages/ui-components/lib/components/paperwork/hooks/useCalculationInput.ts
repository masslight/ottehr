import { QuestionnaireResponseItem } from 'fhir/r4b';
import { useCallback } from 'react';
import { FieldValues } from 'react-hook-form';
import { BuildCalculatedAnswersInput } from 'utils/lib/helpers/paperwork/calculated-expressions';
import { evalEnableWhen } from 'utils/lib/helpers/paperwork/validation';
import { usePaperworkContext } from '../context';
import { useQRState } from './useFormHelpers';

// builds what the calculated items are worked out from: every page, hidden ones included, with the pages that are not
// enabled filtered out against the whole response. Shared by the live CalculatedField and the save in
// PagedQuestionnaire so the value on screen and the value recorded never disagree
export const useCalculationInput = (): ((formValues: FieldValues) => BuildCalculatedAnswersInput) => {
  const { pageItems, allItems, paperwork, questionnaireResponse } = usePaperworkContext();
  const { allFields } = useQRState();

  return useCallback(
    (formValues: FieldValues): BuildCalculatedAnswersInput => ({
      pageItems,
      formValues: formValues as Record<string, QuestionnaireResponseItem | undefined>,
      savedPages: paperwork,
      isPageEnabled: (page) => {
        const definition = pageItems.find((item) => item.linkId === page.linkId);
        return definition ? evalEnableWhen(definition, allItems, allFields, questionnaireResponse) : true;
      },
    }),
    [pageItems, allItems, paperwork, allFields, questionnaireResponse]
  );
};
