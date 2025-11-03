import Dynamsoft from 'dwt';
import { WebTwain } from 'dwt/dist/types/WebTwain';
import { Device } from 'dwt/dist/types/WebTwain.Acquire';
import { Area } from 'dwt/dist/types/WebTwain.Viewer';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScannerDevice {
  displayName: string;
  deviceId?: string;
}

export interface ScanSettings {
  resolution: number;
  pixelType: number; // 0: B&W, 1: Gray, 2: Color
  showUI: boolean;
  useADF: boolean; // Auto Document Feeder
  useDuplex: boolean;
}

export interface SelectedZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseDynamsoftScannerResult {
  isInitialized: boolean;
  isScanning: boolean;
  isRefreshingScanners: boolean;
  scanners: ScannerDevice[];
  currentScanner: string | null;
  imageCount: number;
  selectedZone: SelectedZone | null;
  error: string | null;
  initializeScanner: () => Promise<void>;
  setCurrentScanner: (scannerName: string) => void;
  refreshScanners: (silent?: boolean) => Promise<void>;
  acquireImage: (settings: ScanSettings) => Promise<void>;
  getImageAsBlob: (index: number) => Promise<Blob | null>;
  getAllImagesAsPdf: () => Promise<Blob | null>;
  removeImage: (index: number) => void;
  removeAllImages: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  rotate180: () => void;
  flipVertical: () => void;
  mirror: () => void;
  crop: () => void;
  cleanup: () => void;
}

