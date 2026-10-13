import { Box } from '@mui/material';
import { FC, ReactNode, useLayoutEffect, useRef } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

interface Props {
  children: ReactNode;
  containerQuery: string;
}

/** Keep long guidance reachable inside the chart's scroll area, including inline procedure views. */
export const ProcedureCodingColumn: FC<Props> = ({ children, containerQuery }) => {
  const column = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = column.current;
    if (!element) return;
    let scrollArea = element.parentElement;
    while (scrollArea && !/(auto|scroll)/.test(getComputedStyle(scrollArea).overflowY)) {
      scrollArea = scrollArea.parentElement;
    }
    const measure = (): void => {
      const bottom = Math.min(window.innerHeight, scrollArea?.getBoundingClientRect().bottom ?? window.innerHeight);
      const height = bottom - Math.max(0, element.getBoundingClientRect().top) - 16;
      const value = `${height}px`;
      if (height > 0 && element.style.getPropertyValue('--procedure-coding-max-height') !== value)
        element.style.setProperty('--procedure-coding-max-height', value);
    };
    let frame: number | undefined;
    const scheduleMeasure = (): void => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleMeasure);
    observer?.observe(element);
    if (scrollArea) observer?.observe(scrollArea);
    window.addEventListener('resize', scheduleMeasure);
    (scrollArea ?? window).addEventListener('scroll', scheduleMeasure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      (scrollArea ?? window).removeEventListener('scroll', scheduleMeasure);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Box
      ref={column}
      data-testid={dataTestIds.documentProcedurePage.codingColumn}
      sx={{
        [containerQuery]: {
          position: 'sticky',
          top: 16,
          maxHeight: 'var(--procedure-coding-max-height)',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
        },
      }}
    >
      {children}
    </Box>
  );
};
