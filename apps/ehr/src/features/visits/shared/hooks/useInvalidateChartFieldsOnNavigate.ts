import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useAppointmentData } from '../stores/appointment/appointment.store';

/**
 * Marks every chart-fields query for the current encounter stale when the provider moves to another visit
 * screen or switches to another encounter of the visit. Nothing is refetched here: a stale query is
 * refetched when a component on the new screen mounts it, so each distinct field set costs one request per
 * screen visit.
 *
 * A layout effect on purpose: react-query decides whether to fetch on mount when a query subscribes, in a
 * passive effect, and the new screen's components (children of this layout) run their passive effects
 * before the layout's. Marking stale in a layout effect puts it ahead of every subscription of the new
 * screen; in a passive effect it would land after them and the new screen would show the old chart.
 */
export const useInvalidateChartFieldsOnNavigate = (): void => {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const previous = useRef({ pathname, encounterId });

  useLayoutEffect(() => {
    if (previous.current.pathname === pathname && previous.current.encounterId === encounterId) return;
    previous.current = { pathname, encounterId };
    if (!encounterId) return;
    void queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounterId], refetchType: 'none' });
  }, [pathname, encounterId, queryClient]);
};
