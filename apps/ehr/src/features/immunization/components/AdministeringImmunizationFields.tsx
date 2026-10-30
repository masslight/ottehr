import { Box, Grid } from '@mui/material';
import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { CptCodesInput } from 'src/components/input/CptCodesInput';
import { DateInput } from 'src/components/input/DateInput';
import { TextInput } from 'src/components/input/TextInput';
import { TimeInput } from 'src/components/input/TimeInput';
import { dataTestIds } from 'src/constants/data-test-ids';

interface Props {
  validate?: (value: string | undefined) => boolean | string;
  isReadOnly?: boolean;
}

export const AdministeringImmunizationFields: React.FC<Props> = ({ validate, isReadOnly }) => {
  return (
    <>
      <Grid xs={3} item>
        <TextInput
          name="administrationDetails.lot"
          label="LOT number"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.lotNumber}
        />
      </Grid>
      <Grid xs={3} item>
        <TextInput
          name="administrationDetails.ndc"
          label="NDC code"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.ndcCode}
        />
      </Grid>
      <Grid xs={3} item>
        <DateInput
          name="administrationDetails.expDate"
          label="Exp. Date"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.expiredDate}
        />
      </Grid>
      <Grid xs={3} item>
        <TextInput
          name="administrationDetails.mvx"
          label="MVX code"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.mvxCode}
        />
      </Grid>
      <Grid xs={3} item>
        <TextInput
          name="administrationDetails.cvx"
          label="CVX code"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.cvxCode}
        />
      </Grid>
      <Grid xs={6} item>
        <ImmunizationCptCodesField isReadOnly={isReadOnly} dataTestId={dataTestIds.vaccineDetailsPage.cptCode} />
      </Grid>
      <Grid xs={3} item>
        <DateInput
          name="administrationDetails.administeredDateTime"
          label="Administered date"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.administeredDate}
        />
      </Grid>
      <Grid xs={3} item>
        <TimeInput
          name="administrationDetails.administeredDateTime"
          label="Administered time"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.administeredTime}
        />
      </Grid>
      <Grid xs={6} item>
        <Box
          style={{
            background: '#2169F514',
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <CheckboxInput
            name="administrationDetails.visGiven"
            label="VIS was given to the patient"
            validate={validate}
            dataTestId={dataTestIds.vaccineDetailsPage.visCheckbox}
          />
        </Box>
      </Grid>
      <Grid xs={6} item>
        <DateInput
          name="administrationDetails.visGivenDate"
          label="VIS given date"
          validate={validate}
          dataTestId={dataTestIds.vaccineDetailsPage.visGivenDate}
        />
      </Grid>
    </>
  );
};

// Wrapper to make cptCodes reactive via useWatch
const ImmunizationCptCodesField: React.FC<{
  isReadOnly?: boolean;
  dataTestId?: string;
}> = ({ isReadOnly, dataTestId }) => {
  const { control, setValue } = useFormContext();
  const cptCodes = useWatch({ control, name: 'administrationDetails.cptCodes' }) ?? [];
  return (
    <CptCodesInput
      cptCodes={cptCodes}
      onChange={(codes) => setValue('administrationDetails.cptCodes', codes, { shouldDirty: true })}
      isEditable={!isReadOnly}
      dataTestId={dataTestId}
    />
  );
};
