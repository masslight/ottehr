import Dymo from 'dymojs';
import { enqueueSnackbar, VariantType } from 'notistack';
import { useState } from 'react';
import { PrintingConfig, PrintMode } from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';

interface UsePrintLabelOutput {
  printLabelByConfig: (input: {
    printingConfig: PrintingConfig;
    pdfPresignedUrl: string;
    labelXmlString: string;
  }) => Promise<void>;
}

// labs future TODO: have customer specific variables set and passed e.g. in case they're using non-dymo

const dymo = new Dymo();

/**
 * For use printing labels on a Dymo LabelWriter printer. Supports manual printing through the browser as well as integrated printing
 * directly to the printer. Integrated printing falls back to manual printing if there is an error
 * @param
 * @returns
 */
export const usePrintLabel = (): UsePrintLabelOutput => {
  // tracking the mode so we can give good UX if integrated printing ever fails. Can short circuit to manual easily
  const [fallbackOverrideMode, setFallbackOverrideMode] = useState<PrintMode | null>(null);

  const _openLabelPdf = async (url: string): Promise<void> => {
    // fetch the presigned url so we can handle the case where it expired and S3 sends back a gross xml error page
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch label PDF: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  };

  const _printIntegratedLabel = async (input: { pdfPresignedUrl: string; labelXmlString: string }): Promise<void> => {
    const { pdfPresignedUrl, labelXmlString } = input;
    const showSnackbarAndPrintManually = async (message: string, variant: VariantType): Promise<void> => {
      enqueueSnackbar(message, { variant: variant });

      // add a slight delay so users can actually see the snackbar before the pdf tab opens
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await _openLabelPdf(pdfPresignedUrl);
    };

    // ensure the dymo connect service is actually running. this throws if it isn't
    try {
      const dymoConnectIsRunning = await dymo.getStatus();
      console.log('dymoConnectIsRunning', dymoConnectIsRunning);
    } catch (error: unknown) {
      console.error(error);
      await showSnackbarAndPrintManually(
        'Dymo Connect must be running to print in integrated mode. Install, upgrade, or restart Dymo Connect and refresh the page, or print manually from the browser.',
        'warning'
      );
      setFallbackOverrideMode('manual');
      return;
    }

    let printerName = '';
    try {
      const availablePrinters = parseDymoPrintersXml(await dymo.getPrinters());
      console.log('All detected dymo printers', availablePrinters);
      const connectedPrinters = availablePrinters.filter((printer) => printer.isConnected);
      if (!connectedPrinters.length) {
        await showSnackbarAndPrintManually(
          'No connected available printers detected. Ensure your printer is connected and refresh the page, or print manually from the browser.',
          'warning'
        );
        setFallbackOverrideMode('manual');
        return;
      }
      printerName = connectedPrinters[0].name;
    } catch (error) {
      safelyCaptureException(error);

      await showSnackbarAndPrintManually(
        'Error detecting printer name. Please print manually from the browser.',
        'error'
      );
      setFallbackOverrideMode('manual');
      return;
    }

    console.log('Attempting to print to: ', printerName);

    // grab label xml and print
    try {
      await safePrint(printerName, labelXmlString);
    } catch (error: unknown) {
      console.error('Print error', error);
      safelyCaptureException(error);

      // gracefully fallback to manual printing
      await showSnackbarAndPrintManually(
        `Something went wrong printing to your ${printerName} printer. Please print manually in the browser`,
        'error'
      );
      setFallbackOverrideMode('manual');
    }
  };

  const printLabelByConfig = async (input: {
    printingConfig: PrintingConfig;
    pdfPresignedUrl: string;
    labelXmlString: string;
  }): Promise<void> => {
    const { printingConfig } = input;
    const { mode: configuredMode } = printingConfig;
    const effectiveMode = fallbackOverrideMode ?? configuredMode;

    let shouldOpenPdfInIntegratedMode = false;
    if (effectiveMode === 'integrated' && configuredMode === 'integrated')
      shouldOpenPdfInIntegratedMode = printingConfig.openPdfOnPrint;
    if (effectiveMode === 'integrated') {
      await _printIntegratedLabel(input);
      if (shouldOpenPdfInIntegratedMode) await _openLabelPdf(input.pdfPresignedUrl);
    } else {
      await _openLabelPdf(input.pdfPresignedUrl);
    }
  };

  return {
    printLabelByConfig,
  };
};

type DymoPrinter = {
  name: string;
  modelName: string;
  isConnected: boolean;
  isLocal: boolean;
  isTwinTurbo: boolean;
};

function parseDymoPrintersXml(xml: string): DymoPrinter[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.querySelectorAll('LabelWriterPrinter')).map((p) => ({
    name: p.querySelector('Name')?.textContent ?? '',
    modelName: p.querySelector('ModelName')?.textContent ?? '',
    isConnected: p.querySelector('IsConnected')?.textContent === 'True',
    isLocal: p.querySelector('IsLocal')?.textContent === 'True',
    isTwinTurbo: p.querySelector('IsTwinTurbo')?.textContent === 'True',
  }));
}

const safePrint = async (printerName: string, labelXml: string): Promise<void> => {
  const result = await dymo.print(printerName, labelXml.trim());
  console.log('Integrated print result', result);
  if (result.toLowerCase().includes('error')) {
    throw new Error(`DYMO print failed: ${result}`);
  }
};
