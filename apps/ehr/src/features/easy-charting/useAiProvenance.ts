import { captureException } from '@sentry/react';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useRef, useState } from 'react';
import { rosField } from 'utils/lib/ottehr-config/review-of-systems';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ExamObservationDTO, MedicationDTO, ProcedureDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { SaveChartDataRequest } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { useApiClients } from '../../hooks/useAppClients';
import { useEMCodes } from '../visits/shared/hooks/useEMCodes';
import { AiAlternative } from './AiChartedItem';
import { AiChartedMeta, AiField, ChartNoteKey, ProcedureProvenance, SearchResult } from './chart-types';
import { EXAM_LEAVES, ExamLeaf, ROS_LEAVES, RosLeaf } from './exam-ros-catalog';
import {
  buildIntentPayload,
  findExamLeafMatches,
  findRosLeafMatches,
  noteFieldDriftReason,
  runIntentSearch,
  synthAddIntent,
} from './intent-logic';

// The AI-provenance layer of the easy-chart page: which charted items the assistant wrote (and
// from which dictation phrase), which still need the provider's review, the drift flags on
// AI-written free text, and the inline correction handlers (search / replace / remove / toggles).
// It talks to the chart only through the saveAndMerge/deleteChartedResource functions passed in;
// the one page-side flow it does NOT own is "Discuss" (which opens the conversation picker).
export function useAiProvenance({
  encounterId,
  chartDataRef,
  saveAndMerge,
  deleteChartedResource,
}: {
  encounterId: string | undefined;
  chartDataRef: React.MutableRefObject<GetChartDataResponse | null>;
  saveAndMerge: (payload: SaveChartDataRequest) => Promise<string[]>;
  deleteChartedResource: (field: AiField, dto: { resourceId?: string }) => Promise<void>;
}): {
  aiCharted: Map<string, AiChartedMeta>;
  setAiCharted: React.Dispatch<React.SetStateAction<Map<string, AiChartedMeta>>>;
  hadAiItems: boolean;
  procedureProv: Map<string, ProcedureProvenance>;
  setProcedureProv: React.Dispatch<React.SetStateAction<Map<string, ProcedureProvenance>>>;
  noteFieldMeta: Map<ChartNoteKey, { sourceText?: string; needsReview?: boolean; reason?: string }>;
  setNoteFieldMeta: React.Dispatch<
    React.SetStateAction<Map<ChartNoteKey, { sourceText?: string; needsReview?: boolean; reason?: string }>>
  >;
  instructionMeta: Map<string, { needsReview?: boolean; reason?: string }>;
  setInstructionMeta: React.Dispatch<React.SetStateAction<Map<string, { needsReview?: boolean; reason?: string }>>>;
  pendingProvenanceRef: React.MutableRefObject<{ sourceText?: string; inferred?: boolean; reviewNote?: string } | null>;
  medDoseMismatchRef: React.MutableRefObject<{ drug: string; dictated: string; order: string }[]>;
  withPendingProv: (meta: AiChartedMeta) => AiChartedMeta;
  flagAiObsIds: (ids: string[], field: 'examObservations' | 'rosObservations', display: string) => void;
  clearAiChartedId: (resourceId?: string) => void;
  confirmAllAi: () => void;
  confirmProcedureField: (resourceId: string, field: keyof ProcedureDTO) => void;
  confirmProcedure: (resourceId: string) => void;
  aiSearch: (field: AiField, query: string) => Promise<AiAlternative[]>;
  aiReplace: (field: AiField, dto: { resourceId?: string }, key: string, checkboxChecked?: boolean) => void;
  aiSetMedDosage: (dto: { resourceId?: string }, value: boolean) => void;
  aiSetRosState: (dto: { resourceId?: string }, denies: boolean) => void;
  aiRemove: (field: AiField, dto: { resourceId?: string }) => void;
  detectNoteFieldDrift: () => void;
  confirmNoteField: (key: ChartNoteKey) => void;
  confirmInstruction: (resourceId: string) => void;
} {
  const { oystehr, oystehrZambda } = useApiClients();
  // E&M code list — the alternatives offered when correcting an auto-charted E&M code.
  const { emCodes } = useEMCodes();

  // Items the assistant auto-charted this session that still need the provider's review (keyed by
  // resourceId). Client-only — cleared when the provider corrects/removes/discusses an item, never
  // persisted.
  const [aiCharted, setAiCharted] = useState<Map<string, AiChartedMeta>>(new Map());
  // Latches true once anything has been AI-charted this session, so the readiness banner can show a
  // positive "all reviewed" state after the queue is cleared (rather than just disappearing).
  const [hadAiItems, setHadAiItems] = useState(false);
  // Field-level provenance for AI-added procedures (keyed by procedure resourceId). Session-only,
  // same lifecycle as `aiCharted`.
  const [procedureProv, setProcedureProv] = useState<Map<string, ProcedureProvenance>>(new Map());
  useEffect(() => {
    if (aiCharted.size > 0 || procedureProv.size > 0) setHadAiItems(true);
  }, [aiCharted, procedureProv]);
  // Provenance carrier: set to the current planner step's source phrase right before that step is
  // dispatched, so the (async) charting handlers can stamp every item they create with sourceText /
  // inferred. Single-flight: only one step dispatches at a time (the advance effect waits for the
  // prior step to settle), so a ref is safe. Non-planner dispatches (agent / refine / suggestion)
  // reset it to null first, so those items get NO inferred mark (they came from the provider).
  const pendingProvenanceRef = useRef<{ sourceText?: string; inferred?: boolean; reviewNote?: string } | null>(null);
  // Provenance + needs-review state for the AI-written free-text fields (keyed by chart-data scalar
  // key). `sourceText` is the dictation snippet the field was generated from (shown for comparison);
  // `needsReview`/`reason` flag a likely drift from the dictation (e.g. a dose that no longer matches
  // the order). Cleared when the provider confirms.
  const [noteFieldMeta, setNoteFieldMeta] = useState<
    Map<ChartNoteKey, { sourceText?: string; needsReview?: boolean; reason?: string }>
  >(new Map());
  // Same needs-review flagging for patient-instruction lines, keyed by the instruction's resourceId.
  const [instructionMeta, setInstructionMeta] = useState<Map<string, { needsReview?: boolean; reason?: string }>>(
    new Map()
  );
  // Medications whose ORDERED strength ended up different from what was dictated (dose-safety
  // substitution). Recorded at pick time; used after the plan completes to flag any free-text field
  // that still references the dictated dose.
  const medDoseMismatchRef = useRef<{ drug: string; dictated: string; order: string }[]>([]);
  // `aiSearchResultsRef` holds the last popover search so a chosen alternative key can be resolved
  // back to a SearchResult; the leaf cache is its counterpart for the exam/ROS observation fields.
  const aiSearchResultsRef = useRef<Map<string, SearchResult>>(new Map());
  const aiLeafResultsRef = useRef<Map<string, ExamLeaf | RosLeaf>>(new Map());

  // Merge the current planner step's provenance (sourceText / inferred) into a freshly-built meta,
  // so each item created during a plan step carries where it came from. No-op for non-planner
  // dispatches (ref is null) — those items stay un-inferred.
  const withPendingProv = (meta: AiChartedMeta): AiChartedMeta => {
    const p = pendingProvenanceRef.current;
    if (!p) return meta;
    return {
      ...meta,
      sourceText: p.sourceText,
      inferred: p.inferred,
      reviewNote: p.reviewNote,
      // Triage tier: items WITHOUT a verbatim dictation quote (inferred) or added by the post-chart
      // review are the ones the provider most needs to inspect — mark them low-confidence (amber)
      // so they stand out from routine quote-backed items (blue).
      lowConfidence: meta.lowConfidence || !!p.inferred || !!p.reviewNote,
    };
  };
  // Flag newly-charted observation ids (returned by saveAndMerge) as AI-charted/needs-review so they
  // render clickable-to-correct. (Can't diff chartDataRef here — it's only synced post-render.)
  const flagAiObsIds = (ids: string[], field: 'examObservations' | 'rosObservations', display: string): void => {
    if (ids.length === 0) return;
    setAiCharted((prev) => {
      const n = new Map(prev);
      for (const id of ids) n.set(id, withPendingProv({ field, display, searchTerms: [], lowConfidence: false }));
      return n;
    });
  };
  const clearAiChartedId = (resourceId?: string): void => {
    if (!resourceId) return;
    setAiCharted((prev) => {
      if (!prev.has(resourceId)) return prev;
      const n = new Map(prev);
      n.delete(resourceId);
      return n;
    });
  };
  // "Confirm" an AI item = the provider has eyeballed it and accepts it as-is → drop the needs-review
  // highlight (same effect as correcting it, minus the change). Confirm-all clears the whole queue.
  const confirmAllAi = (): void => {
    setAiCharted(new Map());
    setProcedureProv(new Map());
  };
  // Procedure field-level review: confirming (or editing) a field drops it from the inferred set; the
  // whole entry clears when no fields remain. "Confirm all" on the card drops the entry outright.
  const confirmProcedureField = (resourceId: string, field: keyof ProcedureDTO): void => {
    setProcedureProv((prev) => {
      const entry = prev.get(resourceId);
      if (!entry) return prev;
      const fields = new Set(entry.inferredFields);
      fields.delete(field as string);
      const next = new Map(prev);
      if (fields.size === 0) next.delete(resourceId);
      else next.set(resourceId, { ...entry, inferredFields: fields });
      return next;
    });
  };
  const confirmProcedure = (resourceId: string): void => {
    setProcedureProv((prev) => {
      if (!prev.has(resourceId)) return prev;
      const next = new Map(prev);
      next.delete(resourceId);
      return next;
    });
  };

  // Popover "search alternatives": reuse the same search the pickers use, and cache the results so
  // a chosen key can be resolved back to its SearchResult on replace.
  const aiSearch = async (field: AiField, query: string): Promise<AiAlternative[]> => {
    // CODE-based fields: CPT/HCPCS via the terminology service, E&M from the configured code list.
    if (field === 'cptCodes' || field === 'emCode') {
      let codes: Array<{ code: string; display: string }> = [];
      if (field === 'emCode') {
        const q = query.trim().toLowerCase();
        codes = q
          ? emCodes.filter((c) => c.code.toLowerCase().includes(q) || c.display.toLowerCase().includes(q))
          : emCodes;
        if (codes.length === 0) codes = emCodes;
      } else {
        // CPT + HCPCS terminology search — same source as the regular-note CPT picker (type 'both').
        // Each side degrades independently (one vocabulary failing shouldn't blank the other), but
        // a failure is captured — an empty picker must not silently masquerade as "no matches".
        const searchFailed = (e: unknown): undefined => {
          console.error('CPT/HCPCS terminology search failed:', e);
          captureException(e);
          return undefined;
        };
        const [cpt, hcpcs] = await Promise.all([
          oystehr?.terminology.searchCpt({ query, searchType: 'all', limit: 40 }).catch(searchFailed),
          oystehr?.terminology.searchHcpcs({ query, searchType: 'all', limit: 40 }).catch(searchFailed),
        ]);
        codes = [...(cpt?.codes ?? []), ...(hcpcs?.codes ?? [])];
      }
      const map = new Map<string, SearchResult>();
      const alts: AiAlternative[] = codes.slice(0, 40).map((c, i) => {
        const key = `${c.code}-${i}`;
        map.set(key, { name: c.display, code: c.code });
        return { key, label: `${c.code} — ${c.display}` };
      });
      aiSearchResultsRef.current = map;
      return alts;
    }
    // OBSERVATION fields: resolve against the exam / ROS leaf catalogs (not a term search).
    if (field === 'examObservations' || field === 'rosObservations') {
      const leafMap = new Map<string, ExamLeaf | RosLeaf>();
      let alts: AiAlternative[];
      if (field === 'examObservations') {
        const matches = findExamLeafMatches(
          { kind: 'add-exam-finding', display: query, searchTerms: [query] },
          EXAM_LEAVES
        );
        alts = matches.map((leaf, i) => {
          const key = `${leaf.field}-${i}`;
          leafMap.set(key, leaf);
          return { key, label: leaf.label, secondary: leaf.section };
        });
      } else {
        const matches = findRosLeafMatches(
          { kind: 'add-ros-finding', display: query, searchTerms: [query] },
          ROS_LEAVES
        );
        alts = matches.map((leaf, i) => {
          const key = `${leaf.baseKey}-${i}`;
          leafMap.set(key, leaf);
          return { key, label: leaf.label, secondary: leaf.system };
        });
      }
      aiLeafResultsRef.current = leafMap;
      return alts;
    }
    if (field === 'vitalsObservations') return [];
    const intent = synthAddIntent(field, query, [query]);
    const results = await runIntentSearch(intent, oystehr, oystehrZambda);
    const map = new Map<string, SearchResult>();
    const alts: AiAlternative[] = results.map((r, i) => {
      const key = `${r.code ?? r.id ?? r.name}-${i}`;
      map.set(key, r);
      return {
        key,
        label: r.code ? `${r.code} — ${r.name}` : r.name,
        // Medications show strength as a secondary line (mirrors the regular-note suggestion).
        secondary: field === 'medications' ? r.strength : undefined,
      };
    });
    aiSearchResultsRef.current = map;
    return alts;
  };

  // Replace an AI-charted item with a chosen alternative: delete the old, add the new (NOT flagged
  // for review — the provider chose it). Preserves primary flag for diagnoses; carries the
  // dosage-unconfirmed flag for medications.
  const aiReplace = (field: AiField, dto: { resourceId?: string }, key: string, checkboxChecked?: boolean): void => {
    // OBSERVATION fields resolve the chosen key against the exam/ROS leaf cache, then delete the old
    // observation and save the new leaf (ROS carries the denies/reports state from the checkbox).
    if (field === 'examObservations' || field === 'rosObservations') {
      const leaf = aiLeafResultsRef.current.get(key);
      if (!leaf || !encounterId) return;
      void (async () => {
        try {
          clearAiChartedId(dto.resourceId);
          await deleteChartedResource(field, dto);
          if (field === 'examObservations') {
            const ex = leaf as ExamLeaf;
            await saveAndMerge({ encounterId, examObservations: [{ field: ex.field, label: ex.label, value: true }] });
          } else {
            const ros = leaf as RosLeaf;
            const state = checkboxChecked ? RosFindingState.Denies : RosFindingState.Reports;
            await saveAndMerge({
              encounterId,
              rosObservations: [{ field: rosField(ros.baseKey, state), label: ros.label, value: true }],
            });
          }
        } catch (e) {
          console.error('AI replace failed:', e);
          captureException(e);
          enqueueSnackbar(`Could not replace "${leaf.label}" — check the chart before signing.`, { variant: 'error' });
        }
      })();
      return;
    }
    const result = aiSearchResultsRef.current.get(key);
    if (!result || !encounterId || !result.code) return;
    // CODE-based fields: E&M is a scalar (overwrite); CPT is an array (delete old, add new).
    if (field === 'emCode' || field === 'cptCodes') {
      const code = result.code;
      const display = result.name;
      void (async () => {
        try {
          clearAiChartedId(dto.resourceId);
          if (field === 'emCode') {
            await saveAndMerge({ encounterId, emCode: { code, display } });
          } else {
            await deleteChartedResource('cptCodes', dto);
            await saveAndMerge({ encounterId, cptCodes: [{ code, display }] });
          }
        } catch (e) {
          console.error('AI replace failed:', e);
          captureException(e);
          enqueueSnackbar(`Could not replace with ${result.code} — check the chart before signing.`, {
            variant: 'error',
          });
        }
      })();
      return;
    }
    if (field === 'vitalsObservations') return;
    const isPrimary = field === 'diagnosis' ? !!(dto as { isPrimary?: boolean }).isPrimary : undefined;
    const intent = synthAddIntent(field, result.name, [], isPrimary);
    const payload = buildIntentPayload(encounterId, intent, result, checkboxChecked ?? true);
    void (async () => {
      try {
        await deleteChartedResource(field, dto);
        if (payload) await saveAndMerge(payload);
      } catch (e) {
        // The delete may have succeeded before the save failed — the item could now be missing.
        console.error('AI replace failed:', e);
        captureException(e);
        enqueueSnackbar(`Could not replace "${result.name}" — check the chart before signing.`, { variant: 'error' });
      }
    })();
  };

  // Toggle "patient doesn't know dosage" on an already-charted medication, in place (no replace).
  const aiSetMedDosage = (dto: { resourceId?: string }, value: boolean): void => {
    if (!encounterId || !dto.resourceId) return;
    const med = dto as MedicationDTO;
    const payload: SaveChartDataRequest = {
      encounterId,
      medications: [{ ...med, intakeInfo: { ...med.intakeInfo, patientCouldNotConfirmDosage: value || undefined } }],
    };
    void saveAndMerge(payload).catch((e) => {
      console.error('AI dosage toggle failed:', e);
      captureException(e);
      enqueueSnackbar('Could not update the dosage-unknown flag.', { variant: 'error' });
    });
  };

  // Flip a charted ROS finding's polarity in place (denies ↔ reports). Switching the field-key
  // suffix means a new observation; uncheck the old one and keep the new one flagged for review.
  const aiSetRosState = (dto: { resourceId?: string }, denies: boolean): void => {
    if (!encounterId) return;
    const obs = dto as ExamObservationDTO;
    if (!obs.field) return;
    const baseKey = obs.field.replace(/-(denies|reports)$/, '');
    const newField = rosField(baseKey, denies ? RosFindingState.Denies : RosFindingState.Reports);
    if (newField === obs.field) return;
    const updates: ExamObservationDTO[] = [
      { field: newField, label: obs.label, value: true },
      { field: obs.field, label: obs.label, value: false, resourceId: obs.resourceId },
    ];
    void (async () => {
      try {
        const newIds = await saveAndMerge({ encounterId, rosObservations: updates });
        setAiCharted((prev) => {
          const n = new Map(prev);
          if (obs.resourceId) n.delete(obs.resourceId);
          for (const id of newIds)
            n.set(id, { field: 'rosObservations', display: obs.label ?? '', searchTerms: [], lowConfidence: false });
          return n;
        });
      } catch (e) {
        console.error('AI ROS state toggle failed:', e);
        captureException(e);
        enqueueSnackbar(`Could not flip "${obs.label ?? 'the finding'}" — check the ROS before signing.`, {
          variant: 'error',
        });
      }
    })();
  };

  const aiRemove = (field: AiField, dto: { resourceId?: string }): void => {
    void deleteChartedResource(field, dto).catch((e) => {
      console.error('AI remove failed:', e);
      captureException(e);
      enqueueSnackbar('Could not remove the item — it is still on the chart.', { variant: 'error' });
    });
  };

  // Deterministically flag AI-written free-text fields that likely drifted from the dictation
  // (Phase 1: a dose-safety substitution, or a dose/duration the provider dictated that's missing
  // from the text). Runs at plan completion, against the fully-charted note.
  const detectNoteFieldDrift = (): void => {
    const data = chartDataRef.current;
    if (!data) return;
    const mismatches = medDoseMismatchRef.current;
    setNoteFieldMeta((prev) => {
      const n = new Map(prev);
      const check = (key: ChartNoteKey, text?: string): void => {
        if (!text || !text.trim()) return;
        const meta = n.get(key);
        if (meta?.needsReview) return;
        const reason = noteFieldDriftReason(text, meta?.sourceText, mismatches);
        if (reason) n.set(key, { ...meta, needsReview: true, reason });
      };
      check('chiefComplaint', data.chiefComplaint?.text); // backs the "History of Present Illness" field
      check('medicalDecision', data.medicalDecision?.text);
      return n;
    });
    // Patient-instruction lines: flag any that still name a substituted-dose medication.
    setInstructionMeta((prev) => {
      const n = new Map(prev);
      for (const c of data.instructions ?? []) {
        if (!c.resourceId || !c.text || n.get(c.resourceId)?.needsReview) continue;
        const reason = noteFieldDriftReason(c.text, undefined, mismatches);
        if (reason) n.set(c.resourceId, { needsReview: true, reason });
      }
      return n;
    });
  };

  // Clear a free-text field's needs-review flag once the provider has checked it against the source.
  const confirmNoteField = (key: ChartNoteKey): void => {
    setNoteFieldMeta((prev) => {
      const meta = prev.get(key);
      if (!meta?.needsReview) return prev;
      const n = new Map(prev);
      n.set(key, { ...meta, needsReview: false, reason: undefined });
      return n;
    });
  };

  // Clear a patient-instruction's needs-review flag.
  const confirmInstruction = (resourceId: string): void => {
    setInstructionMeta((prev) => {
      if (!prev.get(resourceId)?.needsReview) return prev;
      const n = new Map(prev);
      n.set(resourceId, { needsReview: false, reason: undefined });
      return n;
    });
  };

  return {
    aiCharted,
    setAiCharted,
    hadAiItems,
    procedureProv,
    setProcedureProv,
    noteFieldMeta,
    setNoteFieldMeta,
    instructionMeta,
    setInstructionMeta,
    pendingProvenanceRef,
    medDoseMismatchRef,
    withPendingProv,
    flagAiObsIds,
    clearAiChartedId,
    confirmAllAi,
    confirmProcedureField,
    confirmProcedure,
    aiSearch,
    aiReplace,
    aiSetMedDosage,
    aiSetRosState,
    aiRemove,
    detectNoteFieldDrift,
    confirmNoteField,
    confirmInstruction,
  };
}
