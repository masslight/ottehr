import { ActionLogChannel } from 'utils';

export const ACTION_LOG_CHANNEL_COPY: Record<
  ActionLogChannel,
  { title: string; label: string; plural: string; addressLabel: string }
> = {
  fax: { title: 'Fax', label: 'fax', plural: 'faxes', addressLabel: 'Fax Number' },
  email: { title: 'Email', label: 'email', plural: 'emails', addressLabel: 'Email Address' },
};
