import { captureException } from '@sentry/react';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { SaveChartDataRequest } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { InHouseOrderListPageItemDTO } from 'utils/lib/types/data/in-house/in-house.types';
import { LabOrderListPageDTO } from 'utils/lib/types/data/labs/labs.types';
import { deleteInHouseLabOrder, deleteLabOrder, getExternalLabOrders, getInHouseOrders } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';
import { AiField, EasyChartLabOrder } from './chart-types';
import { fetchEasyChartData } from './intent-logic';

// The easy-chart page's chart-data layer. Named useEasyChartData, NOT useChartData: the regular chart
// already has a useChartData in appointment.store (~57 consumers) and it is a different thing — a
// react-query READ hook over the appointment store, which this page deliberately does not populate.
// This one owns WRITES for one encounter: the GetChartDataResponse state + its synchronous-read
// mirror, initial load, the save→merge path (with the freshly-added flash), charted-resource
// deletion (with the red-flash removal), lab orders, and the exactly-one-primary-diagnosis
// invariant. Everything here talks to the chart; nothing here knows about intents, plans, the
// conversation, or AI provenance — the page wires those through the returned mutators and the
// onResourceDeleted callback.
export function useEasyChartData({
  encounterId,
  onResourceDeleted,
}: {
  encounterId: string | undefined;
  // Fired after a charted resource is removed so session-side bookkeeping (the AI needs-review
  // map) can drop it too.
  onResourceDeleted?: (resourceId: string) => void;
}): {
  chartData: GetChartDataResponse | null;
  setChartData: React.Dispatch<React.SetStateAction<GetChartDataResponse | null>>;
  chartDataRef: React.MutableRefObject<GetChartDataResponse | null>;
  reloadChartData: () => Promise<void>;
  loading: boolean;
  error: string | null;
  labOrders: EasyChartLabOrder[];
  fetchLabOrders: () => Promise<void>;
  handleRemoveLabOrder: (order: EasyChartLabOrder) => void;
  freshlyAdded: Set<string>;
  setFreshlyAdded: React.Dispatch<React.SetStateAction<Set<string>>>;
  removingItems: Set<string>;
  flashAndRemoveItem: (resourceId: string, commitRemove: () => void) => void;
  mergeSaveResponse: (response: { chartData: GetChartDataResponse }) => string[];
  saveAndMerge: (payload: SaveChartDataRequest) => Promise<string[]>;
  deleteChartedResource: (field: AiField, dto: { resourceId?: string }) => Promise<void>;
  handleConfirmPatientInfo: (value: boolean) => Promise<void>;
  handleMakePrimary: (dto: DiagnosisDTO) => Promise<void>;
} {
  const { oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();

  const [chartData, setChartData] = useState<GetChartDataResponse | null>(null);
  // Mirror of chartData for synchronous reads inside async callbacks (e.g. mergeSaveResponse
  // needs to compute the next state outside of setState's updater so it can compute newIds
  // synchronously — setState updater calls are deferred and would run after our flash check).
  const chartDataRef = useRef<GetChartDataResponse | null>(null);
  useEffect(() => {
    chartDataRef.current = chartData;
  }, [chartData]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lab orders on this encounter (in-house + send-out), fetched separately from getChartData and
  // surfaced read/removable in the left pane. Refreshed after the planner orders a lab and after a
  // cancel.
  const [labOrders, setLabOrders] = useState<EasyChartLabOrder[]>([]);
  const [freshlyAdded, setFreshlyAdded] = useState<Set<string>>(new Set());
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());

  // Initial chart load.
  useEffect(() => {
    let cancelled = false;
    if (!apiClient || !encounterId) return;
    setLoading(true);
    setError(null);
    fetchEasyChartData(apiClient, encounterId)
      .then((d) => {
        if (!cancelled) setChartData(d);
      })
      .catch((e) => {
        console.error('Easy chart fetch failed:', e);
        if (!cancelled) setError('Could not load the chart for this encounter.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient, encounterId]);

  // Re-fetch the whole chart. Most writes merge their response in place (see mergeSaveResponse), so
  // this is for the cases where the chart changed OUTSIDE this page's own saves — currently the exam
  // data migration, which rewrites observation fields server-side.
  const reloadChartData = useCallback(async (): Promise<void> => {
    if (!apiClient || !encounterId) return;
    try {
      setChartData(await fetchEasyChartData(apiClient, encounterId));
    } catch (e) {
      console.error('Easy chart reload failed:', e);
      setError('Could not reload the chart for this encounter.');
    }
  }, [apiClient, encounterId]);

  // For removes: scroll to the item, flash it red for 1.5s so the user sees what's being
  // deleted, then actually remove it from local state. Callers pass a `commitRemove` callback
  // that does the state mutation (typically a setChartData call) — it runs after the flash.
  const flashAndRemoveItem = (resourceId: string, commitRemove: () => void): void => {
    const el = document.querySelector<HTMLElement>(`[data-easy-chart-id="${resourceId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setRemovingItems((prev) => {
      const next = new Set(prev);
      next.add(resourceId);
      return next;
    });
    setTimeout(() => {
      commitRemove();
      setRemovingItems((prev) => {
        const next = new Set(prev);
        next.delete(resourceId);
        return next;
      });
    }, 1500);
  };

  // Load the encounter's lab orders (in-house + send-out) into the left-pane view model. Each list
  // call is independent and best-effort so one lab subsystem being unavailable doesn't hide the
  // other. Called on load, after the planner orders a lab, and after a cancel.
  const fetchLabOrders = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !encounterId) return;
    const search = { searchBy: { field: 'encounterId', value: encounterId } } as const;
    const [inHouse, external] = await Promise.all([
      getInHouseOrders(oystehrZambda, search).catch((e) => {
        console.error('Failed to load in-house lab orders:', e);
        captureException(e);
        enqueueSnackbar('Could not load in-house lab orders.', { variant: 'error' });
        return null;
      }),
      getExternalLabOrders(oystehrZambda, search).catch((e) => {
        console.error('Failed to load send-out lab orders:', e);
        captureException(e);
        enqueueSnackbar('Could not load send-out lab orders.', { variant: 'error' });
        return null;
      }),
    ]);
    const orders: EasyChartLabOrder[] = [];
    for (const o of (inHouse as { data?: InHouseOrderListPageItemDTO[] } | null)?.data ?? []) {
      orders.push({
        serviceRequestId: o.serviceRequestId,
        kind: 'in-house',
        testName: o.testItemName,
        status: o.status,
      });
    }
    for (const o of (external as { data?: LabOrderListPageDTO[] } | null)?.data ?? []) {
      orders.push({
        serviceRequestId: o.serviceRequestId,
        kind: 'external',
        testName: o.testItem,
        labName: o.fillerLab,
        status: o.orderStatus,
      });
    }
    setLabOrders(orders);
  }, [oystehrZambda, encounterId]);

  // Cancel a lab order through the same delete zambda the lab pages use, with the optimistic
  // red-flash removal the other items get. On failure, refetch to restore the true state.
  const handleRemoveLabOrder = (order: EasyChartLabOrder): void => {
    if (!oystehrZambda) return;
    flashAndRemoveItem(order.serviceRequestId, () => {
      setLabOrders((prev) => prev.filter((o) => o.serviceRequestId !== order.serviceRequestId));
    });
    void (async () => {
      try {
        if (order.kind === 'in-house') {
          await deleteInHouseLabOrder(oystehrZambda, { serviceRequestId: order.serviceRequestId });
        } else {
          await deleteLabOrder(oystehrZambda, { serviceRequestId: order.serviceRequestId });
        }
      } catch (e) {
        console.error('Failed to cancel lab order:', e);
        captureException(e);
        enqueueSnackbar(`Could not cancel ${order.testName} — the order is still active.`, { variant: 'error' });
        void fetchLabOrders();
      }
    })();
  };

  // Load lab orders whenever the encounter changes.
  useEffect(() => {
    void fetchLabOrders();
  }, [fetchLabOrders]);

  // Merge the saved-chart-data response into local state and flash the new items.
  // Avoids a full refetch for single-item adds.
  const mergeSaveResponse = (response: { chartData: GetChartDataResponse }): string[] => {
    const saved = response.chartData;
    const prev = chartDataRef.current;
    if (!prev) return [];
    const next: GetChartDataResponse = { ...prev };
    const newIds: string[] = [];
    const arrayFields = [
      'diagnosis',
      'conditions',
      'allergies',
      'medications',
      'surgicalHistory',
      'episodeOfCare',
      'examObservations',
      'rosObservations',
      'vitalsObservations',
      'instructions',
      'cptCodes',
      'procedures',
    ] as const;
    for (const field of arrayFields) {
      const incoming = saved[field] as Array<{ resourceId?: string }> | undefined;
      if (!incoming || incoming.length === 0) continue;
      const existing = (next[field] as Array<{ resourceId?: string }> | undefined) ?? [];
      const existingIds = new Set(existing.map((e) => e.resourceId).filter((id): id is string => !!id));
      // Replace existing items with same resourceId (updates), append new ones (adds).
      const incomingById = new Map<string, { resourceId?: string }>();
      const newItems: Array<{ resourceId?: string }> = [];
      for (const item of incoming) {
        if (item.resourceId && existingIds.has(item.resourceId)) {
          incomingById.set(item.resourceId, item);
        } else {
          newItems.push(item);
          if (item.resourceId) newIds.push(item.resourceId);
        }
      }
      const merged = existing.map((e) =>
        e.resourceId && incomingById.has(e.resourceId) ? incomingById.get(e.resourceId)! : e
      );
      (next[field] as unknown[]) = [...merged, ...newItems];
    }
    const trackScalar = (incoming: { resourceId?: string } | undefined): void => {
      if (incoming?.resourceId) newIds.push(incoming.resourceId);
    };
    if (saved.chiefComplaint) {
      next.chiefComplaint = saved.chiefComplaint;
      trackScalar(saved.chiefComplaint);
    }
    if (saved.historyOfPresentIllness) {
      next.historyOfPresentIllness = saved.historyOfPresentIllness;
      trackScalar(saved.historyOfPresentIllness);
    }
    if (saved.mechanismOfInjury) {
      next.mechanismOfInjury = saved.mechanismOfInjury;
      trackScalar(saved.mechanismOfInjury);
    }
    if (saved.ros) {
      next.ros = saved.ros;
      trackScalar(saved.ros);
    }
    if (saved.medicalDecision) {
      next.medicalDecision = saved.medicalDecision;
      trackScalar(saved.medicalDecision);
    }
    if (saved.emCode) {
      next.emCode = saved.emCode;
      trackScalar(saved.emCode);
    }
    // Disposition: a scalar like emCode. Without this merge, a disposition set by the assistant
    // (or a review suggestion) stays invisible to the next chart-state summary and gets
    // re-suggested/re-written.
    if (saved.disposition) {
      next.disposition = saved.disposition;
    }
    setChartData(next);
    if (newIds.length > 0) {
      setFreshlyAdded((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
      // After React renders, scroll the first new item into view. We retry a few times in
      // case the section was mounted for the first time and React hasn't painted yet.
      const tryScroll = (attempt: number): void => {
        const el = document.querySelector<HTMLElement>(`[data-easy-chart-id="${newIds[0]}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempt < 10) {
          setTimeout(() => tryScroll(attempt + 1), 50);
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(0)));
      setTimeout(() => {
        setFreshlyAdded((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 2500);
    }
    return newIds;
  };

  const saveAndMerge = async (payload: SaveChartDataRequest): Promise<string[]> => {
    if (!apiClient) return [];
    const response = await apiClient.saveChartData(payload);
    return mergeSaveResponse(response);
  };

  // "Verify name & DOB" attestation — a sign-blocking requirement the provider must confirm. Saved on
  // Easy Chart's own chart-data path (mergeSaveResponse doesn't track this scalar, so we set it
  // directly). Optimistic, with rollback on failure.
  const handleConfirmPatientInfo = async (value: boolean): Promise<void> => {
    if (!apiClient || !encounterId) return;
    const prevConfirmed = chartDataRef.current?.patientInfoConfirmed;
    setChartData((prev) => (prev ? { ...prev, patientInfoConfirmed: { ...prev.patientInfoConfirmed, value } } : prev));
    try {
      const response = await apiClient.saveChartData({ encounterId, patientInfoConfirmed: { value } });
      const confirmed = response.chartData?.patientInfoConfirmed;
      if (confirmed) setChartData((prev) => (prev ? { ...prev, patientInfoConfirmed: confirmed } : prev));
    } catch (e) {
      console.error('Failed to save patient confirmation:', e);
      enqueueSnackbar('Could not save patient confirmation. Please try again.', { variant: 'error' });
      setChartData((prev) => (prev ? { ...prev, patientInfoConfirmed: prevConfirmed } : prev));
    }
  };

  // Promote a diagnosis to primary (demoting any prior primary). A signable note needs exactly one
  // primary; this is also what the auto-mark effect calls. Mirrors the regular Assessment tab's
  // save semantics: persist the changed diagnoses (by resourceId) and update local state.
  const handleMakePrimary = async (dto: DiagnosisDTO): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const diagnoses = chartDataRef.current?.diagnosis ?? [];
    if (dto.isPrimary) return;
    const oldPrimary = diagnoses.find((d) => d.isPrimary && d.resourceId !== dto.resourceId);
    const updates: DiagnosisDTO[] = [
      { ...dto, isPrimary: true },
      ...(oldPrimary ? [{ ...oldPrimary, isPrimary: false }] : []),
    ];
    setChartData((prev) =>
      prev
        ? {
            ...prev,
            diagnosis: (prev.diagnosis ?? []).map((d) => ({ ...d, isPrimary: d.resourceId === dto.resourceId })),
          }
        : prev
    );
    try {
      await apiClient.saveChartData({ encounterId, diagnosis: updates });
    } catch (e) {
      console.error('Failed to set primary diagnosis:', e);
      enqueueSnackbar('Could not set primary diagnosis. Please try again.', { variant: 'error' });
      setChartData((prev) => (prev ? { ...prev, diagnosis: diagnoses } : prev));
    }
  };

  // Demote a set of diagnoses to secondary in one save (used to clean up extra primaries).
  const demoteDiagnoses = async (toDemote: DiagnosisDTO[]): Promise<void> => {
    const updates = toDemote.filter((d) => d.resourceId).map((d) => ({ ...d, isPrimary: false }));
    if (!apiClient || !encounterId || updates.length === 0) return;
    const demoteIds = new Set(updates.map((d) => d.resourceId));
    const prevDiagnoses = chartDataRef.current?.diagnosis ?? [];
    setChartData((prev) =>
      prev
        ? {
            ...prev,
            diagnosis: (prev.diagnosis ?? []).map((d) =>
              demoteIds.has(d.resourceId) ? { ...d, isPrimary: false } : d
            ),
          }
        : prev
    );
    try {
      await apiClient.saveChartData({ encounterId, diagnosis: updates });
    } catch (e) {
      console.error('Failed to demote extra primary diagnoses:', e);
      setChartData((prev) => (prev ? { ...prev, diagnosis: prevDiagnoses } : prev));
    }
  };

  // Delete a charted allergy/diagnosis by its dto (flash + local removal); onResourceDeleted lets
  // the page drop it from the AI needs-review set. Shared by Remove and the replace flow.
  const deleteChartedResource = async (field: AiField, dto: { resourceId?: string }): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const resourceId = dto.resourceId;
    // E&M is a scalar field (not an array) — delete + null it out, not array-filter.
    if (field === 'emCode') {
      await apiClient.deleteChartData({ encounterId, emCode: dto } as Parameters<typeof apiClient.deleteChartData>[0]);
      flashAndRemoveItem(resourceId, () => setChartData((prev) => (prev ? { ...prev, emCode: undefined } : prev)));
      onResourceDeleted?.(resourceId);
      return;
    }
    await apiClient.deleteChartData({ encounterId, [field]: [dto] } as Parameters<typeof apiClient.deleteChartData>[0]);
    flashAndRemoveItem(resourceId, () => {
      setChartData((prev) => {
        if (!prev) return prev;
        const next: GetChartDataResponse = { ...prev };
        const list = (next[field] as Array<{ resourceId?: string }> | undefined) ?? [];
        (next[field] as unknown[]) = list.filter((x) => x.resourceId !== resourceId);
        return next;
      });
    });
    onResourceDeleted?.(resourceId);
  };

  // Enforce EXACTLY one primary diagnosis. A signable note needs one, and templates / manual adds
  // can leave a chart with none flagged → promote the first. The planner's initial pass and its
  // post-template re-plan can ALSO each chart their own isPrimary diagnosis (neither sees the
  // other's save), leaving TWO primaries — keep the first, demote the rest. Guarded so each branch
  // fires once per state, never looping.
  const autoPrimaryAttemptedRef = useRef(false);
  const demoteExtrasAttemptedRef = useRef(false);
  const removePlaceholderDxAttemptedRef = useRef(false);
  // The injury templates (e.g. "Sprain/ strain no xray") seed a GENERIC placeholder diagnosis —
  // T14.8XXA "Other injury of unspecified body region" — meant to be replaced with the real code.
  // The easy-chart adds the specific diagnosis but never deletes the placeholder, so it lingers and
  // (being charted first) mis-ranks as primary over the dictated specific dx. Treat T14.8x / T14.90
  // "unspecified injury/body region" as a placeholder.
  const isPlaceholderInjuryDx = (d: { code?: string; display?: string }): boolean =>
    /^T14\.(8|90)/i.test(d.code ?? '') || /unspecified body region|injury of unspecified/i.test(d.display ?? '');
  useEffect(() => {
    const diagnoses = chartData?.diagnosis ?? [];
    // Drop the template's generic injury placeholder once a SPECIFIC diagnosis is on the chart (keep
    // it only when it's the sole dx — i.e. nothing more specific was dictated). After removal the
    // single-primary logic below re-runs and promotes the remaining specific dx.
    const placeholders = diagnoses.filter((d) => d.resourceId && isPlaceholderInjuryDx(d));
    const specific = diagnoses.filter((d) => d.resourceId && !isPlaceholderInjuryDx(d));
    if (placeholders.length > 0 && specific.length > 0) {
      if (removePlaceholderDxAttemptedRef.current) return;
      removePlaceholderDxAttemptedRef.current = true;
      void Promise.all(placeholders.map((p) => deleteChartedResource('diagnosis', p)));
      return;
    }
    removePlaceholderDxAttemptedRef.current = false;
    const primaries = diagnoses.filter((d) => d.isPrimary);
    // More than one primary → keep the first, demote the rest.
    if (primaries.length > 1) {
      if (demoteExtrasAttemptedRef.current) return;
      demoteExtrasAttemptedRef.current = true;
      const [, ...extras] = primaries;
      void demoteDiagnoses(extras);
      return;
    }
    demoteExtrasAttemptedRef.current = false;
    if (diagnoses.length === 0 || primaries.length === 1) {
      autoPrimaryAttemptedRef.current = false;
      return;
    }
    if (autoPrimaryAttemptedRef.current) return;
    const first = diagnoses.find((d) => d.resourceId);
    if (!first) return;
    autoPrimaryAttemptedRef.current = true;
    void handleMakePrimary(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData?.diagnosis]);

  return {
    chartData,
    setChartData,
    chartDataRef,
    reloadChartData,
    loading,
    error,
    labOrders,
    fetchLabOrders,
    handleRemoveLabOrder,
    freshlyAdded,
    setFreshlyAdded,
    removingItems,
    flashAndRemoveItem,
    mergeSaveResponse,
    saveAndMerge,
    deleteChartedResource,
    handleConfirmPatientInfo,
    handleMakePrimary,
  };
}
