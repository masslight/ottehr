import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { patientFieldPaths, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { Row, Section } from '../layout';
import { FormTextField } from '../form';

const FormFields = {
  firstName: { key: 'pcp-first-name', type: 'String' },
  lastName: { key: 'pcp-last-name', type: 'String' },
  practiceName: { key: 'pcp-practice', type: 'String' },
  address: { key: 'pcp-address', type: 'String' },
  phone: { key: 'pcp-number', type: 'String' },
  active: { key: 'pcp-active', type: 'Boolean' },
};

export const PrimaryCareContainer: FC = () => {
  const { control, watch } = useFormContext();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = event.target;
    console.log('event', name, value, type, checked);
    //updatePatientField(name, type === 'checkbox' ? checked : value);
  };

  return (
    <Section title="Primary Care Physician">
      <Controller
        name={FormFields.active.key}
        control={control}
        render={({ field: { onChange, value, ...field } }) => (
          <FormControlLabel
            control={
              <Checkbox
                {...field}
                checked={!value}
                onChange={(e) => {
                  const newActiveValue = !e.target.checked;
                  onChange(newActiveValue);
                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      type: e.target.type,
                      name: FormFields.active.key,
                      checked: newActiveValue,
                    },
                  });
                }}
              />
            }
            label={<Typography>Patient doesn't have a PCP at this time</Typography>}
          />
        )}
      />
      {watch(patientFieldPaths.pcpActive) && (
        <>
          <Row label="First name" inputId={FormFields.firstName.key} required>
            <FormTextField
              name={FormFields.firstName.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              id={FormFields.firstName.key}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Last name" inputId={FormFields.lastName.key} required>
            <FormTextField
              name={FormFields.lastName.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              id={FormFields.lastName.key}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Practice name" inputId={FormFields.practiceName.key} required>
            <FormTextField
              name={FormFields.practiceName.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              id={FormFields.practiceName.key}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Address" inputId={FormFields.address.key} required>
            <FormTextField
              name={FormFields.address.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              id={FormFields.address.key}
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Mobile" inputId={FormFields.phone.key} required>
            <FormTextField
              name={FormFields.phone.key}
              control={control}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              id={FormFields.phone.key}
              onChangeHandler={handleChange}
            />
          </Row>
        </>
      )}
    </Section>
  );
};
