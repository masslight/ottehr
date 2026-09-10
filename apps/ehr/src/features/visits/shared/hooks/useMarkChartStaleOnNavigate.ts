import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { markChartStale } from './chartSectionCache';

/**
 * Marks the current encounter's chart stale when the provider moves to another visit screen. Nothing is
 * refetched here: a stale section is re-read once by the screen that shows it, and the stale visit note by
 * the visit-note pages on entry, so flows that change chart data through other endpoints (an in-house lab
 * being collected, say) are picked up on the next screen at the cost of one small read per section shown.
 *
 * A layout effect on purpose: react-query decides whether to fetch on mount when a query subscribes, in a
 * passive effect, and the new screen's components (children of this layout) run their passive effects
 * before the layout's. Marking stale in a layout effect puts it ahead of every subscription of the new
 * screen; in a passive effect it would land after them and the new screen would show the old chart.
 */
export const useMarkChartStaleOnNavigate = (): void => {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const previousPathname = useRef(pathname);

  useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    void markChartStale(queryClient, encounterId);
  }, [pathname, encounterId, queryClient]);
};
