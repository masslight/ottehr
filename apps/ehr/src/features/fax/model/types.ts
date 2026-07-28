import { FaxDocumentKind } from 'utils';

export type FaxDocumentSelectionMode = 'all' | 'selected';

// prescriptions and patient instructions are sections of the visit/progress note
export interface FaxDocumentRow {
  id: string;
  label: string;
  kind?: FaxDocumentKind;
  checked: boolean;
  disabled: boolean;
  /** Tooltip explaining why the row is disabled. */
  hint?: string;
  /** Rendered indented underneath its parent row. */
  nested?: boolean;
}

export interface FaxRecipientFormValue {
  name: string;
  organization: string;
  faxNumber: string;
  phoneNumber: string;
  saveAsPcp: boolean;
}

export interface FaxFormValues {
  mode: FaxDocumentSelectionMode;
  /** Explicit checkbox state, keyed by document kind. Only meaningful in `selected` mode. */
  selectedKinds: FaxDocumentKind[];
  recipients: FaxRecipientFormValue[];
}
