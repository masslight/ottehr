import { ProviderNotificationMethod } from 'utils';
import { create } from 'zustand';

interface ProviderNotificationsState {
  notificationMethod?: ProviderNotificationMethod;
  taskNotificationsEnabled?: boolean;
  telemedNotificationsEnabled?: boolean;
}

export const useProviderNotificationsStore = create<ProviderNotificationsState>()(() => ({}));
