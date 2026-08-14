import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidSlug, slugFromName } from 'utils/lib/fhir/constants';
import { createProviderGroup, listScheduleOwners } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

type Composition = 'all' | 'locations';

/**
 * Creates a Provider group (a pooling HealthcareService) in the canonical shape —
 * name + slug + groupCharacteristics (assignmentMode + allLocations) + the
 * `pools-providers` strategy — then lands on the group detail page to configure
 * services, members, assignment mode, and the booking link.
 *
 * Create collects only the group's defining trait (who it pools); everything else
 * lives on GroupPage. Location creation is unaffected — this only makes a Group.
 */
export default function CreateProviderGroupPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [composition, setComposition] = useState<Composition>('all');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmedName = name.trim();
  // A group needs a URL-safe slug to be bookable; block names that yield none.
  const derivedSlug = trimmedName ? slugFromName(trimmedName) : '';
  const slugInvalid = trimmedName.length > 0 && !isValidSlug(derivedSlug);

  const { data: locationsData } = useQuery({
    queryKey: ['schedule-list', 'Location'],
    queryFn: () => (oystehrZambda ? listScheduleOwners({ ownerType: 'Location' }, oystehrZambda) : null),
    enabled: !!oystehrZambda && composition === 'locations',
  });
  const activeLocations = useMemo(
    () =>
      (locationsData?.list ?? []).filter((i) => i.owner.active).map((i) => ({ id: i.owner.id, name: i.owner.name })),
    [locationsData]
  );

  const nameHelper = ((): string => {
    if (!trimmedName) return 'Name is required';
    if (slugInvalid) return 'Cannot build a URL-safe permalink from this name. Use letters, digits, or hyphens.';
    return `Permalink will be: ${derivedSlug}`;
  })();

  const canSubmit = !!trimmedName && !slugInvalid && (composition === 'all' || locationIds.length > 0) && !loading;

  const handleCreate = async (): Promise<void> => {
    if (!oystehrZambda || !canSubmit) return;
    setLoading(true);
    try {
      const allLocations = composition === 'all';
      const group = await createProviderGroup(
        { name: trimmedName, allLocations, locationIds: allLocations ? undefined : locationIds },
        oystehrZambda
      );
      navigate(`/admin/group/id/${group.id}`);
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Failed to create provider group.', { variant: 'error' });
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Box marginX={12}>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: '/admin/provider-groups', children: 'Provider groups' },
            { link: '#', children: 'Add group' },
          ]}
        />
        <Paper sx={{ padding: 3, mt: 1 }}>
          <Typography variant="h3" color="primary.dark" marginBottom={2}>
            Add provider group
          </Typography>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 520 }}
          >
            <TextField
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={nameHelper}
              error={slugInvalid}
            />

            <FormControl>
              <FormLabel>Who does this group pool?</FormLabel>
              <RadioGroup value={composition} onChange={(e) => setComposition(e.target.value as Composition)}>
                <FormControlLabel value="all" control={<Radio />} label="All active providers" />
                <FormControlLabel value="locations" control={<Radio />} label="Providers at specific locations" />
              </RadioGroup>
            </FormControl>

            {composition === 'locations' && (
              <Autocomplete
                multiple
                options={activeLocations.map((l) => l.id)}
                getOptionLabel={(id) => activeLocations.find((l) => l.id === id)?.name ?? id}
                value={locationIds}
                onChange={(_e, v) => setLocationIds(v)}
                isOptionEqualToValue={(a, b) => a === b}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Locations"
                    required
                    helperText="Providers at these locations are pooled."
                  />
                )}
              />
            )}

            <LoadingButton
              type="submit"
              loading={loading}
              variant="contained"
              sx={{ alignSelf: 'flex-start' }}
              disabled={!canSubmit}
            >
              Create group
            </LoadingButton>
            <Typography variant="caption" color="text.secondary">
              Services, members, and the booking link are configured on the next page.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </PageContainer>
  );
}
