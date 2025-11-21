import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Extension } from 'fhir/r4b';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface DateQuestionProps {
  questionText: string;
  linkId: string;
  extension: Extension[];
  required: boolean;
  isReadOnly?: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEDateQuestion: React.FC<DateQuestionProps> = (props) => {
  const {
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, extension: _, required, isReadOnly, field } = props;

  return (
    <>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          {...field}
          label={questionText}
          value={field.value ? dayjs(field.value) : null}
          slotProps={{
            textField: {
              style: { width: '100%' },
              required: required,
              id: `date-${linkId}`,
              error: !!errors[linkId],
            },
            actionBar: { actions: ['today'] },
          }}
          onChange={(date) => {
            if (date) {
              const dateStr = date ? date.format('YYYY-MM-DD') : '';
              field.onChange(dateStr);
            } else {
              field.onChange(null);
            }
          }}
          readOnly={isReadOnly}
        />
      </LocalizationProvider>
    </>
  );
};
