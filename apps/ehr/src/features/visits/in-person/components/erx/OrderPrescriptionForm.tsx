import { Add } from '@mui/icons-material';
import { Box, Button, Divider, FormHelperText, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useRef, useState } from 'react';
import { createPrescriptionQuickPick } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useMergedPrescriptionQuickPicks, useMergedPrescriptionSetQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { getFirstName } from 'utils/lib/fhir/patient';
import { directoryPharmacyToResult } from 'utils/lib/helpers/erx-pharmacy-match';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  ErxSavedForm,
  erxSavedFormIsEmpty,
  ErxSavedFormResponse,
  erxSavedLineHasContent,
} from 'utils/lib/types/api/erx.types';
import { PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { OrderPrescriptionInput } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionSetQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { SectionHeading } from '../../../shared/components/NoteSectionHeading';
import { QuickPickSaveDialogs } from '../../../shared/components/QuickPickSaveDialogs';
import { AllergiesContainer } from '../../../shared/components/review-tab/components/AllergiesContainer';
import { MedicationsContainer } from '../../../shared/components/review-tab/components/MedicationsContainer';
import { useChartData } from '../../../shared/hooks/useChartData';
import { useChartSection } from '../../../shared/hooks/useChartSection';
import { usePharmaciesByNcpdpId, usePreferredPharmacy } from '../../../shared/hooks/useErxPharmacies';
import { useGetAppointmentAccessibility } from '../../../shared/hooks/useGetAppointmentAccessibility';
import { useOrderPrescription } from '../../../shared/hooks/useOrderPrescription';
import { useAppointmentData, useSaveChartData } from '../../../shared/stores/appointment/appointment.store';
import { PopoverBlank, Sentence } from '../procedures/narrative/InlineBlanks';
import { calculatorWeightKg, previousVisitWeightNote } from './DoseCalculator';
import { PharmacySearch } from './PharmacySearch';
import { patientAddressAndPhone } from './prescriptionDialogs';
import {
  controlledDrugErrors,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  prescriptionVitals,
  quickPickDosingText,
  quickPickNameInUse,
  quickPickProductMissing,
  suggestedQuickPickName,
  withNewKeys,
} from './prescriptionLines';
import { PrescriptionSentences } from './PrescriptionSentences';
import { missingSetMembersText, withListedQuickPick, withPrescriptionSet } from './prescriptionSuggestions';
import { refillLine } from './refillRequest';
import { useReorderPrescriptionStore } from './reorderPrescription.store';
import {
  useErxSendDataFailed,
  useErxSendDataLoading,
  useVisitAllergies,
  useVisitHeight,
  useVisitWeight,
} from './useVisitWeight';

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
  /** Line problems of that answer, beside the order form's own. */
  sendLineErrors?: (line: PrescriptionLine) => string[];
  sendLabel?: string;
  /** After every prescription went, with the pharmacy it went to. */
  onSent?: (pharmacy: PharmacySearchResult) => void;
  /** No "Prescription sent" toast of its own: `onSent` says what went out. */
  quietSent?: boolean;
  /** The patient's address and phone are shown by the caller. */
  hidePatientInfo?: boolean;
  /** Whoever is signed in isn't enrolled with Surescripts: they can save the form for a provider, not send it. */
  notEnrolled?: boolean;
  /** The visit's form saved for a provider to send (requirement 53b), which the form starts with. */
  saved?: ErxSavedFormResponse['saved'];
  /** Saves the form in place of the saved one ("Save"); an empty form removes it. */
  onSaveForm?: (form: ErxSavedForm) => Promise<ErxSavedFormResponse>;
}

/** Why the form's buttons are off on a signed visit; the Reorder action says the same. */
const SIGNED = 'The visit is signed';

/** The form as the server saves it: its lines as they are, unfinished ones too (requirement 53c). */
const toSavedForm = (lines: PrescriptionLine[], pharmacy: PharmacySearchResult | null): ErxSavedForm => ({
  pharmacy,
  lines: lines as unknown as ErxSavedForm['lines'],
});

