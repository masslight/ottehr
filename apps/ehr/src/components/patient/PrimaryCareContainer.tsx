import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { patientFieldPaths, PRACTICE_NAME_URL, standardizePhoneNumber } from 'utils';
import { usePatientStore } from '../../state/patient.store';
import { Row, Section } from '../layout';
import { FormTextField } from '../form';
export const PrimaryCareContainer: FC = () => {
  const { control, watch } = useFormContext();
  const { patient, updatePatientField } = usePatientStore();
  if (!patient) return null;

  const pcp = patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;
  const practiceName = pcp?.extension?.find((e: { url: string }) => e.url === PRACTICE_NAME_URL)?.valueString;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = event.target;
    updatePatientField(name, type === 'checkbox' ? checked : value);
  };

  return (
    <Section title="Primary Care Physician">
      <Controller
        name={patientFieldPaths.pcpActive}
        control={control}
        defaultValue={pcp?.active ?? false}
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
                      name: patientFieldPaths.pcpActive,
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
          <Row label="First name" inputId="pcp-first-name" required>
            <FormTextField
              name={patientFieldPaths.pcpFirstName}
              control={control}
              defaultValue={pcp?.name?.[0]?.given?.[0]}
              rules={{ required: true }}
              id="pcp-first-name"
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Last name" inputId="pcp-last-name" required>
            <FormTextField
              name={patientFieldPaths.pcpLastName}
              control={control}
              defaultValue={pcp?.name?.[0]?.family}
              rules={{ required: true }}
              id="pcp-last-name"
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Practice name" inputId="practice-name" required>
            <FormTextField
              name={patientFieldPaths.practiceName}
              control={control}
              defaultValue={practiceName}
              rules={{ required: true }}
              id="practice-name"
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Address" inputId="pcp-street-address" required>
            <FormTextField
              name={patientFieldPaths.pcpStreetAddress}
              control={control}
              defaultValue={pcp?.address?.[0]?.line?.[0]}
              rules={{ required: true }}
              id="pcp-street-address"
              onChangeHandler={handleChange}
            />
          </Row>
          <Row label="Mobile" inputId="pcp-mobile" required>
            <FormTextField
              name={patientFieldPaths.pcpPhone}
              control={control}
              defaultValue={standardizePhoneNumber(pcp?.telecom?.[0]?.value)}
              rules={{ required: true }}
              id="pcp-mobile"
              onChangeHandler={handleChange}
            />
          </Row>
        </>
      )}
    </Section>
  );
};
