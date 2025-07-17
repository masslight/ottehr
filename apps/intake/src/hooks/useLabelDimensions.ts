import { RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';

export const useLabelDimensions = (
  labelRef: RefObject<HTMLLabelElement>
): { labelHeight?: number; lineHeight?: number } => {
  const [labelHeight, setLabelHeight] = useState<number | undefined>(undefined);
  const [lineHeight, setLineHeight] = useState<number | undefined>(undefined);

  const updateDimensions = useCallback((): void => {
    if (!labelRef.current) {
      return;
    }
    const lineHeightParsed = parseInt(window.getComputedStyle(labelRef.current).getPropertyValue('line-height'));
    setLineHeight(lineHeightParsed);
    setLabelHeight(labelRef.current.clientHeight);
  }, [labelRef]);

  useLayoutEffect(() => {
    updateDimensions();
  }, [updateDimensions]);

  useEffect(() => {
    if (!labelRef.current) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(labelRef.current);
    return () => resizeObserver.disconnect();
  }, [labelRef, updateDimensions]);

  return { labelHeight, lineHeight };
};
