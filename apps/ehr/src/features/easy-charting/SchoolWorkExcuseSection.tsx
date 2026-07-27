// School/Work excuse documents in the easy-chart note. Mirrors the "School / Work Excuse"
// sub-section of Review & Sign's PatientInstructionsContainer: each generated excuse renders as a
// presigned download link, resolved via the same useExcusePresignedFiles hook. Rendered next to
// Patient Instructions to match Review & Sign's Plan ordering.
import { Link, Stack, Typography } from '@mui/material';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { SchoolWorkNoteExcuseDocFileDTO } from 'utils';
import { Section } from './note-ui';

export function SchoolWorkExcuseSection({
  schoolWorkNotes,
}: {
  schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[];
}): JSX.Element {
  const presigned = useExcusePresignedFiles(schoolWorkNotes);
  // Presigning is async — show the file names immediately, attaching links once the URLs resolve.
  const items: (SchoolWorkNoteExcuseDocFileDTO & { presignedUrl?: string })[] =
    presigned.length > 0 ? presigned : schoolWorkNotes;
  return (
    <Section title="School / Work Excuse">
      <Stack spacing={0.25}>
        {items.map((excuse) => (
          <Typography key={excuse.id} variant="body2">
            •{' '}
            {excuse.presignedUrl ? (
              <Link href={excuse.presignedUrl} target="_blank" rel="noopener noreferrer">
                {excuse.name}
              </Link>
            ) : (
              excuse.name
            )}
          </Typography>
        ))}
      </Stack>
    </Section>
  );
}
