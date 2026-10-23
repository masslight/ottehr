import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../../src/helpers/files.helper';

const FILE_NAME = 'docs-black_oliver-2026-10-16_14-30.zip';
const OBJECT_URL = 'blob:http://localhost/3f2a9c1e';

type ClickedAnchor = { download: string; href: string; wasInDocument: boolean };

describe('downloadBlob', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createObjectURL = vi.fn((_blob: Blob) => OBJECT_URL);
  const revokeObjectURL = vi.fn((_url: string) => undefined);
  let clickedAnchors: ClickedAnchor[];

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clickedAnchors = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push({ download: this.download, href: this.href, wasInDocument: document.body.contains(this) });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('starts a download of the blob under the exact file name', () => {
    const blob = new Blob(['zip bytes'], { type: 'application/zip' });

    downloadBlob(FILE_NAME, blob);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickedAnchors).toEqual([{ download: FILE_NAME, href: OBJECT_URL, wasInDocument: true }]);
    expect(document.body.querySelector('a')).toBeNull();
  });

  it('revokes the object URL once the click has been handled, not before', () => {
    downloadBlob(FILE_NAME, new Blob(['zip bytes']));

    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });

  it('still removes the anchor and revokes the object URL when the click fails', () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
      throw new Error('click failed');
    });

    expect(() => downloadBlob(FILE_NAME, new Blob(['zip bytes']))).toThrow('click failed');
    expect(document.body.querySelector('a')).toBeNull();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });
});