export const useDynamsoftScanner = (containerId: string): UseDynamsoftScannerResult => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshingScanners, setIsRefreshingScanners] = useState(false);
  const [scanners, setScanners] = useState<ScannerDevice[]>([]);
  const [currentScanner, setCurrentScannerState] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dwtObjectRef = useRef<WebTwain | null>(null);

  const initializeScanner = useCallback(async () => {
    try {
      setError(null);

      console.log('Initializing Dynamsoft scanner...');

      // Configure Dynamsoft
      Dynamsoft.DWT.ResourcesPath = '/dwt-resources';
      Dynamsoft.DWT.ProductKey = import.meta.env.VITE_APP_DYNAMSOFT_LICENSE_KEY || '';
      Dynamsoft.DWT.UseLocalService = true;

      // Create DWT object
      const dwtObject = await new Promise<WebTwain>((resolve, reject) => {
        Dynamsoft.DWT.CreateDWTObjectEx(
          { WebTwainId: 'dwtObject' },
          (obj: WebTwain) => resolve(obj),
          (error: { code: number; message: string }) => reject(new Error(error.message))
        );
      });

      dwtObjectRef.current = dwtObject;
      console.log('DWT object created successfully');

      // Bind viewer to container
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container element with id "${containerId}" not found in DOM`);
      }

      console.log('Container found:', container, 'Width:', container.clientWidth);

      const bindResult = dwtObject.Viewer.bind(container);
      if (bindResult) {
        // Set viewer dimensions to match container - use actual pixel values for better rendering
        const containerWidth = container.clientWidth || 600;
        const containerHeight = container.clientHeight || 500;
        console.log('Binding viewer to container, width:', containerWidth, 'height:', containerHeight);
        dwtObject.Viewer.width = containerWidth;
        dwtObject.Viewer.height = containerHeight;
        dwtObject.Viewer.setViewMode(1, 1);
        dwtObject.Viewer.show();
        console.log('Viewer initialized and shown');
      } else {
        throw new Error('Failed to bind viewer to container - Viewer.bind() returned false');
      }

      // Register events
      dwtObject.RegisterEvent('OnBitmapChanged', () => {
        const count = dwtObject.HowManyImagesInBuffer;
        console.log('OnBitmapChanged: Image count =', count);
        setImageCount(count);
        // Ensure viewer shows the latest image
        if (count > 0) {
          dwtObject.CurrentImageIndexInBuffer = count - 1;
        }
      });

      dwtObject.RegisterEvent('OnPostTransfer', () => {
        const count = dwtObject.HowManyImagesInBuffer;
        console.log('OnPostTransfer: Image count =', count);
        setImageCount(count);
        // Refresh viewer after transfer
        if (count > 0) {
          dwtObject.CurrentImageIndexInBuffer = count - 1;
        }
      });

      dwtObject.RegisterEvent('OnPostLoad', () => {
        const count = dwtObject.HowManyImagesInBuffer;
        console.log('OnPostLoad: Image count =', count);
        setImageCount(count);
      });

      // Register zone selection events for cropping
      dwtObject.Viewer.on('pageAreaSelected', (imageIndex: number, rect: Area[]) => {
        console.log('Zone selected:', rect);
        if (rect.length > 0) {
          const currentRect = rect[rect.length - 1];
          setSelectedZone({
            x: currentRect.left,
            y: currentRect.top,
            width: currentRect.right - currentRect.left,
            height: currentRect.bottom - currentRect.top,
          });
        }
      });

      dwtObject.Viewer.on('pageAreaUnselected', () => {
        console.log('Zone unselected');
        setSelectedZone(null);
      });

      // Get available scanners
      const devices = await dwtObject.GetDevicesAsync();
      const scannerList: ScannerDevice[] = devices.map((device: Device) => ({
        displayName: device.displayName,
        deviceId: device.name,
      }));

      setScanners(scannerList);
      if (scannerList.length > 0) {
        setCurrentScannerState(scannerList[0].displayName);
      }

      setIsInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize scanner';
      setError(errorMessage);
      console.error('Scanner initialization error:', err);
    }
  }, [containerId]);

  const setCurrentScanner = useCallback((scannerName: string) => {
    setCurrentScannerState(scannerName);
  }, []);

  const refreshScanners = useCallback(async () => {
    if (!dwtObjectRef.current || !isInitialized) {
      console.log('Refresh skipped - not initialized');
      return;
    }

    try {
      console.log('Setting isRefreshingScanners to TRUE');
      setIsRefreshingScanners(true);
      console.log('Refreshing scanner list...');
      const dwtObject = dwtObjectRef.current;

      // Add a minimum display time for the spinner so users can see it
      const [devices] = await Promise.all([
        dwtObject.GetDevicesAsync(),
        new Promise((resolve) => setTimeout(resolve, 500)), // Minimum 500ms display
      ]);

      const scannerList: ScannerDevice[] = devices.map((device: Device) => ({
        displayName: device.displayName,
        deviceId: device.name,
      }));

      setScanners(scannerList);

      // If we found scanners and none is currently selected, select the first one
      if (scannerList.length > 0 && !currentScanner) {
        setCurrentScannerState(scannerList[0].displayName);
        console.log('Auto-selected scanner:', scannerList[0].displayName);
      }

      console.log('Scanner list refreshed:', scannerList.length, 'scanner(s) found');
    } catch (err) {
      console.error('Error refreshing scanners:', err);
    } finally {
      console.log('Setting isRefreshingScanners to FALSE');
      setIsRefreshingScanners(false);
    }
  }, [isInitialized, currentScanner]);

  const acquireImage = useCallback(
    async (settings: ScanSettings) => {
      if (!dwtObjectRef.current || !currentScanner) {
        setError('Scanner not initialized or no scanner selected');
        return;
      }

      try {
        setIsScanning(true);
        setError(null);

        console.log('Starting scan with settings:', settings);
        const dwtObject = dwtObjectRef.current;

        // Get available devices and select the current one
        const devices = await dwtObject.GetDevicesAsync();
        const selectedDevice = devices.find((device: Device) => device.displayName === currentScanner);

        if (!selectedDevice) {
          throw new Error('Selected scanner not found');
        }

        console.log('Selecting device:', selectedDevice.displayName);
        // Select the device
        await dwtObject.SelectDeviceAsync(selectedDevice);

        console.log('Acquiring image...');
        // Acquire image with settings
        await dwtObject.AcquireImageAsync({
          IfShowUI: settings.showUI,
          PixelType: settings.pixelType,
          Resolution: settings.resolution,
          IfFeederEnabled: settings.useADF,
          IfDuplexEnabled: settings.useDuplex,
          IfDisableSourceAfterAcquire: true,
        });

        await dwtObject.CloseSourceAsync();

        // Update image count and ensure viewer displays the latest image
        const count = dwtObject.HowManyImagesInBuffer;
        console.log('Scan complete. Total images:', count);
        setImageCount(count);
        if (count > 0) {
          dwtObject.CurrentImageIndexInBuffer = count - 1;
          console.log('Set current image to:', count - 1);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to acquire image';
        setError(errorMessage);
        console.error('Scan error:', err);
      } finally {
        setIsScanning(false);
      }
    },
    [currentScanner]
  );

  const getImageAsBlob = useCallback(async (index: number): Promise<Blob | null> => {
    if (!dwtObjectRef.current) return null;

    try {
      const dwtObject = dwtObjectRef.current;

      return new Promise((resolve, reject) => {
        dwtObject.ConvertToBlob(
          [index],
          Dynamsoft.DWT.EnumDWT_ImageType.IT_PDF,
          (result: Blob) => resolve(result),
          (errorCode: number, errorString: string) => {
            console.error('Error converting image:', errorString);
            reject(new Error(errorString));
          }
        );
      });
    } catch (err) {
      console.error('Error getting image as blob:', err);
      return null;
    }
  }, []);

  const getAllImagesAsPdf = useCallback(async (): Promise<Blob | null> => {
    if (!dwtObjectRef.current) return null;

    try {
      const dwtObject = dwtObjectRef.current;
      const count = dwtObject.HowManyImagesInBuffer;

      if (count === 0) {
        console.log('No images to convert to PDF');
        return null;
      }

      // Create array of all image indices
      const indices = Array.from({ length: count }, (_, i) => i);
      console.log(`Converting ${count} images to a single PDF...`);

      return new Promise((resolve, reject) => {
        dwtObject.ConvertToBlob(
          indices,
          Dynamsoft.DWT.EnumDWT_ImageType.IT_PDF,
          (result: Blob) => {
            console.log('Successfully converted all images to PDF');
            resolve(result);
          },
          (errorCode: number, errorString: string) => {
            console.error('Error converting images to PDF:', errorString);
            reject(new Error(errorString));
          }
        );
      });
    } catch (err) {
      console.error('Error getting all images as PDF:', err);
      return null;
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    if (dwtObjectRef.current) {
      dwtObjectRef.current.RemoveImage(index);
      setImageCount(dwtObjectRef.current.HowManyImagesInBuffer);
    }
  }, []);

  const removeAllImages = useCallback(() => {
    if (dwtObjectRef.current) {
      dwtObjectRef.current.RemoveAllImages();
      setImageCount(0);
    }
  }, []);

  // Image editing functions
  const rotateLeft = useCallback(() => {
    if (!dwtObjectRef.current || imageCount === 0) return;
    const currentIndex = dwtObjectRef.current.CurrentImageIndexInBuffer;
    dwtObjectRef.current.RotateLeft(currentIndex);
  }, [imageCount]);

  const rotateRight = useCallback(() => {
    if (!dwtObjectRef.current || imageCount === 0) return;
    const currentIndex = dwtObjectRef.current.CurrentImageIndexInBuffer;
    dwtObjectRef.current.RotateRight(currentIndex);
  }, [imageCount]);

  const rotate180 = useCallback(() => {
    if (!dwtObjectRef.current || imageCount === 0) return;
    const currentIndex = dwtObjectRef.current.CurrentImageIndexInBuffer;
    dwtObjectRef.current.Rotate(currentIndex, 180, true);
  }, [imageCount]);

  const flipVertical = useCallback(() => {
    if (!dwtObjectRef.current || imageCount === 0) return;
    const currentIndex = dwtObjectRef.current.CurrentImageIndexInBuffer;
    dwtObjectRef.current.Flip(currentIndex);
  }, [imageCount]);

  const mirror = useCallback(() => {
    if (!dwtObjectRef.current || imageCount === 0) return;
    const currentIndex = dwtObjectRef.current.CurrentImageIndexInBuffer;
    dwtObjectRef.current.Mirror(currentIndex);
  }, [imageCount]);

  const crop = useCallback(() => {
    if (!dwtObjectRef.current || imageCount === 0) {
      console.log('Cannot crop: no DWT object or no images');
      return;
    }
    if (!selectedZone) {
      console.log('Cannot crop: no zone selected');
      return;
    }
    const currentIndex = dwtObjectRef.current.CurrentImageIndexInBuffer;
    console.log('Cropping image at index', currentIndex, 'with zone:', selectedZone);
    dwtObjectRef.current.Crop(
      currentIndex,
      selectedZone.x,
      selectedZone.y,
      selectedZone.x + selectedZone.width,
      selectedZone.y + selectedZone.height
    );
    // Clear selection after crop
    setSelectedZone(null);
  }, [imageCount, selectedZone]);

  const cleanup = useCallback(() => {
    if (dwtObjectRef.current) {
      try {
        dwtObjectRef.current.RemoveAllImages();
        dwtObjectRef.current.Viewer.unbind();
      } catch (err) {
        console.error('Cleanup error:', err);
      }
      dwtObjectRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isInitialized,
    isScanning,
    isRefreshingScanners,
    scanners,
    currentScanner,
    imageCount,
    selectedZone,
    error,
    initializeScanner,
    setCurrentScanner,
    refreshScanners,
    acquireImage,
    getImageAsBlob,
    getAllImagesAsPdf,
    removeImage,
    removeAllImages,
    rotateLeft,
    rotateRight,
    rotate180,
    flipVertical,
    mirror,
    crop,
    cleanup,
  };
};
