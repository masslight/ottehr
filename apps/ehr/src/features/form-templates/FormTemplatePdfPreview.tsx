import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, CircularProgress, IconButton, Stack, Typography, useTheme } from '@mui/material';
import * as pdfjs from 'pdfjs-dist';
// Vite resolves `?url` to an emitted asset path, which is what pdf.js wants for its worker.
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormFieldInfo } from 'utils/lib/types/api/form-template.types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  /** Short-lived download URL for the template PDF. */
  fileUrl: string;
  fields: FormFieldInfo[];
  /** Field whose rectangle should be called out, by `FormFieldInfo.name`. */
  selectedFieldName?: string;
  /** Names of fields that already have a binding, drawn less prominently. */
  mappedFieldNames: ReadonlySet<string>;
  /** 1-based. Controlled by the parent so the field list can show only this page's fields. */
  pageNumber: number;
  onPageChange: (pageNumber: number) => void;
  /** Re-fetches the template, and with it a fresh download URL, after the current one expires. */
  onRetry?: () => void;
}

interface Highlight {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Renders one page of the template with every field's rectangle drawn over it.
 *
 * This exists because a field's label cannot identify it. Real forms repeat labels — one prior-auth form
 * carries two of "First Name:", "Address:", "City:" and "State:", one set for the patient and one for the
 * prescriber, distinguished only by an arbitrary suffix. Seeing where a field sits on the page is the only
 * reliable way to tell them apart, and binding the wrong one produces a form that looks correct and is not.
 */
export const FormTemplatePdfPreview: FC<Props> = ({
  fileUrl,
  fields,
  selectedFieldName,
  mappedFieldNames,
  pageNumber,
  onPageChange,
  onRetry,
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(element);
    setContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded: pdfjs.PDFDocumentProxy | undefined;
    const controller = new AbortController();
    setError(null);

    void (async () => {
      try {
        // Download once and hand pdf.js the bytes rather than the URL. Given a URL it issues lazy HTTP
        // range requests as pages are visited, so it keeps reaching for a link that is only signed for
        // fifteen minutes — leaving the page open and then turning to page two fails with a 403. Holding
        // the buffer means the signature only has to be valid for this one request.
        const response = await fetch(fileUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;

        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        loaded = doc;
        setPdfDocument(doc);
        setPageCount(doc.numPages);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setError(
          err instanceof Error && err.message.startsWith('403')
            ? 'The link to this PDF has expired.'
            : 'The PDF could not be loaded.'
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      setPdfDocument(null);
      void loaded?.destroy();
    };
  }, [fileUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDocument || !canvas || containerWidth === 0) return;

    let renderTask: pdfjs.RenderTask | undefined;
    let cancelled = false;
    setIsRendering(true);

    void (async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        // Fit the page to the pane, then draw at device resolution so text stays legible.
        const unscaled = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaled.width;
        const viewport = page.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext('2d');
        if (!context) return;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (cancelled) return;

        // Let pdf.js do the coordinate conversion: it accounts for the page's own rotation and origin,
        // which hand-rolled arithmetic against the MediaBox would get wrong on a rotated page.
        setHighlights(
          fields
            .filter((field) => field.position?.page === pageNumber - 1)
            .map((field) => {
              const { x, y, width, height } = field.position!;
              const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([x, y, x + width, y + height]);
              return {
                name: field.name,
                left: Math.min(x1, x2),
                top: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
              };
            })
        );
        setIsRendering(false);
      } catch (err) {
        // A cancelled render is the expected outcome of changing page mid-draw, not a failure.
        if (!cancelled && !(err instanceof Error && err.name === 'RenderingCancelledException')) {
          setError(err instanceof Error ? err.message : 'The page could not be rendered.');
          setIsRendering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDocument, pageNumber, containerWidth, fields]);

  if (error) {
    return (
      <Stack spacing={1} alignItems="flex-start" sx={{ p: 2 }}>
        <Typography color="error" variant="body2">
          {error}
        </Typography>
        {onRetry && (
          <Button size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
            Reload
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      {pageCount > 1 && (
        <Stack direction="row" alignItems="center" justifyContent="center" gap={1}>
          <IconButton size="small" disabled={pageNumber <= 1} onClick={() => onPageChange(pageNumber - 1)}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            Page {pageNumber} of {pageCount}
          </Typography>
          <IconButton size="small" disabled={pageNumber >= pageCount} onClick={() => onPageChange(pageNumber + 1)}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
        {isRendering && <CircularProgress size={20} sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }} />}
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />

        {highlights.map((highlight) => {
          const isSelected = highlight.name === selectedFieldName;
          const isMapped = mappedFieldNames.has(highlight.name);
          return (
            <Box
              key={highlight.name}
              sx={{
                position: 'absolute',
                left: highlight.left,
                top: highlight.top,
                width: highlight.width,
                height: highlight.height,
                pointerEvents: 'none',
                borderRadius: '2px',
                transition: 'background-color 120ms, box-shadow 120ms',
                ...(isSelected
                  ? {
                      backgroundColor: 'rgba(255, 167, 38, 0.45)',
                      boxShadow: `0 0 0 2px ${theme.palette.warning.main}`,
                      zIndex: 1,
                    }
                  : isMapped
                  ? { backgroundColor: 'rgba(25, 118, 210, 0.18)' }
                  : { backgroundColor: 'rgba(120, 144, 156, 0.12)' }),
              }}
            />
          );
        })}
      </Box>
    </Stack>
  );
};
