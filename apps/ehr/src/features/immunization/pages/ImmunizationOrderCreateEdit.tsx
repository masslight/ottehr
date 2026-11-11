import { Add } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Divider, Stack } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { WarningBlock } from 'src/features/visits/in-person/components/WarningBlock';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPickSaveDialogs } from 'src/features/visits/shared/components/QuickPickSaveDialogs';
import { AllergiesContainer } from 'src/features/visits/shared/components/review-tab/components/AllergiesContainer';
import { MedicationsContainer } from 'src/features/visits/shared/components/review-tab/components/MedicationsContainer';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { enqueueOrderDeleteWarnings } from 'src/features/visits/shared/utils/orderDeleteWarnings';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { useImmunizationOrderStore, useMarkDraftNavigatedAway } from 'src/state/draft-data.store';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { InputImmunizationOrderDetails } from 'utils/lib/types/data/immunization/types';
import { PageHeader } from '../../visits/in-person/components/medication-administration/PageHeader';
import {
  useCancelImmunizationOrder,
  useCreateUpdateImmunizationOrder,
  useGetImmunizationForecast,
  useGetImmunizationOrders,
  useGetVaccines,
  useRecordOutsideImmunization,
} from '../../visits/in-person/hooks/useImmunization';
import {
  buildDueToday,
  coverageOf,
  fillFromDueToday,
  StockedVaccine,
  stockedVaccines,
  vaccinesToAddAll,
} from '../components/dueToday';
import { CoverageStrip, DueTodayBox } from '../components/DueTodayBox';
import {
  applyImmunizationQuickPick,
  applyQuickPickToOutsideLine,
  emptyImmunizationLine,
  ImmunizationLine,
  immunizationLineErrors,
  immunizationLineFrom,
  immunizationLineToRequest,
  isUntouchedOrderLine,
  orderButtonLabel,
  outsideLineErrors,
  outsideLineToRequest,
  toggleOutside,
} from '../components/immunizationLines';
import { ImmunizationSectionLabel, ImmunizationSentences } from '../components/ImmunizationSentences';
import { OrderHistoryTable } from '../components/OrderHistoryTable';
import { useImmunizationQuickPickManagement } from '../hooks/useImmunizationQuickPickManagement';

// Layout from the eRx order form: the side column sits beside the form once the page is wide enough.
const SIDE_COLUMN_WIDTH = 340;
const SIDE_COLUMN_MIN_WIDTH = 280;
const FORM_COLUMN_MIN_WIDTH = 420;
const COLUMN_GAP_PX = 16;
const SIDE_COLUMN_QUERY = `@container (min-width: ${FORM_COLUMN_MIN_WIDTH + COLUMN_GAP_PX + SIDE_COLUMN_MIN_WIDTH}px)`;

const ROUNDED_BUTTON_SX = { borderRadius: '20px', textTransform: 'none' } as const;

/** A vaccine from the Due today box fills the first line without a vaccine, else a new line (as a quick pick does). */
const addVaccineToLines = (
  lines: ImmunizationLine[],
  vaccine: StockedVaccine,
  quickPick: ImmunizationQuickPickData | undefined,
  orderedProvider: InputImmunizationOrderDetails['orderedProvider'] | undefined
): ImmunizationLine[] => {
  const target = lines.find((line) => !line.outside && !line.details.medication);
  return target
    ? lines.map((line) => (line === target ? fillFromDueToday(line, vaccine, quickPick) : line))
    : [...lines, fillFromDueToday(emptyImmunizationLine(orderedProvider), vaccine, quickPick)];
};

interface ImmunizationOrderCreateEditProps {
  orderId?: string;
  onFinished?: () => void;
}

