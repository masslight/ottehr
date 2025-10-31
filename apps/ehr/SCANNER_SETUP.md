# Scanner Integration with Dynamsoft Web TWAIN

This implementation integrates Dynamsoft Web TWAIN SDK for document scanning functionality in the EHR application.

## Setup Instructions

### 1. Install Dependencies

The `dwt` package has been added to `package.json`. Install it by running:

```bash
cd apps/ehr
npm install
```

### 2. Copy Dynamsoft Resources

You need to copy the Dynamsoft Web TWAIN resource files to your public directory:

1. After installation, the resources will be in `node_modules/dwt/dist`
2. Copy the contents to `public/dwt-resources/`:

```bash
mkdir -p public/dwt-resources
cp -r node_modules/dwt/dist/* public/dwt-resources/
```

### 3. Configure License Key

Update the license key in `src/hooks/useDynamsoftScanner.ts`:

```typescript
const DYNAMSOFT_LICENSE_KEY = 'YOUR_LICENSE_KEY_HERE';
```

To get a license key:

- Visit [Dynamsoft's Trial License Page](https://www.dynamsoft.com/customer/license/trialLicense?product=dwt)
- Apply for a 30-day free trial license
- Replace `'YOUR_LICENSE_KEY_HERE'` with your actual license key

## Features

### Scanner Modal Component

Located at `src/components/ScannerModal.tsx`, this component provides:

- **Scanner Selection**: Dropdown to select from available TWAIN scanners
- **Scan Settings**:
  - Color Mode: Black & White, Grayscale, or Color
  - Resolution: 100, 200, 300, or 600 DPI
  - Show Scanner UI: Display the scanner's native interface
  - Document Feeder (ADF): Enable automatic document feeder
  - Duplex: Scan both sides of documents

- **Image Preview**: Real-time display of scanned images
- **Image Count**: Shows number of scanned pages
- **Image Editing Tools**:
  - Rotate Left 90°, Right 90°, or 180°
  - Flip Vertical and Mirror (Flip Horizontal)
  - **Crop**: Click and drag on the image to select an area, then click the Crop button
  - Delete Current Image
- **Save Functionality**: Automatically saves scanned documents to the selected folder

### Custom Hook

`src/hooks/useDynamsoftScanner.ts` provides:

- Scanner initialization and cleanup
- Device detection and selection
- Image acquisition with custom settings
- Image buffer management
- Zone selection tracking for crop operations
- Image editing operations (rotate, flip, mirror, crop)
- Blob conversion for upload

## Usage

The scanner is integrated into the `PatientDocumentsExplorerPage`:

1. Select a folder where documents should be saved
2. Click the "Scan" button
3. Configure scan settings in the modal
4. Click "Scan" to acquire images from the scanner
5. Review scanned images in the preview area
6. **Edit images as needed**:
   - Use rotation buttons to adjust orientation
   - Click and drag on the image to select a crop area
   - Click the Crop button to crop to the selected area
   - Use flip/mirror for additional transformations
7. Click "Save" to upload all scanned documents to the selected folder

Multiple pages can be scanned before saving. Each page is saved as a separate PDF file with a timestamp.

## Architecture

```
PatientDocumentsExplorerPage
  └─> ScannerModal (MUI Dialog)
       └─> useDynamsoftScanner (React Hook)
            └─> Dynamsoft Web TWAIN SDK
```

### Key Components

1. **ScannerModal**: MUI-based modal dialog with scanner controls
2. **useDynamsoftScanner**: React hook managing scanner lifecycle
3. **Dynamsoft SDK**: Native TWAIN scanner integration

### Data Flow

1. User clicks "Scan" button → Modal opens
2. Hook initializes Dynamsoft SDK and detects scanners
3. User configures settings and scans documents
4. Images stored in Dynamsoft buffer and displayed in viewer
5. On "Save", images converted to PDF blobs
6. Each blob uploaded to selected folder via existing upload action
7. Modal closes and document list refreshes

## Browser Requirements

Dynamsoft Web TWAIN requires:

- Windows or macOS (scanner support)
- Modern browser (Chrome, Firefox, Edge, Safari)
- For TWAIN scanners: Dynamsoft service installed on client machine

The SDK will prompt users to install the service if not detected.

## Troubleshooting

### No Scanners Found

- Ensure scanner is properly installed and connected
- Install Dynamsoft service when prompted
- Restart the browser after service installation

### License Errors

- Verify license key is correct in `useDynamsoftScanner.ts`
- Check if license has expired (trial licenses are 30 days)
- Contact Dynamsoft support for license issues

### Resources Not Found

- Ensure `dwt-resources` folder is in the `public` directory
- Verify files were copied correctly from `node_modules/dwt/dist`
- Check browser console for 404 errors

## Additional Resources

- [Dynamsoft Web TWAIN Documentation](https://www.dynamsoft.com/web-twain/docs/info/api/)
- [Sample React Implementation](https://github.com/Dynamsoft/web-twain-react-advanced)
- [Support Forum](https://www.dynamsoft.com/forum/)
