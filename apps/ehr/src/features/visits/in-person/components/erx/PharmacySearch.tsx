import { Autocomplete, Box, PopperProps, TextField, Tooltip } from '@mui/material';
import { createContext, FC, HTMLAttributes, ReactNode, useContext, useState } from 'react';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { directoryPharmacyToResult } from 'utils/lib/helpers/erx-pharmacy-match';
import { PharmacyDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ErxDirectoryQuery, PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import {
  useCheckPlace,
  usePharmaciesByNcpdpId,
  usePharmacyDirectory,
  usePharmacyPlaces,
} from '../../../shared/hooks/useErxPharmacies';

// The mockup's colors (erx-pharmacy-picker.html).
const COLORS = {
  label: '#0F347C',
  tint: '#F3F6FA',
  faint: 'rgba(0,0,0,.45)',
  muted: 'rgba(0,0,0,.6)',
  on: 'rgba(25,118,210,.06)',
  okBg: '#EDF7ED',
  ok: '#2E7D32',
  warnBg: '#FFF4E5',
  no: '#B26A00',
  warnText: '#5F2B00',
};

/** A row in the list: a directory pharmacy (with whether it can e-prescribe, before anything is typed), a Google
 * suggestion, checked against the directory when picked, or the row that swaps Google's results for the directory's
 * and back. */
type PharmacyOption =
  | {
      kind: 'pharmacy';
      key: string;
      name: string;
      address: string;
      group: string;
      /** Undefined when it can't be e-prescribed to. */
      pharmacy?: PharmacySearchResult;
      /** The eRx chip: shown once known. */
      erx?: boolean;
    }
  | { kind: 'place'; key: string; name: string; address: string; placesId: string }
  | { kind: 'switch'; key: 'directory' | 'google'; name: string; address: '' };

const SEARCHING = 'Searching…';

/** What's typed as a directory search: a zip, an NCPDP ID, a phone number (punctuation ignored), else a name. */
const directoryQuery = (text: string): ErxDirectoryQuery => {
  if (/^\d{5}$/.test(text)) return { zipCode: text };
  if (/^\d{7}$/.test(text)) return { ncpdpId: text };
  const digits = text.replace(/\D/g, '');
  if (digits.length === 10 && /^[\d\s().+-]+$/.test(text)) return { phone: digits };
  return { name: text };
};

/** Warning shown between the field and the list. */
const NoticeContext = createContext<ReactNode>(null);

/** The list sits in the popover under the field, as in the mockup, rather than floating: so not in MUI's popper
 * class, which positions it absolutely. */
const InlineList: FC<PopperProps> = ({ open, children }) =>
  open ? <Box sx={{ mt: '6px' }}>{children as ReactNode}</Box> : null;

const ListPaper: FC<HTMLAttributes<HTMLElement>> = ({ children, className }) => {
  const notice = useContext(NoticeContext);
  return (
    <Box
      className={className}
      sx={{
        fontSize: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        // As the notice's status above the row that switches between Google and the directory.
        '& .MuiAutocomplete-noOptions, & .MuiAutocomplete-loading': { padding: '8px 12px' },
      }}
    >
      {notice}
      <div>{children}</div>
    </Box>
  );
};

const Chip: FC<{ erx: boolean }> = ({ erx }) => (
  <Box
    component="span"
    sx={{
      fontSize: '11.5px',
      fontWeight: 500,
      borderRadius: '10px',
      padding: '1px 8px',
      whiteSpace: 'nowrap',
      gridRow: 1,
      gridColumn: 2,
      ...(erx
        ? { backgroundColor: COLORS.okBg, color: COLORS.ok }
        : { backgroundColor: COLORS.warnBg, color: COLORS.no }),
    }}
  >
    {erx ? 'eRx ✓' : "Can't e-prescribe"}
  </Box>
);

export interface OnFilePharmacy {
  firstName?: string;
  saved: PharmacyDTO;
  /** Its directory match: null when there is none, undefined while it's being looked up. */
  pharmacy: PharmacySearchResult | null | undefined;
}

export const PharmacySearch: FC<{
  onPick: (pharmacy: PharmacySearchResult) => void;
  /** Why a pharmacy can't be picked, if it can't: it shows disabled, saying why on hover. */
  unavailable?: (pharmacy: PharmacySearchResult) => string | undefined;
  /** Before anything is typed: the patient's saved pharmacy... */
  onFile?: OnFilePharmacy;
  /** ...and the pharmacies the patient's prescriptions went to, by NCPDP ID. */
  sentBefore?: { ncpdpId: string; name?: string }[];
}> = ({ onPick, unavailable, onFile, sentBefore = [] }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // As the patient paperwork's Google search.
  const { debounce } = useDebounce(450);
  const places = usePharmacyPlaces(debouncedQuery);
  const checkPlace = useCheckPlace();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string>();
  // A picked place that can't be picked: why, and its zip for the list of those that can.
  const [notice, setNotice] = useState<{ text: string; zipCode?: string }>();
  const sameZip = usePharmacyDirectory(notice?.zipCode ? { zipCode: notice.zipCode } : undefined);
  // What was typed when the directory was searched for it; typing again goes back to Google.
  const [directory, setDirectory] = useState<string>();
  const directoryResults = usePharmacyDirectory(directory ? directoryQuery(directory) : undefined);
  const sent = usePharmaciesByNcpdpId(
    sentBefore.map(({ ncpdpId }) => ncpdpId).filter((ncpdpId) => ncpdpId !== onFile?.pharmacy?.ncpdpId)
  );

  const beforeTyping: PharmacyOption[] = [
    ...(onFile
      ? [
          {
            kind: 'pharmacy' as const,
            key: 'on-file',
            group: `On file for ${onFile.firstName ?? 'the patient'}`,
            name: `${onFile.pharmacy?.name ?? onFile.saved.name} (preferred)`,
            address: onFile.pharmacy?.address ?? onFile.saved.address,
            pharmacy: onFile.pharmacy ?? undefined,
            erx: onFile.pharmacy === undefined ? undefined : onFile.pharmacy !== null,
          },
        ]
      : []),
    ...sent.map(({ ncpdpId, row, status }) => {
      const pharmacy = row && directoryPharmacyToResult(row);
      return {
        kind: 'pharmacy' as const,
        key: ncpdpId,
        group: 'Sent to before',
        name: row?.name ?? sentBefore.find((item) => item.ncpdpId === ncpdpId)?.name ?? ncpdpId,
        address: pharmacy?.address ?? '',
        pharmacy,
        erx: status === 'success' ? Boolean(pharmacy) : undefined,
      };
    }),
  ];

  const typed = query.trim();
  const options: PharmacyOption[] = notice
    ? (sameZip.data ?? []).map((pharmacy) => ({
        kind: 'pharmacy',
        key: pharmacy.ncpdpId,
        group: `Can receive e-prescriptions in ${notice.zipCode}`,
        name: pharmacy.name,
        address: pharmacy.address,
        pharmacy,
      }))
    : checking
    ? []
    : !typed
    ? beforeTyping
    : directory
    ? [
        // First, so it's reachable without scrolling through the directory's results.
        { kind: 'switch', key: 'google', name: 'Back to Google results', address: '' },
        ...(directoryResults.data ?? []).map((pharmacy) => ({
          kind: 'pharmacy' as const,
          key: pharmacy.ncpdpId,
          group: 'Compounding, mail-order and other pharmacies',
          name: pharmacy.name,
          address: pharmacy.address,
          pharmacy,
        })),
      ]
    : typed.length < 3
    ? []
    : [
        ...(places.data ?? []).map((place) => ({
          kind: 'place' as const,
          key: place.placesId,
          name: place.name,
          address: place.address,
          placesId: place.placesId,
        })),
        {
          kind: 'switch',
          key: 'directory',
          name: `Search compounding, mail-order and other pharmacies for "${typed}"`,
          address: '',
        },
      ];
  const whyNot = (option: PharmacyOption): string | undefined =>
    option.kind === 'pharmacy' ? (option.pharmacy ? unavailable?.(option.pharmacy) : "Can't e-prescribe") : undefined;
  const error = checkError ?? (notice ? sameZip.error : directory ? directoryResults.error : places.error)?.message;
  // Why the list is empty; while typing it shows above the row that switches between Google and the directory.
  const status = error ? (
    <Box component="span" sx={{ color: 'error.main' }}>
      {error}
    </Box>
  ) : notice ? (
    notice.zipCode ? (
      `No pharmacies in ${notice.zipCode} can receive e-prescriptions`
    ) : null
  ) : !directory && typed.length < 3 ? (
    'Type to search pharmacies'
  ) : (directory ? directoryResults.isFetching : debouncedQuery !== query || places.isFetching) ? (
    SEARCHING
  ) : (
    'Nothing found for this search criteria'
  );
  const onlySwitch = options.length === 1 && options[0].kind === 'switch';

  const pickPlace = async (option: Extract<PharmacyOption, { kind: 'place' }>): Promise<void> => {
    if (!checkPlace) return;
    setChecking(true);
    try {
      const { name, zipCode, pharmacy } = await checkPlace(option.placesId);
      const why = pharmacy && unavailable?.(pharmacy);
      if (pharmacy && !why) onPick(pharmacy);
      else if (pharmacy) setNotice({ text: `${pharmacy.name}: ${why}. Pick another pharmacy.` });
      else setNotice({ text: `${name || option.name} can't receive e-prescriptions. Pick another pharmacy.`, zipCode });
    } catch (e) {
      console.error('Error checking the pharmacy:', e);
      setCheckError(e instanceof Error && e.message ? e.message : 'The pharmacy could not be checked.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <NoticeContext.Provider
      value={
        notice ? (
          <Box
            sx={{
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '13px',
              lineHeight: 1.5,
              backgroundColor: COLORS.warnBg,
              color: COLORS.warnText,
            }}
          >
            {notice.text}
          </Box>
        ) : (
          onlySwitch && <Box sx={{ color: 'text.secondary', padding: '8px 12px' }}>{status}</Box>
        )
      }
    >
      <Box sx={{ width: 360, pt: 0.5 }}>
        <Autocomplete<PharmacyOption>
          open
          disablePortal
          autoHighlight
          // The list is always open, so there is nothing to toggle.
          forcePopupIcon={false}
          PopperComponent={InlineList}
          PaperComponent={ListPaper}
          options={options}
          loading={checking || (notice ? sameZip.isFetching : places.isFetching)}
          loadingText={SEARCHING}
          filterOptions={(items) => items}
          groupBy={(option) => (option.kind === 'pharmacy' ? option.group : '')}
          getOptionLabel={(option) => `${option.name} - ${option.address}`}
          getOptionDisabled={(option) => Boolean(whyNot(option))}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          renderGroup={(params) => (
            <li key={params.key}>
              {params.group && (
                <Box
                  sx={{
                    backgroundColor: COLORS.tint,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: COLORS.label,
                    letterSpacing: '.03em',
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    // Stays at the top while its rows scroll, as MUI's.
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {params.group}
                </Box>
              )}
              <Box component="ul" sx={{ p: 0 }}>
                {params.children}
              </Box>
            </li>
          )}
          renderOption={(props, option) => {
            if (option.kind === 'switch') {
              return (
                <li {...props} key={option.key}>
                  <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }}>
                    {option.name}
                  </Box>
                </li>
              );
            }
            const why = option.kind === 'pharmacy' && option.pharmacy ? unavailable?.(option.pharmacy) : undefined;
            const item = (
              <li {...props} key={option.key} style={why ? { pointerEvents: 'auto' } : undefined}>
                <span>{option.name}</span>
                {option.kind === 'pharmacy' && option.erx !== undefined && <Chip erx={option.erx} />}
                <Box component="span" className="pharmacy-address" sx={{ gridColumn: 1, fontSize: '12.5px' }}>
                  {option.address}
                </Box>
              </li>
            );
            // A disabled option takes no pointer events; this one does, for its tooltip. describeChild keeps the
            // pharmacy as its name and the reason as its description.
            return why ? (
              <Tooltip key={option.key} title={why} placement="right" describeChild>
                {item}
              </Tooltip>
            ) : (
              item
            );
          }}
          ListboxProps={{
            sx: {
              p: 0,
              // Short enough to fit the 360px popup card under the field and a notice, so only the list scrolls.
              maxHeight: 240,
              '& .MuiAutocomplete-option': {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '2px 10px',
                alignItems: 'baseline',
                padding: '6px 12px',
                minHeight: 'auto',
                fontWeight: 400,
                '& .pharmacy-address': { color: COLORS.muted },
              },
              '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: COLORS.on },
              '& .MuiAutocomplete-option[aria-disabled="true"]': {
                opacity: 1,
                color: COLORS.faint,
                '& .pharmacy-address': { color: COLORS.faint },
              },
            },
          }}
          inputValue={query}
          onInputChange={(_event, value, reason) => {
            // A pick keeps what was typed.
            if (reason === 'reset') return;
            setQuery(value);
            setDirectory(undefined);
            setNotice(undefined);
            setCheckError(undefined);
            debounce(() => setDebouncedQuery(value));
          }}
          value={null}
          onChange={(_event, option) => {
            if (!option || whyNot(option)) return;
            if (option.kind === 'switch') setDirectory(option.key === 'directory' ? typed : undefined);
            else if (option.kind === 'place') void pickPlace(option);
            else if (option.pharmacy) onPick(option.pharmacy);
          }}
          noOptionsText={status}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Pharmacy"
              placeholder="Search by name, address or zip"
              sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
            />
          )}
        />
      </Box>
    </NoticeContext.Provider>
  );
};
