import { FilterAltOutlined as FilterIcon, NorthEast as DrilldownIcon } from '@mui/icons-material';
import { Box } from '@mui/material';
import { ReactElement } from 'react';

// Corner affordance marking a highlight card as interactive: 'filter' toggles an on-page
// filter, 'drilldown' opens a detail view. The host card must be position: 'relative' and can
// brighten the icon on hover via '&:hover .card-action-hint': { color: 'primary.main' }.
export function CardActionHint({ kind, active }: { kind: 'filter' | 'drilldown'; active?: boolean }): ReactElement {
  const Icon = kind === 'filter' ? FilterIcon : DrilldownIcon;
  return (
    <Box
      className="card-action-hint"
      sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', color: active ? 'primary.main' : 'text.disabled' }}
    >
      <Icon sx={{ fontSize: 16 }} />
    </Box>
  );
}
