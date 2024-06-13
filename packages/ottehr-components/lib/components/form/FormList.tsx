import React, { useEffect, useState } from 'react';
import { FormInputTypeField } from '../../types';
import { FieldValues } from 'react-hook-form';
import { Box, Card, Grid, IconButton, Typography, useTheme } from '@mui/material';
import { deleteIcon } from '../../assets';
import { createPortal } from 'react-dom';
import PageForm from '../PageForm';
import { getFormInputField } from '../../helpers';

export const FormList: React.FC<{ formInput: FormInputTypeField; values: FieldValues; methods: any }> = (props) => {
  const { formInput, values, methods } = props;

  const [innerForm, setInnerForm] = useState<HTMLElement | null>();
  const theme = useTheme();

  useEffect(() => {
    setInnerForm(document.getElementById('page-form-inner-form'));
    methods.setValue(formInput.name, formInput.defaultValue);
  }, [methods, formInput.name, formInput.defaultValue]);

  const onAdd = (data: FieldValues): void => {
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([key]) => !key.endsWith('-form-header') && !key.endsWith('-form-button')),
    );
    const values = methods.watch()[formInput.name];
    methods.setValue(formInput.name, values ? [...values, filtered] : [filtered]);
  };

  const onRemove = (index: number): void => {
    const values = methods.watch()[formInput.name];
    values.splice(index, 1);
    methods.setValue(formInput.name, values);
  };

  const fieldValue = methods.watch()[formInput.name];

  const error = methods?.formState.errors[formInput.name];

  return (
    <Grid>
      {getFormInputField(
        {
          type: 'Header 3',
          label: formInput.label,
          name: `${formInput.name}`,
        },
        values,
        methods,
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
              {error && <Typography color={theme.palette.error.main}>{error.message}</Typography>}
            </Card>,
            innerForm,
          )}
      </>
    </Grid>
  );
};
