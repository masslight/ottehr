import LegacyDataPage from 'src/pages/LegacyDataPage';
import * as UTIF from 'utif';
import { defineStory } from '../../harness/story';
import { zambdaOutput } from './_mocks';

let tiffUrl = '';

/** Draws a plain placeholder "scanned page" and encodes it as a real TIFF for the viewer to decode. */
const buildSampleTiff = (): string => {
  const width = 850;
  const height = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('Progress Note', 70, 110);
  ctx.font = '18px sans-serif';
  ctx.fillText('Patient: Smith, Jane        DOB: 04-12-1985', 70, 160);
  ctx.fillText('Date of service: 03-08-2019', 70, 190);
  ctx.fillStyle = '#9a9a9a';
  for (let y = 250; y < 1000; y += 34) {
    ctx.fillRect(70, y, 480 + ((y * 37) % 230), 8);
  }
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const buffer = UTIF.encodeImage(new Uint8Array(rgba.buffer), width, height);
  return URL.createObjectURL(new Blob([buffer], { type: 'image/tiff' }));
};

export default defineStory({
  title: 'Legacy record TIFF viewer',
  source: 'apps/ehr/src/pages/LegacyDataPage.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Legacy Data → search → click a .tif/.tiff file name in a patient record',
  route: '/legacy-data',
  setup: () => {
    tiffUrl = buildSampleTiff();
  },
  mocks: [
    {
      url: 'ehr-search-legacy-records',
      response: () =>
        zambdaOutput({
          total: 1,
          page: 1,
          pageSize: 20,
          results: [
            {
              patientFolder: 'SMITH_JANE_19850412_10482',
              patientId: '10482',
              displayName: 'Smith, Jane (04-12-1985)',
              files: [
                {
                  key: 'SMITH_JANE_19850412_10482/ProgressNotes/progress_note_2019-03-08.tif',
                  fileName: 'progress_note_2019-03-08.tif',
                  fileType: 'progress-note',
                  presignedUrl: tiffUrl,
                },
                {
                  key: 'SMITH_JANE_19850412_10482/InsuranceCard/insurance_card.pdf',
                  fileName: 'insurance_card.pdf',
                  fileType: 'insurance-card',
                  presignedUrl: tiffUrl,
                },
              ],
            },
          ],
        }),
    },
  ],
  render: () => <LegacyDataPage />,
  play: async ({ user, screen, waitFor }) => {
    // Search by hand: the page's auto-search from a ?lastName= link fires before the API client exists here.
    await user.type(screen.getByLabelText(/Last Name/), 'Smith');
    await new Promise((r) => setTimeout(r, 300));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'progress_note_2019-03-08.tif' }, { timeout: 10000 }));
    await waitFor(
      () => {
        if (!document.querySelector('.MuiDialog-paper canvas')) throw new Error('TIFF not rendered yet');
      },
      { timeout: 15000 }
    );
  },
  notes:
    'The viewed document is a synthetic one-page TIFF generated in the story (blob: URL) and decoded by the real TiffViewer; real records are scanned pages of varying size, so dialog height will differ.',
});
