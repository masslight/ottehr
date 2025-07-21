import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { AllStates } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { ClaimState, useClaimStore, useEditClaimInformationMutation } from '../../../state';
import { AdditionalInformationFormValues, mapAdditionalInformationToClaimResource } from '../../../utils';
import {
  CheckboxController,
  DatePickerController,
  DateRangePickerController,
  EditModal,
  TextFieldController,
} from './components';

const getDefaultValues = (claimData: ClaimState['claimData']): AdditionalInformationFormValues => ({
  relatedToEmployment: !!claimData?.conditionRelatedToEmployment,
  relatedToAutoAccident: claimData?.autoAccidentState || '',
  relatedToOtherAccident: !!claimData?.conditionRelatedToOtherAccident,
  claimCodes: [claimData?.claimCode1, claimData?.claimCode2, claimData?.claimCode3].filter((c) => c).join('   '),
  illness: claimData?.dateOfIllness || null,
  unableToWork: [claimData?.unableToWork.start || null, claimData?.unableToWork.end || null],
  hospitalization: [claimData?.hospitalizationDates.start || null, claimData?.hospitalizationDates.end || null],
  resubmissionCode: claimData?.resubmissionCode || '',
  authorizationNumber: claimData?.priorAuthNumber || '',
});

export const AdditionalInformationModal: FC = () => {
  const { claimData, claim, setClaimData } = getSelectors(useClaimStore, ['claimData', 'claim', 'setClaimData']);

  const editClaim = useEditClaimInformationMutation();

  const methods = useForm<AdditionalInformationFormValues>({
    defaultValues: getDefaultValues(claimData),
  });
  const { control, handleSubmit, reset } = methods;

  const onSave = (values: AdditionalInformationFormValues, hideDialog: () => void): void => {
    if (!claim) {
      throw Error('Claim not provided');
    }

    const updatedClaim = mapAdditionalInformationToClaimResource(claim, values);

    const editClaimPromise = editClaim.mutateAsync({
      claimData: updatedClaim,
      previousClaimData: claim,
    });

    Promise.resolve(editClaimPromise)
      .then((responseClaim) => {
        setClaimData(responseClaim);
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        hideDialog();
      });
  };

  return (
    <FormProvider {...methods}>
      <EditModal
        title="Additional Information"
        onSave={(hideDialog) => handleSubmit((values) => onSave(values, hideDialog))()}
        isSaveLoading={editClaim.isPending}
        onShow={() => reset(getDefaultValues(claimData))}
      >
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <FormControl fullWidth>
              <FormLabel sx={{ fontSize: '12px' }}>10.Is patient condition related to:</FormLabel>
              <FormGroup>
                <CheckboxController name="relatedToEmployment" label="a. Employment (Current or Previous)" />
                <Controller
                  name="relatedToAutoAccident"
                  control={control}
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <Box sx={{ display: 'flex', flex: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!value}
                            onChange={(e) => (e.target.checked ? onChange(AllStates[0].value) : onChange(''))}
                          />
                        }
                        label={<Typography noWrap>b. Auto accident</Typography>}
                      />
                      <TextField
                        helperText={error ? error.message : null}
                        error={!!error}
                        size="small"
                        label="State *"
                        value={value}
                        onChange={onChange}
                        fullWidth
                        select
                      >
                        {AllStates.map((state) => (
                          <MenuItem key={state.value} value={state.value}>
                            {state.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  )}
                />
                <CheckboxController name="relatedToOtherAccident" label="c. Other accident" />
              </FormGroup>
            </FormControl>
          </Grid>
          <Grid item xs={8} />

          <Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <TextFieldController name="claimCodes" label="10d.Claim codes (Designated to NUCC) *" />
          </Grid>
          <Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <DatePickerController
              name="illness"
              label="14.Date of current illness, injury, or pregnancy (LMP)"
              format="MM.dd.yyyy"
              placeholder="MM.DD.YYYY"
            />
          </Grid>
          <Grid item xs={4}>
            <DateRangePickerController
              name="unableToWork"
              label="16.Dates patient is unable to work in current occupation"
            />
          </Grid>

          <Grid item xs={4}>
            <DateRangePickerController
              name="hospitalization"
              label="18.Hospitalization dates related to current services"
            />
          </Grid>
          <Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <TextFieldController name="resubmissionCode" label="22.Resubmission code" select>
              {['1', '7', '8'].map((code) => (
                <MenuItem key={code} value={code}>
                  {code}
                </MenuItem>
              ))}
            </TextFieldController>
          </Grid>
          <Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <TextFieldController name="authorizationNumber" label="23.Prior authorization number" />
          </Grid>
        </Grid>
      </EditModal>
    </FormProvider>
  );
};
