import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useAppointmentData } from '../stores/appointment/appointment.store';

/**
 * Marks every chart-fields query for the current encounter stale when the provider moves to another visit
 * screen. Nothing is refetched here: a stale query is refetched when a component on the new screen mounts
 * it, so each distinct field set costs one request per screen visit rather than one per component mount.
 *
 * This replaces the `staleTime: 0` the chart-fields cache used to run with, which kept every screen fresh
 * by refetching on every mount, including the many mounts of the same field set within one screen.
 */
export const useInvalidateChartFieldsOnNavigate = (): void => {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (!encounterId) return;
    void queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounterId], refetchType: 'none' });
  }, [pathname, encounterId, queryClient]);
};
