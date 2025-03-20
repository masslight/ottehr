import { Box, Button, Typography, useTheme } from '@mui/material';
import { BundleEntry, Coverage, InsurancePlan, Organization, Patient, RelatedPerson } from 'fhir/r4b';
import { FC, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { getFullName } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { CustomDialog } from '../components/dialogs';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  AboutPatientContainer,
  ActionBar,
  ContactContainer,
  Header,
  InsuranceContainer,
  PatientDetailsContainer,
  PrimaryCareContainer,
  ResponsibleInformationContainer,
  SettingsContainer,
} from '../components/patient';
import { useGetInsurancePlans, useGetPatient, useGetPatientQuery } from '../hooks/useGetPatient';
import { createInsurancePlanDto, InsurancePlanDTO, usePatientStore } from '../state/patient.store';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { otherColors } from '@theme/colors';
import { AddInsuranceModal } from '../components/patient/AddInsuranceModal';

const PatientInformationPage: FC = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();

  const { isFetching } = useGetPatientQuery({ patientId: id }, (data) => {
    const bundleEntries = data.entry;
    const bundleEntryWithPatient = bundleEntries?.find(
      (bundleEntry) => bundleEntry.resource?.resourceType === 'Patient'
    );
    const patientResource = bundleEntryWithPatient?.resource as Patient;

    const coverageResources = bundleEntries
      ?.filter((bundleEntry) => bundleEntry.resource?.resourceType === 'Coverage')
      .map((bundleEntry) => bundleEntry.resource as Coverage)
      .filter((coverage) => coverage.status === 'active');

    const relatedPersonResources = bundleEntries
      ?.filter((bundleEntry) => bundleEntry.resource?.resourceType === 'RelatedPerson')
      .map((bundleEntry) => bundleEntry.resource as RelatedPerson);

    usePatientStore.setState({
      patient: patientResource,
      insurances: coverageResources,
      policyHolders: relatedPersonResources,
    });
  });

  const { patient, reset, patchOperations, insurances, tempInsurances, setInsurancePlans } = usePatientStore();

  useGetInsurancePlans((data) => {
    const bundleEntries = data.entry;
    if (bundleEntries) {
      const organizations = bundleEntries
        .filter((bundleEntry: BundleEntry) => bundleEntry.resource?.resourceType === 'Organization')
        .map((bundleEntry: BundleEntry) => bundleEntry.resource as Organization);

      const transformedInsurancePlans = bundleEntries
        .filter((bundleEntry: BundleEntry) => bundleEntry.resource?.resourceType === 'InsurancePlan')
        .map((bundleEntry: BundleEntry) => {
          const insurancePlanResource = bundleEntry.resource as InsurancePlan;

          try {
            const organizationId = insurancePlanResource.ownedBy?.reference?.split('/')[1];
            const organizationResource = organizations.find((organization) => organization.id === organizationId);

            if (!organizationResource) {
              throw new Error(`Organization resource is not found by id: ${organizationId}.`);
            }
            return createInsurancePlanDto(insurancePlanResource, organizationResource);
          } catch (err) {
            console.error(err);
            console.log('Could not add insurance plan due to incomplete data:', JSON.stringify(insurancePlanResource));
            return {} as InsurancePlanDTO;
          }
        })
        .filter((insurancePlan) => insurancePlan.id !== undefined)
        .sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });

      setInsurancePlans(transformedInsurancePlans);
    }
  });

  const { otherPatientsWithSameName, setOtherPatientsWithSameName } = useGetPatient(id);

  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false);
  const [openAddInsuranceModal, setOpenAddInsuranceModal] = useState(false);

  const methods = useForm({
    mode: 'onBlur',
  });

  if (!patient) return null;

  if (isFetching) return <LoadingScreen />;

  const handleDiscardChanges = (): void => {
    reset();
    setOpenConfirmationDialog(false);
    navigate(-1);
  };

  const handleCloseConfirmationDialog = (): void => {
    setOpenConfirmationDialog(false);
  };

  const handleBackClickWithConfirmation = (): void => {
    if (
      (patchOperations?.patient?.length ?? 0) > 0 ||
      Object.values(patchOperations?.coverages || {}).some((ops) => ops.length > 0) ||
      Object.values(patchOperations?.relatedPersons || {}).some((ops) => ops.length > 0)
    ) {
      setOpenConfirmationDialog(true);
    } else {
      navigate(-1);
    }
  };

  return (
    <FormProvider {...methods}>
      <Box>
        <Header handleDiscard={handleBackClickWithConfirmation} id={id} />
        <Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <CustomBreadcrumbs
              chain={[
                { link: '/patients', children: 'Patients' },
                {
                  link: `/patient/${patient?.id}`,
                  children: patient ? getFullName(patient) : '',
                },
                {
                  link: '#',
                  children: `Patient Information`,
                },
              ]}
            />
            <Typography variant="h3" color="primary.main">
              Patient Information
            </Typography>
            {otherPatientsWithSameName && (
              <Box
                sx={{
                  marginTop: 1,
                  padding: 1,
                  background: otherColors.dialogNote,
                  borderRadius: '4px',
                }}
                display="flex"
              >
                <WarningAmberIcon sx={{ marginTop: 1, color: otherColors.warningIcon }} />
                <Typography
                  variant="body2"
                  color={otherColors.closeCross}
                  sx={{ m: 1.25, maxWidth: 850, fontWeight: 500 }}
                >
                  There are another patients with this name in our database. Please confirm by the DOB that you are
                  viewing the right patient.
                </Typography>
                <CloseIcon
                  onClick={() => setOtherPatientsWithSameName(false)}
                  sx={{ marginLeft: 'auto', marginRight: 0, marginTop: 1, color: otherColors.closeCross }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AboutPatientContainer />
                <ContactContainer />
                <PatientDetailsContainer />
                <PrimaryCareContainer />
              </Box>
              <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {insurances.map((insurance) => (
                  <InsuranceContainer key={insurance.id} insuranceId={insurance.id!} />
                ))}
                {tempInsurances.map((insurance) => (
                  <InsuranceContainer key={insurance.coverage.id} insuranceId={insurance.coverage.id!} />
                ))}
                {insurances.length + tempInsurances.length < 3 && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setOpenAddInsuranceModal(true)}
                    sx={{
                      borderRadius: 25,
                      textTransform: 'none',
                      fontWeight: 'bold',
                      width: 'fit-content',
                    }}
                  >
                    + Add Insurance
                  </Button>
                )}
                <ResponsibleInformationContainer />
                <SettingsContainer />
              </Box>
            </Box>
          </Box>
        </Box>
        <ActionBar handleDiscard={handleBackClickWithConfirmation} />
      </Box>
      <CustomDialog
        open={openConfirmationDialog}
        handleClose={handleCloseConfirmationDialog}
        title="Discard Changes?"
        description="You have unsaved changes. Are you sure you want to discard them and go back?"
        closeButtonText="Cancel"
        handleConfirm={handleDiscardChanges}
        confirmText="Discard Changes"
      />
      <AddInsuranceModal open={openAddInsuranceModal} onClose={() => setOpenAddInsuranceModal(false)} />
    </FormProvider>
  );
};

export default PatientInformationPage;
