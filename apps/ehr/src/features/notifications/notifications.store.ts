import { ProviderNotificationMethod } from 'utils';
import { create } from 'zustand';

interface ProviderNotificationsState {
  notificationMethod?: ProviderNotificationMethod;
  notificationsEnabled?: boolean;
}

export const useProviderNotificationsStore = create<ProviderNotificationsState>()(() => ({}));
