import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import { AoeExtension } from '../pages/OrderDetails';

interface DateQuestionProps {
  questionText: string;
  linkId: string;
  extension: AoeExtension[];
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEDateQuestion: React.FC<DateQuestionProps> = (props) => {
  const {
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, extension: _, required, field } = props;

  return (
    <>
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <DatePicker
          {...field}
          label={questionText}
          format={'MM/dd/yyyy'}
          slotProps={{
            textField: {
              style: { width: '100%' },
              required: required,
              id: `date-${linkId}`,
              error: !!errors[linkId],
            },
            actionBar: { actions: ['today'] },
          }}
          disabled={false}
        />
      </LocalizationProvider>
    </>
  );
};
