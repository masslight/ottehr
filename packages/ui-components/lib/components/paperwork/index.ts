export { default as PagedQuestionnaire } from './PagedQuestionnaire';
export type { RenderItemsProps } from './PagedQuestionnaire';

// Form-state hooks reused by intake's specialized inputs (which stay in intake but read the
// shared paperwork form/context state).
export { useFormValues, useQRState } from './hooks/useFormHelpers';
export type { QRState } from './hooks/useFormHelpers';

export { PaperworkProvider, usePaperworkContext } from './context';
export type { PaperworkContext, PaperworkProviderProps } from './context';

export { DEFAULT_PAPERWORK_OTHER_COLORS, PaperworkThemeProvider, usePaperworkOtherColors } from './theme';
export type { PaperworkOtherColors, PaperworkThemeProviderProps } from './theme';

export { PaperworkInjectionsProvider, usePaperworkInjections, useResolvedPreSubmit } from './injections';
export type {
  AttachmentType,
  PaperworkInjections,
  PaperworkInjectionsProviderProps,
  PreSubmitResult,
  RenderAttachmentProps,
  RenderCreditCardProps,
  RenderMedicalHistoryProps,
  RenderPharmacyProps,
  UseAnswerOptions,
  UsePreSubmit,
  UsePreSubmitValue,
} from './injections';
