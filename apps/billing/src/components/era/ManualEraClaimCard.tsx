import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import {
  Box,
  Card,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Link,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { formatCurrency } from 'utils/lib/utils/convert';
import { formatDate } from '../../utils/format';
import { ClaimForm, claimTotals } from '../../utils/manualEra';
import { EraClaimEditor } from './EraClaimEditor';

function Total({ label, cents }: { label: string; cents: number }): ReactElement {
  return (
    <Typography variant="body1" component="span">
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {label}:{' '}
      </Box>
      <Box component="span" sx={{ fontWeight: 700 }}>
        {formatCurrency(cents / 100)}
      </Box>
    </Typography>
  );
}

export interface ManualEraClaimCardActions {
  onMatch: () => void;
  onUnmatch: () => void;
  onView: () => void;
  onRemove: () => void;
}

// A claim of a keyed remit, editable in place. Its match state changes through Match / Unmatch (the
// same as on the ERA screen); edits are saved with the page.
export function ManualEraClaimCard({
  claim,
  onChange,
  expanded,
  onToggle,
  dirty,
  actions,
}: {
  claim: ClaimForm;
  onChange: (claim: ClaimForm) => void;
  expanded: boolean;
  onToggle: () => void;
  dirty: boolean;
  actions: ManualEraClaimCardActions;
}): ReactElement {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const totals = claimTotals(claim);
  const matched = !!claim.matchedClaimId;
  const run = (action: () => void) => () => {
    setMenuAnchor(null);
    action();
  };

  return (
    <Card variant="outlined" data-testid={`claim-card-${claim.claimResponseId ?? claim.key}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
        <IconButton size="small" onClick={onToggle} aria-label={expanded ? 'Collapse claim' : 'Expand claim'}>
          {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
        </IconButton>
        <Typography variant="subtitle1" fontWeight={700} color="primary.dark">
          {claim.patientName || 'Unnamed patient'}
        </Typography>
        {claim.serviceDate && (
          <Typography variant="body2" color="text.secondary">
            DOS {formatDate(claim.serviceDate)}
          </Typography>
        )}
        {matched ? (
          <Chip
            size="small"
            variant="outlined"
            color="success"
            sx={{ borderRadius: '4px' }}
            label={
              <>
                Matched to{' '}
                <Link component={RouterLink} to={`/claims/${claim.matchedClaimId}`} underline="hover">
                  {claim.matchedClaimId}
                </Link>
              </>
            }
          />
        ) : (
          <Chip size="small" variant="outlined" color="warning" label="Unmatched" sx={{ borderRadius: '4px' }} />
        )}
        {dirty && <Chip size="small" label="Unsaved changes" sx={{ borderRadius: '4px' }} />}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" aria-label="Claim actions" onClick={(event) => setMenuAnchor(event.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {matched ? (
            <MenuItem onClick={run(actions.onUnmatch)}>
              <ListItemText>Unmatch</ListItemText>
            </MenuItem>
          ) : (
            <MenuItem onClick={run(actions.onMatch)}>
              <ListItemText>Match to claim</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={run(actions.onView)}>
            <ListItemText>View reimbursement details</ListItemText>
          </MenuItem>
          <Tooltip title={matched ? 'Unmatch the claim before removing it from the remit' : ''} placement="left">
            <span>
              <MenuItem onClick={run(actions.onRemove)} disabled={matched}>
                <ListItemText primaryTypographyProps={{ color: 'error' }}>Remove from remit</ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
        </Menu>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Divider />
        <Box sx={{ px: 2, py: 2 }}>
          <EraClaimEditor claim={claim} onChange={onChange} />
        </Box>
      </Collapse>
      <Divider />
      <Stack direction="row" spacing={4} sx={{ px: 3, py: 1.5 }} flexWrap="wrap" useFlexGap>
        <Total label="Allowed" cents={totals.allowedCents} />
        <Total label="Ins Paid" cents={totals.paidCents} />
        <Total label="Patient Resp" cents={totals.patientRespCents} />
      </Stack>
    </Card>
  );
}
