import { Box, Card, Grid, IconButton, Typography, useTheme } from '@mui/material';
import { deleteIcon } from '@theme/icons';
import { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Controller, FieldValues, useFormContext } from 'react-hook-form';
import { getFormInputField } from '../../helpers/form';
import { FormInputTypeField } from '../../types';
import PageForm from '../PageForm';

const FormListInner: FC<{
  formInput: FormInputTypeField;
  values: FieldValues;
  onChange: (value: any) => void;
}> = (props) => {
  const { formInput, values, onChange } = props;

  const [innerForm, setInnerForm] = useState<HTMLElement | null>();
  const theme = useTheme();
  const methods = useFormContext();

  useEffect(() => {
    setInnerForm(document.getElementById('page-form-inner-form'));
  }, []);

  const onAdd = (data: FieldValues): void => {
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([key]) => !key.endsWith('-form-header') && !key.endsWith('-form-button'))
    );
    const values = methods.watch()[formInput.name];
    const toUpdate = values ? [...values, filtered] : [filtered];

    onChange(toUpdate);
  };

  const onRemove = (index: number): void => {
    const values = methods.watch()[formInput.name];
    values.splice(index, 1);

    onChange(values);
  };

  const fieldValue = methods.watch()[formInput.name];

  const error = methods.formState.errors[formInput.name]?.message;

  return (
    <Grid>
      {getFormInputField(
        {
          type: 'Header 3',
          label: formInput.label,
          name: `${formInput.name}`,
        },
        values,
        methods
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
        {fieldValue &&
          fieldValue.map((item: FieldValues, index: number) => (
            <Box
              key={JSON.stringify({ ...item, index })}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography>{Object.values(item).join(' | ')}</Typography>
              <IconButton onClick={() => onRemove(index)}>
                <img alt="delete icon" src={deleteIcon} width={18} />
              </IconButton>
            </Box>
          ))}
      </Box>

      <>
        {innerForm &&
          createPortal(
            <Card
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                backgroundColor: '#F7F8F9',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <PageForm formElements={formInput.item} onSubmit={onAdd} hideControls innerForm />
              {error && typeof error === 'string' && <Typography color={theme.palette.error.main}>{error}</Typography>}
            </Card>,
            innerForm
          )}
      </>
    </Grid>
  );
};

export const FormList: FC<{ formInput: FormInputTypeField }> = (props) => {
  const { formInput } = props;

  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={formInput.name}
      defaultValue={formInput.defaultValue}
      render={({ field: { value, onChange } }) => (
        <FormListInner formInput={formInput} values={value} onChange={onChange} />
      )}
    />
  );
};
