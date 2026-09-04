import { create } from 'zustand';

export interface RecentNote {
  /** pathname + search of the note page at view time. Replayed verbatim on
   *  select so follow-up encounter views (?encounterId=...) deep-link exactly
   *  back; also the dedupe key, so a follow-up view and its parent visit are
   *  tracked as distinct notes. */
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
