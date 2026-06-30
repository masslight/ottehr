import { Attachment, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { createContext, FC, PropsWithChildren, ReactElement, ReactNode, useContext } from 'react';
import { GetAnswerOptionsRequest } from 'utils';

/**
 * Injection contract for the app-specific specialized inputs.
 *
 * The shared `PagedQuestionnaire` renders the vanilla input types inline and DELEGATES the five
 * specialized field types to renderers supplied here by the host app. Intake binds these to its
 * existing components (which keep all their app-specific logic — Stripe, AI interview, Z3 upload,
 * pharmacy search, dynamic option loading, credit-card store/save). EHR previews supply none of
 * them (optionally a simple stub attachment renderer), so those field types render nothing.
 *
 * Each renderer's prop type matches exactly what the corresponding intake component consumes, so
 * intake's wrapper can pass its component through with no shim.
 */

export type AttachmentType = 'image' | 'pdf';

export interface RenderCreditCardProps {
  fieldId: string;
  onChange: (event: { target: { value: boolean } }) => void;
  required: boolean;
  value?: boolean;
}

export interface RenderMedicalHistoryProps {
  value?: boolean;
  onChange: (event: { target: { value: boolean } }) => void;
}

export interface RenderAttachmentProps {
  fileName: string;
  fieldName: string;
  attachmentType: AttachmentType;
  value: Attachment | undefined;
  description: string;
  onChange: (event: any) => void;
}

export interface RenderPharmacyProps {
  onChange: (e: any) => void;
}

/**
 * Dynamic answer-option loader. Mirrors intake's `useAnswerOptionsQuery` — the shared
 * FreeMultiSelectInput consumes only `data` from the result.
 */
export type UseAnswerOptions = (
  queryKey: string,
  enabled: boolean,
  params: GetAnswerOptionsRequest | undefined
) => { data: QuestionnaireItemAnswerOption[] | undefined };

export interface PreSubmitResult {
  shouldContinue: boolean;
}

/**
 * Pre-submit gate (intake's credit-card save). `preSubmit` runs before the form submits when the
 * page contains the gated field; `isSaving` feeds the submit button's loading state. The default
 * (no injection) is a no-op that always continues.
 */
export interface UsePreSubmitValue {
  isSaving: boolean;
  preSubmit: (options?: { skipValidation?: boolean }) => Promise<PreSubmitResult>;
}

export type UsePreSubmit = () => UsePreSubmitValue;

const DEFAULT_USE_PRE_SUBMIT: UsePreSubmit = () => ({
  isSaving: false,
  preSubmit: async () => ({ shouldContinue: true }),
});

export interface PaperworkInjections {
  renderCreditCard?: (props: RenderCreditCardProps) => ReactElement;
  renderMedicalHistory?: (props: RenderMedicalHistoryProps) => ReactElement;
  renderAttachment?: (props: RenderAttachmentProps) => ReactElement;
  renderPharmacy?: (props: RenderPharmacyProps) => ReactElement;
  useAnswerOptions?: UseAnswerOptions;
  usePreSubmit?: UsePreSubmit;
  // Rendered at the bottom of the form (intake's CardErrorDialog). Receives the submit handler so
  // it can re-trigger submit (e.g. "continue anyway").
  bottomSlot?: (onContinueAnyway: (options?: { skipValidation?: boolean }) => void) => ReactNode;
}

const PaperworkInjectionsContext = createContext<PaperworkInjections>({});

export interface PaperworkInjectionsProviderProps extends PropsWithChildren {
  value: PaperworkInjections;
}

export const PaperworkInjectionsProvider: FC<PaperworkInjectionsProviderProps> = ({ value, children }) => {
  return <PaperworkInjectionsContext.Provider value={value}>{children}</PaperworkInjectionsContext.Provider>;
};

export const usePaperworkInjections = (): PaperworkInjections => useContext(PaperworkInjectionsContext);

/**
 * Returns the injected pre-submit hook, or a no-op default. Hook (not a plain getter) because the
 * injected implementation is itself a hook and must run unconditionally on every render.
 */
export const useResolvedPreSubmit = (): UsePreSubmitValue => {
  const { usePreSubmit } = usePaperworkInjections();
  return (usePreSubmit ?? DEFAULT_USE_PRE_SUBMIT)();
};
