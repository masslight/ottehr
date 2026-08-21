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

import { useCallback, useMemo, useRef } from 'react';
import {
  applyTemplate as applyTemplateRequest,
  createExternalLabOrder,
  createInHouseLabOrder,
  createNursingOrder,
  createRadiologyOrder,
} from 'src/api/api';
import { useDeleteChartData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { AllChartValues, CPTCodeDTO, DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { DataEntryTestItem } from 'utils/lib/types/data/in-house/in-house.types';
import { linkQuickPickCodes, ProcedureQuickPickContext } from '../executor/procedure-quick-pick';
import {
  CatalogueMatch,
  ChartedItem,
  ChartWriter,
  ExternalLabOrderContext,
  ProcedureWriteResult,
} from '../executor/types';

export interface UseChartWriterOptions {
  encounterId: string;
  /**
   * The diagnoses currently on the chart, as DTOs. Lab and imaging orders are filed AGAINST a
   * diagnosis, and the endpoints want the real DTO rather than the executor's display-only view.
   */
  diagnoses?: DiagnosisDTO[];
  /**
   * The CPT codes currently on the chart. Needed for the same reason as `diagnoses`: a procedure
   * quick-pick carries its own codes, and re-saving one already charted duplicates it.
   */
  cptCodes?: CPTCodeDTO[];
  /**
   * The procedures already on the chart. Only their ids are used, to tell which row in a save's
   * response is the one just created.
   */
  procedures?: { resourceId?: string }[];
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
  cptCodes = [],
  procedures = [],
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
        //
        // encounterId is EXPLICIT, exactly as it is in `save`. The delete mutation falls back to the
        // appointment store when it is not given one, and this page is keyed by encounterId in its own URL
        // with that store empty — so every removal threw "api client not defined or encounterId not
        // provided" and nothing happened.
        await deleteChartData({
          encounterId,
          [field]: [{ resourceId: item.resourceId }],
        } as Partial<AllChartValues> & { encounterId: string });
        onRemoved?.([item.resourceId]);
      } catch (error) {
        // Put it back: a row that vanished from the note but is still on the chart is worse than a
        // slow delete.
        onOptimisticRemove?.(item.resourceId, false);
        throw error;
      }
    },
    [deleteChartData, encounterId, onRemoved, onOptimisticRemove]
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

  // A procedure takes TWO saves, and this mirrors what the regular Procedures page does on Save: its
  // CPT codes and supporting diagnoses have to exist as their own rows before the procedure can point
  // at them, so save those first and link the procedure to the ids that come back.
  //
  // Reading the response's `procedures` array directly, rather than the flat `createdResourceIds`, is
  // deliberate. Between the two saves the query cache has not been updated, so the second save reports
  // the FIRST save's dx/CPT as new as well — keying provenance off `createdResourceIds[0]` would hang
  // the procedure's per-field markers on a diagnosis.
  const chartedRef = useRef({ diagnoses, cptCodes, procedures });
  chartedRef.current = { diagnoses, cptCodes, procedures };

  const addProcedure = useCallback(
    async (context: ProcedureQuickPickContext): Promise<ProcedureWriteResult> => {
      const charted = chartedRef.current;
      // Only codes not already on the chart get created; the rest link to the existing row. Without
      // this, a plan that charted "abscess of skin" from the dictation and then applied an I&D
      // quick-pick carrying the same code left the note with the diagnosis twice.
      const dx = linkQuickPickCodes(context.diagnoses, charted.diagnoses);
      const cpt = linkQuickPickCodes(context.cptCodes, charted.cptCodes);

      let createdCodeIds: string[] = [];
      let savedDx: DiagnosisDTO[] = [];
      let savedCpt: CPTCodeDTO[] = [];
      if (dx.toCreate.length > 0 || cpt.toCreate.length > 0) {
        const step1 = await saveChartData({
          encounterId,
          ...(dx.toCreate.length > 0 ? { diagnosis: dx.toCreate } : {}),
          ...(cpt.toCreate.length > 0 ? { cptCodes: cpt.toCreate } : {}),
        });
        savedDx = step1.chartData?.diagnosis ?? [];
        savedCpt = step1.chartData?.cptCodes ?? [];
        createdCodeIds = step1.createdResourceIds;
      }

      // Every linked code resolved to a row that really exists: the one already charted, else the one
      // just created. A code that resolves to neither is dropped rather than linked by value — a
      // ServiceRequest referencing a resource that was never written is worse than an unlinked one.
      const linkedDx = context.diagnoses
        .map((row) => dx.existing.find((e) => e.code === row.code) ?? savedDx.find((e) => e.code === row.code))
        .filter((row): row is DiagnosisDTO => Boolean(row?.resourceId));
      const linkedCpt = context.cptCodes
        .map((row) => cpt.existing.find((e) => e.code === row.code) ?? savedCpt.find((e) => e.code === row.code))
        .filter((row): row is CPTCodeDTO => Boolean(row?.resourceId));

      const knownProcedureIds = new Set(
        charted.procedures.map((row) => row.resourceId).filter((id): id is string => Boolean(id))
      );
      const step2 = await saveChartData({
        encounterId,
        procedures: [
          {
            ...context.dto,
            ...(linkedCpt.length > 0 ? { cptCodes: linkedCpt } : {}),
            ...(linkedDx.length > 0 ? { diagnoses: linkedDx } : {}),
          },
        ],
      });
      const procedure = (step2.chartData?.procedures ?? []).find(
        (row) => row.resourceId && !knownProcedureIds.has(row.resourceId)
      );

      return {
        // The procedure and the genuinely-new codes. Codes that were already charted keep whatever
        // provenance they already had — the procedure did not author them.
        createdResourceIds: [...(procedure?.resourceId ? [procedure.resourceId] : []), ...createdCodeIds],
        procedureResourceId: procedure?.resourceId,
        inferredResourceIds: createdCodeIds,
        templateFilledFields: context.templateFilledFields,
      };
    },
    [saveChartData, encounterId]
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
        // Chart data, so it needs no zambda client of its own — the shared mutation is always there.
        procedures: true,
      },
      orderLab,
      orderRadiology,
      createNursingOrder: createNursingOrderForVisit,
      applyTemplate,
      addProcedure,
    }),
    [save, remove, orderLab, orderRadiology, createNursingOrderForVisit, applyTemplate, addProcedure, oystehrZambda]
  );
}
