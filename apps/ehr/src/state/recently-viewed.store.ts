import { create } from 'zustand';

export interface RecentNote {
  path: string;
  patientName: string;
  dob?: string;
  visitDate?: string;
}

const MAX_RECENT_NOTES = 5;

interface RecentlyViewedState {
  recentNotes: RecentNote[];
  addRecentNote: (note: RecentNote) => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()((set) => ({
  recentNotes: [],
  addRecentNote: (note) =>
    set((state) => ({
      recentNotes: [note, ...state.recentNotes.filter((existing) => existing.path !== note.path)].slice(
        0,
        MAX_RECENT_NOTES
      ),
    })),
}));
