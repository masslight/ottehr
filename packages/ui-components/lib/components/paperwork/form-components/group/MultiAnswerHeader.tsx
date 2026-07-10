import { IconButton, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { IntakeQuestionnaireItem } from 'utils';
import { dataTestIds } from '../../data-test-ids';
// import { deleteIcon } from '../../../../themes/ottehr';
import { getPaperworkFieldId, useFormValues } from '../../hooks/useFormHelpers';

// todo should move the svg from intake (one other thing over there is using it)
const DELETE_ICON_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<mask id="mask0_19639_38610" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="18" height="18">' +
      '<rect width="18" height="18" fill="#D9D9D9"/></mask>' +
      '<g mask="url(#mask0_19639_38610)">' +
      '<path d="M5.25 15.75C4.8375 15.75 4.48438 15.6031 4.19062 15.3094C3.89687 15.0156 3.75 14.6625 3.75 14.25V4.5H3V3H6.75V2.25H11.25V3H15V4.5H14.25V14.25C14.25 14.6625 14.1031 15.0156 13.8094 15.3094C13.5156 15.6031 13.1625 15.75 12.75 15.75H5.25ZM12.75 4.5H5.25V14.25H12.75V4.5ZM6.75 12.75H8.25V6H6.75V12.75ZM9.75 12.75H11.25V6H9.75V12.75Z" fill="#EB5757"/>' +
      '</g></svg>'
  );

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
            <img alt="delete icon" src={DELETE_ICON_SRC} width={18} data-testid={dataTestIds.deletedButton} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
};

export default MultiAnswerHeader;
