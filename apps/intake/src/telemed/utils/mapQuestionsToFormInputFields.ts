import { useCallback } from 'react';
import { useTheme } from '@mui/material';
import { FormInputType, StringFormat } from 'ui-components';
import { OptionConfig, Question } from 'utils';
import { otherColors } from '../../IntakeThemeProvider';

export const useMapQuestionsToFormInputFields = ({
  getLabel,
  getDefaultValue,
  getFileOptions,
  getSelectOptions,
}: {
  getLabel: (item: Question) => string;
  getDefaultValue?: (item: Question) => any;
  getFileOptions?: (item: Question) => any;
  getSelectOptions?: (item: Question) => OptionConfig[] | undefined;
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
          disableWhen: item.disableWhen,
          width: item.width,
          placeholder: item.placeholder,
          autoComplete: item.autoComplete,
          helperText: item.helperText,
          showHelperTextIcon: item.showHelperTextIcon,
          fileOptions: getFileOptions && getFileOptions(item),
          fileUploadType: item.fileUploadType,
          multiline: item.multiline,
          minRows: item.minRows,
          infoText: item.infoText,
          infoTextSecondary: item.infoTextSecondary,
          selectOptions: getSelectOptions ? getSelectOptions(item) : item.options,
          radioOptions: item.options,
          freeSelectOptions: getSelectOptions ? getSelectOptions(item) : item.options,
          freeSelectMultiple: item.freeSelectMultiple,
          submitOnChange: item.submitOnChange,
          disableError: item.disableError,
          freeSelectFreeSolo: item.freeSelectFreeSolo,
          virtualization: item.virtualization,
          format: item.format as StringFormat,
          borderColor: otherColors.borderGray,
          backgroundSelected: otherColors.lightBlue,
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
    [getLabel, getDefaultValue, getFileOptions, getSelectOptions, theme.typography.body2, theme.palette.text.primary]
  );

  return mapQuestionsToFormInputFields;
};
