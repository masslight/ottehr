// The feature's write layer. It is THIN on purpose — everything it can delegate, it delegates.
//
// WHY IT GOES THROUGH THE SHARED MUTATION: `useSaveChartData` refuses to write when the appointment
// is read-only, allowing only addendum content through (a signed visit can still be appended to, not
// rewritten). The `save-chart-data` zambda does not check this at all — the guard is client-side
// only. The previous implementation called `apiClient.saveChartData` directly and therefore bypassed
// it entirely: on a signed visit the assistant could still write while the regular chart refused.
// Nobody noticed, because the happy path is an open visit.
//
// NOT-YET-WIRED PATHS ARE DECLARED, NOT THROWN. `supports` tells the executor which non-chart-data
// endpoints this writer can reach, and it is checked BEFORE the action runs. An unsupported action
// then settles as `skipped` with a reason naming where to do it instead. Throwing would settle it as
// `failed`, which reads to a provider as "something broke" — a different fact, which they would act
// on differently. The bodies below still throw as a backstop, so a `supports` flag that lies is a
// loud bug rather than a silent no-op.

import { useCallback, useMemo } from 'react';
import {
  applyTemplate as applyTemplateRequest,
  createExternalLabOrder,
  createInHouseLabOrder,
  createNursingOrder,
  createRadiologyOrder,
} from 'src/api/api';
import { useDeleteChartData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { AllChartValues, DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { DataEntryTestItem } from 'utils/lib/types/data/in-house/in-house.types';
import { CatalogueMatch, ChartedItem, ChartWriter, ExternalLabOrderContext } from '../executor/types';

export interface UseChartWriterOptions {
  encounterId: string;
  /**
   * The diagnoses currently on the chart, as DTOs. Lab and imaging orders are filed AGAINST a
   * diagnosis, and the endpoints want the real DTO rather than the executor's display-only view.
   */
  diagnoses?: DiagnosisDTO[];
  /** Called with the ids a delete removed, so the provenance map does not keep stale entries. */
  onRemoved?: (resourceIds: string[]) => void;
  /**
   * Called before a delete lands, so the row can flash and disappear rather than waiting on the
   * round trip. Called again with `false` if the delete fails, so a failed removal reappears.
   */
  onOptimisticRemove?: (resourceId: string, removed: boolean) => void;
  /** Called after an order is placed, so the orders sections refresh without a reload. */
  onOrdersChanged?: () => void;
}

export function useChartWriter({
  encounterId,
  diagnoses = [],
  onRemoved,
  onOptimisticRemove,
  onOrdersChanged,
}: UseChartWriterOptions): ChartWriter {
  const { mutateAsync: saveChartData } = useSaveChartData();
  const { mutateAsync: deleteChartData } = useDeleteChartData();
  const { oystehrZambda } = useApiClients();

  const save = useCallback(
    async (fields: Record<string, unknown>): Promise<string[]> => {
      // The shared mutation applies the read-only rule and returns the ids it created. A throw from
      // it ("update disabled in read only mode") becomes a failed step with that text, which is the
      // correct outcome — though the page should already be disabled with a visible reason, so a
      // provider never reaches this by typing into a signed visit.
      const result = await saveChartData({ encounterId, ...(fields as Partial<AllChartValues>) });
      return result.createdResourceIds;
    },
    [saveChartData, encounterId]
  );

  const remove = useCallback(
    async (field: string, item: ChartedItem): Promise<void> => {
      onOptimisticRemove?.(item.resourceId, true);
      try {
        // `field` is the chart-data key the registry gave this action; the cast narrows a dynamic
        // key onto the DTO map, it does not widen what may be deleted.
        await deleteChartData({ [field]: [{ resourceId: item.resourceId }] } as Partial<AllChartValues>);
        onRemoved?.([item.resourceId]);
      } catch (error) {
        // Put it back: a row that vanished from the note but is still on the chart is worse than a
        // slow delete.
        onOptimisticRemove?.(item.resourceId, false);
        throw error;
      }
    },
    [deleteChartData, onRemoved, onOptimisticRemove]
  );

  const applyTemplate = useCallback(
    async (match: CatalogueMatch): Promise<string[]> => {
      if (!oystehrZambda) throw new Error('api client not defined');
      // The template is applied by TITLE, which is why the catalogue resolves against the practice's
      // real titles and the prompt forbids inventing one.
      const result = await applyTemplateRequest(oystehrZambda, { encounterId, templateName: match.display });
      // apply-template writes across many sections; its warnings are what the provider needs to see,
      // and the chart refetch that follows picks up the rows themselves.
      for (const warning of result.warnings ?? []) {
        console.log(`[easy-chart] template "${match.display}" warning on ${warning.section}: ${warning.message}`);
      }
      return [];
    },
    [oystehrZambda, encounterId]
  );

  const createNursingOrderForVisit = useCallback(
    async (text: string): Promise<string[]> => {
      if (!oystehrZambda) throw new Error('api client not defined');
      await createNursingOrder(oystehrZambda, { encounterId, notes: text });
      onOrdersChanged?.();
      return [];
    },
    [oystehrZambda, encounterId, onOrdersChanged]
  );

  const orderLab = useCallback(
    async (match: CatalogueMatch, inHouse: boolean): Promise<string[]> => {
      if (!oystehrZambda) throw new Error('api client not defined');

      if (inHouse) {
        // The catalogue put the whole test ITEM in the payload, because the create call needs the
        // item and not just its name.
        const test = match.payload as DataEntryTestItem;
        await createInHouseLabOrder(oystehrZambda, {
          encounterId,
          testItems: [test],
          // `diagnosesAll` is what the order is filed against; `diagnosesNew` is empty because the
          // assistant charts diagnoses through their own action, never as a side effect of a lab.
          diagnosesAll: diagnoses,
          diagnosesNew: [],
        });
      } else {
        // Office, payment method and the full Encounter were all resolved by the catalogue from real
        // data. Re-resolving them here could produce a DIFFERENT answer than the one the provider was
        // shown in the picker.
        const context = match.payload as ExternalLabOrderContext;
        await createExternalLabOrder(oystehrZambda, {
          dx: diagnoses,
          encounter: context.encounter,
          orderableItems: [context.item],
          psc: false,
          orderingLocation: context.office,
          selectedPaymentMethod: context.paymentMethod,
        });
      }

      onOrdersChanged?.();
      // The order's ServiceRequest is not chart data, so it carries no provenance row of its own.
      return [];
    },
    [oystehrZambda, encounterId, diagnoses, onOrdersChanged]
  );

  const orderRadiology = useCallback(
    async (match: CatalogueMatch, request: { dictatedStudyName: string }): Promise<string[]> => {
      if (!oystehrZambda) throw new Error('api client not defined');
      // Prefer the primary diagnosis; the handler has already refused the action when there is none.
      const linked = diagnoses.find((dx) => dx.isPrimary) ?? diagnoses[0];
      if (!linked?.code) throw new Error('an imaging order needs a linked diagnosis');

      await createRadiologyOrder(oystehrZambda, {
        encounterId,
        diagnosisCodes: [linked.code],
        // From the practice's imaging catalogue, never from the model.
        cptCode: match.payload as string,
        lateralityModifier: undefined,
        stat: false,
        clinicalHistory: `${request.dictatedStudyName} — ${linked.display ?? linked.code}`.slice(0, 255),
        studyName: request.dictatedStudyName,
        // Product-owner decision: an in-clinic X-ray ordered during the visit is taken to have consent
        // obtained, the same assumption the regular Radiology flow makes for these orders. Recorded
        // here rather than left implicit, because it is an assumption and not something the dictation
        // established.
        consentObtained: true,
      });
      onOrdersChanged?.();
      return [];
    },
    [oystehrZambda, encounterId, diagnoses, onOrdersChanged]
  );

  return useMemo<ChartWriter>(
    () => ({
      save,
      remove,
      supports: {
        labOrders: Boolean(oystehrZambda),
        radiologyOrders: Boolean(oystehrZambda),
        nursingOrders: Boolean(oystehrZambda),
        templates: Boolean(oystehrZambda),
      },
      orderLab,
      orderRadiology,
      createNursingOrder: createNursingOrderForVisit,
      applyTemplate,
    }),
    [save, remove, orderLab, orderRadiology, createNursingOrderForVisit, applyTemplate, oystehrZambda]
  );
}
