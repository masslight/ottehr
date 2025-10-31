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

export interface UseDynamsoftScannerResult {
  isInitialized: boolean;
  isScanning: boolean;
  scanners: ScannerDevice[];
  currentScanner: string | null;
  imageCount: number;
  error: string | null;
  initializeScanner: () => Promise<void>;
  setCurrentScanner: (scannerName: string) => void;
  acquireImage: (settings: ScanSettings) => Promise<void>;
  getImageAsBlob: (index: number) => Promise<Blob | null>;
  removeImage: (index: number) => void;
  removeAllImages: () => void;
  cleanup: () => void;
}

const DYNAMSOFT_LICENSE_KEY =
  't01908AUAADbnthnd0J1oixI9EUXbr/xidYpvp5oBrtnDQ8uCCHXnAOYCQwKa7CtLPbAR4eGRmN0gH7gV7hO2kzUlilmNslPyeXNyB6e0dwq1d6KDk6ucRH4Lx+O2zTYvTeAITBsg53M4AeTAsZYbMNt99M1wAVgDRAFEWwM04HEX5eGnbnmmVReautzBKe2deYK0caKDk6ucIUHcSGYNu12PBEH+ci4Aa4A8Avh/ZEWC0B1gDZACcPCGBu9+qdY4og=='; // Replace with your actual license key

export const useDynamsoftScanner = (containerId: string): UseDynamsoftScannerResult => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanners, setScanners] = useState<ScannerDevice[]>([]);
  const [currentScanner, setCurrentScannerState] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dwtObjectRef = useRef<any>(null);

  const initializeScanner = useCallback(async () => {
    try {
      setError(null);

      console.log('Initializing Dynamsoft scanner...');

      // Configure Dynamsoft
      Dynamsoft.DWT.ResourcesPath = '/dwt-resources';
      Dynamsoft.DWT.ProductKey = DYNAMSOFT_LICENSE_KEY;
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
    error,
    initializeScanner,
    setCurrentScanner,
    acquireImage,
    getImageAsBlob,
    removeImage,
    removeAllImages,
    cleanup,
  };
};
