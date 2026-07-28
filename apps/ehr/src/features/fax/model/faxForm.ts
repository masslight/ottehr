import { GetFaxPacketPreviewOutput } from 'utils';
import { defaultSelectedKinds } from './faxDocuments';
import { initialRecipients } from './faxRecipients';
import { FaxFormValues } from './types';

/**
 * Initial form values derived from the packet preview: every available document ticked, and the first
 * recipient prefilled from the patient's PCP. Pure, so the form can seed itself via `useForm` default
 * values at mount — no syncing effect required.
 */
export const buildDefaultFormValues = (preview: GetFaxPacketPreviewOutput): FaxFormValues => ({
  mode: 'selected',
  selectedKinds: defaultSelectedKinds(preview.documents),
  recipients: initialRecipients(preview.pcp, preview.hasSavedPcp),
});
