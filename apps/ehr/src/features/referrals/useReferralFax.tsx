import { FC, useState } from 'react';
import { useSendDocuments, UseSendDocumentsResult } from 'src/features/send-documents/hooks/useSendDocuments';
import { SendDocumentsDialog } from 'src/features/send-documents/ui/SendDocumentsDialog';

export const useReferralFax = (): { controller: UseSendDocumentsResult; sendFax: (referralId: string) => void } => {
  const [referralId, setReferralId] = useState<string>();
  const controller = useSendDocuments(referralId ? { type: 'referral', referralId } : undefined);
  const sendFax = (id: string): void => {
    setReferralId(id);
    controller.open();
  };
  return { controller, sendFax };
};

export const ReferralFaxDialog: FC<{ controller: UseSendDocumentsResult }> = ({ controller }) => (
  <SendDocumentsDialog controller={controller} title="Send referral" />
);
