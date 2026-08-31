import { Box, CircularProgress, Typography } from '@mui/material';
import { ReactElement, useEffect, useRef, useState } from 'react';
import * as UTIF from 'utif';

interface TiffPage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

function TiffPageCanvas({ width, height, rgba }: TiffPage): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Size the canvas to match the image so pixels map 1-to-1.
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Wrap the raw RGBA bytes in an ImageData object and paint it onto the canvas.
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
  }, [width, height, rgba]);

  // Canvas is required because utif decodes TIFFs into raw RGBA pixel data (a Uint8Array),
  // and <canvas> is the only DOM element that accepts raw pixel data via ctx.putImageData().
  // Chrome has no native TIFF support
  return <canvas ref={canvasRef} style={{ maxWidth: '100%', display: 'block' }} />;
}

export default function TiffViewer({ url }: { url: string }): ReactElement {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [pages, setPages] = useState<TiffPage[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setErrorMsg('');
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        // Parse the TIFF binary into an array of Image File Directories (IFDs).
        // Each IFD is one page/image in the file plus its metadata tags (dimensions, color depth, etc.).
        const IFDs = UTIF.decode(buffer);
        if (IFDs.length === 0) throw new Error('No images found in TIFF');

        // Decompress each page's pixel data and convert to RGBA8.
        // UTIF.decodeImage populates ifd.width, .height, and .data in-place.
        // UTIF.toRGBA8 normalizes whatever color format the TIFF uses (grayscale, CMYK, etc.)
        // into a flat [r, g, b, a, r, g, b, a, ...] Uint8Array ready for canvas.
        const decoded = IFDs.map((ifd) => {
          UTIF.decodeImage(buffer, ifd);
          return { width: ifd.width, height: ifd.height, rgba: UTIF.toRGBA8(ifd) };
        });

        setPages(decoded);
        setState('ready');
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setErrorMsg(err.message ?? 'Failed to load TIFF');
        setState('error');
      });
    return () => controller.abort();
  }, [url]);

  return (
    <>
      {state === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {state === 'error' && <Typography color="error">{errorMsg}</Typography>}
      {state === 'ready' &&
        pages.map((page, i) => (
          <Box key={i} sx={i > 0 ? { mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 } : undefined}>
            {pages.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Page {i + 1} of {pages.length}
              </Typography>
            )}
            <TiffPageCanvas {...page} />
          </Box>
        ))}
    </>
  );
}
