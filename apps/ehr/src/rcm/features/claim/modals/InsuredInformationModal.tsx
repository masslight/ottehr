import { Grid, MenuItem } from '@mui/material';
import { FC, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AllStates } from 'utils';
import { FHIR_EXTENSION } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import {
  ClaimState,
  useClaimStore,
  useEditCoverageInformationMutation,
  useEditRelatedPersonInformationMutation,
} from '../../../state';
import {
  genderOptions,
  InsuredInformationModalFormValues,
  mapFieldToRules,
  mapInsuredInformationToCoverageResource,
  mapInsuredInformationToRelatedPersonResource,
  PlanOwnedBy,
} from '../../../utils';
import {
  DatePickerController,
  EditModal,
  NumberMaskCustom,
  TextFieldController,
  VirtualizedAutocompleteController,
} from './components';

const getDefaultValues = (
  coverageData: ClaimState['coverageData'],
  plan?: PlanOwnedBy
): InsuredInformationModalFormValues => ({
  planAndPayor: plan,
  insuredID: coverageData?.subscriberId || '',
  firstName: coverageData?.firstName || '',
  middleName: coverageData?.middleName || '',
  lastName: coverageData?.lastName || '',
  phone: coverageData?.phone || '',
  address: coverageData?.addressLine || '',
  city: coverageData?.city || '',
  state: coverageData?.state || '',
  zip: coverageData?.postalCode || '',
  policyGroup: coverageData?.policyGroup || '',
  dob: coverageData?.dob || null,
  sex: coverageData?.gender || '',
});

export const InsuredInformationModal: FC = () => {
  const { coverageData, plansOwnedBy, coverage, subscriber, setCoverageData } = getSelectors(useClaimStore, [
    'coverageData',
    'plansOwnedBy',
    'coverage',
    'subscriber',
    'setCoverageData',
  ]);

  const plan = useMemo(() => {
    if (!plansOwnedBy || !coverageData?.organizationId || !coverageData?.planName) {
      return;
    }

    return plansOwnedBy?.find(
      (item) => item.ownedBy?.id === coverageData.organizationId && item.name === coverageData.planName
    );
  }, [plansOwnedBy, coverageData?.planName, coverageData?.organizationId]);

  const editCoverage = useEditCoverageInformationMutation();
  const editRelatedPerson = useEditRelatedPersonInformationMutation();

  const methods = useForm<InsuredInformationModalFormValues>({
    defaultValues: getDefaultValues(coverageData, plan),
  });
  const { handleSubmit, reset } = methods;

  const onSave = (values: InsuredInformationModalFormValues, hideDialog: () => void): void => {
    if (!coverage) {
      throw Error('Coverage not provided');
    }
    if (!subscriber) {
      throw Error('Subscriber not provided');
    }

    const updatedCoverage = mapInsuredInformationToCoverageResource(coverage, values);
    const updatedSubscriber = mapInsuredInformationToRelatedPersonResource(subscriber, values);

    const editCoveragePromise = editCoverage.mutateAsync({
      coverageData: updatedCoverage,
      previousCoverageData: coverage,
      fieldsToUpdate: ['class', 'payor', 'subscriberId'],
    });
    const editRelatedPersonPromise = editRelatedPerson.mutateAsync({
      relatedPersonData: updatedSubscriber,
      previousRelatedPersonData: subscriber,
    });

    Promise.all([editCoveragePromise, editRelatedPersonPromise])
      .then(() => {
        setCoverageData(updatedCoverage, updatedSubscriber);
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
        title="Insured Information"
        onSave={(hideDialog) => handleSubmit((values) => onSave(values, hideDialog))()}
        onShow={() => reset(getDefaultValues(coverageData, plan))}
        isSaveLoading={editCoverage.isPending || editRelatedPerson.isPending}
      >
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <VirtualizedAutocompleteController
              name="planAndPayor"
              label="Plan Name and Payer ID *"
              rules={mapFieldToRules.planAndPayor}
              options={plansOwnedBy || []}
              renderRow={(plan) => {
                const payerId = plan.ownedBy?.identifier?.find(
                  (identifier) =>
                    !!identifier.type?.coding?.find(
                      (coding) => coding.code === 'XX' && coding.system === FHIR_EXTENSION.Organization.v2_0203.url
                    )
                )?.value;

                return `${plan.name} ${payerId}`;
              }}
            />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="insuredID" rules={mapFieldToRules.insuredID} label="1a.Insured’s ID number *" />
          </Grid>
          <Grid item xs={4} />

          <Grid item xs={4}>
            <TextFieldController name="firstName" label="4.First name" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="middleName" label="4.Middle name" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="lastName" label="4.Last name" />
          </Grid>

          <Grid item xs={4}>
            <TextFieldController
              name="phone"
              label="7.Phone"
              placeholder="(XXX) XXX-XXXX"
              InputProps={{ inputComponent: NumberMaskCustom as any }}
            />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="address" label="7.Address" placeholder="No., Street" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="city" label="7.City" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="state" label="7.State" select>
              {AllStates.map((state) => (
                <MenuItem key={state.value} value={state.value}>
                  {state.label}
                </MenuItem>
              ))}
            </TextFieldController>
          </Grid>

          <Grid item xs={4}>
            <TextFieldController name="zip" label="7.ZIP" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="policyGroup" label="11.Insured’s policy group or FECA number" />
          </Grid>

          <Grid item xs={4}>
            <DatePickerController name="dob" label="11a.Date of birth" format="MM.dd.yyyy" placeholder="MM.DD.YYYY" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="sex" label="11a.Birth sex" select>
              {genderOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextFieldController>
          </Grid>
        </Grid>
      </EditModal>
    </FormProvider>
  );
};
