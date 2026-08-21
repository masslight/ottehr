// The header's Chart / Easy Chart switch.
//
// Easy Chart is a TAB like any other, so it is already reachable from the sidebar. This toggle exists
// because it is not a tab in the way the others are: the rest of the sidebar is a list of SECTIONS of one
// note, while this is a second way of working on the whole note. Reading it as "which chart am I in" is
// what providers expect, and a section list is the wrong shape for that.
//
// REACHABILITY IS NOT DECIDED HERE. `availableRoutes` from the navigation context has already applied the
// feature flag, the role set and the interaction mode, so asking it whether the Easy Chart route is in
// there is the same answer the sidebar and the router give. Re-deriving any part of that here is how a
// button that leads nowhere gets shipped.

import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { FC } from 'react';
import { useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
import { ROUTER_PATH } from '../routing/routesInPerson';

/** Where "Chart" goes when we cannot tell where the provider came from. The note, not the intake. */
const DEFAULT_CHART_TAB = ROUTER_PATH.REVIEW_AND_SIGN;

/** Router state we set on ourselves, so switching back lands on the tab the provider actually left. */
interface ChartViewModeState {
  chartReturnTo?: string;
}

export const ChartViewModeToggle: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: appointmentId } = useParams();
  const { availableRoutes } = useInPersonNavigationContext();

  // The splat, i.e. the tab, exactly as the navigation context reads it.
  const match = useMatch('/in-person/:id/*');
  const currentTab = match?.params['*'] ?? '';
  const isEasyChart = currentTab === ROUTER_PATH.EASY_CHARTING;

  const isEasyChartAvailable = availableRoutes.some((route) => route.path === ROUTER_PATH.EASY_CHARTING);
  if (!isEasyChartAvailable || !appointmentId) return null;

  const goTo = (tab: string): void => {
    navigate(
      // The SEARCH is carried over. A follow-up encounter is selected by `?encounterId=`, and dropping it
      // would silently switch the provider to the parent encounter's chart.
      { pathname: `/in-person/${appointmentId}/${tab}`, search: location.search },
      // Remember where we came from, but never remember Easy Chart itself — that would make "Chart" a
      // no-op that looks like a broken button.
      {
        state: {
          chartReturnTo: tab === ROUTER_PATH.EASY_CHARTING ? currentTab : undefined,
        } satisfies ChartViewModeState,
      }
    );
  };

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      value={isEasyChart ? 'easy' : 'chart'}
      data-testid={dataTestIds.inPersonHeader.chartViewModeToggle}
      // A selected value must never be deselectable: `exclusive` hands back `null` when the active button
      // is clicked again, and acting on that would navigate somewhere on a click that means "stay".
      onChange={(_event, value) => {
        if (value === 'easy' && !isEasyChart) goTo(ROUTER_PATH.EASY_CHARTING);
        if (value === 'chart' && isEasyChart) {
          const returnTo = (location.state as ChartViewModeState | null)?.chartReturnTo;
          // A reload loses the router state, so the default has to be a tab that always exists.
          goTo(returnTo && returnTo !== ROUTER_PATH.EASY_CHARTING ? returnTo : DEFAULT_CHART_TAB);
        }
      }}
      sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.25 } }}
    >
      <ToggleButton value="chart" data-testid={dataTestIds.inPersonHeader.chartViewModeOption('chart')}>
        Chart
      </ToggleButton>
      <ToggleButton value="easy" data-testid={dataTestIds.inPersonHeader.chartViewModeOption('easy')}>
        Easy Chart
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
