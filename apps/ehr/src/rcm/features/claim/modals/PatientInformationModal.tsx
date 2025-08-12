import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Grid, MenuItem } from '@mui/material';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AllStates } from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useEditPatientInformationMutation } from '../../../../telemed';
import { ClaimState, useClaimStore, useEditCoverageInformationMutation } from '../../../state';
import {
  genderOptions,
  mapFieldToRules,
  mapPatientInformationToCoverageResource,
  mapPatientInformationToPatientResource,
  PatientInformationModalFormValues,
  RELATIONSHIP_TO_INSURED,
} from '../../../utils';
import { DatePickerController, EditModal, NumberMaskCustom, TextFieldController } from './components';

const getDefaultValues = (
  patientData: ClaimState['patientData'],
  coverageData: ClaimState['coverageData']
): PatientInformationModalFormValues => ({
  firstName: patientData?.firstName || '',
  middleName: patientData?.middleName || '',
  lastName: patientData?.lastName || '',
  dob: patientData?.dob || null,
  sex: patientData?.gender || '',
  phone: patientData?.phone || '',
  address: patientData?.addressLine || '',
  city: patientData?.city || '',
  state: patientData?.state || '',
  zip: patientData?.postalCode || '',
  relationship: coverageData?.relationship || '',
});

export const PatientInformationModal: FC = () => {
  const { patientData, coverageData, patient, coverage, subscriber, setPatientData, setCoverageData } = getSelectors(
    useClaimStore,
    ['patientData', 'coverageData', 'patient', 'coverage', 'subscriber', 'setPatientData', 'setCoverageData']
  );

  const methods = useForm<PatientInformationModalFormValues>({
    defaultValues: getDefaultValues(patientData, coverageData),
  });
  const { handleSubmit, reset } = methods;

  const editPatient = useEditPatientInformationMutation();
  const editCoverage = useEditCoverageInformationMutation();

  const onSave = async (values: PatientInformationModalFormValues, hideDialog: () => void): Promise<void> => {
    if (!patient) {
      throw Error('Patient not provided');
    }
    if (!coverage) {
      throw Error('Coverage not provided');
    }

    const updatedPatient = mapPatientInformationToPatientResource(patient, values);
    const updatedCoverage = mapPatientInformationToCoverageResource(coverage, values);

    const editPatientPromise = editPatient.mutateAsync({
      updatedPatientData: updatedPatient,
      originalPatientData: patient,
      fieldsToUpdate: ['name', 'address', 'birthDate', 'gender', 'telecom'],
    });
    const editCoveragePromise = editCoverage.mutateAsync({
      coverageData: updatedCoverage,
      previousCoverageData: coverage,
    });

    Promise.all([editPatientPromise, editCoveragePromise])
      .then(() => {
        setPatientData(updatedPatient);
        setCoverageData(updatedCoverage, subscriber);
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
        title="Patient information"
        onSave={(hideDialog) => handleSubmit((values) => onSave(values, hideDialog))()}
        customDialogButton={(showDialog) => (
          <RoundedButton
            variant="text"
            onClick={() => {
              reset(getDefaultValues(patientData, coverageData));
              showDialog();
            }}
            startIcon={<EditOutlinedIcon />}
          >
            Edit on the Patient Master
          </RoundedButton>
        )}
        isSaveLoading={editPatient.isPending || editCoverage.isPending}
      >
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <TextFieldController name="firstName" rules={mapFieldToRules.firstName} label="2.First name *" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="middleName" label="2.Middle name" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="lastName" rules={mapFieldToRules.lastName} label="2.Last name *" />
          </Grid>

          <Grid item xs={4}>
            <DatePickerController
              name="dob"
              rules={mapFieldToRules.dob}
              label="3.Date of birth *"
              format="MM.dd.yyyy"
              placeholder="MM.DD.YYYY"
            />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="sex" rules={mapFieldToRules.sex} label="3.Birth sex *" select>
              {genderOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextFieldController>
          </Grid>
          <Grid item xs={4}>
            <TextFieldController
              name="phone"
              rules={mapFieldToRules.phone}
              label="5.Phone *"
              placeholder="(XXX) XXX-XXXX"
              InputProps={{ inputComponent: NumberMaskCustom as any }}
            />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController
              name="address"
              rules={mapFieldToRules.address}
              label="5.Address *"
              placeholder="No., Street"
            />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController name="city" rules={mapFieldToRules.city} label="5.City *" />
          </Grid>
          <Grid item xs={2}>
            <TextFieldController name="state" rules={mapFieldToRules.state} label="5.State *" select>
              {AllStates.map((state) => (
                <MenuItem key={state.value} value={state.value}>
                  {state.label}
                </MenuItem>
              ))}
            </TextFieldController>
          </Grid>
          <Grid item xs={2}>
            <TextFieldController name="zip" rules={mapFieldToRules.zip} label="5.ZIP *" />
          </Grid>
          <Grid item xs={4}>
            <TextFieldController
              name="relationship"
              rules={mapFieldToRules.relationship}
              label="6.Patient relation to insured *"
              select
            >
              {RELATIONSHIP_TO_INSURED.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextFieldController>
          </Grid>
        </Grid>
      </EditModal>
    </FormProvider>
  );
};
