import { useQuery } from '@tanstack/react-query';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { useEffect, useMemo, useRef } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import {
  EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES,
  ExtractableCardDocumentFileType,
  GetAnswerOptionsRequest,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  InsuranceCardExtractionFields,
  IntakeQuestionnaireItem,
  PHOTO_ID_FRONT_ID,
} from 'utils';
import { usePaperworkContext } from '../context';
import {
  buildInsuranceFills,
  buildPhotoIdFills,
  CardFill,
  INSURANCE_CARRIER_2_LINK_ID,
  INSURANCE_CARRIER_LINK_ID,
  isFieldUserEdited,
  mergeInsuranceFields,
  readAtPath,
} from './cardAutofillEngine';
import { useCardAutofillStore } from './useCardAutofillStore';
import { useCardExtraction, UseCardExtractionResult } from './useCardExtraction';
import { getPaperworkFieldId, useQRState } from './useFormHelpers';

interface FieldEntry {
  item: IntakeQuestionnaireItem;
  /** react-hook-form path of the item's container value (same derivation NestedInput uses). */
  fieldId: string;
}

/** linkId → { item, fieldId } for every item on the page, including group children. */
const buildFieldIndex = (items: IntakeQuestionnaireItem[]): Record<string, FieldEntry> => {
  const index: Record<string, FieldEntry> = {};
  const walk = (
    list: IntakeQuestionnaireItem[],
    parentItem?: IntakeQuestionnaireItem,
    parentFieldId?: string
  ): void => {
    list.forEach((item) => {
      const fieldId = parentItem ? getPaperworkFieldId({ item, parentItem, parentFieldId }) : item.linkId;
      index[item.linkId] = { item, fieldId };
      if (item.type === 'group' && item.item) {
        walk(item.item, item, fieldId);
      }
    });
  };
  walk(items);
  return index;
};

const attachmentUrlOf = (node: unknown): string | undefined => {
  return (node as QuestionnaireResponseItem | undefined)?.answer?.[0]?.valueAttachment?.url;
};

interface UseCardAutofillInput {
  items: IntakeQuestionnaireItem[];
  pageId: string;
}

/**
 * The card auto-fill engine. Mounted once per paperwork form (PaperworkFormRoot, inside the
 * FormProvider); inert unless the page contains card capture slots and the visit is in-person
 * paperwork.
 *
 * Trigger: a card image ADDED or REPLACED this session — the slot's form value holds the just
 * uploaded z3 url, which differs from the slot's defaultValues url (previously saved images
 * live in defaultValues, so pre-existing cards never trigger). That url is the
 * useCardExtraction trigger, restarting the OCR poll per new image.
 *
 * Fill rules (per slot → target mapping in cardAutofillEngine):
 * - a field the patient actively edited this session (dirty/touched) is NEVER overwritten;
 *   the engine's own setValue calls set neither flag, so its fills stay overwritable
 * - untouched fields are filled/updated with { linkId, answer } via
 *   setValue(fieldId, value, { shouldValidate: true }) — the same shape/mechanism as
 *   useAutoFillValues
 * - each (image, target, value) is applied at most once, so a patient clearing an engine fill
 *   is not re-filled from the same image
 * - back insurance slots only contribute values the front image left null (merge with front
 *   precedence), and are only consulted once the front's extraction settles
 *
 * UI state (reading indicator, ✨AI badges, carrier hints, couldn't-read notes) is published
 * to useCardAutofillStore; badges auto-clear when the patient edits the filled field.
 *
 * Virtual paperwork: the virtual questionnaire has the same card slots and target linkIds, so
 * wiring it is just widening the isInPersonPaperwork gate below (its own carrier field uses
 * the same get-patient-insurance-payers source).
 */
