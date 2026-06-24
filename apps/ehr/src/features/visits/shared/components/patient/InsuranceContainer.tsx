import { RefreshRounded } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, ReactElement, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { StatusStyleObject } from 'src/components/RefreshableStatusWidget';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  chooseJson,
  CoverageCheckWithDetails,
  EligibilityCheckSimpleStatus,
  FinancialDetails,
  InsuranceEligibilityCheckStatus,
  mapEligibilityCheckResultToSimpleStatus,
  mapInsuranceTypeCodeToCandidCode,
  PATIENT_RECORD_CONFIG,
  PatientPaymentBenefit,
} from 'utils';
import { CopayWidget } from './CopayWidget';
import { EligibilityDetailsDialog } from './EligibilityDetailsDialog';
import { InsuranceCarrierQuickPicks } from './InsuranceCarrierQuickPicks';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

type InsuranceContainerProps = {
  ordinal: number;
  patientId: string;
  initialEligibilityCheck?: CoverageCheckWithDetails;
  removeInProgress?: boolean;
  handleRemoveClick?: () => void;
  isNew?: boolean;
  onCancelAdd?: () => void;
  renderWithoutSection?: boolean;
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
  isNew,
  onCancelAdd,
  renderWithoutSection,
}) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();

  const [showEligibilityDetails, setShowEligibilityDetails] = useState(false);

  const [eligibilityStatus, setEligibilityStatus] = useState<SimpleStatusCheckWithDate | undefined>(
    mapInitialStatus(initialEligibilityCheck)
  );

  const { getValues, setValue, watch } = useFormContext();

  const {
    items: FormFields,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: insuranceSection, index: ordinal - 1 });

  const insurancePriority = watch(FormFields.insurancePriority.key);
  const currentInsurancePlanType = watch(FormFields.insurancePlanType.key);

  // Surface the insurance type determined by the eligibility check into the editable
  // "Insurance plan type" dropdown when the field is empty. This intentionally re-applies whenever the
  // field is empty (e.g. after the async coverage-load reset clears it) so the eligibility-derived type
  // is not lost to that race. A value stored on the Coverage or chosen by the user takes precedence via
  // the early return below, and setting a value makes the watched field truthy so this does not loop.
  useEffect(() => {
    if (currentInsurancePlanType) return;
    const eligibilityInsuranceCode = initialEligibilityCheck?.coverageDetails?.insurance?.insuranceCode;
    if (!eligibilityInsuranceCode) return;
    const mappedCandidCode = mapInsuranceTypeCodeToCandidCode(eligibilityInsuranceCode);
    if (!mappedCandidCode) return;
    setValue(FormFields.insurancePlanType.key, mappedCandidCode, { shouldDirty: true });
  }, [currentInsurancePlanType, initialEligibilityCheck, FormFields.insurancePlanType.key, setValue]);

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

  const queryClient = useQueryClient();

  const handleRecheckEligibility = async (): Promise<void> => {
    try {
      const result = await recheckEligibility.mutateAsync();
      if (result) {
        setEligibilityStatus(result);
        // When an eligibility check is run update other components with the updated insurance info
        await queryClient.invalidateQueries({ queryKey: ['patient-account-get'] });
        await queryClient.invalidateQueries({ queryKey: ['patient-coverages'] });
      } else {
        console.error('Error rechecking eligibility:', 'No result returned');
      }
      console.log('Eligibility check result:', result);

      if (
        result &&
        mapSimpleStatusToDetailedStatus(result.status) !== InsuranceEligibilityCheckStatus.eligibilityConfirmed
      ) {
        enqueueSnackbar(
          `Eligibility check failed. ${result.errors
            .map((error: any) => error.code)
            .map((error: any) => error.text)
            .join(', ')}`,
          {
            variant: 'error',
          }
        );
      }

      const currentInsuranceCode = getValues(FormFields.insurancePlanType.key);
      if (!currentInsuranceCode) {
        const insuranceCodeTemp = result?.coverageDetails?.insurance?.insuranceCode;

        if (insuranceCodeTemp) {
          const newInsurance = mapInsuranceTypeCodeToCandidCode(insuranceCodeTemp);

          if (newInsurance) {
            setValue(FormFields.insurancePlanType.key, newInsurance, { shouldDirty: true });
          }
        }
      }
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
          const formattedTime = dt
            .toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })
            .toLowerCase();
          return `Last checked: ${dt.toLocaleDateString()} ${formattedTime}`;
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

  const eligibilityCheck = getCurrentEligibilityData();

  // Plan / MCO entities reported on the eligibility response (e.g. the managed care organization a
  // Medicaid member is enrolled in). Only entries that carry a name are surfaced.
  const mcoPlans = (eligibilityCheck?.coverageDetails?.plans ?? []).filter((plan) => plan.entityName || plan.planName);

  function formatMoney(value: number | undefined): string {
    if (value === undefined) {
      return 'Unknown';
    }
    const formatMoneyTemp = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    return formatMoneyTemp.format(value);
  }

  const BenefitProgressDetails = ({ detail }: { detail: FinancialDetails }): ReactElement => {
    // When this category has no meaningful breakdown (every value is unknown or $0), show a single
    // summary line ("Name: $0" or "Name: Unspecified") instead of the progress bar and paid/total/
    // remaining rows. "$0" when any value is a known zero, "Unspecified" when nothing was reported.
    const values = [detail.paid, detail.total, detail.remaining];
    const hasPositiveValue = values.some((value) => typeof value === 'number' && value > 0);
    if (!hasPositiveValue) {
      const summaryLabel = values.some((value) => value === 0) ? '$0' : 'Unspecified';
      return (
        <Typography variant="body1" color={theme.palette.primary.dark}>
          {detail.name}: <strong>{summaryLabel}</strong>
        </Typography>
      );
    }

    return (
      <>
        <Typography variant="body1" color={theme.palette.primary.dark}>
          {detail.name}
        </Typography>
        {detail.total !== undefined && detail.paid !== undefined && (
          <LinearProgress
            variant="determinate"
            value={detail.total === 0 ? 0 : (detail.paid / detail.total) * 100}
            color="primary"
            sx={{ marginTop: 1, marginBottom: 1 }}
          />
        )}
        <Typography variant="body2" color={theme.palette.primary.dark}>
          Paid: {formatMoney(detail.paid)}
        </Typography>
        <Typography variant="body2" color={theme.palette.primary.dark}>
          Total: {formatMoney(detail.total)}
        </Typography>
        <Typography variant="body2" color={theme.palette.primary.dark}>
          Remaining: <strong>{formatMoney(detail.remaining)}</strong>
        </Typography>
      </>
    );
  };

  const content = (
    <>
      {!isNew && renderWithoutSection && (
        <Box
          sx={{
            alignItems: 'center',
            borderTop: ordinal > 1 ? `1px solid ${theme.palette.divider}` : undefined,
            display: 'flex',
            justifyContent: 'space-between',
            mt: ordinal > 1 ? 2 : 0,
            pt: ordinal > 1 ? 2 : 0,
          }}
        >
          <Typography variant="h5" color={theme.palette.primary.dark} fontWeight={theme.typography.fontWeightBold}>
            {ordinal === 1 ? 'Primary insurance' : 'Secondary insurance'}
          </Typography>
          <TitleWidget />
        </Box>
      )}
      {!isNew && (
        <Box
          sx={{
            marginLeft: '12px',
            marginTop: 2,
          }}
        >
          {(() => {
            const eligibilityErrorDetails = getErrorDetailsFromCoverageResponse(getCurrentEligibilityData());
            if (!eligibilityErrorDetails || eligibilityErrorDetails.length === 0) {
              return null;
            }
            return (
              <Paper
                elevation={0}
                sx={{
                  mb: 4,
                  ml: -2,
                  width: 'calc(100% + 16px)',
                  p: 2,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="h5"
                  color={theme.palette.error.dark}
                  fontWeight={theme.typography.fontWeightBold}
                  sx={{ mb: 1 }}
                >
                  Eligibility not confirmed
                </Typography>
                {eligibilityErrorDetails.map((error, index) => (
                  <Box key={index} sx={{ mb: index < eligibilityErrorDetails.length - 1 ? 1 : 0 }}>
                    {error.code && (
                      <Typography variant="body2" color={theme.palette.error.dark}>
                        Error Code: {error.code}
                      </Typography>
                    )}
                    {error.text && (
                      <Typography variant="body2" color={theme.palette.error.dark} sx={{ mt: 0.5 }}>
                        Error Message: {error.text}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Paper>
            );
          })()}
          <CopayWidget copay={copayBenefits} />
          {mcoPlans.length > 0 && (
            <Grid
              sx={{
                marginTop: 2,
                backgroundColor: 'rgba(244, 246, 248, 1)',
                padding: 1,
              }}
              container
              spacing={2}
            >
              <Grid item xs={12}>
                <Typography
                  variant="h5"
                  color={theme.palette.primary.dark}
                  fontWeight={theme.typography.fontWeightBold}
                >
                  Plan / MCO
                </Typography>
              </Grid>
              {mcoPlans.map((plan, index) => (
                <Grid item xs={12} sm={6} key={`mco-plan-${index}`}>
                  <Typography
                    variant="body1"
                    color={theme.palette.primary.dark}
                    fontWeight={theme.typography.fontWeightMedium}
                  >
                    {[plan.entityName, plan.planName].filter(Boolean).join(' / ')}
                  </Typography>
                  {plan.entityType && (
                    <Typography variant="body2" color={theme.palette.text.secondary}>
                      {plan.entityType}
                    </Typography>
                  )}
                  {plan.payerID && (
                    <Typography variant="body2" color={theme.palette.text.secondary}>
                      Payer ID: {plan.payerID}
                    </Typography>
                  )}
                  {plan.phone && (
                    <Typography variant="body2" color={theme.palette.text.secondary}>
                      Phone: {plan.phone}
                    </Typography>
                  )}
                </Grid>
              ))}
            </Grid>
          )}
          <Grid
            sx={{
              marginTop: 2,
              backgroundColor: 'rgba(244, 246, 248, 1)',
              padding: 1,
            }}
            container
            spacing={2}
          >
            <Grid item xs={12}>
              <Typography variant="h5" color={theme.palette.primary.dark} fontWeight={theme.typography.fontWeightBold}>
                Deductible & Out-of-Pocket (In-network)
              </Typography>
            </Grid>

            {eligibilityCheck?.financialDetails?.map((detail) => (
              <Grid item xs={4} key={detail.name}>
                <BenefitProgressDetails detail={detail} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      <PatientRecordFormField
        item={FormFields.insurancePriority}
        isLoading={false}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <InsuranceCarrierQuickPicks fieldKey={FormFields.insuranceCarrier.key} />
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
      <PatientRecordFormField
        item={FormFields.relationship}
        isLoading={false}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      {/* should be always visible to ensure dynamic population works. https://linear.app/zapehr/issue/OTR-1728/ehr-save-operation-failed-error-if-insurance-with-self-option-is-added */}
      <Box>
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
          item={FormFields.additionalInformation}
          isLoading={false}
          requiredFormFields={requiredFields}
          hiddenFormFields={hiddenFields}
        />
        {isNew ? (
          <Button
            onClick={onCancelAdd}
            variant="text"
            sx={{
              color: theme.palette.error.main,
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 500,
              padding: '0',
              width: 'fit-content',
            }}
          >
            Cancel
          </Button>
        ) : (
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
        )}
      </Box>

      {!isNew && (
        <EligibilityDetailsDialog
          open={showEligibilityDetails}
          onClose={() => setShowEligibilityDetails(false)}
          eligibilityCheck={getCurrentEligibilityData()}
          simpleStatus={eligibilityStatus?.status}
          errorDetails={getErrorDetailsFromCoverageResponse(getCurrentEligibilityData())}
        />
      )}
    </>
  );

  if (renderWithoutSection) {
    return content;
  }

  return (
    <PatientRecordFormSection
      formSection={insuranceSection}
      ordinal={ordinal - 1}
      titleWidget={isNew ? undefined : <TitleWidget />}
    >
      {content}
    </PatientRecordFormSection>
  );
};
