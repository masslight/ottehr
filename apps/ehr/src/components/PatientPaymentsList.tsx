import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Box,
  Button,
  capitalize,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Markdown as TiptapMarkdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Appointment, ChargeItemDefinition, DocumentReference, Encounter, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, Fragment, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { getEligibilityCheckDetailsForCoverage } from 'src/features/visits/shared/components/patient/InsuranceSection';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { useEncounterReceipt, useGetEncounter } from 'src/hooks/useEncounter';
import { useGetPatientAccount } from 'src/hooks/useGetPatient';
import { useGetChargeMasterEntryQuery } from 'src/rcm/state/charge-masters/charge-master.queries';
import { useFindApplicableFeeScheduleQuery } from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CreditCardBrandIcon } from 'ui-components';
import {
  APIError,
  APIErrorCode,
  CASE_RATE_CODE,
  CashOrCardPayment,
  CoverageCheckWithDetails,
  CPT_CODE_SYSTEM,
  CPT_MODIFIER_EXTENSION_URL,
  FHIR_EXTENSION,
  getCoding,
  getPaymentVariantFromEncounter,
  isApiError,
  ListPatientPaymentResponse,
  OrderedCoveragesWithSubscribers,
  PatientPaymentBenefit,
  PatientPaymentDTO,
  PaymentVariant,
  PostPatientPaymentInput,
  RCM_TAG_SYSTEM,
  SendReceiptByEmailZambdaInput,
  SERVICE_CATEGORY_SYSTEM,
  updateEncounterPaymentVariantExtension,
} from 'utils';
import { sendReceiptByEmail } from '../api/api';
import PaymentDialog from './dialogs/PaymentDialog';
import SendReceiptByEmailDialog, { SendReceiptFormData } from './dialogs/SendReceiptByEmailDialog';
import { GenericToolTip } from './GenericToolTip';
import { RefreshableStatusChip } from './RefreshableStatusWidget';

export interface PaymentListProps {
  patient: Patient | undefined;
  appointment: Appointment | undefined;
  encounterId: string;
  loading?: boolean;
  responsibleParty?: {
    fullName?: string;
    email?: string;
  };
  insuranceCoverages?: {
    coverages: OrderedCoveragesWithSubscribers;
    insuranceOrgs: Organization[];
  };
  paymentData: ListPatientPaymentResponse | undefined;
  refetchPaymentList: () => Promise<void>;
  isRefetching: boolean;
  paymentListError: Error | null;
}

const idForPaymentDTO = (payment: PatientPaymentDTO): string => {
  if (payment.paymentMethod === 'card') {
    return payment.fhirPaymentNotificationId;
  } else {
    return payment.fhirPaymentNotificationId ?? 'unknown-payment-id'; //todo: should get something from candid
  }
};

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatUsd = (amount: number | string | undefined | null): string | null => {
  if (amount === undefined || amount === null) return null;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return null;
  return usdFormatter.format(numericAmount);
};

interface LineItem {
  code: string;
  modifier?: string;
  description: string;
  amount: number;
}

function buildLineItems(
  feeSchedule: ChargeItemDefinition | null | undefined,
  cptCodes: { code: string; display: string; modifier?: { code: string; display: string }[] }[] | undefined,
  emCode: { code: string; display: string; modifier?: { code: string; display: string }[] } | undefined
): LineItem[] {
  if (!feeSchedule?.propertyGroup || (!cptCodes?.length && !emCode)) return [];

  const allCodes = [...(cptCodes ?? []), ...(emCode ? [emCode] : [])];
  const items: LineItem[] = [];

  for (const cpt of allCodes) {
    const cptModifier = cpt.modifier?.[0]?.code;
    let noModifierFallbackPg: (typeof feeSchedule.propertyGroup)[number] | undefined;
    let anyModifierFallbackPg: (typeof feeSchedule.propertyGroup)[number] | undefined;

    for (const pg of feeSchedule.propertyGroup) {
      const pc = pg.priceComponent?.[0];
      if (!pc) continue;
      const fsCoding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
      if (!fsCoding || fsCoding.code !== cpt.code) continue;
      const fsModifier = pc.extension?.find((ext) => ext.url === CPT_MODIFIER_EXTENSION_URL)?.valueCode;
      if ((fsModifier || '') === (cptModifier || '')) {
        // Exact code + modifier match — use it immediately
        items.push({
          code: cpt.code,
          modifier: cptModifier,
          description: cpt.display || fsCoding.display || '',
          amount: pc.amount?.value ?? 0,
        });
        noModifierFallbackPg = undefined;
        anyModifierFallbackPg = undefined;
        break;
      }
      // Code matches but modifier doesn't — prefer no-modifier entry as fallback
      if (!fsModifier && !noModifierFallbackPg) noModifierFallbackPg = pg;
      else if (fsModifier && !anyModifierFallbackPg) anyModifierFallbackPg = pg;
    }

    const fallbackPg = noModifierFallbackPg ?? anyModifierFallbackPg;

    // No exact match found — fall back to first entry with matching code
    if (fallbackPg) {
      const pc = fallbackPg.priceComponent![0];
      const fsCoding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
      items.push({
        code: cpt.code,
        modifier: cptModifier,
        description: cpt.display || fsCoding?.display || '',
        amount: pc.amount?.value ?? 0,
      });
    }
  }

  return items;
}

interface EmPreviewRate {
  code: string;
  label: string;
  amount: number;
}

