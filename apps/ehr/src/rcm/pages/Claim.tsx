import { Box, CircularProgress, Skeleton } from '@mui/material';
import React, { FC, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FHIR_EXTENSION } from 'utils';
import CustomBreadcrumbs from '../../components/CustomBreadcrumbs';
import { getSelectors } from '../../shared/store/getSelectors';
import {
  AdditionalInformationModal,
  AdditionalInsuranceModal,
  BillingCard,
  ClaimHeader,
  ClaimListCard,
  DiagnosesModal,
  InsuredInformationModal,
  PatientInformationModal,
  SLBProviderCard,
} from '../features';
import { useClaimStore, useGetClaim, useGetFacilities, useGetInsurancePlans, useGetOrganizations } from '../state';
import { DIAGNOSES_SEQUENCE_LETTER } from '../utils';

export const Claim: FC = () => {
  const { id } = useParams();

  const {
    patientData,
    coverageData,
    additionalCoverageData,
    claimData,
    setResources,
    setPlansOwnedBy,
    plansOwnedBy,
    additionalCoverage,
  } = getSelectors(useClaimStore, [
    'patientData',
    'coverageData',
    'additionalCoverageData',
    'claimData',
    'setResources',
    'setPlansOwnedBy',
    'plansOwnedBy',
    'additionalCoverage',
  ]);

  const { isLoading } = useGetClaim({ claimId: id }, (data) => {
    if (!data) return;
    setResources(data);
  });

  const { data: insurancePlans } = useGetInsurancePlans((data) => {
    console.log('Insurance plans', data);
  });

  const { data: organizations } = useGetOrganizations((data) => {
    console.log('Organizations', data);
  });

  useEffect(() => {
    if (insurancePlans && organizations) {
      setPlansOwnedBy(insurancePlans, organizations);
    }
  }, [insurancePlans, organizations, setPlansOwnedBy]);

  useGetFacilities((data) => {
    console.log('Facilities', data);
    useClaimStore.setState({ facilities: data || undefined });
  });

  useEffect(() => {
    useClaimStore.setState({
      claim: undefined,
      claimData: undefined,
      patient: undefined,
      patientData: undefined,
      appointment: undefined,
      coverage: undefined,
      coverageData: undefined,
      additionalCoverage: undefined,
      additionalCoverageData: undefined,
      encounter: undefined,
      subscriber: undefined,
      additionalSubscriber: undefined,
      insurancePlans: undefined,
      organizations: undefined,
      plansOwnedBy: undefined,
      facilities: undefined,
      visitNoteDocument: undefined,
    });
  }, []);

  const planNamePayerId = useMemo(() => {
    if (!plansOwnedBy || !coverageData?.organizationId || !coverageData?.planName) {
      return;
    }

    const plan = plansOwnedBy?.find(
      (item) => item.ownedBy?.id === coverageData.organizationId && item.name === coverageData.planName
    );

    if (!plan) {
      return;
    }

    const payerId = plan.ownedBy?.identifier?.find(
      (identifier) =>
        !!identifier.type?.coding?.find(
          (coding) => coding.code === 'XX' && coding.system === FHIR_EXTENSION.Organization.v2_0203.url
        )
    )?.value;

    return `${coverageData.planName} ${payerId}`;
  }, [plansOwnedBy, coverageData?.planName, coverageData?.organizationId]);

  if (isLoading) {
    return (
      <CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          p: 3,
          gap: 3,
        }}
      >
        <CustomBreadcrumbs
          chain={[
            { link: '/rcm/claims?type=registration', children: 'Registration' },
            { link: '#', children: id || <Skeleton width={150} /> },
          ]}
        />

        <ClaimHeader />

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <ClaimListCard
              title="Patient information"
              items={[
                { label: '2.First name', value: patientData?.firstName },
                { label: '2.Middle name', value: patientData?.middleName },
                { label: '2.Last name', value: patientData?.lastName },
                { label: '3.Date of birth', value: patientData?.dob?.toFormat('MM/dd/yyyy') },
                { label: '3.Birth sex', value: patientData?.genderLabel },
                { label: '5.Phone', value: patientData?.phone },
                { label: '5.Address line', value: patientData?.addressLine },
                { label: '5.City, State, ZIP', value: patientData?.cityStateZIP },
                { label: '6.Patient relation to insured', value: coverageData?.relationship },
              ]}
              editButton={<PatientInformationModal />}
            />

            <ClaimListCard
              title="Additional information"
              items={[
                { label: '10.Is patient condition related to:', value: claimData?.conditionRelatedToMixed },
                { label: '10d.Claim codes (Designated to NUCC)', value: claimData?.claimCodes },
                {
                  label: '14.Date of current illness, injury, or pregnancy (LMP)',
                  value: claimData?.dateOfIllness?.toFormat('MM/dd/yyyy'),
                },
                {
                  label: '16.Dates patient is unable to work in current occupation',
                  value: claimData?.unableToWorkString,
                },
                {
                  label: '18.Hospitalization dates related to current services',
                  value: claimData?.hospitalizationDatesString,
                },
                { label: '22.Resubmission code', value: claimData?.resubmissionCode },
                // { label: '22.Original ref.no.', value: 'TODO' },
                { label: '23.Prior authorization number', value: claimData?.priorAuthNumber },
              ]}
              editButton={<AdditionalInformationModal />}
            />

            <ClaimListCard
              title="21. Diagnoses"
              items={(claimData?.diagnoses || []).map((diagnosis, index) => ({
                label: `${DIAGNOSES_SEQUENCE_LETTER[index]} ${diagnosis.code} ${diagnosis.display}`,
                hideValue: true,
              }))}
              comment={claimData?.diagnosesComment}
              editButton={<DiagnosesModal />}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <ClaimListCard
              title="Insured information"
              items={[
                {
                  label: 'Plan Name and Payer ID *',
                  value: planNamePayerId,
                },
                {
                  label: '1a.Insured’s ID number *',
                  value: coverageData?.subscriberId,
                },
                {
                  label: '4.Insured’s First name',
                  value: coverageData?.firstName,
                },
                {
                  label: '4.Insured’s Middle name',
                  value: coverageData?.middleName,
                },
                {
                  label: '4.Insured’s Last name',
                  value: coverageData?.lastName,
                },
                {
                  label: '7.Phone',
                  value: coverageData?.phone,
                },
                {
                  label: '7.Address line',
                  value: coverageData?.addressLine,
                },
                {
                  label: '7.City, State, ZIP',
                  value: coverageData?.cityStateZIP,
                },
                {
                  label: '11.Insured’s policy group or FECA number',
                  value: coverageData?.policyGroup,
                },
                {
                  label: '11a.Date of birth',
                  value: coverageData?.dob?.toFormat('MM.dd.yyyy'),
                },
                {
                  label: '11a.Birth sex',
                  value: coverageData?.genderLabel,
                },
                // {
                //   label: '11b.Other claim ID (Designated to NUCC) *',
                //   value: 'TODO',
                // },
              ]}
              editButton={<InsuredInformationModal />}
            />

            <ClaimListCard
              title="Additional Insurance"
              items={[
                {
                  label: '9.Other insured’s name',
                  value: additionalCoverageData?.firstMiddleLastName,
                },
                {
                  label: '9a.Other insured’s policy or group number',
                  value: additionalCoverageData?.policyGroup,
                },
                // {
                //   label: '9d.Insured’s plan name or program name',
                //   value: 'TODO',
                // },
              ]}
              editButton={additionalCoverage && <AdditionalInsuranceModal />}
            />

            <SLBProviderCard />
          </Box>
        </Box>

        <BillingCard />
      </Box>

      {/*<AppBar*/}
      {/*  position="sticky"*/}
      {/*  sx={{*/}
      {/*    top: 'auto',*/}
      {/*    bottom: 0,*/}
      {/*    backgroundColor: (theme) => theme.palette.background.paper,*/}
      {/*    zIndex: (theme) => theme.zIndex.drawer + 1,*/}
      {/*    color: 'inherit',*/}
      {/*  }}*/}
      {/*>*/}
      {/*  <Container maxWidth="xl">*/}
      {/*    <Box*/}
      {/*      sx={{*/}
      {/*        py: 2,*/}
      {/*        display: 'flex',*/}
      {/*        justifyContent: 'flex-end',*/}
      {/*        gap: 1,*/}
      {/*      }}*/}
      {/*    >*/}
      {/*      <RoundedButton startIcon={<DoneIcon />} variant="contained">*/}
      {/*        Save*/}
      {/*      </RoundedButton>*/}
      {/*      <RoundedButton startIcon={<LockOutlinedIcon />} variant="contained">*/}
      {/*        Lock*/}
      {/*      </RoundedButton>*/}
      {/*      <RoundedButton disabled startIcon={<CheckCircleOutlineOutlinedIcon />} variant="contained">*/}
      {/*        Done*/}
      {/*      </RoundedButton>*/}
      {/*    </Box>*/}
      {/*  </Container>*/}
      {/*</AppBar>*/}
    </Box>
  );
};
