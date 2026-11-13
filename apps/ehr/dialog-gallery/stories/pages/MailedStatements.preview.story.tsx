import MailedStatements from 'src/pages/reports/MailedStatements';
import { defineStory } from '../../harness/story';
import { zambdaOutput } from './_mocks';

const statementHtml = `<!doctype html><html><body style="font-family: Arial, sans-serif; margin: 48px; color: #111">
<table width="100%"><tr><td><h2 style="margin:0">Ottehr</h2><div>123 Main Street<br/>New York, NY 10001</div></td>
<td align="right"><h2 style="margin:0">Statement</h2><div>Statement date: 11/12/2026<br/>Account #: 104-882</div></td></tr></table>
<p style="margin-top:48px">Morgan Lee<br/>48 Orchard Lane<br/>Brooklyn, NY 11201</p>
<table width="100%" cellpadding="8" style="border-collapse:collapse;margin-top:32px">
<tr style="border-bottom:2px solid #111"><th align="left">Date of service</th><th align="left">Description</th><th align="right">Charges</th><th align="right">Insurance paid</th><th align="right">You owe</th></tr>
<tr style="border-bottom:1px solid #ccc"><td>10/02/2026</td><td>Office visit, established patient</td><td align="right">$180.00</td><td align="right">$135.00</td><td align="right">$45.00</td></tr>
<tr style="border-bottom:1px solid #ccc"><td>10/02/2026</td><td>Rapid strep test</td><td align="right">$32.00</td><td align="right">$22.00</td><td align="right">$10.00</td></tr>
<tr><td colspan="4" align="right"><b>Amount due</b></td><td align="right"><b>$55.00</b></td></tr></table>
<p style="margin-top:40px">Payment is due within 30 days of the statement date. Pay online or call (555) 010-0199.</p>
</body></html>`;

export default defineStory({
  title: 'Mailed statement preview',
  source: 'apps/ehr/src/pages/reports/MailedStatements.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Reports → Mailed Statements → "Preview" button in a statement row',
  route: '/reports/mailed-statements',
  mocks: [
    {
      url: 'mailed-statements-report',
      response: zambdaOutput({
        message: 'ok',
        lastSyncRunAt: new Date().toISOString(),
        statements: [
          {
            communicationId: 'comm-1',
            patientId: 'patient-1',
            patientName: 'Lee, Morgan',
            encounterId: 'enc-1',
            recipientName: 'Morgan Lee',
            sentDate: new Date().toISOString(),
            appointmentDate: '2026-10-02T14:00:00.000Z',
            appointmentId: 'appt-1',
            vendorLetterId: 'ltr_1f0c9a',
            vendorLetterStatus: 'in_transit',
            vendorSendDate: new Date().toISOString(),
            vendorLetterUrl: '',
            vendorMailingClass: 'first_class',
            vendorPageCount: 1,
            vendorEnvelopeType: 'standard_double_window',
            vendorStatusSyncedAt: new Date().toISOString(),
            description: 'Statement for visit on 10/02/2026',
            htmlContent: statementHtml,
          },
        ],
      }),
    },
  ],
  setup: () => {
    // No MUI X license key in the gallery: the grid behind the dialog paints a "Missing license key"
    // watermark at z-index 100000, i.e. on top of the dialog. It is not part of the product UI.
    const style = document.createElement('style');
    style.textContent = 'div[style*="z-index: 100000"][style*="letter-spacing"] { display: none !important; }';
    document.head.appendChild(style);
  },
  render: () => <MailedStatements />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: /Statement for visit/ }, { timeout: 10000 }));
    await screen.findByRole('dialog');
  },
  notes:
    'Statement HTML shown in the iframe is a short mocked document (real statements are generated server-side). The dialog content has minHeight 800, so it is taller than the 900px capture viewport and scrolls. The MUI X "Missing license key" watermark of the data grid behind the dialog is hidden by a story-level style (the gallery has no license key).',
});
