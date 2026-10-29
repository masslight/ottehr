import { Add } from '@mui/icons-material';
import { Box, Button, Divider, FormHelperText, Stack, Typography, useTheme } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createPrescriptionQuickPick } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useMergedPrescriptionQuickPicks, useMergedPrescriptionSetQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { getFirstName } from 'utils/lib/fhir/patient';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { OrderPrescriptionInput } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionSetQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { SectionHeading } from '../../../shared/components/NoteSectionHeading';
import { AllergiesContainer } from '../../../shared/components/review-tab/components/AllergiesContainer';
import { MedicationsContainer } from '../../../shared/components/review-tab/components/MedicationsContainer';
import { useChartData } from '../../../shared/hooks/useChartData';
import { useChartSection } from '../../../shared/hooks/useChartSection';
import { usePreferredPharmacy } from '../../../shared/hooks/useErxPharmacies';
import { useGetAppointmentAccessibility } from '../../../shared/hooks/useGetAppointmentAccessibility';
import { useOrderPrescription } from '../../../shared/hooks/useOrderPrescription';
import { useAppointmentData, useSaveChartData } from '../../../shared/stores/appointment/appointment.store';
import { PopoverBlank, Sentence } from '../procedures/narrative/InlineBlanks';
import { ProcedureQuickPickDialogs } from '../procedures/ProcedureQuickPickDialogs';
import { calculatorWeightKg, previousVisitWeightNote } from './DoseCalculator';
import { PharmacySearch } from './PharmacySearch';
import { patientAddressAndPhone } from './prescriptionDialogs';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  quickPickDosingText,
  quickPickNameInUse,
  quickPickProductMissing,
  suggestedQuickPickName,
} from './prescriptionLines';
import { PrescriptionSentences } from './PrescriptionSentences';
import { missingSetMembersText, withListedQuickPick, withPrescriptionSet } from './prescriptionSuggestions';
import { useVisitHeight, useVisitWeight } from './useVisitWeight';

// Layout from the procedure page: the side column sits beside the form once the page is wide enough.
const SIDE_COLUMN_WIDTH = 340;
const SIDE_COLUMN_MIN_WIDTH = 280;
const FORM_COLUMN_MIN_WIDTH = 420;
const COLUMN_GAP_PX = 16;
const SIDE_COLUMN_QUERY = `@container (min-width: ${FORM_COLUMN_MIN_WIDTH + COLUMN_GAP_PX + SIDE_COLUMN_MIN_WIDTH}px)`;

interface OrderPrescriptionFormProps {
  /** Outside a visit (a refill request): the patient, and the visit the prescription is saved to and its vitals,
   * charted diagnoses, allergies and medications are read from, in place of the page's. The signed-visit lock and the
   * chart's diagnoses being added to don't apply. */
  visit?: { patient: Patient; encounterId: string };
  /** The one prescription the form starts with; "Add another" is then hidden. */
  initialLine?: PrescriptionLine;
  /** The pharmacy that asked, which can't be changed. */
  pharmacy?: PharmacySearchResult;
  /** Sends the prescription in place of ordering it (the answer to a pharmacy's request). */
  onSend?: (line: PrescriptionLine, order: OrderPrescriptionInput) => Promise<void>;
  sendLabel?: string;
  /** After every prescription went, with the pharmacy it went to. */
  onSent?: (pharmacy: PharmacySearchResult) => void;
}

