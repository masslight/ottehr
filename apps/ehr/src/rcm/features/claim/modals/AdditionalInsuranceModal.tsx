import { Grid } from '@mui/material';
import React, { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getSelectors } from '../../../../shared/store/getSelectors';
import {
  ClaimState,
  useClaimStore,
  useEditCoverageInformationMutation,
  useEditRelatedPersonInformationMutation,
} from '../../../state';
import {
  AdditionalInsuranceFormValues,
  mapAdditionalInsuranceToCoverageResource,
  mapAdditionalInsuranceToRelatedPersonResource,
} from '../../../utils';
import { EditModal, TextFieldController } from './components';

const getDefaultValues = (
  additionalCoverageData: ClaimState['additionalCoverageData']
): AdditionalInsuranceFormValues => ({
  firstName: additionalCoverageData?.firstName || '',
  middleName: additionalCoverageData?.middleName || '',
  lastName: additionalCoverageData?.lastName || '',
  policyGroup: additionalCoverageData?.policyGroup || '',
});

export const AdditionalInsuranceModal: FC = () => {
  const { additionalCoverageData, additionalCoverage, additionalSubscriber, setAdditionalCoverageData } = getSelectors(
    useClaimStore,
    ['additionalCoverageData', 'additionalCoverage', 'additionalSubscriber', 'setAdditionalCoverageData']
  );

  const methods = useForm<AdditionalInsuranceFormValues>({
    defaultValues: getDefaultValues(additionalCoverageData),
  });
  const { handleSubmit, reset } = methods;

  const editCoverage = useEditCoverageInformationMutation();
  const editRelatedPerson = useEditRelatedPersonInformationMutation();

  const onSave = (values: AdditionalInsuranceFormValues, hideDialog: () => void): void => {
    if (!additionalCoverage) {
      throw Error('Coverage not provided');
    }
    if (!additionalSubscriber) {
      throw Error('Subscriber not provided');
    }

    const updatedCoverage = mapAdditionalInsuranceToCoverageResource(additionalCoverage, values);
    const updatedSubscriber = mapAdditionalInsuranceToRelatedPersonResource(additionalSubscriber, values);

    const editCoveragePromise = editCoverage.mutateAsync({
      coverageData: updatedCoverage,
      previousCoverageData: additionalCoverage,
      fieldsToUpdate: ['class'],
    });
    const editRelatedPersonPromise = editRelatedPerson.mutateAsync({
      relatedPersonData: updatedSubscriber,
      previousRelatedPersonData: additionalSubscriber,
      fieldsToUpdate: ['name'],
    });

    Promise.all([editCoveragePromise, editRelatedPersonPromise])
      .then(() => {
        setAdditionalCoverageData(updatedCoverage, updatedSubscriber);
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
        onShow={() => reset(getDefaultValues(additionalCoverageData))}
        isSaveLoading={editCoverage.isPending || editRelatedPerson.isPending}
      >
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <TextFieldController name="firstName" label="9.Other insured’s first name" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="middleName" label="9.Other insured’s middle name" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="lastName" label="9.Other insured’s last name" />
          </Grid>

          <Grid item xs={4}>
            <TextFieldController name="policyGroup" label="9a.Other insured’s policy or group number" />
          </Grid>
        </Grid>
      </EditModal>
    </FormProvider>
  );
};
