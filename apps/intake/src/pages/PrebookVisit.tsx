import { Autocomplete, Skeleton, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Box, styled } from '@mui/system';
import { Slot } from 'fhir/r4b';
import noop from 'lodash/noop';
import { FC, useEffect, useState } from 'react';
import { generatePath, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  APIError,
  BookableItem,
  BOOKING_CONFIG,
  CreateSlotParams,
  createSlotParamsFromSlotAndOptions,
  GetScheduleResponse,
  isApiError,
  ScheduleType,
  ServiceCategoryCode,
  ServiceCategoryCodeSchema,
  ServiceMode,
  shouldShowServiceCategorySelectionPage,
  SlotListItem,
} from 'utils';
import ottehrApi from '../api/ottehrApi';
import {
  BOOKING_SCHEDULE_ON_QUERY_PARAM,
  BOOKING_SCHEDULE_SELECTED_SLOT,
  BOOKING_SCHEDULE_TYPE_QUERY_PARAM,
  BOOKING_SERVICE_CATEGORY_PARAM,
  BOOKING_SERVICE_MODE_PARAM,
  bookingBasePath,
  intakeFlowPageRoute,
} from '../App';
import { PageContainer, Schedule } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import { BoldPurpleInputLabel } from '../components/form';
import { dataTestIds } from '../helpers/data-test-ids';
import { useServiceCategories } from '../hooks/useServiceCategories';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors } from '../IntakeThemeProvider';
import { useGetBookableItems, useGetSchedule } from '../telemed/features/appointments/appointment.queries';
import { useOystehrAPIClient } from '../telemed/utils';

const SERVICE_MODES: ServiceMode[] = [ServiceMode['in-person'], ServiceMode['virtual']];

const getUrl = (): string => {
  return `${window.location.pathname}${window.location.search}`;
};

const findSelectedSlotFromAvailable = (available: SlotListItem[], selectedSlotId?: string): Slot | undefined => {
  if (!selectedSlotId) {
    return undefined;
  }

  // todo: test needed to ensure an existing tentative-busy slot is included in the list of available
  // slots whenever this page is being used to update a previously selected slot time
  return available.find((si) => {
    const { slot, owner } = si;
    const { id: slotId, start: slotStart } = slot;

    if (owner.id && selectedSlotId.startsWith(owner.id)) {
      return `${owner.id}|${slotStart}` === selectedSlotId;
    } else {
      return slotId === selectedSlotId;
    }
  })?.slot;
};

const useBookingParams = (
  selectedLocation: BookableItem | null
): {
  serviceMode: ServiceMode;
  bookingOn: string | null;
  scheduleType: ScheduleType | null;
  selectedSlot: string | undefined;
  slugToFetch: string | undefined;
  serviceModeFromParam: string | undefined;
  serviceCategoryCode: ServiceCategoryCode | undefined;
  atLocationSlug: string | null;
} => {
  const [searchParams] = useSearchParams();
  const pathParams = useParams();
  const bookingOn = searchParams.get(BOOKING_SCHEDULE_ON_QUERY_PARAM);
  const scheduleTypeFromParam = searchParams.get(BOOKING_SCHEDULE_TYPE_QUERY_PARAM) as ScheduleType | null;
  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM];
  const serviceCategoryCodeFromParam = searchParams.get(BOOKING_SERVICE_CATEGORY_PARAM);
  const atLocationSlug = searchParams.get('atLocation');

  const typeMap: Record<string, ScheduleType> = {
    HealthcareService: ScheduleType.group,
    Location: ScheduleType.location,
    Practitioner: ScheduleType.provider,
    PractitionerRole: ScheduleType.provider,
  };

  return {
    serviceMode: serviceModeFromParam as ServiceMode,
    serviceModeFromParam,
    bookingOn,
    selectedSlot: searchParams.get(BOOKING_SCHEDULE_SELECTED_SLOT) ?? undefined,
    scheduleType: scheduleTypeFromParam || (selectedLocation && typeMap[selectedLocation.resourceType]),
    slugToFetch: bookingOn ?? selectedLocation?.slug,
    serviceCategoryCode: ServiceCategoryCodeSchema.safeParse(serviceCategoryCodeFromParam)?.data ?? undefined,
    atLocationSlug,
  };
};