export const ImmunizationOrderCreateEdit: React.FC<ImmunizationOrderCreateEditProps> = ({
  orderId: orderIdProp,
  onFinished,
}) => {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const { id: appointmentId, orderId: orderIdFromUrl } = useParams();
  const orderId = orderIdProp ?? orderIdFromUrl;
  const {
    resources: { encounter, patient },
  } = useAppointmentData(appointmentId);

  const isCreating = !orderId;
  const encounterId = encounter?.id ?? '';

  const { setDraft, clearDraft, hasDraft, getDraft } = useImmunizationOrderStore();
  const draft = getDraft(encounterId);

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const [isOrderSaved, setIsOrderSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutateAsync: createUpdateOrder } = useCreateUpdateImmunizationOrder();
  const { mutateAsync: recordOutside } = useRecordOutsideImmunization();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder(encounterId);

  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;
  const currentUserProviderId = getIdFromReference(currentUser?.profile);
  const currentUserHasProviderRole = currentUser?.hasRole?.([RoleType.Provider]);
  const currentUserName = currentUser?.userName;
  const defaultProvider = useMemo(
    () =>
      currentUserHasProviderRole && currentUserProviderId
        ? { id: currentUserProviderId, name: currentUserName ?? '' }
        : undefined,
    [currentUserHasProviderRole, currentUserProviderId, currentUserName]
  );

  useMarkDraftNavigatedAway({ encounterId, setDraft, hasDraft });

  const finish = onFinished ?? ((): void => navigate(getImmunizationMARUrl(appointmentId!)));

  // A new order starts from the draft's lines; the order being edited is loaded into its one line below.
  const [lines, setLines] = useState<ImmunizationLine[]>(() =>
    isCreating && draft.lines?.length ? draft.lines.map(immunizationLineFrom) : [emptyImmunizationLine(defaultProvider)]
  );
  const [dirty, setDirty] = useState(false);
  const [orderAttempted, setOrderAttempted] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  /** A change of the user's: the draft follows it. */
  const changeLines = useCallback((update: (current: ImmunizationLine[]) => ImmunizationLine[]): void => {
    setDirty(true);
    setLines(update);
  }, []);
  const updateLine = (key: number, next: ImmunizationLine): void =>
    changeLines((current) => current.map((line) => (line.key === key ? next : line)));
  /** An untouched order line becomes the external one; otherwise one is added after the others. */
  const addOutsideLine = (): void =>
    changeLines((current) => {
      const untouched = current.find(isUntouchedOrderLine);
      return untouched
        ? current.map((line) => (line === untouched ? toggleOutside(line) : line))
        : [...current, toggleOutside(emptyImmunizationLine(defaultProvider))];
    });
  const lineErrors = (line: ImmunizationLine): string[] =>
    line.outside ? outsideLineErrors(line) : immunizationLineErrors(line);

  // The draft holds every line of a new order, once the user has changed something; not the lines sent.
  useEffect(() => {
    if (!isCreating || !encounterId || !dirty || isOrderSaved) return;
    setDraft(encounterId, { lines: lines.map(({ key: _key, ...values }) => values) });
  }, [isCreating, encounterId, dirty, isOrderSaved, lines, setDraft]);

  const { data: ordersResponse, isLoading: isOrderLoading } = useGetImmunizationOrders({ orderId });
  useEffect(() => {
    if (!orderId) return;
    const order = ordersResponse?.orders?.find((order) => order.id === orderId);
    if (order) setLines([immunizationLineFrom(order)]);
  }, [ordersResponse, orderId]);

  // The current provider is the default "Ordered by" once known; not a change of the user's, so no draft.
  useEffect(() => {
    if (!isCreating || !defaultProvider) return;
    setLines((current) =>
      current.some((line) => !line.details.orderedProvider)
        ? current.map((line) =>
            line.details.orderedProvider
              ? line
              : { ...line, details: { ...line.details, orderedProvider: defaultProvider } }
          )
        : current
    );
  }, [isCreating, defaultProvider]);

  // The quick pick save dialog reads the line it was opened from, as the line stands when it saves.
  const quickPickLineKey = useRef<number>();
  const {
    mergedQuickPicks,
    quickPickDialogOpen,
    setQuickPickDialogOpen,
    quickPickName,
    setQuickPickName,
    existingQuickPicks,
    quickPickSaving,
    openQuickPickDialog,
    onSaveAsQuickPick,
  } = useImmunizationQuickPickManagement({
    getValues: () => linesRef.current.find((line) => line.key === quickPickLineKey.current) ?? {},
  });
  const openSaveQuickPickDialog = (line: ImmunizationLine): void => {
    quickPickLineKey.current = line.key;
    void openQuickPickDialog();
  };

  /** A quick pick from the command palette fills the first line without a vaccine, else a new line. */
  const addQuickPickLine = useCallback(
    (quickPick: ImmunizationQuickPickData): void =>
      changeLines((current) => {
        const target = current.find((line) => !line.outside && !line.details.medication);
        return target
          ? current.map((line) => (line === target ? applyImmunizationQuickPick(line, quickPick, true) : line))
          : [...current, applyImmunizationQuickPick(emptyImmunizationLine(defaultProvider), quickPick, true)];
      }),
    [changeLines, defaultProvider]
  );
  const addQuickPickLineRef = useRef(addQuickPickLine);
  addQuickPickLineRef.current = addQuickPickLine;

  const commandPaletteItems = useMemo(
    () =>
      orderId || isReadOnly
        ? []
        : mergedQuickPicks.map((quickPick) => {
            const doseAndUnits = quickPick.dose && quickPick.units ? `${quickPick.dose} ${quickPick.units}` : undefined;

            return {
              id: `immunization-${quickPick.id ?? quickPick.name}`,
              label: [quickPick.name, doseAndUnits].filter(Boolean).join(', '),
              category: 'Add Immunization',
              onSelect: () => addQuickPickLineRef.current(quickPick),
            };
          }),
    [isReadOnly, mergedQuickPicks, orderId]
  );
  useCommandPaletteSource('immunization-quick-picks', commandPaletteItems);

  const handlePendingQuickPick = useCallback(
    (payload: ImmunizationQuickPickData) => {
      if (isReadOnly) {
        return;
      }
      addQuickPickLineRef.current(payload);
    },
    [isReadOnly]
  );
  usePendingQuickPick('immunizations', handlePendingQuickPick, !isOrderLoading);

  // The Due today box: the forecast run on the server for this visit, the vaccines the practice gives, their quick picks.
  const {
    data: forecastResponse,
    isLoading: forecastLoading,
    isError: forecastError,
  } = useGetImmunizationForecast({ patientId: isCreating ? patient?.id : undefined, encounterId: encounter?.id });
  const { data: vaccines } = useGetVaccines();
  const stocked = useMemo(() => stockedVaccines(vaccines, mergedQuickPicks), [vaccines, mergedQuickPicks]);
  const dueToday = useMemo(
    () => forecastResponse && buildDueToday(forecastResponse.forecast, stocked, forecastResponse.cvxGroups),
    [forecastResponse, stocked]
  );
  const coverage = useMemo(
    () => (dueToday && forecastResponse ? coverageOf(dueToday.due, lines, stocked, forecastResponse.cvxGroups) : []),
    [dueToday, forecastResponse, lines, stocked]
  );
  const addFromDueToday = (vaccine: StockedVaccine, quickPick?: ImmunizationQuickPickData): void =>
    changeLines((current) => addVaccineToLines(current, vaccine, quickPick, defaultProvider));
  // The fewest-shot set; a vaccine given several ways is added without a quick pick, and its line asks which.
  const addAllDue = (): void =>
    changeLines((current) =>
      dueToday
        ? vaccinesToAddAll(dueToday, current).reduce(
            (lines, vaccine) => addVaccineToLines(lines, vaccine, undefined, defaultProvider),
            current
          )
        : current
    );

  // The create endpoint takes one order, so each line is sent in turn (an external line to the history instead); a
  // sent line leaves the form, so a failure part-way leaves exactly the unsent ones (and their draft) to try again.
  const order = async (): Promise<void> => {
    setOrderAttempted(true);
    if (lines.some((line) => lineErrors(line).length > 0)) return;
    setOrdering(true);
    const sent: ImmunizationLine[] = [];
    try {
      for (const line of lines) {
        if (line.outside) await recordOutside(outsideLineToRequest(line, encounterId));
        else await createUpdateOrder(immunizationLineToRequest(line, encounterId, orderId));
        sent.push(line);
        if (isCreating) changeLines((current) => current.filter((item) => item.key !== line.key));
      }
      setIsOrderSaved(true);
      if (isCreating && encounterId) clearDraft(encounterId);
      finish();
    } catch (error) {
      const message = getApiError({ error, defaultError: 'An error occurred while saving the immunization order.' });
      enqueueSnackbar(sent.length ? `${sent.length} of ${lines.length} immunizations ordered. ${message}` : message, {
        variant: 'error',
      });
    } finally {
      setOrdering(false);
    }
  };

  const handleDeleteOrder = async (): Promise<void> => {
    if (!orderId) return;
    try {
      const response = await cancelOrder({ orderId });
      enqueueOrderDeleteWarnings(response);
      finish();
    } catch {
      setIsDeleteDialogOpen(false);
      enqueueSnackbar('An error occurred while deleting the immunization order. Please try again.', {
        variant: 'error',
      });
    }
  };

  const handleBack = (): void => {
    if (isCreating && encounterId) clearDraft(encounterId);
    finish();
  };

  const handleClearForm = (): void => {
    clearDraft(encounterId);
    setDirty(false);
    setOrderAttempted(false);
    setLines([emptyImmunizationLine(defaultProvider)]);
  };

  return (
    <>
      <Stack spacing={2}>
        {!isInlineFlow && (
          <BaseBreadcrumbs
            sectionName={orderId ? 'Edit Immunization Order' : 'Order Immunization'}
            baseCrumb={{ label: 'Immunizations', path: getImmunizationMARUrl(appointmentId ?? '') }}
          />
        )}
        <PageHeader
          title={orderId ? 'Edit Immunization Order' : 'Order Immunization'}
          variant="h3"
          component="h1"
          dataTestId={dataTestIds.orderVaccinePage.title}
        />

        {isCreating && hasDraft(encounterId) && (
          <UnsavedDraftWarning
            message={
              draft.hasNavigatedAway
                ? 'Your previously entered data has been restored. Click "Clear Form" to start fresh.'
                : 'You have an immunization order in progress. Your draft will be saved.'
            }
          />
        )}

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
                <ImmunizationSectionLabel>Immunizations</ImmunizationSectionLabel>
                {isCreating && <CoverageStrip coverage={coverage} />}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {lines.map((line, index) => (
                    <ImmunizationSentences
                      key={line.key}
                      line={line}
                      index={index}
                      onChange={(next) => updateLine(line.key, next)}
                      onRemove={
                        lines.length > 1
                          ? () => changeLines((current) => current.filter((item) => item.key !== line.key))
                          : undefined
                      }
                      quickPicks={mergedQuickPicks}
                      onQuickPick={(quickPick) =>
                        updateLine(
                          line.key,
                          line.outside
                            ? applyQuickPickToOutsideLine(line, quickPick)
                            : applyImmunizationQuickPick(line, quickPick, true)
                        )
                      }
                      onSaveQuickPick={isAdmin && !line.outside ? () => openSaveQuickPickDialog(line) : undefined}
                      errors={orderAttempted ? lineErrors(line) : []}
                      readOnly={isReadOnly}
                    />
                  ))}
                </Box>
                {isCreating && !isReadOnly && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      sx={{ textTransform: 'none' }}
                      onClick={() => changeLines((current) => [...current, emptyImmunizationLine(defaultProvider)])}
                    >
                      Add another immunization
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      sx={{ textTransform: 'none' }}
                      onClick={addOutsideLine}
                      data-testid={dataTestIds.orderVaccinePage.addOutsideButton}
                    >
                      Add an externally administered immunization
                    </Button>
                  </Box>
                )}

                <WarningBlock
                  title="Safety Alert"
                  text="Vaccine orders do not automatically check for patient allergies (unlike medication orders). Before proceeding, please manually review the patient's allergies and confirm there is no risk of allergy to the vaccine or its components."
                />

                <Divider orientation="horizontal" />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1}>
                    <ButtonRounded variant="outlined" color="primary" size="large" onClick={handleBack}>
                      Back
                    </ButtonRounded>
                    {isCreating && hasDraft(encounterId) && (
                      <ButtonRounded variant="outlined" color="primary" size="large" onClick={handleClearForm}>
                        Clear Form
                      </ButtonRounded>
                    )}
                    {orderId && (
                      <>
                        <LoadingButton
                          variant="outlined"
                          color="error"
                          size="large"
                          loading={isDeleting}
                          onClick={() => setIsDeleteDialogOpen(true)}
                          sx={ROUNDED_BUTTON_SX}
                        >
                          Delete Order
                        </LoadingButton>
                        <CustomDialog
                          open={isDeleteDialogOpen}
                          handleClose={() => setIsDeleteDialogOpen(false)}
                          title="Delete immunization order"
                          description="Are you sure you want to delete the immunization order?"
                          closeButtonText="Cancel"
                          closeButton={false}
                          handleConfirm={handleDeleteOrder}
                          confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                          confirmLoading={isDeleting}
                        />
                      </>
                    )}
                  </Stack>
                  <LoadingButton
                    disabled={isOrderLoading || isOrderSaved || isReadOnly}
                    loading={ordering}
                    variant="contained"
                    color="primary"
                    size="large"
                    sx={ROUNDED_BUTTON_SX}
                    onClick={() => void order()}
                    data-testid={dataTestIds.orderVaccinePage.orderVaccineButton}
                  >
                    {orderId ? 'Save changes' : orderButtonLabel(lines)}
                  </LoadingButton>
                </Stack>
              </Stack>
            </AccordionCard>

            <Box sx={{ [SIDE_COLUMN_QUERY]: { position: 'sticky', top: 16 } }}>
              <Stack spacing={2}>
                {isCreating && (
                  <DueTodayBox
                    dueToday={dueToday}
                    loading={forecastLoading}
                    error={forecastError}
                    lines={lines}
                    readOnly={isReadOnly}
                    onAdd={addFromDueToday}
                    onAddAll={addAllDue}
                  />
                )}
                <AccordionCard>
                  <Stack spacing={1.5} style={{ padding: '24px' }}>
                    <AllergiesContainer />
                    <MedicationsContainer />
                  </Stack>
                </AccordionCard>
              </Stack>
            </Box>
          </Box>
        </Box>

        <AccordionCard
          label="Immunization history"
          collapsed={isImmunizationHistoryCollapsed}
          onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
          withBorder={false}
        >
          <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
        </AccordionCard>
      </Stack>

      <QuickPickSaveDialogs
        open={quickPickDialogOpen}
        name={quickPickName}
        onNameChange={setQuickPickName}
        existingQuickPicks={existingQuickPicks}
        saving={quickPickSaving}
        onClose={() => setQuickPickDialogOpen(false)}
        onSave={(overwriteId) => void onSaveAsQuickPick(overwriteId)}
        entityLabel="immunization"
      />
    </>
  );
};