const EM_PREVIEW_CODES: { code: string; label: string }[] = [
  { code: '99203', label: 'New Patient, Level 3' },
  { code: '99204', label: 'New Patient, Level 4' },
  { code: '99213', label: 'Existing Patient, Level 3' },
  { code: '99214', label: 'Existing Patient, Level 4' },
];

function buildEmPreviewRates(feeSchedule: ChargeItemDefinition | null | undefined): EmPreviewRate[] {
  if (!feeSchedule?.propertyGroup) return [];

  const rates: EmPreviewRate[] = [];
  for (const em of EM_PREVIEW_CODES) {
    for (const pg of feeSchedule.propertyGroup) {
      const pc = pg.priceComponent?.[0];
      if (!pc) continue;
      const fsCoding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
      if (fsCoding?.code === em.code) {
        rates.push({ code: em.code, label: em.label, amount: pc.amount?.value ?? 0 });
        break;
      }
    }
  }
  return rates;
}

const deriveCardOnFileStatus = (output: unknown): boolean => {
  if (!output || typeof output !== 'object') return false;
  const response = output as Record<string, unknown>;
  return Array.isArray(response.cards) && response.cards.length > 0;
};

export default function PatientPaymentList({
  loading,
  patient,
  appointment,
  encounterId,
  responsibleParty,
  insuranceCoverages,
  paymentData,
  refetchPaymentList,
  isRefetching,
  paymentListError,
}: PaymentListProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();
  const theme = useTheme();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [sendReceiptByEmailDialogOpen, setSendReceiptByEmailDialogOpen] = useState(false);
  const {
    data: hasCreditCardOnFileFromList = false,
    isSuccess: cardOnFileKnown,
    refetch: refetchCardOnFile,
  } = useQuery({
    queryKey: ['card-on-file', patient?.id, appointment?.id],
    queryFn: async () => {
      if (!oystehrZambda || !patient?.id || !appointment?.id) return false;
      const result = await oystehrZambda.zambda.execute({
        id: 'payment-methods-list',
        beneficiaryPatientId: patient.id,
        appointmentId: appointment.id,
      });
      return deriveCardOnFileStatus(result.output);
    },
    enabled: !!oystehrZambda && !!patient?.id && !!appointment?.id,
  });

  const {
    data: encounter,
    refetch: refetchEncounter,
    isRefetching: isEncounterRefetching,
  } = useGetEncounter({ encounterId });

  const paymentVariant = encounter ? getPaymentVariantFromEncounter(encounter) : undefined;

  const {
    data: receiptDocRef,
    refetch: refetchReceipt,
    isFetching: isReceiptFetching,
  } = useEncounterReceipt({ encounterId });

  const { data: insuranceData } = useGetPatientAccount({
    apiClient,
    patientId: patient?.id ?? null,
  });

  const insuranceOrgId = insuranceCoverages?.coverages?.primary?.identifier
    ?.find((id) => id.type?.coding?.find((c) => c.code === 'MB'))
    ?.assigner?.reference?.replace('Organization/', '');

  const dateOfService = useMemo(() => {
    const start = appointment?.start;
    return start ? start.split('T')[0] : undefined;
  }, [appointment?.start]);

  const {
    data: selfPayResult,
    isLoading: selfPayLoading,
    isFetched: selfPayFetched,
  } = useGetChargeMasterEntryQuery(
    paymentVariant === PaymentVariant.selfPay ? 'self-pay' : undefined,
    undefined,
    dateOfService
  );
  const selfPayFeeSchedule = selfPayResult?.chargeMaster;

  // For non-self-pay, non-default variants: first try fee schedule, then fall back to charge master
  const isPayerVariant = paymentVariant === PaymentVariant.insurance || paymentVariant === PaymentVariant.employer;
  const canQueryFeeSchedule = isPayerVariant && !!insuranceOrgId && !!dateOfService;

  const {
    data: feeScheduleResult,
    isLoading: feeScheduleLoading,
    isFetched: feeScheduleFetched,
  } = useFindApplicableFeeScheduleQuery(
    canQueryFeeSchedule ? insuranceOrgId : undefined,
    canQueryFeeSchedule ? dateOfService : undefined
  );
  const payerFeeSchedule = feeScheduleResult?.feeSchedule ?? undefined;

  // Fall back to charge master when no fee schedule found (or no payer org to look up)
  const shouldFallbackToCm = isPayerVariant && (!canQueryFeeSchedule || (feeScheduleFetched && !payerFeeSchedule));

  const {
    data: insurancePayResult,
    isLoading: insurancePayLoading,
    isFetched: insurancePayFetched,
  } = useGetChargeMasterEntryQuery(shouldFallbackToCm ? 'default-insurance' : undefined, insuranceOrgId, dateOfService);
  const insuranceChargeMaster = insurancePayResult?.chargeMaster;
  const insuranceChargeMasterSource = insurancePayResult?.source;

  // Default charge master used when no payment variant is selected yet
  const {
    data: defaultCmResult,
    isLoading: defaultCmLoading,
    isFetched: defaultCmFetched,
  } = useGetChargeMasterEntryQuery(
    paymentVariant === undefined ? 'default-insurance' : undefined,
    undefined,
    dateOfService
  );
  const defaultChargeMaster = defaultCmResult?.chargeMaster;

  const { chartData } = useChartData({ encounterId });

  const activeFeeSchedule =
    paymentVariant === PaymentVariant.selfPay
      ? selfPayFeeSchedule
      : isPayerVariant
      ? payerFeeSchedule ?? insuranceChargeMaster
      : defaultChargeMaster;

  const activeDescription = activeFeeSchedule?.description || '';

  const descriptionEditor = useEditor({
    extensions: [StarterKit, TiptapMarkdown],
    editable: false,
    content: '',
  });

  useEffect(() => {
    if (descriptionEditor) {
      if (activeDescription) {
        descriptionEditor.commands.setContent(activeDescription, {
          contentType: 'markdown',
          emitUpdate: false,
        });
      } else {
        descriptionEditor.commands.clearContent(false);
      }
    }
  }, [descriptionEditor, activeDescription]);

  const lineItems = useMemo(
    () => buildLineItems(activeFeeSchedule, chartData?.cptCodes, chartData?.emCode),
    [activeFeeSchedule, chartData?.cptCodes, chartData?.emCode]
  );

  const lineItemsTotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.amount, 0), [lineItems]);

  const emPreviewRates = useMemo(() => buildEmPreviewRates(activeFeeSchedule), [activeFeeSchedule]);

  const hasCptCodes = (chartData?.cptCodes?.length ?? 0) > 0 || !!chartData?.emCode;

  const isCaseRate = useMemo(
    () => activeFeeSchedule?.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE) ?? false,
    [activeFeeSchedule]
  );

  const caseRateInfo = useMemo(() => {
    if (!isCaseRate || !activeFeeSchedule?.propertyGroup) return null;
    const pg = activeFeeSchedule.propertyGroup[0];
    const pc = pg?.priceComponent?.[0];
    if (!pc) return null;
    return {
      amount: pc.amount?.value ?? 0,
      comment: pc.code?.text ?? '',
    };
  }, [isCaseRate, activeFeeSchedule]);

  // Determine whether the active pricing comes from a fee schedule or charge master
  const activePricingType: 'fee-schedule' | 'payer-cm' | 'default-cm' | 'self-pay-cm' = isPayerVariant
    ? payerFeeSchedule
      ? 'fee-schedule'
      : insuranceChargeMasterSource === 'payer'
      ? 'payer-cm'
      : 'default-cm'
    : paymentVariant === PaymentVariant.selfPay
    ? 'self-pay-cm'
    : 'default-cm';

  // Loading state for payer pricing (fee schedule then charge master fallback)
  const payerPricingLoading =
    isPayerVariant && ((canQueryFeeSchedule && feeScheduleLoading) || (shouldFallbackToCm && insurancePayLoading));
  const payerPricingFetched =
    isPayerVariant &&
    ((!canQueryFeeSchedule && insurancePayFetched) ||
      (canQueryFeeSchedule && feeScheduleFetched && (!!payerFeeSchedule || insurancePayFetched)));

  function getPaymentAmountFromPatientBenefit({
    coverage,
    code,
    coverageCode,
    levelCode,
    periodCode,
  }: {
    coverage: PatientPaymentBenefit[];
    code: string;
    coverageCode: string;
    levelCode: string;
    periodCode: string | undefined;
  }): PatientPaymentBenefit | undefined {
    if (!periodCode) {
      return coverage.find(
        (item) => item.code === code && item.coverageCode === coverageCode && item.levelCode === levelCode
      );
    }

    return coverage.find(
      (item) =>
        item.code === code &&
        item.coverageCode === coverageCode &&
        item.levelCode === levelCode &&
        item.periodCode === periodCode
    );
  }

  const payments = paymentData?.payments ?? []; // Replace with actual payments when available

  const totalPaid = useMemo(
    () => (paymentData?.payments ?? []).reduce((sum, p) => sum + p.amountInCents, 0) / 100,
    [paymentData?.payments]
  );
  const remainingBalance = lineItemsTotal - totalPaid;

  const cardOnFileStatusStroke = cardOnFileKnown ? (hasCreditCardOnFileFromList ? '#2E7D32' : '#8A1538') : '#90A4AE';
  const cardOnFileStatusFill = cardOnFileKnown ? (hasCreditCardOnFileFromList ? '#E8F5E9' : '#FBE9E7') : '#D9D9D9';
  const cardOnFileStatusLabel = cardOnFileKnown
    ? hasCreditCardOnFileFromList
      ? 'card on file'
      : 'no card on file'
    : 'checking card on file';
  const cardOnFileChipLabel = hasCreditCardOnFileFromList === true ? 'ON FILE' : 'NO CARD';
  const cardOnFileTooltipText = hasCreditCardOnFileFromList === true ? 'Credit card on file' : 'No card on file';

  const handlePaymentDialogClose = useCallback(() => {
    setPaymentDialogOpen(false);
    if (oystehrZambda && patient?.id && appointment?.id) {
      void refetchCardOnFile();
    }
  }, [oystehrZambda, patient?.id, appointment?.id, refetchCardOnFile]);

  const stripeCustomerDeletedError =
    paymentListError && isApiError(paymentListError)
      ? (paymentListError as APIError).code === APIErrorCode.STRIPE_CUSTOMER_ID_DOES_NOT_EXIST
      : false;

  const receiptDocRefId = receiptDocRef?.id;

  const sendReceipt = async (formData: SendReceiptFormData): Promise<void> => {
    if (!oystehr) return;
    try {
      if (!receiptDocRefId) throw new Error("unable to send email, don't have receipt docRefId");
      const sendReceiptParams: SendReceiptByEmailZambdaInput = {
        recipientFullName: formData.recipientName,
        email: formData.recipientEmail,
        receiptDocRefId: receiptDocRefId,
      };
      await sendReceiptByEmail(oystehr, sendReceiptParams);
      setSendReceiptByEmailDialogOpen(false);
      enqueueSnackbar('Receipt sent successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Something went wrong! Unable to send receipt.', { variant: 'error' });
    }
  };

  const getLabelForPayment = (payment: PatientPaymentDTO): string | ReactElement => {
    if (
      payment.paymentMethod === 'card' ||
      payment.paymentMethod === 'card-reader' ||
      payment.paymentMethod === 'external-card-reader'
    ) {
      if (payment.cardLast4) {
        const formattedBrand = payment.cardBrand ? capitalize(payment.cardBrand) : 'Card';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {payment.cardBrand && (
              <Box sx={{ mr: 1, display: 'inline-flex', alignItems: 'center' }}>
                <CreditCardBrandIcon brand={payment.cardBrand} />
              </Box>
            )}
            <Typography variant="body1">{`${formattedBrand} •••• ${payment.cardLast4}`}</Typography>
          </Box>
        );
      }

      if (payment.paymentMethod === 'card') {
        return (
          <RefreshableStatusChip
            status={'processing...'}
            styleMap={{
              ['processing...']: {
                textSX: {
                  fontSize: '16px',
                  fontWeight: 'normal',
                  color: theme.palette.primary.dark,
                },
                bgColor: 'transparent',
                textColor: theme.palette.primary.dark,
              },
            }}
            lastRefreshISO={''}
            handleRefresh={refetchPaymentList}
            isRefreshing={isRefetching}
            flexDirection="row"
          />
        );
      }

      return 'Card Reader';
    }

    return capitalize(payment.paymentMethod);
  };

  const createNewPayment = useMutation({
    mutationFn: async (input: PostPatientPaymentInput) => {
      if (!oystehrZambda) throw new Error('Oystehr client is not available');

      await oystehrZambda.zambda.execute({
        id: 'patient-payments-post',
        ...input,
      });
    },
    onSuccess: async () => {
      await refetchPaymentList();

      // Close as soon as the payment is visible; receipt creation can continue in background.
      setPaymentDialogOpen(false);
      if (appointment?.id) {
        void refetchCardOnFile();
      }

      const waitForReceipt = async (): Promise<void> => {
        let receipt: DocumentReference | null = null;
        const maxTries = 15;
        let tries = 0;

        while (!receipt && tries < maxTries) {
          const result = await refetchReceipt();

          receipt = result.data ?? null;
          if (!receipt) {
            await new Promise((res) => setTimeout(res, 2000));
          }
          tries += 1;
        }
      };

      void waitForReceipt().catch((err) => console.error('Receipt polling failed', err));
    },
    retry: 0,
  });

  const updateEncounter = useMutation({
    mutationFn: async (input: Encounter) => {
      if (oystehr && encounter && input && input.id) {
        await oystehr.fhir
          .patch<Encounter>({
            id: input.id,
            resourceType: 'Encounter',
            operations: [
              {
                op: encounter.extension !== undefined ? 'replace' : 'add',
                path: '/extension',
                value: input.extension,
              },
            ],
          })
          .then(async () => {
            await refetchEncounter();
          })
          .catch(async () => {
            enqueueSnackbar("Something went wrong! Visit payment option can't be changed.", { variant: 'error' });
            await refetchEncounter();
          });
      }
    },
    onError: async (e) => {
      console.log('error updating encounter', e);
    },
    retry: 0,
  });

  const errorMessage = (() => {
    const networkError = createNewPayment.error;
    if (networkError) {
      if (isApiError(networkError)) {
        return (networkError as APIError).message;
      }
      return 'Something went wrong. Payment was not completed.';
    }
    return null;
  })();

  const insurance = insuranceCoverages?.coverages?.primary?.identifier?.find(
    (temp) => temp.type?.coding?.find((temp) => temp.code === 'MB')
  )?.assigner;
  const insuranceOrganization = insuranceCoverages?.insuranceOrgs?.find(
    (organization) => organization.id === insurance?.reference?.replace('Organization/', '')
  );
  const insuranceName = insuranceOrganization?.name;
  const insuranceNotes = insuranceOrganization?.extension?.find(
    (extensionTemp) => extensionTemp.url === FHIR_EXTENSION.InsurancePlan.notes.url
  )?.valueString;

  let coverageCheck: CoverageCheckWithDetails | undefined = undefined;
  if (insuranceCoverages?.coverages?.primary && insuranceData?.coverageChecks) {
    coverageCheck = getEligibilityCheckDetailsForCoverage(
      insuranceCoverages?.coverages?.primary,
      insuranceData?.coverageChecks
    );
  }

  const copayAmount = getPaymentAmountFromPatientBenefit({
    coverage: coverageCheck?.copay?.filter((item) => item.inNetwork === true) || [],
    code: 'UC',
    coverageCode: 'B',
    levelCode: 'IND',
    periodCode: undefined,
  });

  const remainingDeductibleAmount = getPaymentAmountFromPatientBenefit({
    coverage: coverageCheck?.deductible?.filter((item) => item.inNetwork === true) || [],
    code: '30',
    coverageCode: 'C',
    levelCode: 'IND',
    periodCode: '29',
  });

  const serviceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  const isUrgentCare = serviceCategory === 'urgent-care';
  const isOccupationalMedicine = serviceCategory === 'occupational-medicine';
  const isWorkmansComp = serviceCategory === 'workers-comp';
  const formattedCopayAmount = formatUsd(copayAmount?.amountInUSD);
  const formattedRemainingDeductibleAmount = formatUsd(remainingDeductibleAmount?.amountInUSD);

  // Recommended collection amount based on copay, deductible, and services
  const recommendedCollection = useMemo(() => {
    const copay = copayAmount?.amountInUSD ?? 0;
    const deductibleRemaining = remainingDeductibleAmount?.amountInUSD ?? 0;
    const hasEligibilityData = !!copayAmount || !!remainingDeductibleAmount;

    if (!hasEligibilityData) return null;

    if (hasCptCodes && lineItemsTotal > 0) {
      // Post-service: estimate patient responsibility from services, copay, and deductible
      // Patient owes copay, plus any portion of services that falls within remaining deductible
      const servicesBeyondCopay = Math.max(0, lineItemsTotal - copay);
      const deductiblePortion = Math.min(deductibleRemaining, servicesBeyondCopay);
      const estimated = Math.min(lineItemsTotal, copay + deductiblePortion);
      const afterPayments = Math.max(0, estimated - totalPaid);
      return {
        amount: afterPayments,
        isPreService: false,
        copay,
        deductibleRemaining,
        servicesTotal: lineItemsTotal,
      };
    }

    // Pre-service: recommend collecting copay at minimum
    if (copay > 0) {
      const afterPayments = Math.max(0, copay - totalPaid);
      return {
        amount: afterPayments,
        isPreService: true,
        copay,
        deductibleRemaining,
        servicesTotal: 0,
      };
    }

    return null;
  }, [copayAmount, remainingDeductibleAmount, hasCptCodes, lineItemsTotal, totalPaid]);

  return (
    <Paper
      sx={{
        marginTop: 2,
        padding: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="h4" color="primary.dark">
          Payer/Responsible for Claim
        </Typography>
      </Box>
      <ToggleButtonGroup
        exclusive
        color="primary"
        value={paymentVariant ?? null}
        aria-label="Select payer for claim"
        onChange={async (_e, newValue) => {
          if (newValue !== null && encounter) {
            await updateEncounter.mutateAsync(
              updateEncounterPaymentVariantExtension(encounter, newValue as PaymentVariant)
            );
          }
        }}
        sx={{
          mt: 1,
          borderRadius: 2,
          backgroundColor: theme.palette.grey[200],
          p: 0.25,
          overflow: 'hidden',
          gap: 0,
          '& .MuiToggleButtonGroup-grouped': {
            border: 0,
            borderRadius: 1,
            px: 2.5,
            py: 0.9,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: theme.palette.text.secondary,
            backgroundColor: 'transparent',
            '&.Mui-selected': {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            },
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          },
          '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
            borderLeft: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {isUrgentCare ? (
          <ToggleButton disabled={updateEncounter.isPending || isEncounterRefetching} value={PaymentVariant.insurance}>
            Insurance
          </ToggleButton>
        ) : null}
        <ToggleButton disabled={updateEncounter.isPending || isEncounterRefetching} value={PaymentVariant.selfPay}>
          Self Pay
        </ToggleButton>
        {isOccupationalMedicine || isWorkmansComp ? (
          <ToggleButton disabled={updateEncounter.isPending || isEncounterRefetching} value={PaymentVariant.employer}>
            Employer
          </ToggleButton>
        ) : null}
      </ToggleButtonGroup>
      <Container
        style={{
          backgroundColor: theme.palette.background.default,
          borderRadius: 4,
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
            Payment Considerations
          </Typography>
          {activeFeeSchedule && (
            <GenericToolTip
              customWidth={320}
              title={
                <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    Pricing Source
                  </Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {activeFeeSchedule.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      {activePricingType === 'self-pay-cm' ? (
                        <Chip
                          label="Self-Pay Charge Master"
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 20, backgroundColor: '#E91E90', color: '#fff' }}
                        />
                      ) : activePricingType === 'fee-schedule' ? (
                        <>
                          <Chip
                            label="Payer Fee Schedule"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20, borderColor: '#2E7D32', color: '#2E7D32' }}
                          />
                          {isCaseRate && (
                            <Chip
                              label="Case Rate"
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 20, backgroundColor: '#E65100', color: '#fff' }}
                            />
                          )}
                        </>
                      ) : activePricingType === 'payer-cm' ? (
                        <Chip
                          label="Payer Charge Master"
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 20, backgroundColor: '#1565C0', color: '#fff' }}
                        />
                      ) : (
                        <Chip
                          label="Default Insurance CM"
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 20, backgroundColor: '#6A1B9A', color: '#fff' }}
                        />
                      )}
                    </Box>
                  </Box>
                  {activeFeeSchedule.date && (
                    <Typography variant="caption" color="text.secondary">
                      Effective: {activeFeeSchedule.date}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {paymentVariant === PaymentVariant.selfPay
                      ? 'This is a self-pay visit, therefore the self-pay charge master applies.'
                      : paymentVariant === undefined
                      ? 'No payer selected yet; showing rates from the default charge master.'
                      : activePricingType === 'fee-schedule'
                      ? isCaseRate
                        ? 'A case-rate fee schedule is associated with this payer.'
                        : 'A payer-specific fee schedule is associated with this payer.'
                      : activePricingType === 'payer-cm'
                      ? 'No fee schedule found; a payer-specific charge master applies.'
                      : 'No payer-specific pricing found; the default charge master applies.'}
                  </Typography>
                </Box>
              }
            >
              <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'pointer' }} />
            </GenericToolTip>
          )}
        </Box>
        {paymentVariant === PaymentVariant.selfPay ? (
          selfPayLoading || !selfPayFetched ? (
            <CircularProgress size={20} sx={{ mt: 1 }} />
          ) : selfPayFeeSchedule ? (
            <>
              {activeDescription ? (
                <Box sx={{ mt: 1, '& .tiptap': { outline: 'none' }, '& .tiptap p': { margin: 0 } }}>
                  <EditorContent editor={descriptionEditor} />
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Self-pay rates apply.
                </Typography>
              )}
              {lineItems.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Services provided:
                  </Typography>
                  <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.25, px: 0 } }}>
                    <TableBody>
                      {lineItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ width: '30%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {item.code}
                              {item.modifier ? ` (${item.modifier})` : ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {item.description}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                            <Typography variant="body2">{formatUsd(item.amount)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {payments.map((payment) => (
                        <TableRow key={idForPaymentDTO(payment)}>
                          <TableCell sx={{ width: '30%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              Payment
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {payment.cardBrand && <CreditCardBrandIcon brand={payment.cardBrand} />}
                              <Typography variant="body2" color="text.secondary">
                                {payment.cardLast4
                                  ? `${capitalize(payment.cardBrand ?? 'Card')} •••• ${payment.cardLast4}`
                                  : capitalize(payment.paymentMethod)}
                                {' · '}
                                {DateTime.fromISO(payment.dateISO).toLocaleString(DateTime.DATE_SHORT)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                            <Typography variant="body2" color="success.main">
                              -{formatUsd(payment.amountInCents / 100)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} sx={{ pt: '8px !important' }}>
                          <Typography variant="body2" fontWeight={700}>
                            Remaining Balance
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', pt: '8px !important' }}>
                          <Typography variant="body2" fontWeight={700}>
                            {formatUsd(remainingBalance)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}
              {!hasCptCodes && emPreviewRates.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Estimated service rates:
                  </Typography>
                  <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.25, px: 0 } }}>
                    <TableBody>
                      {emPreviewRates.map((rate) => (
                        <TableRow key={rate.code}>
                          <TableCell sx={{ width: '25%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {rate.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {rate.label}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                            <Typography variant="body2">{formatUsd(rate.amount)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No self-pay charge master configured.
            </Typography>
          )
        ) : isPayerVariant ? (
          paymentVariant === PaymentVariant.insurance && !insuranceData ? (
            <CircularProgress />
          ) : (
            <>
              {paymentVariant === PaymentVariant.insurance && insuranceData && (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                    {insuranceName && (
                      <Box sx={{ minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">
                          Carrier
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {insuranceName}
                        </Typography>
                      </Box>
                    )}
                    {formattedCopayAmount && copayAmount?.periodDescription && (
                      <Box sx={{ minWidth: 100 }}>
                        <Typography variant="caption" color="text.secondary">
                          Copay
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {`${formattedCopayAmount} / ${copayAmount.periodDescription}`}
                        </Typography>
                      </Box>
                    )}
                    {formattedRemainingDeductibleAmount && (
                      <Box sx={{ minWidth: 100 }}>
                        <Typography variant="caption" color="text.secondary">
                          Remaining Deductible
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formattedRemainingDeductibleAmount}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  {insuranceNotes && (
                    <Container
                      style={{
                        backgroundColor: '#2169F514',
                        borderRadius: 4,
                        marginTop: 5,
                        paddingTop: 10,
                        paddingBottom: 10,
                      }}
                    >
                      <Typography variant="body1" sx={{ color: theme.palette.primary.dark, fontWeight: 'bold' }}>
                        Notes
                      </Typography>
                      <Typography variant="body1" style={{ whiteSpace: 'pre' }}>
                        {insuranceNotes}
                      </Typography>
                    </Container>
                  )}
                </>
              )}
              {payerPricingLoading || !payerPricingFetched ? (
                <CircularProgress size={20} sx={{ mt: 1 }} />
              ) : activeFeeSchedule ? (
                <>
                  {isCaseRate && caseRateInfo ? (
                    <Box sx={{ mt: 1 }}>
                      {activeDescription && (
                        <Box sx={{ mb: 1, '& .tiptap': { outline: 'none' }, '& .tiptap p': { margin: 0 } }}>
                          <EditorContent editor={descriptionEditor} />
                        </Box>
                      )}
                      <Typography variant="body2" fontWeight={600}>
                        Case Rate: {formatUsd(caseRateInfo.amount)}
                      </Typography>
                      {caseRateInfo.comment && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {caseRateInfo.comment}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <>
                      {activeDescription ? (
                        <Box sx={{ mt: 1, '& .tiptap': { outline: 'none' }, '& .tiptap p': { margin: 0 } }}>
                          <EditorContent editor={descriptionEditor} />
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {activePricingType === 'fee-schedule'
                            ? 'Fee schedule rates apply.'
                            : activePricingType === 'payer-cm'
                            ? 'Payer charge master rates apply.'
                            : 'Default charge master rates apply.'}
                        </Typography>
                      )}
                      {lineItems.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            Services provided:
                          </Typography>
                          <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.25, px: 0 } }}>
                            <TableBody>
                              {lineItems.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell sx={{ width: '30%' }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {item.code}
                                      {item.modifier ? ` (${item.modifier})` : ''}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                      {item.description}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                                    <Typography variant="body2">{formatUsd(item.amount)}</Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {payments.map((payment) => (
                                <TableRow key={idForPaymentDTO(payment)}>
                                  <TableCell sx={{ width: '30%' }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      Payment
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      {payment.cardBrand && <CreditCardBrandIcon brand={payment.cardBrand} />}
                                      <Typography variant="body2" color="text.secondary">
                                        {payment.cardLast4
                                          ? `${capitalize(payment.cardBrand ?? 'Card')} •••• ${payment.cardLast4}`
                                          : capitalize(payment.paymentMethod)}
                                        {' · '}
                                        {DateTime.fromISO(payment.dateISO).toLocaleString(DateTime.DATE_SHORT)}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                                    <Typography variant="body2" color="success.main">
                                      -{formatUsd(payment.amountInCents / 100)}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell colSpan={2} sx={{ pt: '8px !important' }}>
                                  <Typography variant="body2" fontWeight={700}>
                                    Remaining Balance
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', pt: '8px !important' }}>
                                  <Typography variant="body2" fontWeight={700}>
                                    {formatUsd(remainingBalance)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                      {!hasCptCodes && emPreviewRates.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            Estimated service rates:
                          </Typography>
                          <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.25, px: 0 } }}>
                            <TableBody>
                              {emPreviewRates.map((rate) => (
                                <TableRow key={rate.code}>
                                  <TableCell sx={{ width: '25%' }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {rate.code}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                      {rate.label}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                                    <Typography variant="body2">{formatUsd(rate.amount)}</Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No pricing configured for this payer.
                </Typography>
              )}
            </>
          )
        ) : null}
        {paymentVariant === undefined &&
          (defaultCmLoading || !defaultCmFetched ? (
            <CircularProgress size={20} sx={{ mt: 1 }} />
          ) : defaultChargeMaster ? (
            <>
              {activeDescription && (
                <Box sx={{ mt: 1, '& .tiptap': { outline: 'none' }, '& .tiptap p': { margin: 0 } }}>
                  <EditorContent editor={descriptionEditor} />
                </Box>
              )}
              {lineItems.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Services provided:
                  </Typography>
                  <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.25, px: 0 } }}>
                    <TableBody>
                      {lineItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ width: '30%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {item.code}
                              {item.modifier ? ` (${item.modifier})` : ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {item.description}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                            <Typography variant="body2">{formatUsd(item.amount)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {payments.map((payment) => (
                        <TableRow key={idForPaymentDTO(payment)}>
                          <TableCell sx={{ width: '30%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              Payment
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {payment.cardBrand && <CreditCardBrandIcon brand={payment.cardBrand} />}
                              <Typography variant="body2" color="text.secondary">
                                {payment.cardLast4
                                  ? `${capitalize(payment.cardBrand ?? 'Card')} •••• ${payment.cardLast4}`
                                  : capitalize(payment.paymentMethod)}
                                {' · '}
                                {DateTime.fromISO(payment.dateISO).toLocaleString(DateTime.DATE_SHORT)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                            <Typography variant="body2" color="success.main">
                              -{formatUsd(payment.amountInCents / 100)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} sx={{ pt: '8px !important' }}>
                          <Typography variant="body2" fontWeight={700}>
                            Remaining Balance
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', pt: '8px !important' }}>
                          <Typography variant="body2" fontWeight={700}>
                            {formatUsd(remainingBalance)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}
              {!hasCptCodes && emPreviewRates.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Estimated service rates:
                  </Typography>
                  <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.25, px: 0 } }}>
                    <TableBody>
                      {emPreviewRates.map((rate) => (
                        <TableRow key={rate.code}>
                          <TableCell sx={{ width: '25%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {rate.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {rate.label}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', width: '20%' }}>
                            <Typography variant="body2">{formatUsd(rate.amount)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No default charge master configured.
            </Typography>
          ))}
        {/* Recommended collection amount */}
        {paymentVariant === PaymentVariant.insurance && recommendedCollection && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              backgroundColor: '#E3F2FD',
              borderRadius: 1,
              borderLeft: '4px solid #1565C0',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#1565C0', mb: 0.5 }}>
              {recommendedCollection.isPreService ? 'Recommended to Collect' : 'Estimated Patient Responsibility'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0D47A1' }}>
              {formatUsd(recommendedCollection.amount)}
            </Typography>
            <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {recommendedCollection.copay > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Copay: {formatUsd(recommendedCollection.copay)}
                </Typography>
              )}
              {recommendedCollection.deductibleRemaining > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Remaining deductible: {formatUsd(recommendedCollection.deductibleRemaining)}
                </Typography>
              )}
              {!recommendedCollection.isPreService && recommendedCollection.servicesTotal > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Services total: {formatUsd(recommendedCollection.servicesTotal)}
                </Typography>
              )}
              {totalPaid > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Already collected: {formatUsd(totalPaid)}
                </Typography>
              )}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}
            >
              {recommendedCollection.isPreService
                ? 'Based on copay from eligibility check. Final amount may vary once services are rendered.'
                : 'Estimate based on copay, remaining deductible, and services provided. Actual payer adjudication may differ.'}
            </Typography>
          </Box>
        )}
      </Container>
      {stripeCustomerDeletedError && <StripeErrorAlert />}
      {!stripeCustomerDeletedError && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
            <Typography variant="h5" color="primary.dark">
              Patient Payments
            </Typography>
            <GenericToolTip
              disableHoverListener={!cardOnFileKnown}
              customWidth={220}
              title={
                cardOnFileKnown ? (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      backgroundColor: 'transparent',
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.3px',
                        color: hasCreditCardOnFileFromList === true ? '#2E7D32' : '#8A1538',
                        backgroundColor: hasCreditCardOnFileFromList === true ? '#C8E6C9' : '#FFCDD2',
                      }}
                    >
                      {cardOnFileChipLabel}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#000000',
                        fontWeight: 500,
                      }}
                    >
                      {cardOnFileTooltipText}
                    </Typography>
                  </Box>
                ) : (
                  ''
                )
              }
            >
              <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center' }} aria-label={cardOnFileStatusLabel}>
                <svg width="38" height="38" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect
                    x="10"
                    y="12"
                    width="36"
                    height="30"
                    rx="5"
                    fill={cardOnFileStatusFill}
                    stroke={cardOnFileStatusStroke}
                    strokeWidth="2"
                  />
                  <rect x="15" y="18" width="26" height="5" rx="1" fill={cardOnFileStatusStroke} opacity="0.7" />
                  <rect x="15" y="27" width="12" height="4" rx="1" fill={cardOnFileStatusStroke} opacity="0.45" />
                  {cardOnFileKnown && hasCreditCardOnFileFromList === true ? (
                    <path
                      d="M31 31L34.5 34.5L41 28"
                      stroke={cardOnFileStatusStroke}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {cardOnFileKnown && hasCreditCardOnFileFromList === false ? (
                    <>
                      <path d="M32 28L40 36" stroke={cardOnFileStatusStroke} strokeWidth="2" strokeLinecap="round" />
                      <path d="M40 28L32 36" stroke={cardOnFileStatusStroke} strokeWidth="2" strokeLinecap="round" />
                    </>
                  ) : null}
                </svg>
              </Box>
            </GenericToolTip>
          </Box>
          <Table size="small" style={{ tableLayout: 'fixed' }}>
            <TableBody>
              {payments.length === 0 && !loading && (
                <TableRow>
                  <TableCell sx={{ paddingTop: 1, paddingBottom: 1 }}>
                    <Typography variant="body1" color="textSecondary">
                      No payments recorded.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {payments.map((payment) => {
                const paymentDateString = DateTime.fromISO(payment.dateISO).toLocaleString(DateTime.DATE_SHORT);
                const formattedPaymentAmount = formatUsd(payment.amountInCents / 100) ?? '$0.00';
                return (
                  <Fragment key={idForPaymentDTO(payment)}>
                    <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <>
                        <TableCell
                          sx={{
                            width: '50%',
                            color: theme.palette.primary.dark,
                            paddingLeft: 0,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                            {getLabelForPayment(payment)}
                          </Box>
                        </TableCell>

                        <TableCell
                          colSpan={2}
                          sx={{
                            textAlign: 'center',
                            wordWrap: 'break-word',
                            paddingRight: 0,
                            paddingTop: 0,
                            fontSize: '12px',
                          }}
                        >
                          {paymentDateString}
                        </TableCell>

                        <TableCell
                          sx={{
                            textAlign: 'right',
                            wordWrap: 'break-word',
                            paddingRight: 0,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {loading ? (
                              <Skeleton aria-busy="true" width={200} />
                            ) : (
                              <Typography variant="body1">{formattedPaymentAmount}</Typography>
                            )}
                          </Box>
                        </TableCell>
                      </>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <Button sx={{ marginTop: 2 }} onClick={() => setPaymentDialogOpen(true)} variant="contained" color="primary">
            $ Add Payment
          </Button>
          <Tooltip
            disableHoverListener={receiptDocRefId !== undefined}
            placement="top"
            title="Patient doesn't have any receipt for this encounter"
          >
            <span>
              <Button
                sx={{ mt: 2, ml: 2 }}
                disabled={!receiptDocRefId || isReceiptFetching}
                onClick={() => setSendReceiptByEmailDialogOpen(true)}
                variant="contained"
                color="primary"
              >
                Email receipt
              </Button>
            </span>
          </Tooltip>
        </>
      )}
      {patient && (
        <PaymentDialog
          open={paymentDialogOpen}
          patient={patient}
          encounterId={encounterId}
          appointmentId={appointment?.id}
          handleClose={handlePaymentDialogClose}
          isSubmitting={createNewPayment.isPending}
          onTerminalPaymentSuccess={async () => {
            await refetchPaymentList();
          }}
          submitPayment={async (data: CashOrCardPayment) => {
            const postInput: PostPatientPaymentInput = {
              patientId: patient.id ?? '',
              encounterId,
              paymentDetails: data,
            };
            await createNewPayment.mutateAsync(postInput);
          }}
        />
      )}
      <SendReceiptByEmailDialog
        title="Send receipt"
        modalOpen={sendReceiptByEmailDialogOpen}
        handleClose={() => setSendReceiptByEmailDialogOpen(false)}
        onSubmit={sendReceipt}
        submitButtonName="Send Receipt"
        defaultValues={{
          recipientName: responsibleParty?.fullName,
          recipientEmail: responsibleParty?.email,
        }}
      />
      <Snackbar
        // anchorOrigin={{ vertical: snackbarOpen.vertical, horizontal: snackbarOpen.horizontal }}
        open={errorMessage !== null}
        autoHideDuration={6000}
        onClose={() => createNewPayment.reset()}
      >
        <Alert severity="error" onClose={() => createNewPayment.reset()} sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

const StripeErrorAlert: FC = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        backgroundColor: theme.palette.common.white,
        borderColor: theme.palette.error.dark,
        borderWidth: 1,
        borderStyle: 'solid',
        marginTop: 2,
        padding: 2,
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Typography
        sx={{
          color: theme.palette.error.dark,
        }}
      >
        The Stripe customer ID associated with this account does not exist and may have been deleted. Collection of
        payments will be disabled until this issue is resolved. Please report the issue.
      </Typography>
    </Box>
  );
};
