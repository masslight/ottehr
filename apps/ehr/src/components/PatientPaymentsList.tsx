import {
  Alert,
  Box,
  Button,
  capitalize,
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
import { useMutation } from '@tanstack/react-query';
import { Markdown as TiptapMarkdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Appointment, ChargeItemDefinition, DocumentReference, Encounter, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, Fragment, ReactElement, useEffect, useMemo, useState } from 'react';
import { getEligibilityCheckDetailsForCoverage } from 'src/features/visits/shared/components/patient/InsuranceSection';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { useEncounterReceipt, useGetEncounter } from 'src/hooks/useEncounter';
import { useGetPatientAccount } from 'src/hooks/useGetPatient';
import { useGetChargeMasterEntryQuery } from 'src/rcm/state/charge-masters/charge-master.queries';
import { CreditCardBrandIcon } from 'ui-components';
import {
  APIError,
  APIErrorCode,
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
    for (const pg of feeSchedule.propertyGroup) {
      const pc = pg.priceComponent?.[0];
      if (!pc) continue;
      const fsCoding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
      if (!fsCoding || fsCoding.code !== cpt.code) continue;
      const fsModifier = pc.extension?.find((ext) => ext.url === CPT_MODIFIER_EXTENSION_URL)?.valueCode;
      const cptModifier = cpt.modifier?.[0]?.code;
      if ((fsModifier || '') !== (cptModifier || '')) continue;
      items.push({
        code: cpt.code,
        modifier: cptModifier,
        description: cpt.display || fsCoding.display || '',
        amount: pc.amount?.value ?? 0,
      });
      break;
    }
  }

  return items;
}

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
  const [hasCreditCardOnFileFromList, setHasCreditCardOnFileFromList] = useState<boolean>(false);
  const [cardOnFileKnown, setCardOnFileKnown] = useState<boolean>(false);

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

  const {
    data: selfPayResult,
    isLoading: selfPayLoading,
    isFetched: selfPayFetched,
  } = useGetChargeMasterEntryQuery(paymentVariant === PaymentVariant.selfPay ? 'self-pay' : undefined);
  const selfPayFeeSchedule = selfPayResult?.chargeMaster;
  const selfPayChargeDescription = selfPayFeeSchedule?.description || '';

  const {
    data: insurancePayResult,
    isLoading: insurancePayLoading,
    isFetched: insurancePayFetched,
  } = useGetChargeMasterEntryQuery(
    paymentVariant === PaymentVariant.insurance ? 'insurance-pay' : undefined,
    insuranceOrgId
  );
  const insuranceFeeSchedule = insurancePayResult?.chargeMaster;
  const insuranceFeeScheduleSource = insurancePayResult?.source;
  const insuranceFeeScheduleDescription = insuranceFeeSchedule?.description || '';

  const selfPayDescriptionEditor = useEditor({
    extensions: [StarterKit, TiptapMarkdown],
    editable: false,
    content: '',
  });

  const insuranceFeeScheduleEditor = useEditor({
    extensions: [StarterKit, TiptapMarkdown],
    editable: false,
    content: '',
  });

  useEffect(() => {
    if (selfPayDescriptionEditor && selfPayChargeDescription) {
      selfPayDescriptionEditor.commands.setContent(selfPayChargeDescription, {
        contentType: 'markdown',
        emitUpdate: false,
      });
    }
  }, [selfPayDescriptionEditor, selfPayChargeDescription]);

  useEffect(() => {
    if (insuranceFeeScheduleEditor && insuranceFeeScheduleDescription) {
      insuranceFeeScheduleEditor.commands.setContent(insuranceFeeScheduleDescription, {
        contentType: 'markdown',
        emitUpdate: false,
      });
    }
  }, [insuranceFeeScheduleEditor, insuranceFeeScheduleDescription]);

  const { chartData } = useChartData({ encounterId });

  const activeFeeSchedule = paymentVariant === PaymentVariant.selfPay ? selfPayFeeSchedule : insuranceFeeSchedule;

  const lineItems = useMemo(
    () => buildLineItems(activeFeeSchedule, chartData?.cptCodes, chartData?.emCode),
    [activeFeeSchedule, chartData?.cptCodes, chartData?.emCode]
  );

  const lineItemsTotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.amount, 0), [lineItems]);

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

  useEffect(() => {
    let cancelled = false;

    const getBooleanFlag = (candidate: unknown): boolean | undefined => {
      if (typeof candidate === 'boolean') {
        return candidate;
      }
      return undefined;
    };

    const deriveCardOnFileStatus = (output: unknown): boolean => {
      if (!output || typeof output !== 'object') {
        return false;
      }

      const response = output as Record<string, unknown>;
      if (!Array.isArray(response.cards)) {
        return false;
      }

      const allCards = response.cards as unknown[];
      if (allCards.length === 0) {
        return false;
      }

      let hasAnyDefaultFlag = false;
      let hasDefaultOrPrimary = false;

      allCards.forEach((card) => {
        if (!card || typeof card !== 'object') {
          return;
        }

        const cardObj = card as Record<string, unknown>;
        const possibleFlags = [
          cardObj.default,
          cardObj.isDefault,
          cardObj.is_default,
          cardObj.primary,
          cardObj.isPrimary,
          cardObj.is_primary,
        ];

        possibleFlags.forEach((flag) => {
          const boolFlag = getBooleanFlag(flag);
          if (boolFlag !== undefined) {
            hasAnyDefaultFlag = true;
            if (boolFlag) {
              hasDefaultOrPrimary = true;
            }
          }
        });
      });

      if (hasAnyDefaultFlag) {
        return hasDefaultOrPrimary;
      }

      return true;
    };

    const fetchCardStatus = async (): Promise<void> => {
      if (!oystehrZambda || !patient?.id) {
        setCardOnFileKnown(false);
        setHasCreditCardOnFileFromList(false);
        return;
      }

      try {
        const result = await oystehrZambda.zambda.execute({
          id: 'payment-methods-list',
          beneficiaryPatientId: patient.id,
          appointmentId: appointment?.id,
        });

        const derivedStatus = deriveCardOnFileStatus(result.output);
        if (!cancelled) {
          setHasCreditCardOnFileFromList(derivedStatus);
          setCardOnFileKnown(true);
        }
      } catch (error) {
        console.error('Failed to determine card-on-file status from payment-methods-list', error);
        if (!cancelled) {
          setCardOnFileKnown(false);
          setHasCreditCardOnFileFromList(false);
        }
      }
    };

    void fetchCardStatus();

    return () => {
      cancelled = true;
    };
  }, [oystehrZambda, patient?.id, appointment?.id]);

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
      if (!oystehrZambda) return;

      await oystehrZambda.zambda.execute({
        id: 'patient-payments-post',
        ...input,
      });
    },
    onSuccess: async () => {
      await refetchPaymentList();
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

      await waitForReceipt();

      setPaymentDialogOpen(false);
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
        value={paymentVariant ?? null}
        onChange={async (_e, newValue) => {
          if (newValue !== null && encounter) {
            await updateEncounter.mutateAsync(
              updateEncounterPaymentVariantExtension(encounter, newValue as PaymentVariant)
            );
          }
        }}
        sx={{
          mt: 2,
          backgroundColor: theme.palette.grey[200],
          borderRadius: '8px',
          padding: '3px',
          gap: 0,
          '& .MuiToggleButtonGroup-grouped': {
            border: 'none',
            '&:not(:first-of-type)': { borderRadius: '6px', marginLeft: '2px' },
            '&:first-of-type': { borderRadius: '6px' },
          },
        }}
      >
        {isUrgentCare ? (
          <ToggleButton
            disabled={updateEncounter.isPending || isEncounterRefetching}
            value={PaymentVariant.insurance}
            sx={{
              px: 3,
              py: 0.75,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '14px',
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                backgroundColor: theme.palette.common.white,
                color: theme.palette.primary.main,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                '&:hover': { backgroundColor: theme.palette.common.white },
              },
              '&:hover': { backgroundColor: 'transparent' },
            }}
          >
            Insurance
          </ToggleButton>
        ) : null}
        <ToggleButton
          disabled={updateEncounter.isPending || isEncounterRefetching}
          value={PaymentVariant.selfPay}
          sx={{
            px: 3,
            py: 0.75,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '14px',
            color: theme.palette.text.secondary,
            '&.Mui-selected': {
              backgroundColor: theme.palette.common.white,
              color: theme.palette.primary.main,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              '&:hover': { backgroundColor: theme.palette.common.white },
            },
            '&:hover': { backgroundColor: 'transparent' },
          }}
        >
          Self Pay
        </ToggleButton>
        {isOccupationalMedicine || isWorkmansComp ? (
          <ToggleButton
            disabled={updateEncounter.isPending || isEncounterRefetching}
            value={PaymentVariant.employer}
            sx={{
              px: 3,
              py: 0.75,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '14px',
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                backgroundColor: theme.palette.common.white,
                color: theme.palette.primary.main,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                '&:hover': { backgroundColor: theme.palette.common.white },
              },
              '&:hover': { backgroundColor: 'transparent' },
            }}
          >
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
        <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
          Payment Considerations
        </Typography>
        {paymentVariant === PaymentVariant.selfPay ? (
          selfPayLoading || !selfPayFetched ? (
            <CircularProgress size={20} sx={{ mt: 1 }} />
          ) : selfPayFeeSchedule ? (
            <>
              {selfPayChargeDescription ? (
                <Box sx={{ mt: 1, '& .tiptap': { outline: 'none' }, '& .tiptap p': { margin: 0 } }}>
                  <EditorContent editor={selfPayDescriptionEditor} />
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Self-pay rates apply.
                </Typography>
              )}
              {lineItems.length > 0 && (
                <Box sx={{ mt: 2 }}>
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
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No self-pay charge master configured.
            </Typography>
          )
        ) : insuranceData ? (
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
            {insurancePayLoading || !insurancePayFetched ? (
              <CircularProgress size={20} sx={{ mt: 1 }} />
            ) : insuranceFeeSchedule ? (
              <>
                {insuranceFeeScheduleDescription ? (
                  <Box sx={{ mt: 1, '& .tiptap': { outline: 'none' }, '& .tiptap p': { margin: 0 } }}>
                    <EditorContent editor={insuranceFeeScheduleEditor} />
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {insuranceFeeScheduleSource === 'payer' ? 'Insurance rates apply.' : 'Chargemaster rates apply.'}
                  </Typography>
                )}
                {lineItems.length > 0 && (
                  <Box sx={{ mt: 2 }}>
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
              </>
            ) : null}
          </>
        ) : (
          <CircularProgress />
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
          handleClose={() => setPaymentDialogOpen(false)}
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
