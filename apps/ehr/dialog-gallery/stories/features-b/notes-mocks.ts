import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import type { FetchMock } from '../../harness/story';

export const mockNotes: NoteDTO[] = [
  {
    resourceId: 'note-1',
    patientId: 'patient-1',
    text: 'Patient prefers afternoon appointments. Mother (Karen) is the primary contact and should be called first.',
    authorId: 'practitioner-1',
    authorName: 'Dr. Olivia Bennett',
    sent: '2026-11-02T15:12:00.000Z',
  },
  {
    resourceId: 'note-2',
    patientId: 'patient-1',
    text: 'Requested a copy of immunization records for school enrollment — sent via portal.',
    authorId: 'practitioner-2',
    authorName: 'Marcus Lee, RN',
    sent: '2026-10-18T19:40:00.000Z',
    edited: true,
    editorNames: ['Dr. Olivia Bennett'],
  },
  {
    resourceId: 'note-3',
    patientId: 'patient-1',
    text: 'Needs Spanish interpreter for in-person visits.',
    authorId: 'practitioner-3',
    authorName: 'Front Desk — Ana Ruiz',
    sent: '2026-09-05T14:03:00.000Z',
  },
];

export const notesMocks: FetchMock[] = [
  { url: 'get-patient-notes-count', response: { status: 200, output: { count: mockNotes.length } } },
  { url: 'get-patient-notes', response: { status: 200, output: { notes: mockNotes, hasMore: false } } },
];
