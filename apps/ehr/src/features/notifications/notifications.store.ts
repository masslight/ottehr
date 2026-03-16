import { ProviderNotificationMethod } from 'utils';
import { create } from 'zustand';

interface ProviderNotificationsState {
  notificationMethod?: ProviderNotificationMethod;
  taskNotificationsEnabled?: boolean;
  telemedNotificationsEnabled?: boolean;
  phoneNumber?: string;
}

export const useProviderNotificationsStore = create<ProviderNotificationsState>()(() => ({}));
