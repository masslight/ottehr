import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { useQuery } from '@tanstack/react-query';
import type { ServiceCategoryConfig } from 'config-types';
import { Location, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCopyChartDataToFollowup } from 'src/features/visits/shared/components/patient/useCopyChartDataToFollowup';
import { AddVisitPatientInformationCard } from 'src/features/visits/shared/components/staff-add-visit/AddVisitPatientInformationCard';
import { useReasonForVisitOptions } from 'src/features/visits/shared/hooks/useReasonForVisitOptions';
import {
  APIError,
  BOOKING_CONFIG,
  CopyableFollowupField,
  CreateAppointmentInputParams,
  CreateSlotParams,
  FollowUpOptions,
  getAppointmentDurationFromSlot,
  GetScheduleRequestParams,
  GetScheduleResponse,
  getTimezone,
  isApiError,
  PatientInfo,
  SCHEDULED_FOLLOWUP_OTHER_REASON,
  SCHEDULED_FOLLOWUP_REASONS,
  ScheduleType,
  SERVICE_CATEGORY_SYSTEM,
  serviceCategorySupportsContext,
  ServiceMode,
  ServiceVisitType,
  SLUG_SYSTEM,
} from 'utils';
import { createAppointment, createSlot, getLocations, listServiceCategories } from '../api/api';
import BookableSelect, { BookableMode, BookableTarget } from '../components/BookableSelect';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { CustomDialog } from '../components/dialogs/CustomDialog';
import SlotPicker from '../components/SlotPicker';
import { MAXIMUM_CHARACTER_LIMIT } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

type SlotLoadingState =
  | { status: 'initial'; input: undefined }
  | { status: 'loading'; input: undefined }
  | { status: 'loaded'; input: string };

export type AddVisitFormState =
  | 'existingPatientSelected'
  | 'manuallyEnterPatientDetails'
  | 'initialPatientSearch'
  | 'displayPatientSearch';

export interface AddVisitErrorState {
  submit?: boolean;
  visitType?: boolean;
  serviceCategory?: boolean;
  location?: boolean;
  firstName?: boolean;
  lastName?: boolean;
  phone?: boolean;
  dateOfBirth?: boolean;
  sexAtBirth?: boolean;
  reasonForVisit?: boolean;
  otherReason?: boolean;
  search?: boolean;
  searchEntry?: boolean;
}

export type AddVisitPatientInfo = Pick<
  PatientInfo,
  'id' | 'newPatient' | 'firstName' | 'middleName' | 'lastName' | 'dateOfBirth' | 'sex' | 'phoneNumber'
>;
export interface LocationWithWalkinSchedule extends Location {
  walkinSchedule: Schedule | undefined;
}

const defaultServiceCategory =
  BOOKING_CONFIG.serviceCategories.length === 1 ? BOOKING_CONFIG.serviceCategories[0]?.category.code : '';

// todo: this lives in the util folder and is redundantly declared here - should be consolidated
enum VisitType {
  InPersonWalkIn = 'in-person-walk-in',
  InPersonPreBook = 'in-person-pre-booked',
  InPersonPostTelemed = 'in-person-post-telemed',
  VirtualOnDemand = 'virtual-on-demand',
  VirtualScheduled = 'virtual-scheduled',
}

// Maps each visit type to the (mode, visit-context) pair we use to filter the
// service-category dropdown via serviceCategorySupportsContext. The patient-
// side picker uses the same helper, so a category that shows on patient flows
// for (in-person, prebook) will show in the EHR Add Visit form for the same
// visit type, keeping staff and patient views in sync.
//
// PostTelemed deliberately leaves `visitCtx` undefined. It's an in-person
// follow-up to a virtual visit — neither 'prebook' nor 'walk-in' cleanly
// applies, and a strict prebook filter would silently exclude walk-in-only
// categories that staff still need to reach in this back-conversion flow.
// Mode is still enforced (always in-person).
const visitTypeContext: Record<VisitType, { mode: ServiceMode; visitCtx: ServiceVisitType | undefined }> = {
  [VisitType.InPersonWalkIn]: { mode: ServiceMode['in-person'], visitCtx: ServiceVisitType['walk-in'] },
  [VisitType.InPersonPreBook]: { mode: ServiceMode['in-person'], visitCtx: ServiceVisitType.prebook },
  [VisitType.InPersonPostTelemed]: { mode: ServiceMode['in-person'], visitCtx: undefined },
  [VisitType.VirtualOnDemand]: { mode: ServiceMode.virtual, visitCtx: ServiceVisitType['walk-in'] },
  [VisitType.VirtualScheduled]: { mode: ServiceMode.virtual, visitCtx: ServiceVisitType.prebook },
};