export const OrderPrescriptionForm: FC<OrderPrescriptionFormProps> = ({
  visit,
  initialLine,
  pharmacy: fixedPharmacy,
  onSend,
  sendLabel,
  onSent,
}) => {
  const theme = useTheme();
  const appointmentData = useAppointmentData();
  const patient = visit?.patient ?? appointmentData.patient;
  const encounterId = visit?.encounterId ?? appointmentData.encounter?.id;
  const patientContact = patientAddressAndPhone(patient);
  const weight = useVisitWeight(visit?.encounterId);
  // A weight typed in any line's dose calculator stands in for the vitals' everywhere on the page.
  const [weightText, setWeightText] = useState<string>();
  const weightKg = calculatorWeightKg(weightText, weight);
  const height = useVisitHeight(visit?.encounterId);
  const user = useEvolveUser();
  const isAdmin = user?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const readOnly = !visit && isAppointmentReadOnly;
  const { oystehrZambda } = useApiClients();
  const { mutateAsync: orderPrescription } = useOrderPrescription();
  const chartVisit = visit ? { encounterId: visit.encounterId } : {};
  const { data: plan, refetch: refetchPrescriptions } = useChartSection('plan', chartVisit);
  const { chartData, setPartialChartData } = useChartData(chartVisit);
  const { mutateAsync: saveChartData } = useSaveChartData();
  const visitDiagnoses = chartData?.diagnosis ?? [];
  const { quickPicks, refetch: refetchQuickPicks } = useMergedPrescriptionQuickPicks();
  const { quickPicks: sets } = useMergedPrescriptionSetQuickPicks();

  const [lines, setLines] = useState<PrescriptionLine[]>(() => [initialLine ?? emptyPrescriptionLine()]);
  const [sendAttempted, setSendAttempted] = useState(false);
  const [sending, setSending] = useState(false);

  // Until a pharmacy is picked (or after Clear Form), the line reads the saved one, when it matches the directory.
  const savedPharmacy = plan?.preferredPharmacies?.find((item) => item.primary) ?? plan?.preferredPharmacies?.[0];
  const { data: preferredPharmacy } = usePreferredPharmacy(patient?.id, savedPharmacy);
  const [pickedPharmacy, setPickedPharmacy] = useState<PharmacySearchResult | null>(null);
  const pharmacy = fixedPharmacy ?? pickedPharmacy ?? preferredPharmacy ?? null;
  // The pharmacies this patient's prescriptions went to, once each.
  const sentBefore = (plan?.prescribedMedications ?? []).flatMap((item, i, all) =>
    item.pharmacyId && all.findIndex((other) => other.pharmacyId === item.pharmacyId) === i
      ? [{ ncpdpId: item.pharmacyId, name: item.pharmacyName }]
      : []
  );

  const [quickPickLineKey, setQuickPickLineKey] = useState<number | null>(null);
  const [quickPickName, setQuickPickName] = useState('');
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  const [quickPickNameError, setQuickPickNameError] = useState<string>();

  const updateLine = (key: number, next: PrescriptionLine): void =>
    setLines((current) => current.map((line) => (line.key === key ? next : line)));

  /** A set's quick picks in place of the line and after it; a quick pick deleted since is left out, with a notice. */
  const applySet = (
    line: PrescriptionLine,
    set: PrescriptionSetQuickPickData,
    used?: { line: PrescriptionLine; memberId: string }
  ): void => {
    const { lines: next, missing } = withPrescriptionSet(line, set, quickPicks, weightKg, used);
    setLines((current) => current.flatMap((item) => (item.key === line.key ? next : [item])));
    if (missing) enqueueSnackbar(missingSetMembersText(missing), { variant: 'warning' });
  };

  const clearForm = (): void => {
    setLines([emptyPrescriptionLine()]);
    setPickedPharmacy(null);
    setSendAttempted(false);
  };

  /** One chart save for every new diagnosis: the visit's first diagnosis becomes its primary one. */
  const addDiagnosesToVisit = async (diagnoses: { code: string; display: string }[]): Promise<void> => {
    const existing = chartData?.diagnosis ?? [];
    const fresh = diagnoses.filter(
      (diagnosis, i) =>
        diagnoses.findIndex((other) => other.code === diagnosis.code) === i &&
        !existing.some((item) => item.code === diagnosis.code)
    );
    if (!fresh.length || visit) return;
    const hasPrimary = existing.some((item) => item.isPrimary);
    const prepared = fresh.map((diagnosis, i) => ({ ...diagnosis, isPrimary: !hasPrimary && i === 0 }));
    try {
      const saved = await saveChartData({ diagnosis: prepared });
      setPartialChartData({ diagnosis: [...existing, ...(saved.chartData.diagnosis ?? [])] });
    } catch (error) {
      console.error(`Error adding prescription diagnoses to the visit: ${error}`);
      enqueueSnackbar('The prescription diagnosis could not be added to the visit. Please add it on the Assessment.', {
        variant: 'warning',
      });
    }
  };

  // The order endpoint takes one prescription, so each line is sent in turn; a sent line leaves the form, so a
  // failure part-way leaves exactly the unsent ones to try again.
  const send = async (): Promise<void> => {
    setSendAttempted(true);
    if (!pharmacy || lines.some((line) => prescriptionLineErrors(line).length > 0)) return;
    const practitionerId = user?.profileResource?.id;
    if (!patient?.id || !encounterId || !practitionerId) {
      enqueueSnackbar('The patient, encounter or provider could not be determined. Please reload and try again.', {
        variant: 'error',
      });
      return;
    }
    // The written date isn't shown: a prescription is always written today.
    const writtenDate = DateTime.local().toISODate() ?? '';
    const measuredDate = (takenAt?: string): string =>
      (takenAt && DateTime.fromISO(takenAt).toLocal().toISODate()) || writtenDate;
    const context = {
      patientId: patient.id,
      practitionerId,
      encounterId,
      pharmacy,
      writtenDate,
      patientHeight: height && { cm: height.cm, measuredDate: measuredDate(height.takenAt) },
      // A weight typed in the dose calculator is today's, in place of the vitals'.
      patientWeight:
        weightKg === undefined
          ? undefined
          : { kg: weightKg, measuredDate: weightText === undefined ? measuredDate(weight?.takenAt) : writtenDate },
    };
    setSending(true);
    const sent: PrescriptionLine[] = [];
    try {
      for (const line of lines) {
        if (onSend) await onSend(line, prescriptionLineToOrder(line, context));
        else await orderPrescription(prescriptionLineToOrder(line, context));
        sent.push(line);
        setLines((current) => current.filter((item) => item.key !== line.key));
      }
      enqueueSnackbar(sent.length === 1 ? 'Prescription sent' : `${sent.length} prescriptions sent`, {
        variant: 'success',
      });
      setLines([emptyPrescriptionLine()]);
      setSendAttempted(false);
      onSent?.(pharmacy);
    } catch (error) {
      console.error(`Error ordering prescription: ${error}`);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'An error occurred while sending the prescription. Please try again.';
      enqueueSnackbar(sent.length ? `${sent.length} of ${lines.length} prescriptions sent. ${message}` : message, {
        variant: 'error',
      });
    } finally {
      setSending(false);
      await addDiagnosesToVisit(sent.flatMap((line) => (line.diagnosis ? [line.diagnosis] : [])));
      if (sent.length) await refetchPrescriptions();
    }
  };

  // Only adds: existing quick picks are edited in Admin → Quick Picks. Every quick pick orders a product or a compound.
  const openQuickPickDialog = (line: PrescriptionLine): void => {
    const noProduct = quickPickProductMissing(line);
    if (noProduct) {
      enqueueSnackbar(noProduct, { variant: 'error' });
      return;
    }
    setQuickPickName(suggestedQuickPickName(line));
    setQuickPickNameError(undefined);
    setQuickPickLineKey(line.key);
  };

  const onSaveAsQuickPick = async (): Promise<void> => {
    const line = lines.find((item) => item.key === quickPickLineKey);
    // A line hidden while it waits for a pick (its product changed after the dialog opened) holds text nobody has seen.
    if (!oystehrZambda || !line || line.awaitingPick) return;
    if (!quickPickName.trim()) {
      enqueueSnackbar('Quick pick name is required', { variant: 'error' });
      return;
    }
    // Only adds: a name already in use is edited in Admin, never saved over.
    const nameInUse = quickPickNameInUse(quickPickName, quickPicks);
    if (nameInUse) {
      setQuickPickNameError(nameInUse);
      return;
    }
    setQuickPickSaving(true);
    try {
      const quickPickData = prescriptionLineToQuickPick(line, quickPickName);
      await createPrescriptionQuickPick(oystehrZambda, { quickPick: quickPickData });
      enqueueSnackbar(`Quick pick "${quickPickName}" created`, { variant: 'success' });
      setQuickPickLineKey(null);
      void refetchQuickPicks();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to save quick pick' }), { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

  const isPreferred = pharmacy != null && preferredPharmacy?.ncpdpId === pharmacy.ncpdpId;
  // What the quick pick keeps from the calculator, for the save dialog to say.
  const quickPickLine = lines.find((item) => item.key === quickPickLineKey);
  const savedDosing = quickPickLine && prescriptionLineToQuickPick(quickPickLine, quickPickName).dosing;

  return (
    <>
      <Box sx={{ containerType: 'inline-size' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: `${COLUMN_GAP_PX}px`,
            alignItems: 'start',
            [SIDE_COLUMN_QUERY]: {
              gridTemplateColumns: `minmax(${FORM_COLUMN_MIN_WIDTH}px, 1fr) minmax(${SIDE_COLUMN_MIN_WIDTH}px, ${SIDE_COLUMN_WIDTH}px)`,
            },
          }}
        >
          <AccordionCard>
            <Stack spacing={1.5} style={{ padding: '24px' }}>
              <Typography
                component="h3"
                sx={{
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: theme.palette.primary.dark,
                }}
              >
                Pharmacy
              </Typography>
              <Sentence>
                Send to{' '}
                <PopoverBlank
                  label="pharmacy"
                  title="Pharmacy"
                  // The search's own field says "Pharmacy".
                  hideTitle
                  value={pharmacy?.name}
                  need
                  readOnly={readOnly || !!fixedPharmacy}
                >
                  {(close) => (
                    <PharmacySearch
                      onPick={(next) => {
                        setPickedPharmacy(next);
                        close();
                      }}
                      onFile={
                        savedPharmacy && {
                          firstName: patient && getFirstName(patient),
                          saved: savedPharmacy,
                          pharmacy: preferredPharmacy,
                        }
                      }
                      sentBefore={sentBefore}
                    />
                  )}
                </PopoverBlank>
                {pharmacy && (
                  <>
                    {isPreferred && ' (preferred)'},{' '}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {[pharmacy.address, formatPhoneNumberDisplay(pharmacy.phone)].filter(Boolean).join(' · ')}
                    </Box>
                  </>
                )}
                .
              </Sentence>
              {sendAttempted && !pharmacy && (
                <FormHelperText error sx={{ mt: '-8px' }}>
                  Pick a pharmacy.
                </FormHelperText>
              )}

              <Typography
                component="h3"
                sx={{
                  fontSize: '12px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: theme.palette.primary.dark,
                }}
              >
                Prescriptions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {lines.map((line, index) => (
                  <PrescriptionSentences
                    key={line.key}
                    line={line}
                    index={index}
                    onChange={(next) => updateLine(line.key, next)}
                    onRemove={
                      lines.length > 1
                        ? () => setLines((current) => current.filter((item) => item.key !== line.key))
                        : undefined
                    }
                    quickPicks={quickPicks}
                    onQuickPick={(quickPick) => updateLine(line.key, withListedQuickPick(line, quickPick, weightKg))}
                    sets={sets}
                    onSet={(set, used) => applySet(line, set, used)}
                    onSaveQuickPick={isAdmin ? () => openQuickPickDialog(line) : undefined}
                    visitDiagnoses={visitDiagnoses}
                    weightKg={weightKg}
                    weightNote={previousVisitWeightNote(weightText, weight)}
                    weight={weight}
                    weightText={weightText}
                    onWeightText={setWeightText}
                    errors={sendAttempted ? prescriptionLineErrors(line) : []}
                    readOnly={readOnly}
                  />
                ))}
              </Box>
              {!readOnly && !initialLine && (
                <Button
                  size="small"
                  startIcon={<Add />}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                  onClick={() => setLines((current) => [...current, emptyPrescriptionLine()])}
                >
                  Add another prescription
                </Button>
              )}

              <Divider orientation="horizontal" />

              <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                <RoundedButton color="primary" onClick={clearForm} disabled={readOnly || sending}>
                  Clear Form
                </RoundedButton>
                <RoundedButton
                  color="primary"
                  variant="contained"
                  disabled={readOnly}
                  loading={sending}
                  onClick={() => void send()}
                >
                  {sendLabel ?? (lines.length === 1 ? 'Send Prescription' : `Send ${lines.length} Prescriptions`)}
                </RoundedButton>
              </Box>
            </Stack>
          </AccordionCard>

          <Box sx={{ [SIDE_COLUMN_QUERY]: { position: 'sticky', top: 16 } }}>
            <AccordionCard>
              <Stack spacing={1.5} style={{ padding: '24px' }}>
                {/* Read-only: what the visit header doesn't show of what's sent about the patient. */}
                {(patientContact.address || patientContact.phone) && (
                  <Box>
                    <SectionHeading>Contact Info</SectionHeading>
                    {patientContact.address && (
                      <Typography>
                        <Box component="span" color="text.secondary">
                          Address:
                        </Box>{' '}
                        {patientContact.address}
                      </Typography>
                    )}
                    {patientContact.phone && (
                      <Typography>
                        <Box component="span" color="text.secondary">
                          Phone:
                        </Box>{' '}
                        {patientContact.phone}
                      </Typography>
                    )}
                  </Box>
                )}
                <AllergiesContainer encounterId={visit?.encounterId} />
                <MedicationsContainer encounterId={visit?.encounterId} />
              </Stack>
            </AccordionCard>
          </Box>
        </Box>
      </Box>

      <ProcedureQuickPickDialogs
        open={quickPickLineKey != null}
        name={quickPickName}
        onNameChange={(name) => {
          setQuickPickName(name);
          setQuickPickNameError(undefined);
        }}
        existingQuickPicks={[]}
        saving={quickPickSaving}
        onClose={() => setQuickPickLineKey(null)}
        onSave={() => void onSaveAsQuickPick()}
        subject="prescription"
        details={savedDosing && quickPickDosingText(savedDosing)}
        placeholder="Quick pick name"
        nameError={quickPickNameError}
      />
    </>
  );
};
