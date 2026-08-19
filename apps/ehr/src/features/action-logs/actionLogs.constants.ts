import { ActionLogChannel } from 'utils/lib/types/api/action-logs.types';

export const ACTION_LOG_CHANNEL_COPY: Record<
  ActionLogChannel,
  {
    title: string;
    label: string;
    plural: string;
    /** The address as a noun in prose, e.g. the resend confirmation. */
    addressLabel: string;
    /** Column header for the address the attempt was sent to. */
    recipientAddressLabel: string;
    /** Column header for the address it was sent from; omitted for channels that record none. */
    senderAddressLabel?: string;
  }
> = {
  fax: {
    title: 'Fax',
    label: 'fax',
    plural: 'faxes',
    addressLabel: 'Fax Number',
    recipientAddressLabel: 'Recipient Fax',
    senderAddressLabel: 'Sender Fax',
  },
  email: {
    title: 'Email',
    label: 'email',
    plural: 'emails',
    addressLabel: 'Email Address',
    recipientAddressLabel: 'Email Address',
  },
};
