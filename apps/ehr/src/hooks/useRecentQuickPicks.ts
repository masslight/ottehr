import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateConfigurable } from 'utils/lib/utils/dateUtils';
import { CommandPaletteItem } from '../state/command-palette.store';
import { RecentNote, useRecentlyViewedStore } from '../state/recently-viewed.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';

const formatNoteLabel = (note: RecentNote): string => {
  const dob = formatDateConfigurable({ isoDate: note.dob });
  const visitDate = formatDateConfigurable({ isoDate: note.visitDate });
  return [note.patientName, dob ? `DOB ${dob}` : undefined, visitDate ? `DOV ${visitDate}` : undefined]
    .filter(Boolean)
    .join(' · ');
};

/**
 * Registers the most recently viewed progress notes as command-palette items
 * under a "Recent Notes" category. sortWeight both pins the category to the top
 * of the empty-query palette and carries the most-recent-first ordering (the
 * palette alphabetizes otherwise). Registers nothing when no notes have been
 * viewed yet.
 */
export function useRecentQuickPicks(): void {
  const navigate = useNavigate();
  const recentNotes = useRecentlyViewedStore((state) => state.recentNotes);

  const items = useMemo<CommandPaletteItem[]>(
    () =>
      recentNotes.map((note, index) => ({
        id: `recent-note-${note.path}`,
        label: formatNoteLabel(note),
        category: 'Recent Notes',
        keywords: [note.patientName],
        sortWeight: recentNotes.length - index,
        onSelect: () => navigate(note.path),
      })),
    [navigate, recentNotes]
  );

  useCommandPaletteSource('recent-notes', items);
}