/** "Saved by Jamie Rivera, 11/18/2026 12:31 PM", in the browser's time zone. */
const savedByText = ({ savedBy, savedAt }: { savedBy?: string; savedAt?: string }): string => {
  const at = formatDateToMDYWithTime(savedAt, DateTime.local().zoneName);
  return `${savedBy ? `Saved by ${savedBy}` : 'Saved'}${at ? `, ${at.date} ${at.time}` : ''}`;
};
export const OrderPrescriptionForm: FC<OrderPrescriptionFormProps> = ({
  visit,
  initialLine,
  pharmacy: fixedPharmacy,
  onSend,
  sendLineErrors,
  sendLabel,
  onSent,
  quietSent,
  hidePatientInfo,
  notEnrolled,
  saved,
  onSaveForm,
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
  const allergies = useVisitAllergies(visit?.encounterId);
  // Sending waits for what goes with it, so a prescription never goes out as if the patient had no allergies.
  const sendDataLoading = useErxSendDataLoading(visit?.encounterId);
  const sendDataFailed = useErxSendDataFailed(visit?.encounterId);
  const user = useEvolveUser();
  // The roles that manage quick picks in Admin.
  const isAdmin = user?.hasRole([RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]) ?? false;
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
  const { quickPicks: sets, refetch: refetchSets } = useMergedPrescriptionSetQuickPicks();

  // The saved form's lines, when there are any, in place of an empty one (requirement 53b).
  const [savedLines] = useState(() => ((saved?.form.lines ?? []) as unknown as PrescriptionLine[]).map(withNewKeys));
  const [lines, setLines] = useState<PrescriptionLine[]>(() =>
    savedLines.length ? savedLines : [initialLine ?? emptyPrescriptionLine()]
  );
  const [sendAttempted, setSendAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  // The saved form's lines as saved, keyed as on the form: each leaves it once sent, edited on the form or not.
  const [linesSaved, setLinesSaved] = useState(savedLines);

  // Until a pharmacy is picked (or after Clear Form), the line reads the saved one, when it matches the directory.
  const savedPharmacy = plan?.preferredPharmacies?.find((item) => item.primary) ?? plan?.preferredPharmacies?.[0];
  const { data: preferred } = usePreferredPharmacy(patient?.id, savedPharmacy);
  const several = preferred && 'several' in preferred ? preferred : undefined;
  const preferredPharmacy = preferred && 'several' in preferred ? null : preferred;
  const [pickedPharmacy, setPickedPharmacy] = useState<PharmacySearchResult | null>(saved?.form.pharmacy ?? null);
  const pharmacy = fixedPharmacy ?? pickedPharmacy ?? preferredPharmacy ?? null;
  // The pharmacies this visit's prescriptions went to, once each, named as any of them names it.
  const sentBefore = (plan?.prescribedMedications ?? []).flatMap((item, i, all) =>
    item.pharmacyId && all.findIndex((other) => other.pharmacyId === item.pharmacyId) === i
      ? [
          {
            ncpdpId: item.pharmacyId,
            name: all.find((other) => other.pharmacyId === item.pharmacyId && other.pharmacyName)?.pharmacyName,
          },
        ]
      : []
  );

  // Reorder on a sent prescription: its line joins the form in place of an untouched one, to go to its pharmacy. A
  // form answering a request (`visit`) doesn't take it.
  const formRef = useRef<HTMLDivElement>(null);
  const reordered = useReorderPrescriptionStore((state) => state.prescription);
  const [reorderNcpdpId, setReorderNcpdpId] = useState<string>();
  const [reorderPharmacy] = usePharmaciesByNcpdpId(reorderNcpdpId ? [reorderNcpdpId] : []);
  useEffect(() => {
    if (!reordered || visit) return;
    useReorderPrescriptionStore.setState({ prescription: undefined });
    const line = refillLine(reordered, undefined, reordered.order?.metadata);
    setLines((current) => [...current.filter((item) => item.drug || item.medication || item.compound), line]);
    setReorderNcpdpId(reordered.pharmacyId);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [reordered, visit]);
  useEffect(() => {
    if (!reorderPharmacy || reorderPharmacy.status === 'pending') return;
    const found = reorderPharmacy.row && directoryPharmacyToResult(reorderPharmacy.row);
    if (found) {
      setPickedPharmacy(found);
      // The form has one pharmacy, so its other lines move too: said only when it had a different one.
      if (pharmacy && found.ncpdpId !== pharmacy.ncpdpId)
        enqueueSnackbar(`Pharmacy changed to ${found.name} for every prescription on the form`, { variant: 'warning' });
    } else
      enqueueSnackbar(
        `The original pharmacy can't take e-prescriptions now. ${
          pharmacy ? `Sending to ${pharmacy.name}.` : 'Pick another pharmacy.'
        }`,
        { variant: 'warning' }
      );
    setReorderNcpdpId(undefined);
  }, [reorderPharmacy, pharmacy]);

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

  // Replaces the visit's saved form; an empty one removes it. Nothing is checked, as the provider finishes it (53c).
  const onSave = async (): Promise<void> => {
    if (!onSaveForm) return;
    const form = toSavedForm(lines, pickedPharmacy);
    if (erxSavedFormIsEmpty(form) && !saved) {
      enqueueSnackbar('Nothing to save', { variant: 'info' });
      return;
    }
    setSavingForm(true);
    try {
      const response = await onSaveForm(form);
      setLinesSaved(response.saved ? lines : []);
      enqueueSnackbar(response.saved ? 'Saved' : 'Saved form removed', { variant: 'success' });
    } catch (error) {
      console.error('Failed to save the eRx form:', error);
      enqueueSnackbar(getApiError({ error, defaultError: 'The form could not be saved. Please try again.' }), {
        variant: 'error',
      });
    } finally {
      setSavingForm(false);
    }
  };

  // A sent line leaves the saved form as it leaves the form, and one that failed stays; once no saved line is left
  // to send, the saved form is removed (requirement 53d).
  const removeSentFromSaved = async (sent: PrescriptionLine[]): Promise<void> => {
    if (!onSaveForm) return;
    const unsent = linesSaved.filter((line) => !sent.some((item) => item.key === line.key));
    const left = unsent.some(erxSavedLineHasContent);
    try {
      const response = await onSaveForm(toSavedForm(left ? unsent : [], left ? saved?.form.pharmacy ?? null : null));
      setLinesSaved(response.saved ? unsent : []);
    } catch (error) {
      console.error('Failed to update the saved eRx form:', error);
      enqueueSnackbar("The saved form couldn't be updated. Reload the page to see what is still saved.", {
        variant: 'warning',
      });
    }
  };

  const lineErrors = (line: PrescriptionLine): string[] => [
    ...prescriptionLineErrors(line),
    ...(sendLineErrors?.(line) ?? []),
  ];

  // The order endpoint takes one prescription, so each line is sent in turn; a sent line leaves the form, so a
  // failure part-way leaves exactly the unsent ones to try again.
  const send = async (): Promise<void> => {
    setSendAttempted(true);
    if (!pharmacy || lines.some((line) => lineErrors(line).length > 0)) return;
    const practitionerId = user?.profileResource?.id;
    if (!patient?.id || !encounterId || !practitionerId) {
      enqueueSnackbar('The patient, encounter or provider could not be determined. Please reload and try again.', {
        variant: 'error',
      });
      return;
    }
    const context = {
      patientId: patient.id,
      practitionerId,
      encounterId,
      pharmacy,
      // The charted height and weight: one typed in the dose calculator only works out the dose (decision 7).
      vitals: prescriptionVitals(height, weight),
      allergies,
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
      if (!quietSent) {
        enqueueSnackbar(sent.length === 1 ? 'Prescription sent' : `${sent.length} prescriptions sent`, {
          variant: 'success',
        });
      }
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
      if (sent.length && saved) await removeSentFromSaved(sent);
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
      // A set lists quick picks, so the sets reload with them: one removed elsewhere drops out of both.
      void Promise.all([refetchQuickPicks(), refetchSets()]);
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
      <Box ref={formRef} sx={{ containerType: 'inline-size' }}>
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
                          several,
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
                    // A controlled drug's error shows as soon as it's picked; the rest once Send is tried.
                    errors={sendAttempted ? lineErrors(line) : controlledDrugErrors(line)}
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

              {!readOnly && sendDataFailed && (
                <Typography variant="body2" color="warning.dark">
                  {sendDataFailed}
                </Typography>
              )}
              <Box
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <Tooltip title={readOnly ? SIGNED : sending ? 'Sending…' : ''}>
                  <span>
                    <RoundedButton color="primary" onClick={clearForm} disabled={readOnly || sending}>
                      Clear Form
                    </RoundedButton>
                  </span>
                </Tooltip>
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  {saved && (
                    <Typography variant="body2" color="text.secondary">
                      {savedByText(saved)}
                    </Typography>
                  )}
                  {onSaveForm && (
                    <Tooltip title={readOnly ? SIGNED : sending ? 'Sending…' : ''}>
                      <span>
                        <RoundedButton
                          color="primary"
                          onClick={() => void onSave()}
                          disabled={readOnly || sending}
                          loading={savingForm}
                        >
                          Save
                        </RoundedButton>
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip
                    title={
                      readOnly
                        ? SIGNED
                        : notEnrolled
                        ? 'Only an enrolled prescriber can send'
                        : sendDataLoading
                        ? 'Loading allergies and vitals'
                        : ''
                    }
                  >
                    <span>
                      <RoundedButton
                        color="primary"
                        variant="contained"
                        disabled={readOnly || notEnrolled || sendDataLoading}
                        loading={sending}
                        onClick={() => void send()}
                      >
                        {sendLabel ?? (lines.length === 1 ? 'Send Prescription' : `Send ${lines.length} Prescriptions`)}
                      </RoundedButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Stack>
          </AccordionCard>

          <Box sx={{ [SIDE_COLUMN_QUERY]: { position: 'sticky', top: 16 } }}>
            <AccordionCard>
              <Stack spacing={1.5} style={{ padding: '24px' }}>
                {/* Read-only: what the visit header doesn't show of what's sent about the patient. */}
                {!hidePatientInfo && (patientContact.address || patientContact.phone) && (
                  <Box>
                    <SectionHeading>Patient Info</SectionHeading>
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

      <QuickPickSaveDialogs
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
        entityLabel="prescription"
        details={savedDosing && quickPickLine && quickPickDosingText(savedDosing, quickPickLine)}
        placeholder="Quick pick name"
        nameError={quickPickNameError}
      />
    </>
  );
};
