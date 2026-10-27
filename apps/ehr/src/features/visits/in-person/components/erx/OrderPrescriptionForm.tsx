import { Add } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Divider,
  FormHelperText,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createPrescriptionQuickPick } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useMergedPrescriptionQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { PharmacyDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { AllergiesContainer } from '../../../shared/components/review-tab/components/AllergiesContainer';
import { MedicationsContainer } from '../../../shared/components/review-tab/components/MedicationsContainer';
import { useChartData } from '../../../shared/hooks/useChartData';
import { useChartSection } from '../../../shared/hooks/useChartSection';
import { useSearchPharmacies } from '../../../shared/hooks/useErxSearch';
import { useGetAppointmentAccessibility } from '../../../shared/hooks/useGetAppointmentAccessibility';
import { useOrderPrescription } from '../../../shared/hooks/useOrderPrescription';
import { useAppointmentData, useSaveChartData } from '../../../shared/stores/appointment/appointment.store';
import { PopoverBlank, Sentence } from '../procedures/narrative/InlineBlanks';
import { ProcedureQuickPickDialogs } from '../procedures/ProcedureQuickPickDialogs';
import { calculatorWeightKg, previousVisitWeightNote } from './DoseCalculator';
import {
  ageMonthsAtVisit,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  quickPickDosingText,
} from './prescriptionLines';
import { PrescriptionSentences } from './PrescriptionSentences';
import { withListedQuickPick } from './prescriptionSuggestions';
import { useVisitWeight } from './useVisitWeight';

// Layout from the procedure page: the side column sits beside the form once the page is wide enough.
const SIDE_COLUMN_WIDTH = 340;
const SIDE_COLUMN_MIN_WIDTH = 280;
const FORM_COLUMN_MIN_WIDTH = 420;
const COLUMN_GAP_PX = 16;
const SIDE_COLUMN_QUERY = `@container (min-width: ${FORM_COLUMN_MIN_WIDTH + COLUMN_GAP_PX + SIDE_COLUMN_MIN_WIDTH}px)`;

const digits = (value: string | undefined): string => value?.replace(/\D/g, '') ?? '';

/** The patient's preferred pharmacy as a Surescripts directory entry. The chart keeps only its name, address and
 * phone, so it is looked up by name; a phone on file must match too. */
const usePreferredPharmacy = (preferred: PharmacyDTO[] | undefined): PharmacySearchResult | null => {
  const primary = preferred?.find((pharmacy) => pharmacy.primary) ?? preferred?.[0];
  const { data: results = [] } = useSearchPharmacies(primary?.name ?? '');
  if (!primary) return null;
  return (
    results.find(
      (result) =>
        result.name.trim().toLowerCase() === primary.name.trim().toLowerCase() &&
        (!digits(primary.phone) || digits(result.phone).endsWith(digits(primary.phone).slice(-10)))
    ) ?? null
  );
};

const PharmacySearch: FC<{ onPick: (pharmacy: PharmacySearchResult) => void }> = ({ onPick }) => {
  const [query, setQuery] = useState('');
  const { data: pharmacies = [], isFetching } = useSearchPharmacies(query);
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
      <Autocomplete<PharmacySearchResult>
        options={pharmacies}
        loading={isFetching}
        filterOptions={(options) => options}
        getOptionLabel={(option) => `${option.name} - ${option.address}`}
        inputValue={query}
        onInputChange={(_event, value) => setQuery(value)}
        value={null}
        onChange={(_event, option) => option && onPick(option)}
        noOptionsText={query.trim().length < 2 ? 'Type to search pharmacies' : 'Nothing found for this search criteria'}
        renderInput={(params) => <TextField {...params} size="small" label="Pharmacy" />}
      />
    </Box>
  );
};