export const getPostAppointmentSnackbar = ({
  hasClientCopyFailures,
  isScheduledFollowUp,
  copyAttempted,
}: {
  hasClientCopyFailures: boolean;
  isScheduledFollowUp: boolean;
  copyAttempted: boolean;
}): { message: string; variant: 'warning' | 'success' } => {
  if (hasClientCopyFailures) {
    return {
      message: "Visit created, but some fields couldn't be copied from the previous visit.",
      variant: 'warning',
    };
  }
  if (isScheduledFollowUp && copyAttempted) {
    return { message: 'Visit added; notes copied from the previous visit.', variant: 'success' };
  }
  return { message: 'Visit added successfully', variant: 'success' };
};

export default function AddPatient(): JSX.Element {
  const location = useLocation();
  const followUpState = location.state as
    | {
        followUpOptions?: FollowUpOptions;
        parentLocation?: LocationWithWalkinSchedule;
        patientId?: string;
        patientInfo?: AddVisitPatientInfo;
        clientCopyFields?: CopyableFollowupField[];
      }
    | undefined;
  const followUpOptions = followUpState?.followUpOptions;
  const isScheduledFollowUp = !!followUpOptions?.parentEncounterId;

  // selectedBookable is the canonical "what was picked" state — Location,
  // Group, or PR-direct Schedule. For follow-ups we seed it from the parent
  // location so existing flows behave unchanged.
  const [selectedBookable, setSelectedBookable] = useState<BookableTarget | undefined>(() => {
    const parent = followUpState?.parentLocation;
    const parentSlug = parent?.identifier?.find((i) => i.system === SLUG_SYSTEM)?.value;
    if (!parent || !parent.id || !parentSlug) return undefined;
    return {
      resourceType: 'Location',
      id: parent.id,
      slug: parentSlug,
      name: parent.name ?? 'Location',
      walkinSchedule: parent.walkinSchedule,
      rawLocation: parent,
    };
  });
  const [birthDate, setBirthDate] = useState<DateTime | null>(
    followUpState?.patientInfo?.dateOfBirth ? DateTime.fromISO(followUpState.patientInfo.dateOfBirth) : null
  );
  const [patientInfo, setPatientInfo] = useState<AddVisitPatientInfo | undefined>(
    followUpState?.patientInfo || undefined
  );
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  // Scheduled follow-ups pick a reason from SCHEDULED_FOLLOWUP_REASONS; "Other" reveals this free text.
  const [otherReason, setOtherReason] = useState<string>('');
  const [reasonForVisitAdditional, setReasonForVisitAdditional] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitType>();
  const [serviceCategory, setServiceCategory] = useState<string>(defaultServiceCategory);
  const [slot, setSlot] = useState<Slot | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<AddVisitErrorState>({
    submit: false,
    visitType: false,
    serviceCategory: false,
    location: false,
    firstName: false,
    lastName: false,
    phone: false,
    dateOfBirth: false,
    sexAtBirth: false,
    reasonForVisit: false,
    search: false,
    searchEntry: false,
  });
  const [loadingSlotState, setLoadingSlotState] = useState<SlotLoadingState>({ status: 'initial', input: undefined });
  const [locationWithSlotData, setLocationWithSlotData] = useState<GetScheduleResponse | undefined>(undefined);
  const [validDate, setValidDate] = useState<boolean>(true);
  const [selectSlotDialogOpen, setSelectSlotDialogOpen] = useState<boolean>(false);
  const [validReasonForVisit, setValidReasonForVisit] = useState<boolean>(true);
  const [showFields, setShowFields] = useState<AddVisitFormState>(
    isScheduledFollowUp ? 'existingPatientSelected' : 'initialPatientSearch'
  );

  useEffect(() => {
    setReasonForVisit('');
    setOtherReason('');
    setReasonForVisitAdditional('');
  }, [serviceCategory]);

  // Scheduled follow-ups use a fixed follow-up-reason list instead of the service-category reasons.
  // The per-service path goes through the shared hook so admin-managed FHIR categories surface their
  // configured RFV options. The hook is called unconditionally (rules of hooks); it short-circuits
  // internally when the code is in BOOKING_CONFIG or absent.
  const serviceCategoryRfvOptions = useReasonForVisitOptions(serviceCategory ?? '');
  const reasonForVisitOptions = isScheduledFollowUp
    ? SCHEDULED_FOLLOWUP_REASONS.map((reason) => ({ value: reason, label: reason }))
    : serviceCategoryRfvOptions;
  const isOtherFollowUpReason = isScheduledFollowUp && reasonForVisit === SCHEDULED_FOLLOWUP_OTHER_REASON;
  const shouldShowReasonForVisitFields = useMemo(() => {
    return showFields !== 'initialPatientSearch' && reasonForVisitOptions.length > 0;
  }, [showFields, reasonForVisitOptions.length]);
  // general variables
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const copyChartDataToFollowupMutation = useCopyChartDataToFollowup();
  const reasonForVisitErrorMessage = `Input cannot be more than ${MAXIMUM_CHARACTER_LIMIT} characters`;

  // The Service category dropdown was historically hardcoded to BOOKING_CONFIG
  // (urgent-care / workers-comp / occupational-medicine). Now: merge with
  // FHIR-managed admin-created services so categories created in Admin →
  // Services (e.g., massage30/45/90) appear here too. BOOKING_CONFIG wins on
  // code collisions, matching the patient-side useServiceCategories merge.
  const { data: fhirServiceCategories } = useQuery({
    queryKey: ['add-patient-service-categories'],
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      try {
        return await listServiceCategories(oystehrZambda);
      } catch {
        return { serviceCategories: [] };
      }
    },
    enabled: !!oystehrZambda,
  });
  // Merge the compiled-in BOOKING_CONFIG entries with admin-managed FHIR
  // records, keeping the full ServiceCategoryConfig shape (plus `source`) so
  // the dropdown can filter via serviceCategorySupportsContext below. Same
  // BOOKING_CONFIG-wins-on-code-collision rule as the patient-side merge.
  const mergedSourcedCategories = useMemo<Array<ServiceCategoryConfig & { source: 'booking-config' | 'fhir' }>>(() => {
    const fhirRecords = fhirServiceCategories?.serviceCategories ?? [];
    const bookingCodes = new Set(
      BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code).filter((c): c is string => !!c)
    );
    const bookingEntries = BOOKING_CONFIG.serviceCategories.map((sc) => ({ ...sc, source: 'booking-config' as const }));
    const fhirOnly = fhirRecords
      .filter((r) => r.active !== false && r.code && !bookingCodes.has(r.code))
      .map((r) => ({
        // StrongCoding requires a non-empty system. SERVICE_CATEGORY_SYSTEM
        // is what BOOKING_CONFIG entries use and what the Slot/Schedule
        // category readers look for downstream — keep FHIR-sourced entries
        // on the same system so any future consumer that filters codings by
        // system (the BookableSelect schedule filter does exactly this) sees
        // both sources uniformly.
        category: { code: r.code as string, display: r.name, system: SERVICE_CATEGORY_SYSTEM },
        serviceModes: r.config.serviceModes,
        visitTypes: r.config.visitTypes,
        reasonsForVisit: { default: r.config.reasonsForVisit ?? [] },
        source: 'fhir' as const,
      }));
    return [...bookingEntries, ...fhirOnly];
  }, [fhirServiceCategories]);
  // Filter the category dropdown by the selected visit type's (mode,
  // visit-context) pair so staff can't pick a category that the chosen visit
  // type doesn't support. Shares the helper with the patient-side picker, so
  // both sides admit the same set for the same (mode, visit-context). With
  // no visit type selected we show the full merged catalog.
  const filteredServiceCategories = useMemo(() => {
    const source = visitType ? visitTypeContext[visitType] : undefined;
    const matches = source
      ? mergedSourcedCategories.filter((sc) => serviceCategorySupportsContext(sc, source.mode, source.visitCtx))
      : mergedSourcedCategories;
    return matches
      .map((sc) => ({
        code: sc.category.code as string,
        display: sc.category.display ?? sc.category.code ?? '',
      }))
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [mergedSourcedCategories, visitType]);

  // When visit type changes, drop a stale category that's no longer offered.
  // Keep the selection if it's still valid (avoid yanking the user's choice
  // when they switch between two visit types that share a category). When
  // the selection becomes invalid, fall back to the first remaining filtered
  // option — NOT to `defaultServiceCategory`, which is itself just "the only
  // BOOKING_CONFIG entry" when there's exactly one and may also be filtered
  // out by the visit-type context. Resetting to a filtered-out value would
  // leave the dropdown displaying nothing usable while the form sat in an
  // invalid state.
  useEffect(() => {
    if (!serviceCategory) return;
    if (!filteredServiceCategories.some((sc) => sc.code === serviceCategory)) {
      setServiceCategory(filteredServiceCategories[0]?.code ?? '');
    }
  }, [filteredServiceCategories, serviceCategory]);

  const handleAdditionalReasonForVisitChange = (newValue: string): void => {
    setValidReasonForVisit(newValue.length <= MAXIMUM_CHARACTER_LIMIT);
    setReasonForVisitAdditional(newValue);
  };

  useEffect(() => {
    const fetchSlotData = async (params: GetScheduleRequestParams, client: Oystehr): Promise<void> => {
      setLoadingSlotState({ status: 'loading', input: undefined });
      try {
        const response = await getLocations(client, params);
        setLocationWithSlotData(response);
      } catch (e) {
        console.error('error loading slot data', e);
      } finally {
        setLoadingSlotState({
          status: 'loaded',
          input: `${params.slug}|${params.scheduleType}|${params.serviceCategoryCode ?? ''}`,
        });
      }
    };
    if (!selectedBookable || !oystehrZambda) return;

    const scheduleType =
      selectedBookable.resourceType === 'HealthcareService'
        ? ScheduleType.group
        : selectedBookable.resourceType === 'PractitionerRole'
        ? ScheduleType.provider
        : ScheduleType.location;

    // For groups, the picked service category is required so the slot grid
    // reflects the right service's duration/cadence. For locations and
    // PR-direct (typically single-service), it's optional.
    const params: GetScheduleRequestParams = {
      slug: selectedBookable.slug,
      scheduleType,
      ...(serviceCategory ? { serviceCategoryCode: serviceCategory as any } : {}),
    };
    const key = `${params.slug}|${params.scheduleType}|${params.serviceCategoryCode ?? ''}`;

    if (
      loadingSlotState.status === 'loading' ||
      (loadingSlotState.status === 'loaded' && loadingSlotState.input === key)
    ) {
      return;
    }
    void fetchSlotData(params, oystehrZambda);
  }, [selectedBookable, serviceCategory, loadingSlotState, oystehrZambda]);

  // handle functions
  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!patientInfo) {
      setErrors({ search: true });
      return;
    }

    const validations: Array<{ invalid: boolean; field: keyof AddVisitErrorState }> = [
      // first name, last name, and phone are empty strings when untouched
      { field: 'firstName', invalid: patientInfo.firstName != null && patientInfo.firstName.length === 0 },
      { field: 'lastName', invalid: patientInfo.lastName != null && patientInfo.lastName.length === 0 },
      { field: 'phone', invalid: patientInfo.phoneNumber != null && patientInfo.phoneNumber.length !== 10 },
      {
        field: 'dateOfBirth',
        invalid: patientInfo.newPatient ? !birthDate : !patientInfo.dateOfBirth,
      },
      { field: 'sexAtBirth', invalid: !patientInfo.sex },
      { field: 'visitType', invalid: !visitType },
      { field: 'serviceCategory', invalid: !serviceCategory },
      { field: 'location', invalid: !!visitType && !selectedBookable },
      { field: 'reasonForVisit', invalid: shouldShowReasonForVisitFields && !reasonForVisit },
      { field: 'otherReason', invalid: isOtherFollowUpReason && !otherReason.trim() },
    ];
    const fieldErrors = Object.fromEntries(validations.map((v) => [v.field, v.invalid]));
    setErrors((prev) => ({ ...prev, ...fieldErrors }));
    if (validations.some((v) => v.invalid)) {
      return;
    }

    if (
      (visitType === VisitType.InPersonPreBook ||
        visitType === VisitType.InPersonPostTelemed ||
        visitType === VisitType.VirtualScheduled) &&
      slot === undefined
    ) {
      setSelectSlotDialogOpen(true);
      return;
    }
    if (showFields.includes('PatientSearch')) {
      setErrors({ search: true });
      return;
    } else {
      setErrors({ ...errors, search: false });
    }

    if (validDate && validReasonForVisit) {
      setLoading(true);

      if (!oystehrZambda) throw new Error('Zambda client not found');
      let createSlotInput: CreateSlotParams;
      if (visitType === VisitType.InPersonWalkIn || visitType === VisitType.VirtualOnDemand) {
        if (!selectedBookable) {
          enqueueSnackbar('Please select where to book', { variant: 'error' });
          setLoading(false);
          return;
        }
        // Walk-in scheduleId:
        //   - Location: the Location's walk-in Schedule resource (existing)
        //   - Group / PR-direct: derived from the first candidate slot's
        //     scheduleId, same approach used by the patient WalkinGroup page.
        let walkinScheduleId: string | undefined;
        let timezone: string;
        if (selectedBookable.resourceType === 'Location' && selectedBookable.rawLocation) {
          walkinScheduleId = selectedBookable.walkinSchedule?.id;
          timezone = getTimezone(selectedBookable.walkinSchedule ?? selectedBookable.rawLocation);
        } else {
          const candidate = locationWithSlotData?.available?.[0] ?? locationWithSlotData?.telemedAvailable?.[0];
          walkinScheduleId = candidate?.slot.schedule?.reference?.split('/')[1];
          timezone = locationWithSlotData?.location?.timezone ?? 'UTC';
        }
        if (!walkinScheduleId) {
          enqueueSnackbar('No walk-in availability for this target right now.', { variant: 'error' });
          setLoading(false);
          return;
        }
        createSlotInput = {
          scheduleId: walkinScheduleId,
          startISO: DateTime.now().setZone(timezone).toISO() ?? '',
          lengthInMinutes: 15,
          serviceModality: visitType === VisitType.InPersonWalkIn ? ServiceMode['in-person'] : ServiceMode['virtual'],
          walkin: true,
          serviceCategoryCode: serviceCategory,
        };
      } else {
        if (!slot) {
          enqueueSnackbar('Please select a time slot', { variant: 'error' });
          setLoading(false);
          return;
        }
        const scheduleId = slot?.schedule?.reference?.split('/')?.[1] ?? '';
        createSlotInput = {
          scheduleId: scheduleId,
          startISO: slot?.start ?? '',
          lengthInMinutes: getAppointmentDurationFromSlot(slot),
          serviceModality:
            visitType === VisitType.InPersonPreBook || visitType === VisitType.InPersonPostTelemed
              ? ServiceMode['in-person']
              : ServiceMode['virtual'],
          walkin: false,
          postTelemedLabOnly: visitType === VisitType.InPersonPostTelemed,
          serviceCategoryCode: serviceCategory,
        };
      }
      console.log('slot input: ', createSlotInput);
      let persistedSlot: Slot;
      try {
        persistedSlot = await createSlot(createSlotInput, oystehrZambda);
      } catch (error) {
        console.error(`Failed to create slot: ${error}`);
        let errorMessage = 'An unexpected error occurred creating the slot, please try again.';
        if (isApiError(error)) {
          errorMessage = (error as APIError).message;
        }
        enqueueSnackbar(errorMessage, { variant: 'error' });
        setLoading(false);
        return;
      }
      const zambdaParams: CreateAppointmentInputParams = {
        patient: {
          ...patientInfo,
          dateOfBirth: patientInfo?.dateOfBirth || birthDate?.toISODate() || undefined,
          reasonForVisit: isOtherFollowUpReason ? otherReason.trim() : reasonForVisit,
          reasonAdditional: reasonForVisitAdditional !== '' ? reasonForVisitAdditional : undefined,
        },
        slotId: persistedSlot.id!,
        ...(followUpOptions && { followUpOptions }),
      };

      let response;
      let apiErr = false;
      try {
        response = await createAppointment(oystehrZambda, zambdaParams);
      } catch (error) {
        console.error(`Failed to add patient: ${error}`);
        enqueueSnackbar('An unexpected error occurred, please try again.', { variant: 'error' });
        apiErr = true;
      }

      // Best-effort copy: failure here must not block navigation since the visit is already created.
      const clientCopyFields = followUpState?.clientCopyFields;
      const parentEncounterIdForCopy = followUpOptions?.parentEncounterId;
      let clientFailedFields: CopyableFollowupField[] = [];
      if (response && !apiErr && parentEncounterIdForCopy && clientCopyFields && clientCopyFields.length > 0) {
        try {
          await copyChartDataToFollowupMutation.mutateAsync({
            sourceEncounterId: parentEncounterIdForCopy,
            targetEncounterId: response.encounterId,
            fields: clientCopyFields,
          });
        } catch (e) {
          console.error('Failed to copy chart data to follow-up visit:', e);
          // save-chart-data is transactional — treat the whole batch as failed.
          clientFailedFields = clientCopyFields;
        }
      }

      setLoading(false);

      if (response && !apiErr) {
        const { message, variant } = getPostAppointmentSnackbar({
          hasClientCopyFailures: clientFailedFields.length > 0,
          isScheduledFollowUp,
          copyAttempted: (clientCopyFields?.length ?? 0) > 0,
        });
        enqueueSnackbar(message, { variant });
        navigate('/visits');
      } else {
        setErrors({ submit: true });
      }
    }
  };

  return (
    <PageContainer>
      <Grid container direction="row">
        <Grid item xs={3.5} />
        <Grid item xs={5}>
          <CustomBreadcrumbs
            chain={[
              { link: '/visits', children: 'Tracking Board' },
              { link: '#', children: isScheduledFollowUp ? 'Add Scheduled Follow-up' : 'Add Visit' },
            ]}
          />

          {/* page title */}

          <Typography
            variant="h3"
            marginTop={1}
            color={'primary.dark'}
            data-testid={dataTestIds.addPatientPage.pageTitle}
          >
            {isScheduledFollowUp ? 'Add Scheduled Follow-up Visit' : 'Add Visit'}
          </Typography>

          {/* form content */}
          <Paper>
            <form noValidate onSubmit={(e) => handleFormSubmit(e)}>
              <Stack spacing={2} padding={4}>
                <FormControl fullWidth error={!!errors.visitType}>
                  <InputLabel id="visit-type-label">Visit type *</InputLabel>
                  <Select
                    data-testid={dataTestIds.addPatientPage.visitTypeDropdown}
                    labelId="visit-type-label"
                    id="visit-type-select"
                    value={visitType || ''}
                    label="Visit type *"
                    required
                    onChange={(event) => {
                      setSlot(undefined);
                      setVisitType(event.target.value as VisitType);
                    }}
                  >
                    {BOOKING_CONFIG.ehrBookingOptions.map((option) => (
                      <MenuItem value={option.id} key={option.id}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.visitType && <FormHelperText>Visit type is required</FormHelperText>}
                </FormControl>

                <FormControl fullWidth error={!!errors.serviceCategory}>
                  <InputLabel id="service-category-label">Service category *</InputLabel>
                  <Select
                    data-testid={dataTestIds.addPatientPage.serviceCategoryDropdown}
                    labelId="service-category-label"
                    id="service-category-select"
                    value={serviceCategory || ''}
                    label="Service category *"
                    required
                    disabled={defaultServiceCategory !== ''}
                    onChange={(event) => {
                      setServiceCategory(event.target.value);
                    }}
                  >
                    {filteredServiceCategories.map((sc) => (
                      <MenuItem value={sc.code} key={sc.code}>
                        {sc.display}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.serviceCategory && <FormHelperText>Service category is required</FormHelperText>}
                </FormControl>

                <BookableSelect
                  dataTestId={dataTestIds.addPatientPage.bookableSelect}
                  selected={selectedBookable}
                  setSelected={(target) => {
                    setSelectedBookable(target);
                    // Reset slot when the target changes so we don't try to
                    // book a slot belonging to a previously-picked target.
                    setSlot(undefined);
                    setLoadingSlotState({ status: 'initial', input: undefined });
                  }}
                  required
                  disabled={!visitType}
                  mode={
                    visitType === VisitType.InPersonWalkIn ||
                    visitType === VisitType.InPersonPreBook ||
                    visitType === VisitType.InPersonPostTelemed
                      ? [BookableMode.IN_PERSON]
                      : [BookableMode.VIRTUAL]
                  }
                  // Add Visit creates an appointment at a physical place a
                  // patient is treated; Groups and PR-direct Schedules can
                  // span multiple Locations and aren't meaningful answers to
                  // "where will the patient be seen". Locations-only here.
                  resourceTypes={['Location']}
                  serviceCategoryCode={serviceCategory || undefined}
                  onLocationsLoaded={() => {
                    // Side-load not strictly required by the new flow but kept
                    // so existing callers that consumed setLocations stay
                    // unaffected if they're added later.
                  }}
                  error={!!errors.location}
                  helperText="Location is required"
                />

                {!isScheduledFollowUp && (
                  <AddVisitPatientInformationCard
                    patientInfo={patientInfo}
                    setPatientInfo={setPatientInfo}
                    showFields={showFields}
                    setShowFields={setShowFields}
                    setValidDate={setValidDate}
                    errors={errors}
                    setErrors={setErrors}
                    birthDate={birthDate}
                    setBirthDate={setBirthDate}
                  />
                )}
                {isScheduledFollowUp && patientInfo && (
                  <Typography variant="body1" color="text.secondary">
                    Patient: {patientInfo.firstName} {patientInfo.lastName}
                  </Typography>
                )}

                {/* Visit Information */}
                {shouldShowReasonForVisitFields && (
                  <Box marginTop={4}>
                    <Typography variant="h4" color="primary.dark">
                      Visit information
                    </Typography>
                    <Box marginTop={2}>
                      <FormControl fullWidth error={!!errors.reasonForVisit}>
                        <InputLabel id="reason-for-visit-label">Reason for visit *</InputLabel>
                        <Select
                          data-testid={dataTestIds.addPatientPage.reasonForVisitDropdown}
                          labelId="reason-for-visit-label"
                          id="reason-for-visit-select"
                          value={reasonForVisit || ''}
                          label="Reason for visit *"
                          required
                          onChange={(event) => {
                            setReasonForVisit(event.target.value);
                            if (event.target.value !== SCHEDULED_FOLLOWUP_OTHER_REASON) {
                              setOtherReason('');
                            }
                          }}
                        >
                          {reasonForVisitOptions.map((reason) => (
                            <MenuItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.reasonForVisit && <FormHelperText>Reason for visit is required</FormHelperText>}
                      </FormControl>
                    </Box>
                    {isOtherFollowUpReason && (
                      <Box marginTop={2}>
                        <FormControl fullWidth error={!!errors.otherReason}>
                          <TextField
                            label="Other reason"
                            id="follow-up-other-reason-text"
                            value={otherReason}
                            required
                            onChange={(e) => {
                              setOtherReason(e.target.value);
                              if (errors.otherReason) setErrors((prev) => ({ ...prev, otherReason: false }));
                            }}
                            error={!!errors.otherReason}
                            helperText={errors.otherReason ? 'Please specify the follow-up reason' : undefined}
                          />
                        </FormControl>
                      </Box>
                    )}
                    <Box marginTop={2}>
                      <FormControl fullWidth>
                        <TextField
                          label="Tell us more (optional)"
                          id="reason-additional-text"
                          value={reasonForVisitAdditional}
                          aria-describedby="reason-additional-helper-text"
                          onChange={(e) => handleAdditionalReasonForVisitChange(e.target.value?.trimStart())}
                          maxRows={2}
                          multiline={true}
                          error={!validReasonForVisit}
                        />
                        {reasonForVisitAdditional.length > 100 && (
                          <Typography
                            variant="caption"
                            color={validReasonForVisit ? 'text.secondary' : 'error'}
                            sx={{ marginTop: 1 }}
                          >
                            {`${reasonForVisitAdditional.length} / ${MAXIMUM_CHARACTER_LIMIT}${
                              !validReasonForVisit ? ` - ${reasonForVisitErrorMessage}` : ''
                            }`}
                          </Typography>
                        )}
                      </FormControl>
                    </Box>
                    {(visitType === VisitType.InPersonPreBook ||
                      visitType === VisitType.InPersonPostTelemed ||
                      visitType === VisitType.VirtualScheduled) && (
                      <SlotPicker
                        slotData={
                          visitType === VisitType.InPersonPostTelemed
                            ? locationWithSlotData?.telemedAvailable?.map((si) => si.slot)
                            : locationWithSlotData?.available?.map((si) => si.slot)
                        }
                        slotsLoading={loadingSlotState.status === 'loading'}
                        bookableSlug={selectedBookable?.slug}
                        bookableScheduleType={
                          selectedBookable?.resourceType === 'HealthcareService'
                            ? ScheduleType.group
                            : selectedBookable?.resourceType === 'PractitionerRole'
                            ? ScheduleType.provider
                            : ScheduleType.location
                        }
                        serviceCategoryCode={serviceCategory as any}
                        timezone={locationWithSlotData?.location?.timezone || 'Undefined'}
                        selectedSlot={slot}
                        setSelectedSlot={setSlot}
                      />
                    )}
                  </Box>
                )}

                {/* form buttons */}
                <Box marginTop={4}>
                  {errors.submit && (
                    <Typography color="error" variant="body2" mb={2}>
                      Failed to add patient. Please try again.
                    </Typography>
                  )}
                  {errors.search && (
                    <Typography color="error" variant="body2" mb={2}>
                      Please search for patients before adding
                    </Typography>
                  )}
                  <LoadingButton
                    data-testid={dataTestIds.addPatientPage.addButton}
                    variant="contained"
                    type="submit"
                    loading={loading}
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      marginRight: 1,
                    }}
                  >
                    Add {visitType}
                  </LoadingButton>
                  <Button
                    data-testid={dataTestIds.addPatientPage.cancelButton}
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      navigate('/visits');
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Stack>
            </form>
            <CustomDialog
              open={selectSlotDialogOpen}
              title="Please select a date and time"
              description="To continue, please select an available appointment."
              closeButtonText="Close"
              handleClose={() => setSelectSlotDialogOpen(false)}
            />
          </Paper>
        </Grid>

        <Grid item xs={3.5} />
      </Grid>
    </PageContainer>
  );
}
