import { RefreshRounded } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Chip, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { FC, ReactElement, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { StatusStyleObject } from 'src/components/RefreshableStatusWidget';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  chooseJson,
  CoverageCheckWithDetails,
  EligibilityCheckSimpleStatus,
  InsuranceEligibilityCheckStatus,
  mapEligibilityCheckResultToSimpleStatus,
  PATIENT_RECORD_CONFIG,
  PatientPaymentBenefit,
} from 'utils';
import { CopayWidget } from './CopayWidget';
import { EligibilityDetailsDialog } from './EligibilityDetailsDialog';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import ShowMoreButton from './ShowMoreButton';

type InsuranceContainerProps = {
  ordinal: number;
  patientId: string;
  initialEligibilityCheck?: CoverageCheckWithDetails;
  removeInProgress?: boolean;
  handleRemoveClick?: () => void;
};

export const STATUS_TO_STYLE_MAP: Record<EligibilityCheckSimpleStatus, StatusStyleObject> = {
  ELIGIBLE: {
    bgColor: '#C8E6C9',
    textColor: '#1B5E20',
  },
  'NOT ELIGIBLE': {
    bgColor: '#FECDD2',
    textColor: '#B71C1C',
  },
  UNKNOWN: {
    bgColor: '#FECDD2',
    textColor: '#B71C1C',
  },
};

function mapInitialStatus(
  initialCheckResult: CoverageCheckWithDetails | undefined
): SimpleStatusCheckWithDate | undefined {
  if (initialCheckResult) {
    const status = mapEligibilityCheckResultToSimpleStatus(initialCheckResult);
    return {
      status: status.status,
      dateISO: status.dateISO,
      copay: initialCheckResult.copay,
      errors: initialCheckResult.errors,
    };
  }
  return undefined;
}

function mapSimpleStatusToDetailedStatus(simpleStatus: EligibilityCheckSimpleStatus): InsuranceEligibilityCheckStatus {
  switch (simpleStatus) {
    case 'ELIGIBLE':
      return InsuranceEligibilityCheckStatus.eligibilityConfirmed;
    case 'NOT ELIGIBLE':
      return InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;
    case 'UNKNOWN':
    default:
      return InsuranceEligibilityCheckStatus.eligibilityNotChecked;
  }
}

function getErrorDetailsFromCoverageResponse(
  eligibilityCheck?: CoverageCheckWithDetails
): Array<{ code: string; text: string }> | undefined {
  if (!eligibilityCheck) return undefined;

  // First, try to extract errors from the errors field if available
  if (eligibilityCheck.errors && eligibilityCheck.errors.length > 0) {
    return eligibilityCheck.errors.map((error) => {
      // Extract code and text from FHIR CodeableConcept
      const code = error.code?.coding?.[0]?.code || error.code?.text || 'UNKNOWN';
      const text = error.code?.text || 'No error details available';
      return { code, text };
    });
  }

  return undefined;
}

interface SimpleStatusCheckWithDate {
  status: EligibilityCheckSimpleStatus;
  dateISO: string;
  copay?: PatientPaymentBenefit[];
  errors?: Array<{ code: { coding?: Array<{ code?: string; display?: string }>; text?: string } }>;
}

const insuranceSection = PATIENT_RECORD_CONFIG.FormFields.insurance;