export const OrderPrescriptionForm: FC = () => {
  const theme = useTheme();
  const { patient, encounter, appointment } = useAppointmentData();
  const patientAgeMonths = ageMonthsAtVisit(patient?.birthDate, appointment?.start);
  const weight = useVisitWeight();
  // A weight typed in any line's dose calculator stands in for the vitals' everywhere on the page.
  const [weightText, setWeightText] = useState<string>();
  const weightKg = calculatorWeightKg(weightText, weight);
  const user = useEvolveUser();
  const isAdmin = user?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;
  const { isAppointmentReadOnly: readOnly } = useGetAppointmentAccessibility();
  const { oystehrZambda } = useApiClients();
  const { mutateAsync: orderPrescription } = useOrderPrescription();
  const { data: plan, refetch: refetchPrescriptions } = useChartSection('plan');
  const { chartData, setPartialChartData } = useChartData();
  const { mutateAsync: saveChartData } = useSaveChartData();
  const visitDiagnoses = chartData?.diagnosis ?? [];
  const { quickPicks, refetch: refetchQuickPicks } = useMergedPrescriptionQuickPicks();

  const [lines, setLines] = useState<PrescriptionLine[]>(() => [emptyPrescriptionLine()]);
  const [sendAttempted, setSendAttempted] = useState(false);
  const [sending, setSending] = useState(false);

  // Until a pharmacy is picked (or after Clear Form), the line reads the preferred one.
  const preferredPharmacy = usePreferredPharmacy(plan?.preferredPharmacies);
  const [pickedPharmacy, setPickedPharmacy] = useState<PharmacySearchResult | null>(null);
  const pharmacy = pickedPharmacy ?? preferredPharmacy;

  const [quickPickLineKey, setQuickPickLineKey] = useState<number | null>(null);
  const [quickPickName, setQuickPickName] = useState('');
  const [quickPickSaving, setQuickPickSaving] = useState(false);

  const updateLine = (key: number, next: PrescriptionLine): void =>
    setLines((current) => current.map((line) => (line.key === key ? next : line)));

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
    if (!fresh.length) return;
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
    if (!patient?.id || !encounter?.id || !practitionerId) {
      enqueueSnackbar('The patient, encounter or provider could not be determined. Please reload and try again.', {
        variant: 'error',
      });
      return;
    }
    const context = {
      patientId: patient.id,
      practitionerId,
      encounterId: encounter.id,
      pharmacy,
      // The written date isn't shown: a prescription is always written today.
      writtenDate: DateTime.local().toISODate() ?? '',
    };
    setSending(true);
    const sent: PrescriptionLine[] = [];
    try {
      for (const line of lines) {
        await orderPrescription(prescriptionLineToOrder(line, context));
        sent.push(line);
        setLines((current) => current.filter((item) => item.key !== line.key));
      }
      enqueueSnackbar(sent.length === 1 ? 'Prescription sent' : `${sent.length} prescriptions sent`, {
        variant: 'success',
      });
      setLines([emptyPrescriptionLine()]);
      setSendAttempted(false);
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

  // Only adds: existing quick picks are edited in Admin → Quick Picks.
  const openQuickPickDialog = (line: PrescriptionLine): void => {
    setQuickPickName(line.medication?.description ?? '');
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
    setQuickPickSaving(true);
    try {
      const quickPickData = prescriptionLineToQuickPick(line, quickPickName);
      await createPrescriptionQuickPick(oystehrZambda, { quickPick: quickPickData });
      enqueueSnackbar(`Quick pick "${quickPickName}" created`, { variant: 'success' });
      setQuickPickLineKey(null);
      void refetchQuickPicks();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
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
                <PopoverBlank label="pharmacy" title="Pharmacy" value={pharmacy?.name} need readOnly={readOnly}>
                  {(close) => (
                    <PharmacySearch
                      onPick={(next) => {
                        setPickedPharmacy(next);
                        close();
                      }}
                    />
                  )}
                </PopoverBlank>
                {pharmacy && (
                  <>
                    {isPreferred && ' (preferred)'},{' '}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {pharmacy.address} · {pharmacy.phone}
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
                  <Box key={line.key}>
                    <PrescriptionSentences
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
                      onSaveQuickPick={isAdmin ? () => openQuickPickDialog(line) : undefined}
                      visitDiagnoses={visitDiagnoses}
                      patientAgeMonths={patientAgeMonths}
                      weightKg={weightKg}
                      weightNote={previousVisitWeightNote(weightText, weight)}
                      weight={weight}
                      weightText={weightText}
                      onWeightText={setWeightText}
                      errors={sendAttempted ? prescriptionLineErrors(line) : []}
                      readOnly={readOnly}
                    />
                  </Box>
                ))}
              </Box>
              {!readOnly && (
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
                  {lines.length === 1 ? 'Send Prescription' : `Send ${lines.length} Prescriptions`}
                </RoundedButton>
              </Box>
            </Stack>
          </AccordionCard>

          <Box sx={{ [SIDE_COLUMN_QUERY]: { position: 'sticky', top: 16 } }}>
            <AccordionCard>
              <Stack spacing={1.5} style={{ padding: '24px' }}>
                <AllergiesContainer />
                <MedicationsContainer />
              </Stack>
            </AccordionCard>
          </Box>
        </Box>
      </Box>

      <ProcedureQuickPickDialogs
        open={quickPickLineKey != null}
        name={quickPickName}
        onNameChange={setQuickPickName}
        existingQuickPicks={[]}
        saving={quickPickSaving}
        onClose={() => setQuickPickLineKey(null)}
        onSave={() => void onSaveAsQuickPick()}
        subject="prescription"
        details={savedDosing && quickPickDosingText(savedDosing)}
      />
    </>
  );
};
