import { Grid, TextField } from '@mui/material';
import { Location } from 'fhir/r4b';
import React, { FC, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FHIR_EXTENSION } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { ClaimState, useClaimStore, useEditClaimInformationMutation } from '../../../state';
import { mapSLBProviderToClaimResource, SLBProviderFormValues } from '../../../utils';
import { EditModal, VirtualizedAutocompleteController } from './components';

const getDefaultValues = (
  claimData: ClaimState['claimData'],
  facilities: ClaimState['facilities']
): SLBProviderFormValues => ({
  location: facilities?.find((facility) => facility.id === claimData?.facilityId),
});

export const SLBProviderModal: FC = () => {
  const { organizations, facilities, claimData, coverageData, claim, setClaimData } = getSelectors(useClaimStore, [
    'organizations',
    'facilities',
    'claimData',
    'coverageData',
    'claim',
    'setClaimData',
  ]);

  const editClaim = useEditClaimInformationMutation();

  const methods = useForm<SLBProviderFormValues>({
    defaultValues: getDefaultValues(claimData, facilities),
  });
  const { handleSubmit, watch, reset } = methods;

  // TS2589: Type instantiation is excessively deep and possibly infinite.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const currentFacility = watch('location') as Location | undefined;
  const organization = useMemo(
    () =>
      organizations?.find(
        (organization) => organization.id === currentFacility?.managingOrganization?.reference?.split('/')?.[1]
      ),
    [currentFacility?.managingOrganization?.reference, organizations]
  );

  const options = useMemo(
    () =>
      (facilities || []).filter(
        (facility) =>
          !!facility.extension?.find(
            (extension) =>
              extension.url === FHIR_EXTENSION.Location.locationFormPreRelease.url &&
              extension.valueCoding?.code === 'vi'
          ) && facility.managingOrganization
      ),
    [facilities]
  );

  const onSave = (values: SLBProviderFormValues, hideDialog: () => void): void => {
    if (!claim) {
      throw Error('Claim not provided');
    }

    const updatedClaim = mapSLBProviderToClaimResource(claim, values);

    const editClaimPromise = editClaim.mutateAsync({
      claimData: updatedClaim,
      previousClaimData: claim,
      fieldsToUpdate: ['facility', 'provider'],
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
        title="Additional Insurance"
        onSave={(hideDialog) => handleSubmit((values) => onSave(values, hideDialog))()}
        onShow={() => reset(getDefaultValues(claimData, facilities))}
        isSaveLoading={editClaim.isLoading}
      >
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              label="31.Signature of Physician or Supplier"
              fullWidth
              size="small"
              disabled
              value={
                organizations?.find((organization) => organization.id === coverageData?.organizationId)?.name || ''
              }
            />
          </Grid>

          <Grid item xs={6}>
            <VirtualizedAutocompleteController
              name="location"
              label="32.Service Facility Location"
              rules={{ required: true }}
              options={options}
              renderRow={(facility) => facility.name || ''}
            />
          </Grid>

          <Grid item xs={6}>
            <TextField label="33.Billing Provider" fullWidth size="small" disabled value={organization?.name || ''} />
          </Grid>
        </Grid>
      </EditModal>
    </FormProvider>
  );
};
