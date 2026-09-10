import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { markChartStale } from './chartSectionCache';

/**
 * Marks the current encounter's chart stale when the provider moves to another visit screen. Nothing is
 * refetched here: a stale section is re-read once by the screen that shows it, and the stale visit note by
 * the visit-note pages on entry, so flows that change chart data through other endpoints (an in-house lab
 * being collected, say) are picked up on the next screen at the cost of one small read per section shown.
 */
export const useMarkChartStaleOnNavigate = (): void => {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    void markChartStale(queryClient, encounterId);
  }, [pathname, encounterId, queryClient]);
};
