import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { Alert, Box, Button, Link as MuiLink, Tooltip, Typography } from '@mui/material';
import { Location } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { isLocationInPerson, isLocationVirtual } from 'utils/lib/fhir/location';
import { LocationScheduleSummary } from 'utils/lib/types/api/locations';
import { buildPrebookModeLinks } from 'utils/lib/utils/scheduleUtils';

const INTAKE_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

interface LocationBookingLinksProps {
  location: Location;
  schedules: LocationScheduleSummary[];
}

// A Schedule's name is optional (R4B has no `name` field; the display-name extension is the only
// human label). Fall back to a positional label so a second, unnamed schedule is still tellable
// apart from the first.
const scheduleLabel = (schedule: LocationScheduleSummary, index: number): string =>
  schedule.name ?? `Schedule ${index + 1}`;

/**
 * Shareable booking links for a Location, and the way through to the Schedules behind them.
 *
 * These live here rather than on the Schedule page because what they offer is a property of the
 * Location: prebook modes come from the Location's virtual/in-person config, and walk-in depends only
 * on whether the place is open. The Schedule supplies the hours, not the identity of the thing being
 * booked.
 *
 * Knowing the Schedules is what lets this warn instead of handing out a dead link: a Location with
 * no Schedule still produces syntactically valid prebook URLs that resolve and then vend nothing.
 * They arrive with the Location from `get-location`, so there is no second load state to render.
 */
export function LocationBookingLinks({ location, schedules }: LocationBookingLinksProps): ReactElement {
  // Read from the saved resource, not the form state above it. A link that rewrites itself as you
  // type a new slug is a link that resolves to nothing until you remember to hit Save.
  const slug = location.identifier?.find((id) => id.system === SLUG_SYSTEM)?.value ?? '';
  const isVirtual = isLocationVirtual(location);
  const isInPerson = isLocationInPerson(location);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const prebookLinks = slug
    ? buildPrebookModeLinks({ fhirType: 'Location', slug, isVirtual, isInPerson }).map((link) => ({
        label: link.label,
        url: `${INTAKE_URL}${link.relativeUrl}`,
        key: link.key,
      }))
    : [];

  // One walk-in link per Schedule: the route is keyed to a Schedule id, and a Location may own
  // several. `/walkin/location/:name` exists too but resolves by Location *name*, so any rename
  // silently breaks previously-shared links — the Schedule-keyed form is the stable one.
  const walkinLinks = schedules.map((schedule, index) => ({
    label: schedules.length > 1 ? `Walk-in — ${scheduleLabel(schedule, index)}` : 'Walk-in',
    url: `${INTAKE_URL}/walkin/schedule/${schedule.id}`,
    key: `walkin-${schedule.id}`,
  }));

  const links = [...prebookLinks, ...walkinLinks];

  return (
    <Box data-testid={dataTestIds.locationConfig.bookingLinks}>
      <Typography variant="h6" color="primary.dark" sx={{ mb: 1 }}>
        Booking links
      </Typography>

      {!slug && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This location has no slug, so it has no booking URL. Add one above to make it bookable.
        </Alert>
      )}

      {slug && schedules.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid={dataTestIds.locationConfig.noScheduleWarning}>
          This location doesn&apos;t own a schedule yet, so these links will open but won&apos;t offer any times. Create
          a schedule to make it bookable.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {links.map((link) => (
          <Box key={link.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip
              title={copiedKey === link.key ? 'Link copied!' : 'Copy link'}
              placement="top"
              arrow
              onClose={() => {
                setTimeout(() => setCopiedKey((prev) => (prev === link.key ? null : prev)), 200);
              }}
            >
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(link.url);
                  setCopiedKey(link.key);
                }}
                sx={{ p: 0, minWidth: 0 }}
              >
                <ContentCopyRoundedIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {link.label}
              </Typography>
              {/* These URLs carry a slug and query string and are longer than the column is
                      wide. Break them rather than let them push the card past its flex basis. */}
              <MuiLink href={link.url} target="_blank" rel="noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>
                {link.url}
              </MuiLink>
            </Box>
          </Box>
        ))}
      </Box>

      {schedules.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Schedules
          </Typography>
          {schedules.map((schedule, index) => (
            <MuiLink
              key={schedule.id}
              component={RouterLink}
              to={`/admin/schedule/id/${schedule.id}`}
              variant="body2"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              data-testid={dataTestIds.locationConfig.scheduleLink(schedule.id)}
            >
              {scheduleLabel(schedule, index)}
              <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
            </MuiLink>
          ))}
        </Box>
      )}
    </Box>
  );
}