export const useCardAutofill = ({ items, pageId }: UseCardAutofillInput): void => {
  const { appointment, questionnaireResponse, paperworkComponentHelpers } = usePaperworkContext();
  const appointmentID = appointment?.id;
  // in-person only for now (same gate idiom as the continue-label swizzle in PagedQuestionnaire)
  const isInPersonPaperwork = questionnaireResponse?.questionnaire?.includes('intake-paperwork-inperson') ?? false;

  const { getValues, setValue } = useFormContext();
  const { dirtyFields, touchedFields, defaultValues } = useFormState();
  const { formValues } = useQRState();

  const fieldIndex = useMemo(() => buildFieldIndex(items), [items]);

  const slotTriggers = useMemo(() => {
    const triggers: Partial<Record<ExtractableCardDocumentFileType, string | null>> = {};
    EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES.forEach((slot) => {
      const entry = fieldIndex[slot];
      if (!entry || !isInPersonPaperwork) {
        triggers[slot] = null;
        return;
      }
      const current = attachmentUrlOf(readAtPath(formValues, entry.fieldId));
      const initial = attachmentUrlOf(readAtPath(defaultValues, entry.fieldId));
      triggers[slot] = current && current !== initial ? current : null;
    });
    return triggers;
  }, [fieldIndex, formValues, defaultValues, isInPersonPaperwork]);

  const photoIdFront = useCardExtraction(appointmentID, PHOTO_ID_FRONT_ID, {
    trigger: slotTriggers[PHOTO_ID_FRONT_ID],
  });
  const insuranceFront = useCardExtraction(appointmentID, INSURANCE_CARD_FRONT_ID, {
    trigger: slotTriggers[INSURANCE_CARD_FRONT_ID],
  });
  const insuranceBack = useCardExtraction(appointmentID, INSURANCE_CARD_BACK_ID, {
    trigger: slotTriggers[INSURANCE_CARD_BACK_ID],
  });
  const insuranceFront2 = useCardExtraction(appointmentID, INSURANCE_CARD_FRONT_2_ID, {
    trigger: slotTriggers[INSURANCE_CARD_FRONT_2_ID],
  });
  const insuranceBack2 = useCardExtraction(appointmentID, INSURANCE_CARD_BACK_2_ID, {
    trigger: slotTriggers[INSURANCE_CARD_BACK_2_ID],
  });

  // The carrier match runs against the SAME payer option list the carrier field loads: the
  // query key matches FreeMultiSelectInput's key for the primary carrier field (its top-level
  // fieldId + fetch input), so react-query shares the cache with the rendered field rather than
  // refetching. Goes through paperworkComponentHelpers.getAnswerOptions — the same app-supplied
  // helper FreeMultiSelectInput calls — since this hook lives in ui-components and has no direct
  // access to the intake app's API client.
  const carrierAnswerSource =
    fieldIndex[INSURANCE_CARRIER_LINK_ID]?.item.answerLoadingOptions?.answerSource ??
    fieldIndex[INSURANCE_CARRIER_2_LINK_ID]?.item.answerLoadingOptions?.answerSource;
  const anyInsuranceTrigger = [
    INSURANCE_CARD_FRONT_ID,
    INSURANCE_CARD_BACK_ID,
    INSURANCE_CARD_FRONT_2_ID,
    INSURANCE_CARD_BACK_2_ID,
  ].some((slot) => slotTriggers[slot as ExtractableCardDocumentFileType] != null);
  const carrierFetchOptionsInput: GetAnswerOptionsRequest | undefined = carrierAnswerSource
    ? { answerSource: carrierAnswerSource }
    : undefined;
  const { data: payerOptions } = useQuery({
    queryKey: [INSURANCE_CARRIER_LINK_ID, carrierFetchOptionsInput],
    queryFn: () => paperworkComponentHelpers.getAnswerOptions?.(carrierFetchOptionsInput as GetAnswerOptionsRequest),
    enabled:
      Boolean(carrierAnswerSource) && anyInsuranceTrigger && paperworkComponentHelpers.getAnswerOptions !== undefined,
  });

  // (image url, target linkId, value) applications — never repeated, so a user clearing an
  // engine fill isn't fill-fought from the same image
  const appliedFillsRef = useRef<Set<string>>(new Set());
  // target linkId → JSON of the answer the engine last set (badge cleared when it changes)
  const engineValuesRef = useRef<Map<string, string>>(new Map());

  // page change: the form resets to new defaults; drop all engine + UI state with it
  const prevPageRef = useRef(pageId);
  useEffect(() => {
    if (prevPageRef.current !== pageId) {
      prevPageRef.current = pageId;
      appliedFillsRef.current.clear();
      engineValuesRef.current.clear();
      useCardAutofillStore.getState().resetAll();
    }
  }, [pageId]);
  useEffect(() => {
    return () => useCardAutofillStore.getState().resetAll();
  }, []);

  useEffect(() => {
    const { setReading, setFailed, markFilled, clearFilled, setCarrierHint, clearCarrierHint } =
      useCardAutofillStore.getState();

    const slotResults: Record<ExtractableCardDocumentFileType, UseCardExtractionResult<any>> = {
      [PHOTO_ID_FRONT_ID]: photoIdFront,
      [INSURANCE_CARD_FRONT_ID]: insuranceFront,
      [INSURANCE_CARD_BACK_ID]: insuranceBack,
      [INSURANCE_CARD_FRONT_2_ID]: insuranceFront2,
      [INSURANCE_CARD_BACK_2_ID]: insuranceBack2,
    };

    // slot-level progress UI
    EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES.forEach((slot) => {
      const trigger = slotTriggers[slot];
      const result = slotResults[slot];
      setReading(slot, Boolean(trigger) && result.isPolling);
      setFailed(slot, Boolean(trigger) && (result.status === 'not-a-card' || result.status === 'unreadable'));
    });

    // assemble the fill plan
    const plans: { slot: ExtractableCardDocumentFileType; trigger: string; fill: CardFill }[] = [];
    const pushFills = (slot: ExtractableCardDocumentFileType, trigger: string, fills: CardFill[]): void => {
      fills.forEach((fill) => plans.push({ slot, trigger, fill }));
    };

    const photoIdTrigger = slotTriggers[PHOTO_ID_FRONT_ID];
    if (photoIdTrigger && photoIdFront.fields) {
      pushFills(PHOTO_ID_FRONT_ID, photoIdTrigger, buildPhotoIdFills(photoIdFront.fields));
    }

    const applyInsuranceOrdinal = (
      ordinal: 'primary' | 'secondary',
      frontSlot: ExtractableCardDocumentFileType,
      backSlot: ExtractableCardDocumentFileType,
      front: UseCardExtractionResult<any>,
      back: UseCardExtractionResult<any>
    ): void => {
      const frontTrigger = slotTriggers[frontSlot];
      const backTrigger = slotTriggers[backSlot];
      if (!frontTrigger && !backTrigger) return;
      // front is primary: while its extraction is still in flight, don't let the back fill
      // anything the front may be about to supply
      if (frontTrigger && front.isPolling) return;
      const merged = mergeInsuranceFields(
        front.fields as InsuranceCardExtractionFields | null,
        back.fields as InsuranceCardExtractionFields | null
      );
      if (!merged) return;
      const { fills, carrierHint } = buildInsuranceFills(merged, payerOptions, ordinal);
      const uiSlot = frontTrigger ? frontSlot : backSlot;
      pushFills(uiSlot, frontTrigger ?? backTrigger ?? '', fills);
      if (carrierHint) {
        const carrierEntry = fieldIndex[carrierHint.linkId];
        const carrierUserEdited = carrierEntry && isFieldUserEdited(dirtyFields, touchedFields, carrierEntry.fieldId);
        if (!carrierUserEdited) {
          setCarrierHint(carrierHint.linkId, carrierHint.carrierName);
        }
      }
    };
    applyInsuranceOrdinal('primary', INSURANCE_CARD_FRONT_ID, INSURANCE_CARD_BACK_ID, insuranceFront, insuranceBack);
    applyInsuranceOrdinal(
      'secondary',
      INSURANCE_CARD_FRONT_2_ID,
      INSURANCE_CARD_BACK_2_ID,
      insuranceFront2,
      insuranceBack2
    );

    // apply fills
    plans.forEach(({ slot, trigger, fill }) => {
      const entry = fieldIndex[fill.linkId];
      if (!entry) return;
      const answerJson = JSON.stringify(fill.answer);
      const key = `${trigger}|${fill.linkId}|${answerJson}`;
      if (appliedFillsRef.current.has(key)) return;
      appliedFillsRef.current.add(key);
      // the clobber guard: a field the patient actively edited is never overwritten
      if (isFieldUserEdited(dirtyFields, touchedFields, entry.fieldId)) return;
      const current = getValues(entry.fieldId) as QuestionnaireResponseItem | undefined;
      if (JSON.stringify(current?.answer) === answerJson) return; // already holds this value
      setValue(entry.fieldId, { linkId: fill.linkId, answer: fill.answer }, { shouldValidate: true });
      engineValuesRef.current.set(fill.linkId, answerJson);
      markFilled(slot, fill.linkId);
    });

    // badge upkeep: editing an AI-filled field clears its badge
    engineValuesRef.current.forEach((setJson, targetLinkId) => {
      const entry = fieldIndex[targetLinkId];
      if (!entry) return;
      const current = getValues(entry.fieldId) as QuestionnaireResponseItem | undefined;
      if (JSON.stringify(current?.answer) !== setJson) {
        engineValuesRef.current.delete(targetLinkId);
        clearFilled(targetLinkId);
      }
    });

    // hint upkeep: once the patient works the carrier field themselves, retire the hint
    [INSURANCE_CARRIER_LINK_ID, INSURANCE_CARRIER_2_LINK_ID].forEach((linkId) => {
      const entry = fieldIndex[linkId];
      if (!entry) return;
      if (
        useCardAutofillStore.getState().carrierHint[linkId] !== undefined &&
        isFieldUserEdited(dirtyFields, touchedFields, entry.fieldId)
      ) {
        clearCarrierHint(linkId);
      }
    });
  }, [
    photoIdFront,
    insuranceFront,
    insuranceBack,
    insuranceFront2,
    insuranceBack2,
    slotTriggers,
    payerOptions,
    fieldIndex,
    dirtyFields,
    touchedFields,
    formValues,
    getValues,
    setValue,
  ]);
};
