// Public API of the fax slice. Everything else under features/fax is internal — import from here only.
export { SendFaxDialog } from './ui/SendFaxDialog';
export { useSendFax } from './hooks/useSendFax';
export type { UseSendFaxResult } from './hooks/useSendFax';
export type { FaxVisitOption } from './model/types';
