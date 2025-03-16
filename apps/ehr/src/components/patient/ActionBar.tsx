import { Box, Button, useTheme } from '@mui/material';
import { FC, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { usePatientStore } from '../../state/patient.store';
import { dataTestIds } from '../../constants/data-test-ids';
import { enqueueSnackbar } from 'notistack';
import { Questionnaire, QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { IntakeQuestionnaireItem, makeQRResponseItem, mapQuestionnaireAndValueSetsToItemsList } from 'utils';
import { useUpdatePatientAccount } from '../../hooks/useGetPatient';

type ActionBarProps = {
  handleDiscard: () => void;
  questionnaire: Questionnaire | undefined;
  patientId: string;
};

const containedItemWithLinkId = (item: QuestionnaireItem, linkId: string): QuestionnaireItem | undefined => {
  // note: if item.linkId === linkId, return item
  const { linkId: itemLinkId, item: subItems } = item;
  if (itemLinkId === linkId) return item;
  if (!subItems) return undefined;
  return subItems.find((subItem) => containedItemWithLinkId(subItem, linkId));
};

const structureQuestionnaireResponse = (
  questionnaire: Questionnaire,
  formValues: any,
  patientId: string
): QuestionnaireResponse => {
  const pageDict: Map<string, QuestionnaireResponseItem[]> = new Map();

  const qItems = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
  qItems.forEach((item) => {
    pageDict.set(item.linkId, []);
  });

  Object.entries(formValues).forEach(([key, value]) => {
    const parentItem = qItems?.find((item) => containedItemWithLinkId(item, key));
    if (parentItem) {
      const pageItems = pageDict.get(parentItem.linkId);
      const qItem = containedItemWithLinkId(parentItem, key) as IntakeQuestionnaireItem;
      if (pageItems && qItem) {
        const answer = value != undefined ? makeQRResponseItem(value, qItem) : undefined;
        if (qItem.linkId === 'insurance-carrier') {
          console.log('patient-birthdate value, answer', value, answer);
        }
        if (answer) {
          pageItems.push(answer);
        } else {
          pageItems.push({ linkId: key });
        }
      }
    }
  });
  const qrItem: QuestionnaireResponseItem[] = Array.from(pageDict.entries())
    .map(([linkId, items]) => {
      const item: QuestionnaireResponseItem = {
        linkId,
        item: items,
      };
      return item;
    })
    .filter((i) => Boolean(i.item?.length));

  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    item: qrItem,
  };
};

export const ActionBar: FC<ActionBarProps> = ({ handleDiscard, questionnaire, patientId }) => {
  const theme = useTheme();

  const submitQR = useUpdatePatientAccount();

  const { patchOperations, tempInsurances } = usePatientStore();
  const {
    formState: { isDirty },
    getValues,
    trigger,
  } = useFormContext();

  const hasChanges = useMemo(() => {
    return (
      isDirty ||
      (patchOperations?.patient?.length ?? 0) > 0 ||
      Object.values(patchOperations?.coverages || {}).some((ops) => ops.length > 0) ||
      Object.values(patchOperations?.relatedPersons || {}).some((ops) => ops.length > 0) ||
      tempInsurances.length > 0
    );
  }, [isDirty, patchOperations, tempInsurances]);

  if (!isDirty) return null;

  const handleSave = async (): Promise<void> => {
    // Trigger validation for all fields
    const isValid = await trigger();
    if (!isValid) {
      enqueueSnackbar('Please fix all field validation errors and try again', { variant: 'error' });
      return;
    }

    if (!questionnaire) {
      enqueueSnackbar('Something went wrong. Please reload the page.', { variant: 'error' });
      return;
    }
    console.log('form vals', getValues());
    const qr = structureQuestionnaireResponse(questionnaire, getValues(), patientId);
    console.log('qr', qr);
    submitQR.mutate(qr);
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 999,
        display: 'flex',
        justifyContent: 'space-between',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(2, 6),
        borderTop: `1px solid ${theme.palette.divider}`,
        boxShadow: '0px -3px 3px -2px rgba(0, 0, 0, 0.2)',
      }}
    >
      <Button
        variant="outlined"
        color="primary"
        sx={{
          borderRadius: 25,
          textTransform: 'none',
          fontWeight: 'bold',
        }}
        onClick={handleDiscard}
      >
        Back
      </Button>
      <Button
        data-testid={dataTestIds.patientInformationPage.saveChangesButton}
        variant="contained"
        color="primary"
        disabled={!hasChanges}
        sx={{
          borderRadius: 25,
          textTransform: 'none',
          fontWeight: 'bold',
        }}
        onClick={handleSave}
      >
        Save changes
      </Button>
    </Box>
  );
};
