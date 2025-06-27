import { IconButton, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { IntakeQuestionnaireItem } from 'utils';
import { dataTestIds } from '../../../../helpers/data-test-ids';
import { deleteIcon } from '../../../../themes/ottehr';
import { getPaperworkFieldId, useFormValues } from '../../useFormHelpers';

interface MultiAnswerHeader {
  item: IntakeQuestionnaireItem;
  parentItem?: IntakeQuestionnaireItem;
}
interface SelectedItem {
  linkId: string;
  valueString: string;
  parentIndex: number;
  index: number;
  category?: string;
}

const MultiAnswerHeader: FC<MultiAnswerHeader> = ({ item, parentItem }) => {
  const title = item.text;

  const formValues = useFormValues();
  const fieldId = getPaperworkFieldId({ item, parentItem });
  const { setValue } = useFormContext();

  const listValue: SelectedItem[] = useMemo(() => {
    const thisItemValues = formValues?.[item.linkId]?.item ?? [];
    const combinedValues: SelectedItem[] = thisItemValues.flatMap((nestedItem: any, groupIndex: number) => {
      const ignore = item.item?.find((child) => child.linkId === nestedItem.linkId)?.alwaysFilter ?? false;
      if (nestedItem.answer && !ignore) {
        const categoryItem = item.item?.find((child) => child.linkId === nestedItem.linkId);
        const category = categoryItem?.categoryTag;
        return nestedItem.answer
          .map((i: { valueString: string }, index: number) => {
            return {
              linkId: item.linkId,
              valueString: i?.valueString,
              parentIndex: groupIndex,
              index,
              category,
            };
          })
          .filter((i: any) => i?.valueString !== undefined);
      }
    });
    return combinedValues.filter((ci) => ci?.valueString !== undefined);
  }, [formValues, item.item, item.linkId]);

  const removeItem = (deletedIndex: number): void => {
    const item = listValue[deletedIndex];
    if (!item) {
      return;
    }
    const thisItemValues = formValues?.[item.linkId]?.item ?? [];
    const { parentIndex, index } = item;
    const targetItem = thisItemValues[parentIndex];
    if (!targetItem?.answer || !Array.isArray(targetItem.answer)) {
      return;
    }
    const newAnswer = targetItem?.answer.filter((_: any, idx: number) => idx !== index);
    setValue(`${fieldId}.item.${parentIndex}.answer`, newAnswer);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
      {title && <Typography variant="h5" color="primary.dark">{`${title}`}</Typography>}
      {listValue.map((item: SelectedItem, index: number) => (
        <Box
          key={JSON.stringify({ item, index })}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography data-testid={dataTestIds.itemAddedValue}>{`${item?.valueString}${
            item.category ? ' | ' + item.category : ''
          }`}</Typography>
          <IconButton
            onClick={() => {
              removeItem(index);
            }}
          >
            <img alt="delete icon" src={deleteIcon} width={18} data-testid={dataTestIds.deletedButton} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
};

export default MultiAnswerHeader;
