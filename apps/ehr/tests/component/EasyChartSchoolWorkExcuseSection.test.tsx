import { render, screen } from '@testing-library/react';
import { SchoolWorkNoteExcuseDocFileDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it, vi } from 'vitest';
import { SchoolWorkExcuseSection } from '../../src/features/easy-charting/SchoolWorkExcuseSection';

// The section reuses Review & Sign's useExcusePresignedFiles hook, which needs an auth token and
// presigns each document URL — stub both so the test stays offline.
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: async () => 'test-token' }),
}));
// Mock the DECLARING module, not the 'utils' barrel: useExcusePresignedFiles imports getPresignedURL
// from this path directly, so a barrel-level mock no longer intercepts it and the test would make a
// real network call (the no-network setup fails it).
vi.mock('utils/lib/helpers/presigned-file-url/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/helpers/presigned-file-url/helpers')>()),
  getPresignedURL: async (url: string) => `${url}?presigned`,
}));

// The easy-chart note's School / Work Excuse block mirrors the sub-section of Review & Sign's
// PatientInstructionsContainer: each generated excuse becomes a presigned download link.
describe('SchoolWorkExcuseSection', () => {
  const notes: SchoolWorkNoteExcuseDocFileDTO[] = [
    { id: 'doc-1', name: 'School Excuse.pdf', url: 'https://example.com/school.pdf', type: 'school' },
    { id: 'doc-2', name: 'Work Excuse.pdf', url: 'https://example.com/work.pdf', type: 'work' },
  ];

  it('renders each excuse as a presigned download link', async () => {
    render(<SchoolWorkExcuseSection schoolWorkNotes={notes} />);
    expect(screen.getByText('School / Work Excuse')).toBeDefined();
    const school = await screen.findByRole('link', { name: 'School Excuse.pdf' });
    expect(school.getAttribute('href')).toBe('https://example.com/school.pdf?presigned');
    expect(school.getAttribute('target')).toBe('_blank');
    const work = await screen.findByRole('link', { name: 'Work Excuse.pdf' });
    expect(work.getAttribute('href')).toBe('https://example.com/work.pdf?presigned');
  });

  it('shows the file names as plain text while presigning is still in flight', () => {
    render(<SchoolWorkExcuseSection schoolWorkNotes={notes} />);
    // Synchronously (before the async hook resolves) the names render without links.
    expect(screen.getByText(/School Excuse\.pdf/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'School Excuse.pdf' })).toBeNull();
  });
});
