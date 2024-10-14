import { useCallback } from 'react';
import { useTheme } from '@mui/material';
import { FormInputType, StringFormat } from 'ottehr-components';
import { Question } from 'ottehr-utils';
import { otherColors } from '../IntakeThemeProvider';

export const useMapQuestionsToFormInputFields = ({
  getLabel,
  getDefaultValue,
  getFileOptions,
}: {
  getLabel: (item: Question) => string;
  getDefaultValue?: (item: Question) => any;
  getFileOptions?: (item: Question) => any;
}): ((items: Question[]) => FormInputType[]) => {
  const theme = useTheme();

  const mapQuestionsToFormInputFields = useCallback(
    (items: Question[]): FormInputType[] =>
      items
        .filter((item, index: number) => !(item.type === 'Description' && index === 0))
        .map((item) => ({
          type: item.type,
          name: item.id,
          item: item.item && mapQuestionsToFormInputFields(item.item),
          // todo don't hardcode specific item
          label: getLabel(item),
          defaultValue: getDefaultValue && getDefaultValue(item),
          required: item.required,
          enableWhen: item.enableWhen,
          requireWhen: item.requireWhen,
          width: item.width,
          placeholder: item.placeholder,
          helperText: item.helperText,
          showHelperTextIcon: item.showHelperTextIcon,
          fileOptions: getFileOptions && getFileOptions(item),
          fileUploadType: item.fileUploadType,
          multiline: item.multiline,
          minRows: item.minRows,
          infoText: item.infoText,
          selectOptions: item.options,
          radioOptions: item.options,
          freeSelectOptions: item.options,
          format: item.format as StringFormat,
          borderColor: otherColors.borderGray,
          backgroundSelected: otherColors.lightBlue,
          submitOnChange: item.submitOnChange,
          disableError: item.disableError,
          radioStyling: {
            radio: {
              alignSelf: 'center',
              marginY: 'auto',
            },
            label: {
              ...theme.typography.body2,
              color: theme.palette.text.primary,
            },
          },
        })),
    [getLabel, getDefaultValue, getFileOptions, theme.palette.text.primary, theme.typography.body2],
  );

  return mapQuestionsToFormInputFields;
};
