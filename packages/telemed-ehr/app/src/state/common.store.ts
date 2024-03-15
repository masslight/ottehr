import { User } from '@zapehr/sdk';
import { create } from 'zustand';

interface CommonState {
  user?: User;
}

export const useCommonStore = create<CommonState>()(() => ({}));