const useBookingData = (
  serviceMode: ServiceMode,
  slugToFetch: string | undefined,
  scheduleType: ScheduleType | null,
  serviceCategoryCode?: ServiceCategoryCode,
  atLocationSlug?: string | null
): {
  bookableItems: BookableItem[];
  isCategorized: boolean;
  isLoading: boolean;
  slotData: GetScheduleResponse | undefined;
  isSlotsLoading: boolean;
  inPersonData?: { items: BookableItem[]; categorized: boolean };
} => {
  const apiClient = useOystehrAPIClient({ tokenless: true });

  const { data: inPersonData, status: inPersonStatus } = useGetBookableItems(
    apiClient,
    Boolean(apiClient) && serviceMode === 'in-person',
    { serviceMode }
  );

  const { data: virtualData, status: virtualStatus } = useGetBookableItems(
    apiClient,
    Boolean(apiClient) && serviceMode === 'virtual',
    { serviceMode }
  );

  // Threading atLocationSlug into get-schedule narrows the slot pool to a
  // specific Location for owners that span multiple. When absent for such
  // owners, the server returns pickableLocations[] (with empty slot lists)
  // so the page can render a Location picker; once the patient picks, the
  // URL gains atLocation, this hook re-fires, and real slots come back.
  const { data: slotData, status: slotsStatus } = useGetSchedule(
    apiClient,
    Boolean(apiClient) && Boolean(slugToFetch) && Boolean(scheduleType),
    {
      slug: slugToFetch ?? '',
      scheduleType: scheduleType ?? ScheduleType.location,
      serviceCategoryCode,
      ...(atLocationSlug && { atLocationSlug }),
    }
  );

  const currentData = serviceMode === ServiceMode['in-person'] ? inPersonData : virtualData;

  const isLoading =
    serviceMode === ServiceMode['in-person'] ? inPersonStatus === 'pending' : virtualStatus === 'pending';

  return {
    bookableItems: currentData?.items ?? [],
    isCategorized: currentData?.categorized ?? false,
    isLoading,
    slotData,
    isSlotsLoading: slotsStatus === 'pending',
    inPersonData,
  };
};

// Spelling-based article selection. Picks "an" when the next word starts
// with a vowel letter, otherwise "a". Covers the realistic span of service-
// category display names ("Urgent Care", "Occupational Medicine", "Workers
// Comp", "Eye Care", …); the few orthographic-but-not-phonetic exceptions
// ("a university", "an hour") aren't worth a phonetic dictionary here —
// service-category labels in this product don't hit them.
const articleFor = (word: string): 'a' | 'an' => {
  const first = word.trim().charAt(0).toLowerCase();
  return ['a', 'e', 'i', 'o', 'u'].includes(first) ? 'an' : 'a';
};

const getLocationTitleText = ({
  selectedLocation,
  bookingOn,
  slotData,
  isSlotsLoading,
  serviceCategoryDisplay,
}: {
  selectedLocation: BookableItem | null;
  bookingOn: string | null;
  slotData?: GetScheduleResponse;
  isSlotsLoading: boolean;
  serviceCategoryDisplay?: string;
}): string => {
  if ((!selectedLocation && !bookingOn) || isSlotsLoading) {
    return 'Book a visit';
  }

  // For group bookings, the server overrides slotData.location.name to the
  // resolved Location's name *when* the group flow has narrowed to a single
  // concrete Location (explicit atLocationSlug, or the auto-pick for groups
  // with exactly one qualifying Location). Multi-Location group flows that
  // haven't resolved a Location yet return early server-side with
  // pickableLocations and no slots — that case is handled by the location-
  // picker effect below, not this title. For location/provider owners
  // slotData.location.name is already the correct name. selectedLocation /
  // bookingOn are the Autocomplete / URL fallbacks when slotData hasn't
  // resolved yet.
  const locationName = slotData?.location?.name || selectedLocation?.label || bookingOn;
  const isProviderSchedule = slotData?.location?.scheduleOwnerType === ScheduleType.provider;
  const preposition = isProviderSchedule ? 'with' : 'at';
  // Compose "Book a/an {category} visit {at|with} {location}". Article is
  // chosen by the category's first letter ("an Urgent Care", "a Workers
  // Comp"); falls back to the plain "a" when no category is resolved.
  // Segments drop out when their data isn't ready so the title degrades
  // gracefully ("Book a visit", "Book an Urgent Care visit", etc.) rather
  // than rendering stranded whitespace.
  const parts: string[] = ['Book'];
  if (serviceCategoryDisplay) {
    parts.push(articleFor(serviceCategoryDisplay), serviceCategoryDisplay);
  } else {
    parts.push('a');
  }
  parts.push('visit');
  if (locationName) parts.push(preposition, locationName);
  return parts.join(' ');
};