export const InsuranceContainer: FC<InsuranceContainerProps> = ({
  ordinal,
  patientId,
  removeInProgress,
  initialEligibilityCheck,
  handleRemoveClick,
}) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();

  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showEligibilityDetails, setShowEligibilityDetails] = useState(false);

  const [eligibilityStatus, setEligibilityStatus] = useState<SimpleStatusCheckWithDate | undefined>(
    mapInitialStatus(initialEligibilityCheck)
  );

  const { watch } = useFormContext();

  const {
    items: FormFields,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: insuranceSection, index: ordinal - 1 });

  const insurancePriority = watch(FormFields.insurancePriority.key);

  const toggleMoreInfo = (): void => {
    setShowMoreInfo((prev) => !prev);
  };

  const handleRemoveInsurance = (): void => {
    handleRemoveClick?.();
  };

  const recheckEligibility = useMutation({
    mutationFn: async () => {
      // todo: show an alert when form has unsaved changes?
      const coverageToCheck = insurancePriority?.toLowerCase();
      try {
        return oystehrZambda?.zambda
          .execute({
            id: 'get-eligibility',
            patientId,
            coverageToCheck: coverageToCheck,
          })
          .then((res) => {
            console.log('eligibility check result', res);
            const json = chooseJson(res);
            const fullResult = coverageToCheck === 'secondary' ? json.secondary : json.primary;
            const simpleStatus = mapEligibilityCheckResultToSimpleStatus(fullResult);

            // Return combined data including the error details
            return {
              ...simpleStatus,
              errors: fullResult?.errors,
            };
          });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
  });

  const handleRecheckEligibility = async (): Promise<void> => {
    try {
      const result = await recheckEligibility.mutateAsync();
      if (result) {
        setEligibilityStatus(result);
      } else {
        console.error('Error rechecking eligibility:', 'No result returned');
      }
      console.log('Eligibility check result:', result);
    } catch (error) {
      console.error('Error rechecking eligibility:', error);
    }
  };

  const TitleWidget = (): ReactElement => {
    const chipColors = STATUS_TO_STYLE_MAP[eligibilityStatus?.status ?? 'UNKNOWN'];
    const lastRefreshDateString = (() => {
      const dateISO = eligibilityStatus?.dateISO ?? '';
      if (dateISO) {
        try {
          const dt = new Date(dateISO);
          return `Last checked: ${dt.toLocaleDateString()}`;
        } catch {
          return '';
        }
      }
      return '';
    })();

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        {/* Status badge and View Details button in same row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Chip
            label={eligibilityStatus?.status ?? 'UNKNOWN'}
            sx={{
              backgroundColor: chipColors.bgColor,
              color: chipColors.textColor,
              borderRadius: '8px',
              padding: '0 9px',
              height: '24px',
              '& .MuiChip-label': {
                padding: 0,
                fontWeight: 'bold',
                fontSize: '0.7rem',
              },
            }}
          />
          {(initialEligibilityCheck || eligibilityStatus) && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowEligibilityDetails(true)}
              sx={{
                textTransform: 'none',
                fontSize: '12px',
                borderRadius: '16px',
                minWidth: 'auto',
                px: 2,
                py: 0.5,
              }}
            >
              View Details
            </Button>
          )}
        </Box>
        {/* Last checked date and refresh button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: 'Rubik',
              color: 'rgba(0, 0, 0, 0.6)',
              fontSize: '12px',
              lineHeight: '15px',
              fontWeight: '400',
            }}
          >
            {lastRefreshDateString}
          </Typography>
          <IconButton onClick={handleRecheckEligibility} size="small">
            {recheckEligibility.isPending ? <CircularProgress size="24px" /> : <RefreshRounded color="primary" />}
          </IconButton>
        </Box>
      </Box>
    );
  };

  const copayBenefits = eligibilityStatus?.copay ?? [];

  // Get the most current eligibility data, combining initial data with any updates
  const getCurrentEligibilityData = (): CoverageCheckWithDetails | undefined => {
    if (!initialEligibilityCheck && !eligibilityStatus) {
      return undefined;
    }

    // If we have updated eligibility status from a recheck, merge it with initial data
    if (eligibilityStatus && initialEligibilityCheck) {
      const mergedData = {
        ...initialEligibilityCheck,
        status: mapSimpleStatusToDetailedStatus(eligibilityStatus.status),
        dateISO: eligibilityStatus.dateISO,
        // Prefer eligibilityStatus.copay if it has items, otherwise use initialEligibilityCheck.copay
        copay:
          eligibilityStatus.copay && eligibilityStatus.copay.length > 0
            ? eligibilityStatus.copay
            : initialEligibilityCheck.copay,
        errors: eligibilityStatus.errors || initialEligibilityCheck.errors,
      };

      return mergedData;
    }

    // If we only have initial data, use that
    if (initialEligibilityCheck) {
      return initialEligibilityCheck;
    }

    // If we only have eligibility status (shouldn't happen in practice), create minimal data
    if (eligibilityStatus) {
      return {
        status: mapSimpleStatusToDetailedStatus(eligibilityStatus.status),
        dateISO: eligibilityStatus.dateISO,
        copay: eligibilityStatus.copay,
        errors: eligibilityStatus.errors,
        subscriberId: '',
        payorRef: '',
      };
    }

    return undefined;
  };

  return (
    <PatientRecordFormSection formSection={insuranceSection} ordinal={ordinal - 1} titleWidget={<TitleWidget />}>
      <Box
        sx={{
          marginLeft: '12px',
          marginTop: 2,
        }}
      >
        <CopayWidget copay={copayBenefits} />
      </Box>
      <PatientRecordFormField
        item={FormFields.insurancePriority}
        isLoading={false}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.insuranceCarrier}
        isLoading={false}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.insurancePlanType}
        isLoading={false}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.memberId}
        isLoading={false}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ShowMoreButton
          onClick={toggleMoreInfo}
          isOpen={showMoreInfo}
          dataTestId={dataTestIds.insuranceContainer.showMoreButton}
        />
      </Box>
      {showMoreInfo ? (
        <>
          <PatientRecordFormField
            item={FormFields.firstName}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <PatientRecordFormField
            item={FormFields.middleName}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <PatientRecordFormField
            item={FormFields.lastName}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <PatientRecordFormField
            item={FormFields.birthDate}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <PatientRecordFormField
            item={FormFields.birthSex}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
              <PatientRecordFormField
                item={FormFields.policyHolderAddressAsPatient}
                isLoading={false}
                requiredFormFields={requiredFields}
                hiddenFormFields={hiddenFields}
                omitRowWrapper
              />
            </Box>
          </Box>
          <PatientRecordFormField
            item={FormFields.streetAddress}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <PatientRecordFormField
            item={FormFields.addressLine2}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <Row label="City, State, ZIP" required>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <PatientRecordFormField
                item={FormFields.city}
                isLoading={false}
                requiredFormFields={requiredFields}
                hiddenFormFields={hiddenFields}
                omitRowWrapper
              />
              <PatientRecordFormField
                item={FormFields.state}
                isLoading={false}
                requiredFormFields={requiredFields}
                hiddenFormFields={hiddenFields}
                omitRowWrapper
              />
              <PatientRecordFormField
                item={FormFields.zip}
                isLoading={false}
                requiredFormFields={requiredFields}
                hiddenFormFields={hiddenFields}
                omitRowWrapper
              />
            </Box>
          </Row>
          <PatientRecordFormField
            item={FormFields.relationship}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <PatientRecordFormField
            item={FormFields.additionalInformation}
            isLoading={false}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
          />
          <LoadingButton
            data-testid={dataTestIds.insuranceContainer.removeButton}
            onClick={handleRemoveInsurance}
            variant="text"
            loading={removeInProgress}
            sx={{
              color: theme.palette.error.main,
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 500,
              display: handleRemoveClick !== undefined ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: '0',
              width: 'fit-content',
            }}
          >
            Remove This Insurance
          </LoadingButton>
        </>
      ) : (
        <></>
      )}

      <EligibilityDetailsDialog
        open={showEligibilityDetails}
        onClose={() => setShowEligibilityDetails(false)}
        eligibilityCheck={getCurrentEligibilityData()}
        simpleStatus={eligibilityStatus?.status}
        errorDetails={getErrorDetailsFromCoverageResponse(getCurrentEligibilityData())}
      />
    </PatientRecordFormSection>
  );
};
