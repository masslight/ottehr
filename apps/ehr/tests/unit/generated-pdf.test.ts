import { generateAndOpenPdf, reserveTab } from 'src/helpers/generatedPdf';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeTab = { location: { href: string }; close: ReturnType<typeof vi.fn>; closed: boolean };

const fakeTab = (): FakeTab => ({ location: { href: '' }, close: vi.fn(), closed: false });

describe('generateAndOpenPdf', () => {
  let opened: FakeTab[];

  beforeEach(() => {
    vi.useFakeTimers();
    opened = [];
    vi.stubGlobal('window', {
      open: vi.fn(() => {
        const tab = fakeTab();
        opened.push(tab);
        return tab;
      }),
      setInterval,
      clearInterval,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(['%PDF']) }))
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const render = vi.fn(async () => ({ presignedURL: 'https://example.test/form.pdf' }));

  it('reserves a blank tab', () => {
    reserveTab();
    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  it('points a reserved tab at the PDF as a file typed application/pdf', async () => {
    const tab = fakeTab();
    await generateAndOpenPdf(render, tab as unknown as Window);

    expect(tab.location.href).toBe('blob:pdf');
    expect(window.open).not.toHaveBeenCalled();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/pdf');
  });

  it('opens a new tab when none was reserved', async () => {
    await generateAndOpenPdf(render);

    expect(window.open).toHaveBeenCalledWith('blob:pdf', '_blank');
  });

  it('opens the URL itself rather than an error page when the file cannot be fetched', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    const tab = fakeTab();

    await generateAndOpenPdf(render, tab as unknown as Window);

    expect(tab.location.href).toBe('https://example.test/form.pdf');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('closes the reserved tab and rethrows when the PDF cannot be generated', async () => {
    const tab = fakeTab();
    const failing = vi.fn(async () => {
      throw new Error('render failed');
    });

    await expect(generateAndOpenPdf(failing, tab as unknown as Window)).rejects.toThrow('render failed');
    expect(tab.close).toHaveBeenCalled();
  });

  it('releases the file only once its tab is closed', async () => {
    const tab = fakeTab();
    await generateAndOpenPdf(render, tab as unknown as Window);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    tab.closed = true;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
  });

  it('releases the file at once when the browser refused the tab', async () => {
    vi.mocked(window.open).mockReturnValue(null);

    await generateAndOpenPdf(render);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
  });
});
