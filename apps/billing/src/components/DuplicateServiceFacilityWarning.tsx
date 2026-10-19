import { Alert, Box, Link } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { isCLIAValid, isNPIValidWithChecksum } from 'utils/lib/helpers/helpers';
import { ServiceFacilityItem } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingServiceFacilities } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

// Only a handful of matches are listed; a real duplicate set is expected to be small.
const MAX_MATCHES = 5;

interface Matches {
  npi: ServiceFacilityItem[];
  clia: ServiceFacilityItem[];
}

const NO_MATCHES: Matches = { npi: [], clia: [] };

// Non-blocking warning shown while editing a service facility whose NPI or CLIA number is already
// used by another active facility. Must be rendered inside the facility form's FormProvider.
export function DuplicateServiceFacilityWarning({ facilityId }: { facilityId?: string }): ReactElement | null {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce();
  const npi = ((useWatch({ name: 'npi' }) as string | undefined) ?? '').trim();
  const clia = ((useWatch({ name: 'clia' }) as string | undefined) ?? '').trim();
  const [matches, setMatches] = useState<Matches>(NO_MATCHES);

  useEffect(() => {
    if (!oystehrZambda) return;
    const validNpi = isNPIValidWithChecksum(npi) ? npi : undefined;
    const validClia = isCLIAValid(clia) ? clia : undefined;
    if (!validNpi && !validClia) {
      setMatches(NO_MATCHES);
      return;
    }

    let cancelled = false;
    const search = async (params: { npi?: string; clia?: string }): Promise<ServiceFacilityItem[]> => {
      const data = await searchBillingServiceFacilities(oystehrZambda, { ...params, pageSize: MAX_MATCHES + 1 });
      return (data.facilities ?? []).filter((f) => f.id !== facilityId).slice(0, MAX_MATCHES);
    };
    debounce(() => {
      Promise.all([validNpi ? search({ npi: validNpi }) : [], validClia ? search({ clia: validClia }) : []])
        .then(([npiMatches, cliaMatches]) => {
          if (!cancelled) setMatches({ npi: npiMatches, clia: cliaMatches });
        })
        .catch((err) => {
          // The warning is advisory only; a failed lookup must not block editing.
          console.error('Failed to check for duplicate service facilities', err);
          if (!cancelled) setMatches(NO_MATCHES);
        });
    }, 'duplicate-check');
    return () => {
      cancelled = true;
    };
  }, [oystehrZambda, npi, clia, facilityId, debounce]);

  if (matches.npi.length === 0 && matches.clia.length === 0) return null;

  return (
    <Alert severity="warning" data-testid="duplicate-service-facility-warning">
      {matches.npi.length > 0 && <MatchList label={`NPI ${npi} is already used by`} facilities={matches.npi} />}
      {matches.clia.length > 0 && (
        <MatchList label={`CLIA number ${clia} is already used by`} facilities={matches.clia} />
      )}
    </Alert>
  );
}

function MatchList({ label, facilities }: { label: string; facilities: ServiceFacilityItem[] }): ReactElement {
  return (
    <Box>
      {label}{' '}
      {facilities.map((facility, index) => (
        <span key={facility.id}>
          {index > 0 && ', '}
          {/* New tab, so an unsaved form (e.g. the Add dialog) isn't lost. */}
          <Link component={RouterLink} to={`/service-facilities/${facility.id}`} target="_blank" rel="noopener">
            {facility.name || facility.id}
          </Link>
        </span>
      ))}
    </Box>
  );
}
