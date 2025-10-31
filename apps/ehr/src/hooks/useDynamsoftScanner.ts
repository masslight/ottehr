import Dynamsoft from 'dwt';
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
  scanners: ScannerDevice[];
  currentScanner: string | null;
  imageCount: number;
  selectedZone: SelectedZone | null;
  error: string | null;
  initializeScanner: () => Promise<void>;
  setCurrentScanner: (scannerName: string) => void;
  acquireImage: (settings: ScanSettings) => Promise<void>;
  getImageAsBlob: (index: number) => Promise<Blob | null>;
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
  const [scanners, setScanners] = useState<ScannerDevice[]>([]);
  const [currentScanner, setCurrentScannerState] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dwtObjectRef = useRef<any>(null);

  const initializeScanner = useCallback(async () => {
    try {
      setError(null);

      console.log('Initializing Dynamsoft scanner...');

      // Configure Dynamsoft
      Dynamsoft.DWT.ResourcesPath = '/dwt-resources';
      Dynamsoft.DWT.ProductKey = import.meta.env.VITE_APP_DYNAMSOFT_LICENSE_KEY || '';
      Dynamsoft.DWT.UseLocalService = true;

      // Create DWT object
      const dwtObject = await new Promise<any>((resolve, reject) => {
        Dynamsoft.DWT.CreateDWTObjectEx(
          { WebTwainId: 'dwtObject' },
          (obj: any) => resolve(obj),
          (errorString: any) => reject(new Error(errorString))
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
        // Set viewer dimensions - use actual pixel values for better rendering
        const containerWidth = container.clientWidth || 600;
        console.log('Binding viewer to container, width:', containerWidth);
        dwtObject.Viewer.width = containerWidth;
        dwtObject.Viewer.height = 400;
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
      dwtObject.Viewer.on('pageAreaSelected', (imageIndex: number, rect: any[]) => {
        console.log('Zone selected:', rect);
        if (rect.length > 0) {
          const currentRect = rect[rect.length - 1];
          setSelectedZone({
            x: currentRect.x,
            y: currentRect.y,
            width: currentRect.width,
            height: currentRect.height,
          });
        }
      });

      dwtObject.Viewer.on('pageAreaUnselected', () => {
        console.log('Zone unselected');
        setSelectedZone(null);
      });

      // Get available scanners
      const devices = await dwtObject.GetDevicesAsync();
      const scannerList: ScannerDevice[] = devices.map((device: any) => ({
        displayName: device.displayName,
        deviceId: device.deviceId,
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
        const selectedDevice = devices.find((device: any) => device.displayName === currentScanner);

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
    scanners,
    currentScanner,
    imageCount,
    selectedZone,
    error,
    initializeScanner,
    setCurrentScanner,
    acquireImage,
    getImageAsBlob,
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
