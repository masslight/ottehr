import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Cms1500FormData } from 'utils/lib/types/data/billing/cms1500.types';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { Cms1500Dialog } from '../../src/components/claim/Cms1500Dialog';

const { getBillingClaimCms1500Mock, renderCms1500PdfMock, fillCms1500TemplateMock, oystehrZambdaStub } = vi.hoisted(
  () => ({
    getBillingClaimCms1500Mock: vi.fn(),
    renderCms1500PdfMock: vi.fn(),
    fillCms1500TemplateMock: vi.fn(),
    oystehrZambdaStub: {},
  })
);

vi.mock('../../src/api/api', () => ({
  getBillingClaimCms1500: getBillingClaimCms1500Mock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

vi.mock('utils/lib/helpers/rcm/cms1500/render', () => ({
  renderCms1500Pdf: renderCms1500PdfMock,
}));

vi.mock('utils/lib/helpers/rcm/cms1500/template', () => ({
  fillCms1500Template: fillCms1500TemplateMock,
}));

const CLAIM_ID = '9f0c0a7e-4c1a-4f7e-9d7a-1b2c3d4e5f60';
const form: Cms1500FormData = {
  insuredId: 'W123456789',
  patientName: { last: 'Doe', first: 'Jane' },
  serviceLines: [{ procedureCode: '99213', charges: 150 }],
};
const blankForm = new ArrayBuffer(8);

const renderDialog = (): void => {
  render(<Cms1500Dialog open onClose={() => {}} claimId={CLAIM_ID} />);
};

describe('Cms1500Dialog', () => {
  let urlCount = 0;
  let fetchMock: MockInstance<typeof fetch>;

  beforeEach(() => {
    urlCount = 0;
    localStorage.clear();
    getBillingClaimCms1500Mock.mockReset().mockResolvedValue(form);
    renderCms1500PdfMock.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    fillCms1500TemplateMock.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(blankForm));
    URL.createObjectURL = vi.fn(() => `blob:cms1500-${++urlCount}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the claim and previews it filled in on the fillable form', async () => {
    renderDialog();

    const preview = await screen.findByTitle('CMS-1500 preview');
    expect(preview).toHaveAttribute('src', 'blob:cms1500-1');
    expect(getBillingClaimCms1500Mock).toHaveBeenCalledWith(oystehrZambdaStub, { claimId: CLAIM_ID });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('cms1500-template.pdf'));
    expect(fillCms1500TemplateMock).toHaveBeenCalledWith(blankForm, [form]);
    expect(renderCms1500PdfMock).not.toHaveBeenCalled();
    expect(screen.getByText(/every box is an editable field/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
      'download',
      `claim-${CLAIM_ID}-cms1500.pdf`
    );
  });

  it('prints only the data, shifted for the printer, for pre-printed forms', async () => {
    renderDialog();
    await screen.findByTitle('CMS-1500 preview');

    fireEvent.click(screen.getByRole('button', { name: /data only/i }));
    await waitFor(() => expect(renderCms1500PdfMock).toHaveBeenLastCalledWith([form], { offset: { x: 0, y: 0 } }));

    fireEvent.change(screen.getByLabelText(/shift right/i), { target: { value: '0.1' } });
    fireEvent.change(screen.getByLabelText(/shift down/i), { target: { value: '-0.05' } });
    await waitFor(() => expect(renderCms1500PdfMock).toHaveBeenLastCalledWith([form], { offset: { x: 7.2, y: -3.6 } }));
    expect(JSON.parse(localStorage.getItem('billing.cms1500.dataOnlyOffset') ?? '{}')).toEqual({
      right: 0.1,
      down: -0.05,
    });
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
      'download',
      `claim-${CLAIM_ID}-cms1500-data-only.pdf`
    );
    // Replaced previews are released.
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cms1500-1'));
  });

  it('releases the preview when the dialog closes, though it stays mounted', async () => {
    const { rerender } = render(<Cms1500Dialog open onClose={() => {}} claimId={CLAIM_ID} />);
    await screen.findByTitle('CMS-1500 preview');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    rerender(<Cms1500Dialog open={false} onClose={() => {}} claimId={CLAIM_ID} />);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cms1500-1'));
  });

  it('limits the shift to an inch and tidies the typed value on leaving the field', async () => {
    renderDialog();
    await screen.findByTitle('CMS-1500 preview');
    fireEvent.click(screen.getByRole('button', { name: /data only/i }));

    const shiftRight = screen.getByLabelText(/shift right/i);
    fireEvent.change(shiftRight, { target: { value: '5' } });
    await waitFor(() => expect(renderCms1500PdfMock).toHaveBeenLastCalledWith([form], { offset: { x: 72, y: 0 } }));
    expect(shiftRight).toHaveValue(5);
    fireEvent.blur(shiftRight);
    expect(shiftRight).toHaveValue(1);
  });

  it('shows why the form could not be loaded', async () => {
    getBillingClaimCms1500Mock.mockRejectedValue(new Error('The CMS-1500 form is only for professional claims.'));
    renderDialog();

    expect(await screen.findByText(/only for professional claims/i)).toBeInTheDocument();
    expect(fillCms1500TemplateMock).not.toHaveBeenCalled();
  });

  it('says so when the blank form could not be downloaded', async () => {
    fetchMock.mockResolvedValue(new Response('Not found', { status: 404 }));
    renderDialog();

    expect(await screen.findByText(/failed to download the cms-1500 form \(404\)/i)).toBeInTheDocument();
    expect(fillCms1500TemplateMock).not.toHaveBeenCalled();
  });

  it('only ever previews the chosen print, and clears the error once it renders', async () => {
    fetchMock.mockResolvedValue(new Response('Not found', { status: 404 }));
    renderDialog();
    await screen.findByText(/failed to download the cms-1500 form/i);

    fireEvent.click(screen.getByRole('button', { name: /data only/i }));
    expect(await screen.findByTitle('CMS-1500 preview')).toHaveAttribute('src', 'blob:cms1500-1');
    expect(screen.queryByText(/failed to download/i)).not.toBeInTheDocument();

    // The form still can't be downloaded, so the data-only preview goes rather than stand in for it.
    fireEvent.click(screen.getByRole('button', { name: /form with claim data/i }));
    await screen.findByText(/failed to download the cms-1500 form/i);
    expect(screen.queryByTitle('CMS-1500 preview')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cms1500-1');
  });
});
