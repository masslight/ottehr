import { otherColors } from '@ehrTheme/colors';
import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Card,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { FC } from 'react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { RoundedButton } from '../../../../components/RoundedButton';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { DeleteIconButton } from '../../../../telemed';
import { ClaimState, useClaimStore, useEditClaimInformationMutation } from '../../../state';
import { BillingFormValues, mapBillingToClaimResource } from '../../../utils';
import { CheckboxController, DateRangePickerController, EditModal, TextFieldController } from './components';
const getDefaultValues = (claimData: ClaimState['claimData']): BillingFormValues => ({
  items: claimData?.billingItems || [],
  payment: claimData?.patientPaid || NaN,
});

export const BillingModal: FC = () => {
  const { organizations, facilities, claimData, coverageData, claim, setClaimData } = getSelectors(useClaimStore, [
    'organizations',
    'facilities',
    'claimData',
    'coverageData',
    'claim',
    'setClaimData',
  ]);

  const editClaim = useEditClaimInformationMutation();

  const methods = useForm<BillingFormValues>({
    defaultValues: getDefaultValues(claimData),
  });
  const { control, handleSubmit, watch, reset } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const onSave = (values: BillingFormValues, hideDialog: () => void): void => {
    if (!claim) {
      throw Error('Claim not provided');
    }

    const updatedClaim = mapBillingToClaimResource(claim, values);

    const editClaimPromise = editClaim.mutateAsync({
      claimData: updatedClaim,
      previousClaimData: claim,
      fieldsToUpdate: ['item', 'extension', 'total'],
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

  // TS2589: Type instantiation is excessively deep and possibly infinite.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const currentItems = watch('items') as BillingFormValues['items'];

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const provider = organizations?.find((organization) => organization.id === coverageData?.organizationId)?.name || '';
  const facility = facilities?.find((facility) => facility.id === claimData?.facilityId)?.name || '';

  return (
    <FormProvider {...methods}>
      <EditModal
        maxWidth="xl"
        title="24. Billing"
        onShow={() => reset(getDefaultValues(claimData))}
        onSave={(hideDialog) => handleSubmit((values) => onSave(values, hideDialog))()}
        isSaveLoading={editClaim.isPending}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {fields.length > 0 && (
            <Table>
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                  <TableCell>A. Date</TableCell>
                  <TableCell>B. Place</TableCell>
                  {/* cSpell:disable-next Emerg.(ency) */}
                  <TableCell>C. Emerg.</TableCell>
                  <TableCell>D. Code & Modifiers</TableCell>
                  {/* cSpell:disable-next Diagn.(ostic) */}
                  <TableCell>E. Diagn. pointers</TableCell>
                  <TableCell>F. Charges, $</TableCell>
                  <TableCell>G. Units / Days</TableCell>
                  <TableCell>H. EPSDT</TableCell>
                  <TableCell>J. Rendering Provider NPI</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <DateRangePickerController
                        name={`items.${index}.date`}
                        separator="-"
                        variant="standard"
                        sx={{ display: 'block' }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField variant="standard" size="small" value={facility} disabled />
                    </TableCell>
                    <TableCell>
                      <CheckboxController name={`items.${index}.emergency`} />
                    </TableCell>
                    <TableCell>
                      <TextFieldController name={`items.${index}.code`} variant="standard" rules={{ required: true }} />
                      <TextFieldController name={`items.${index}.modifiers`} variant="standard" />
                    </TableCell>
                    <TableCell>
                      {/*<CheckboxController name={`items.${index}.pointerA`} label="A" />*/}
                      {/*<CheckboxController name={`items.${index}.pointerB`} label="B" />*/}
                    </TableCell>
                    <TableCell>
                      <TextFieldController name={`items.${index}.charges`} variant="standard" type="number" />
                    </TableCell>
                    <TableCell>
                      <TextFieldController name={`items.${index}.units`} variant="standard" type="number" />
                    </TableCell>
                    <TableCell>{/*<CheckboxController name={`items.${index}.epsdt`} />*/}</TableCell>
                    <TableCell>
                      <TextField variant="standard" size="small" value={provider} disabled />
                    </TableCell>
                    <TableCell>
                      <DeleteIconButton fontSize="medium" onClick={() => remove(index)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <RoundedButton
            startIcon={<AddIcon />}
            variant="text"
            onClick={() =>
              append({
                date: [DateTime.now(), DateTime.now()],
                // place: '',
                emergency: false,
                code: '',
                modifiers: '',
                // pointerA: false,
                // pointerB: false,
                charges: 0,
                units: 0,
                // epsdt: false,
                // provider: '',
              })
            }
          >
            Add billing item
          </RoundedButton>

          <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: '500px', gap: 3 }}>
            <Card
              elevation={0}
              sx={{
                backgroundColor: otherColors.lightIconButton,
                px: 2,
                py: '10px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="h5" color="primary.dark">
                28. Total charge:
              </Typography>
              <Typography variant="h5" color="primary.main">
                {currencyFormatter.format(
                  currentItems.reduce((prev, curr) => {
                    prev += +curr.charges;
                    return prev;
                  }, 0)
                )}
              </Typography>
            </Card>

            <Controller
              name="payment"
              control={control}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Box sx={{ display: 'flex', flex: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!isNaN(value)}
                        onChange={(e) => (e.target.checked ? onChange(0) : onChange(NaN))}
                      />
                    }
                    label={<Typography noWrap>29.Patient Payment</Typography>}
                  />
                  <TextField
                    helperText={error ? error.message : null}
                    error={!!error}
                    size="small"
                    label="Paid, $"
                    type="number"
                    value={isNaN(value) ? '' : value}
                    disabled={isNaN(value)}
                    onChange={onChange}
                    fullWidth
                  />
                </Box>
              )}
            />
          </Box>
        </Box>
      </EditModal>
    </FormProvider>
  );
};