const PrebookVisit: FC = () => {
  const navigate = useNavigate();
  const pathParams = useParams();
  const { state: navState } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isReschedule = Boolean(navState?.reschedule);

  const [serviceModeIndex, setServiceModeIndex] = useState<0 | 1>(0);
  const [selectedInPersonLocation, setSelectedInPersonLocation] = useState<BookableItem | null>(null);
  const [selectedVirtualLocation, setSelectedVirtualLocation] = useState<BookableItem | null>(null);

  const [errorDialogConfig, setErrorDialogConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM];
  const serviceMode: ServiceMode = (serviceModeFromParam as ServiceMode | undefined) ?? SERVICE_MODES[serviceModeIndex];

  const selectedLocation =
    (serviceModeFromParam ?? serviceMode) === 'in-person' ? selectedInPersonLocation : selectedVirtualLocation;

  const { bookingOn, scheduleType, selectedSlot, slugToFetch, serviceCategoryCode, atLocationSlug } =
    useBookingParams(selectedLocation);

  // When the booking URL targets a multi-Location owner without specifying
  // an atLocation slug, get-schedule returns the list of qualifying
  // Locations in `pickableLocations` (with empty slot lists). We push the
  // chosen slug back into the URL so the same get-schedule call refires
  // with disambiguated location → real slots come back. Pushing (not
  // replacing) so the back button returns to the picker — useful when the
  // chosen location has no slots and the patient wants to try another.
  const handleLocationPick = (locationSlug: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set('atLocation', locationSlug);
    setSearchParams(next);
  };

  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const {
    bookableItems,
    isCategorized,
    isLoading: isBookablesLoading,
    slotData,
    isSlotsLoading,
  } = useBookingData(serviceMode, slugToFetch, scheduleType, serviceCategoryCode, atLocationSlug);

  // Picker-redirect: when a deep link carries scheduleType + bookingOn but
  // no serviceCategory, and the destination supports more than one category
  // in the current (serviceMode, visitType) context, send the patient to
  // the category picker first. Without this guard the booking flow proceeds
  // without a category — create-slot then either back-compat-defaults to
  // urgent-care (fine on Location-actored Schedules) or rejects with "not
  // bookable against a provider-owned schedule" (PR-actored member
  // Schedules in a group, since urgent-care is BOOKING_CONFIG and the PR
  // guard blocks compile-time categories on PR Schedules). The picker
  // round-trips back here with `?serviceCategory=<code>` appended, at which
  // point this effect's first guard bails. Mirrors the same picker-decision
  // logic Homepage uses for homepage-button entry — `shouldShow…` filters
  // by (mode, visit-type) and respects a group's allow-list. `replace`
  // keeps the back button pointed at the referring page (not a no-op
  // booking page the patient never saw).
  //
  // Scope the useServiceCategories call only for group deeplinks. The hook's
  // loading-state fallback gates on `isScoped = scheduleType && bookingOn`
  // (returns [] for scoped, BOOKING_CONFIG for unscoped) — passing both
  // unconditionally for non-group cases produces an empty-list window
  // before the network resolves, delaying the redirect decision past the
  // initial render. The zambda only narrows by allow-list for the group
  // case anyway; location/provider deeplinks get the same full catalog
  // either way, so the unscoped call here is semantically identical and
  // gives us the BOOKING_CONFIG fallback synchronously on first render.
  const isGroupDeeplink = scheduleType === ScheduleType.group && Boolean(bookingOn);
  const { serviceCategories: scopedServiceCategories, isLoading: scopedServiceCategoriesLoading } =
    useServiceCategories(isGroupDeeplink ? { scheduleType, bookingOn: bookingOn ?? undefined } : {});
  useEffect(() => {
    if (serviceCategoryCode) return;
    if (scopedServiceCategoriesLoading) return;
    if (!scheduleType || !bookingOn) return;
    if (!serviceMode) return;
    const shouldPick = shouldShowServiceCategorySelectionPage({
      serviceMode,
      visitType: 'prebook',
      serviceCategories: scopedServiceCategories,
    });
    if (!shouldPick) return;
    navigate(`/prebook/${serviceMode}/select-service-category?${searchParams.toString()}`, { replace: true });
  }, [
    serviceCategoryCode,
    scopedServiceCategoriesLoading,
    scopedServiceCategories,
    scheduleType,
    bookingOn,
    serviceMode,
    navigate,
    searchParams,
  ]);

  // If the owner spans exactly one Location, skip the picker — there's no
  // choice to make. Replacing (not pushing) keeps the back button pointed
  // at the referring page rather than a no-op picker the patient never saw.
  useEffect(() => {
    if (atLocationSlug) return;
    const only = slotData?.pickableLocations?.length === 1 ? slotData.pickableLocations[0] : undefined;
    if (!only?.slug) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('atLocation', only.slug);
        return next;
      },
      { replace: true }
    );
  }, [atLocationSlug, slotData?.pickableLocations, setSearchParams]);

  const handleBookableSelection = (_e: any, newValue: BookableItem | null): void => {
    const serviceType = newValue?.serviceMode ?? serviceModeFromParam ?? serviceMode;
    const setLocation = serviceType === 'in-person' ? setSelectedInPersonLocation : setSelectedVirtualLocation;
    setLocation(newValue);
  };

  const handleSlotSelection = async (slot?: Slot): Promise<void> => {
    if (slot && tokenlessZambdaClient) {
      // Use test questionnaire canonical if injected via config (for e2e test isolation)
      const questionnaireCanonical =
        serviceMode === ServiceMode.virtual
          ? BOOKING_CONFIG.virtualQuestionnaireCanonical
          : BOOKING_CONFIG.inPersonQuestionnaireCanonical;
      const createSlotInput: CreateSlotParams = {
        ...createSlotParamsFromSlotAndOptions(slot, {
          originalBookingUrl: getUrl(),
          status: 'busy-tentative',
          // The /prebook/:mode URL segment is the patient's chosen modality and is
          // authoritative. For group links the vended slot can carry the wrong
          // modality (owner is a PractitionerRole/group, not a virtual Location),
          // so a /prebook/virtual group booking would otherwise create an
          // in-person visit. Passing it here keeps the appointment's type correct.
          serviceModality: serviceMode,
        }),
        ...(questionnaireCanonical && { questionnaireCanonical }),
      };

      try {
        const slot = await ottehrApi.createSlot(createSlotInput, tokenlessZambdaClient);
        const basePath = generatePath(bookingBasePath, {
          slotId: slot.id!,
        });
        if (isReschedule) {
          navigate(`${basePath}/review`);
        } else {
          const basePath = generatePath(bookingBasePath, {
            slotId: slot.id!,
          });
          navigate(`${basePath}/patients`);
        }
      } catch (error) {
        let errorMessage = 'Sorry, this time slot may no longer be available. Please select another time.';
        if (isApiError(error)) {
          errorMessage = (error as APIError).message;
        }
        setErrorDialogConfig({
          title: 'Error reserving time',
          description: errorMessage,
          closeButtonText: 'Ok',
        });
      }
    }
  };

  // Service category display name — resolved from the category code carried
  // in the URL once the picker (or single-match auto-select) has set it. Uses
  // the same scoped-or-system catalog the picker-redirect effect above
  // consults, so the display name lines up with whatever the patient picked.
  const serviceCategoryDisplay = serviceCategoryCode
    ? scopedServiceCategories.find((sc) => sc.category.code === serviceCategoryCode)?.category.display
    : undefined;

  const title = getLocationTitleText({
    selectedLocation,
    bookingOn,
    slotData,
    isSlotsLoading,
    serviceCategoryDisplay,
  });

  if (serviceModeFromParam && !(serviceModeFromParam in ServiceMode)) {
    return <Navigate to={intakeFlowPageRoute.PrebookVisit.path} replace />;
  }

  return (
    <PageContainer title={title} imgAlt="Chat icon">
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information just
        once. Next time you return, it will all be here for you!
      </Typography>

      <ServiceModeSelector
        serviceModeIndex={serviceModeIndex}
        setServiceModeIndex={setServiceModeIndex}
        hidden={Boolean(serviceModeFromParam) || Boolean(bookingOn)}
      />

      <SelectionContainer>
        {!bookingOn &&
          (isBookablesLoading ? (
            <LoadingSkeleton />
          ) : (
            <Autocomplete
              id="bookable-autocomplete"
              options={bookableItems}
              data-testid={dataTestIds.scheduleVirtualVisitStatesSelector}
              getOptionLabel={(option) => option.label || option.state || ''}
              onChange={handleBookableSelection}
              groupBy={isCategorized ? (option) => option.category ?? '' : undefined}
              value={selectedLocation}
              isOptionEqualToValue={(option, value) => option.state === value.state}
              renderOption={(props, option) => (
                <li {...props} key={`option-${option.resourceId}`}>
                  <Box>
                    <Typography sx={{ pt: 1 }} variant="body2">
                      {option.label}
                    </Typography>
                    {option.secondaryLabel.map((label, idx) => (
                      <Typography variant="body2" color="text.secondary" key={`sec-${option.resourceId}-${idx}`}>
                        {label}
                      </Typography>
                    ))}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <>
                  <BoldPurpleInputLabel required shrink sx={{ whiteSpace: 'pre-wrap' }}>
                    Select a location
                  </BoldPurpleInputLabel>
                  <StyledTextField {...params} placeholder="Search or select" variant="outlined" />
                </>
              )}
            />
          ))}

        {slugToFetch &&
          (isSlotsLoading ? (
            <LoadingSkeleton />
          ) : slotData?.pickableLocations && slotData.pickableLocations.length > 0 ? (
            // The targeted owner spans multiple Locations; pick one before
            // we can show slots. Re-uses the page's existing Autocomplete
            // styling for consistency with the bookable-item picker above.
            <Autocomplete
              id="pickable-location-autocomplete"
              options={slotData.pickableLocations}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_e, value) => {
                if (value?.slug) handleLocationPick(value.slug);
              }}
              renderOption={(props, option) => (
                <li {...props} key={`pickable-loc-${option.id}`}>
                  <Typography sx={{ pt: 1 }} variant="body2">
                    {option.name}
                  </Typography>
                </li>
              )}
              renderInput={(params) => (
                <>
                  <BoldPurpleInputLabel required shrink sx={{ whiteSpace: 'pre-wrap' }}>
                    Choose a location
                  </BoldPurpleInputLabel>
                  <StyledTextField {...params} placeholder="Search or select" variant="outlined" />
                </>
              )}
            />
          ) : (
            <Schedule
              customOnSubmit={handleSlotSelection}
              slotData={(slotData?.available ?? []).map((sli) => sli.slot)}
              slotsLoading={false}
              existingSelectedSlot={findSelectedSlotFromAvailable(slotData?.available ?? [], selectedSlot)}
              timezone={selectedLocation?.timezone ?? slotData?.timezone ?? 'America/New_York'}
              forceClosedToday={false}
              forceClosedTomorrow={false}
              handleSlotSelected={noop}
            />
          ))}
      </SelectionContainer>

      <ErrorDialog
        open={!!errorDialogConfig}
        title={errorDialogConfig?.title || ''}
        description={errorDialogConfig?.description || ''}
        closeButtonText={errorDialogConfig?.closeButtonText || ''}
        handleClose={() => setErrorDialogConfig(undefined)}
      />
    </PageContainer>
  );
};

const LoadingSkeleton: FC = () => (
  <Skeleton
    sx={{
      borderRadius: 2,
      backgroundColor: otherColors.coachingVisit,
      p: 6,
    }}
  />
);

const SelectionContainer = styled(Box)({
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  marginTop: '20px',
  minHeight: '200px',
});

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: theme.palette.background.paper,
    borderColor: otherColors.lightGray,
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: otherColors.lightGray,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: otherColors.lightGray,
    },
  },
}));

interface ServiceModeSelectorProps {
  serviceModeIndex: number;
  setServiceModeIndex: (idx: 0 | 1) => void;
  hidden?: boolean;
}

const ServiceModeSelector: FC<ServiceModeSelectorProps> = ({ setServiceModeIndex, serviceModeIndex, hidden }) => {
  return (
    <Box sx={{ border: '0px', display: hidden ? 'none' : 'block' }}>
      <Tabs
        value={serviceModeIndex}
        onChange={(_e, val) => setServiceModeIndex(val as 0 | 1)}
        aria-label="service mode tabs"
      >
        <Tab label="In Person" />
        <Tab label="Virtual" />
      </Tabs>
    </Box>
  );
};

export default PrebookVisit;
