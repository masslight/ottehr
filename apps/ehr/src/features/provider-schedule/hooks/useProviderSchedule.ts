import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { effectiveVisitTypes, expandProviderSchedule } from 'utils/lib/provider-schedule/expand';
import {
  IsoDate,
  ProviderScheduleConfig,
  ScheduleBlockInstance,
  ScheduledAppointment,
  ScheduleLocation,
  ScheduleProvider,
  ScheduleVisitType,
} from 'utils/lib/provider-schedule/types';
import { mockProviderScheduleApi } from '../api/mockProviderScheduleApi';
import { ProviderScheduleApi } from '../api/providerScheduleApi';

/** Single seam for swapping the mock for real zambda calls. */
export const useProviderScheduleApi = (): ProviderScheduleApi => mockProviderScheduleApi;

const keys = {
  providers: ['provider-schedule', 'providers'] as const,
  locations: ['provider-schedule', 'locations'] as const,
  visitTypes: ['provider-schedule', 'visit-types'] as const,
  config: (providerId: string) => ['provider-schedule', 'config', providerId] as const,
  appointments: (providerId: string, start: string, end: string) =>
    ['provider-schedule', 'appointments', providerId, start, end] as const,
};

export const useScheduleProviders = (): UseQueryResult<ScheduleProvider[]> => {
  const api = useProviderScheduleApi();
  return useQuery({ queryKey: keys.providers, queryFn: () => api.listProviders(), staleTime: Infinity });
};

export const useScheduleLocations = (): UseQueryResult<ScheduleLocation[]> => {
  const api = useProviderScheduleApi();
  return useQuery({ queryKey: keys.locations, queryFn: () => api.listLocations(), staleTime: Infinity });
};

export const useScheduleVisitTypes = (): UseQueryResult<ScheduleVisitType[]> => {
  const api = useProviderScheduleApi();
  return useQuery({ queryKey: keys.visitTypes, queryFn: () => api.listVisitTypes(), staleTime: Infinity });
};

export const useProviderScheduleConfig = (providerId: string | undefined): UseQueryResult<ProviderScheduleConfig> => {
  const api = useProviderScheduleApi();
  return useQuery({
    queryKey: keys.config(providerId ?? ''),
    queryFn: () => api.getScheduleConfig(providerId!),
    enabled: Boolean(providerId),
  });
};

export const useSaveProviderScheduleConfig = (): UseMutationResult<
  ProviderScheduleConfig,
  Error,
  ProviderScheduleConfig
> => {
  const api = useProviderScheduleApi();
  const queryClient = useQueryClient();
  return useMutation<ProviderScheduleConfig, Error, ProviderScheduleConfig>({
    mutationFn: (config) => api.saveScheduleConfig(config),
    onSuccess: (saved) => {
      queryClient.setQueryData(keys.config(saved.providerId), saved);
    },
  });
};

export const useProviderAppointments = (
  providerId: string | undefined,
  startDate: IsoDate | undefined,
  endDate: IsoDate | undefined
): UseQueryResult<ScheduledAppointment[]> => {
  const api = useProviderScheduleApi();
  return useQuery({
    queryKey: keys.appointments(providerId ?? '', startDate ?? '', endDate ?? ''),
    queryFn: () => api.listAppointments({ providerId: providerId!, startDate: startDate!, endDate: endDate! }),
    enabled: Boolean(providerId && startDate && endDate),
    placeholderData: (previous) => previous,
  });
};

/** Template + exceptions expanded for a date range, plus the provider's effective visit types. */
export const useExpandedSchedule = (
  config: ProviderScheduleConfig | undefined,
  visitTypes: ScheduleVisitType[] | undefined,
  startDate: IsoDate | undefined,
  endDate: IsoDate | undefined
): {
  blocks: ScheduleBlockInstance[];
  providerVisitTypes: ReturnType<typeof effectiveVisitTypes>;
} =>
  useMemo(() => {
    if (!config || !visitTypes || !startDate || !endDate) return { blocks: [], providerVisitTypes: [] };
    return {
      blocks: expandProviderSchedule(config, startDate, endDate),
      providerVisitTypes: effectiveVisitTypes(config, visitTypes),
    };
  }, [config, visitTypes, startDate, endDate]);
