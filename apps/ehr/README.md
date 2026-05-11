# Ottehr EHR

## Feature Flags

The Ottehr EHR uses feature flags to control the display of certain features. Flag values are defined centrally in [`packages/utils/lib/ottehr-config/feature-flags/index.ts`](/packages/utils/lib/ottehr-config/feature-flags/index.ts) and validated against the schema in [`packages/config-types/config/feature-flags.ts`](/packages/config-types/config/feature-flags.ts). The EHR consumes them via [`src/constants/feature-flags.ts`](/apps/ehr/src/constants/feature-flags.ts), which re-exports the shared config as the app-level `FEATURE_FLAGS` object. For example:

```ts
import { FEATURE_FLAGS_CONFIG } from 'utils';

export const FEATURE_FLAGS = {
  LAB_ORDERS_ENABLED: FEATURE_FLAGS_CONFIG.labOrdersEnabled,
  IN_HOUSE_LABS_ENABLED: FEATURE_FLAGS_CONFIG.inHouseLabsEnabled,
  NURSING_ORDERS_ENABLED: FEATURE_FLAGS_CONFIG.nursingOrdersEnabled,
};
```

To add or modify a flag, update the Zod schema in `config-types` and the default values in the `utils` feature-flags module.

## Label Printing

Ottehr primarily supports label printing with DYMO LabelWriter printers. These steps have not been tested with other printer types.

Ottehr encourages admin users to enable system-level printing configuration through the Admin Printing Config tab. Here admins can decide if printing should be done in `manual` mode by default, or, if printing in `integrated` mode, what the printer, label type, and label orientation should be. More information on each is found below.

### Printing Modes

Ottehr supports two printing modes, `manual` and `integrated`.

`manual` printing prints a pdf to your DYMO printer via the browser and system print settings. It offers the most flexibility, as users can often find a paper size to suit their needs even if ottehr does not yet explicitly support that paper type.

`integrated` printing attempts to print directly to your printer without first going through the browser. This mode is limited to the supported label sizes.

In either case, you must first:

1. Follow the quick setup guide included with your label maker.

- Install DYMO Connect for Desktop. Make sure you install before connecting the printer to your computer
- You may need to give additional permissions to DYMO Connect. You may need to restart your computer afterwards

2. Configure your default printing mode and paper type if applicable in the Admin printer config page.

### Manual Printing Mode

This mode prints a pdf of the label via the browser and the system print dialog. By default, Ottehr assumes a DYMO 30334 size label and a DYMO LabelWriter 550 Turbo printer. However, the system print dialog offers configurablility, so it is possible to achieve a satisfactory label using a different paper size and printer.

#### Chrome, Safari, and Edge

Chrome and Safari are the preferred browsers for the label printing workflow, but these settings will also work for Edge.

To print from the browser:

1. Ensure pop-ups are enabled for Ottehr
1. Open the label pdf in the browser
1. Click the print button, or ctrl+P (or cmd+P on Mac)
1. (Chrome & Edge): Select "Print using system dialog..."
1. Printer setting: Select the DYMO LabelWriter 550 Turbo printer
1. Paper size setting: select the option corresponding to 2.25x1.25 inches -- this may open a menu showing additional label paper types of the same size. Choose 30334
1. Select Landscape orientation
1. Scaling should be 100%
1. Ensure nothing is selected under the Layout section
1. Under the Paper Handling section, ensure nothing is selected. DO NOT scale to fit paper size
1. Click Print

When you next print, under "Presets" select "Last Used Settings." You can also save these settings as a preset.

##### A Note on Edge

Edge had odd printing behavior at times, for example only allowing a pdf to be printed once after which the print button in the browser and hot keys stop responding. This can be remedied by refreshing the page.

#### Firefox

We have observed that Firefox does not correctly transmit orientation metadata to the printer and as a result labels are not printed correctly from Firefox. This is a known issue with Firefox. We do not recommend printing labels through this browser at this time.

### Integrated Printing Mode

In this mode, labels will print directly to your printer without the need to print through the browser. This mode is significantly more restrictive than `manual` mode, as it relies entirely on a pre-determined set of supported label sizes. While in `integrated` mode, if an admin elects the `Open PDF on Print` option from the Admin Printing Config tab, a pdf of the label will still open in the borwser to allow manual printing if desired.

The currently supported printer manufacturers and their label sizes are:

| Printer Manufacturer      | Label Type / Item Number | Label Size                       |
| ------------------------- | ------------------------ | -------------------------------- |
| Dymo (Labelwriter Series) | 30334                    | 1 1/4" x 2 1/4 " (32 mm x 57 mm) |

_Don't see your label size? Contact support@ottehr.com to request a new label size template._

Label sizes can be found on the back of DYMO label paper and are indicated by the "DYMO Item #". Alternatively, open DYMO Connect with your printer powered on an connected; the program should display the label type in the bottom right hand corner of the screen.

If an error is encountered while printing in `integrated` mode, Ottehr will automatically fallback to `manual` mode on a given page and display a toast with recommended adjustments. Refresh the page after making the adjustments to apply the changes.

To print in `integrated` mode:

1. Ensure DYMO Connect is installed and up to date. (Version at time of publication: Version 1.6.0.41)
1. Ensure your printer is powered on, has labels loaded, and is connected to your computer
1. Select `integrated` mode on the Admin printer config page
1. Indicate the paper template size in the Admin printer config page
1. Attempt a test print. If an error toast appears, attempt the following step.
1. (As needed) Some systems may require explicit acceptance of the printer's certificates. In your browser, navigate to https://127.0.0.1:41951/DYMO/DLS/Printing/StatusConnected and click "Accept the risk" / "Proceed anyway" to trust the certificate for that origin. This should be a one-time step if required at all.
1. If a label prints but the content is incorrectly placed, try adjusting the label orientation in the Adming Printing Config.

If you are still having trouble after these steps, contact support@ottehr.com and revert to `manual` mode in the Admin config in the meantime.

#### Notes:

- Long strings will not wrap and will instead truncate
- Attempting to use an unsupported paper size may result in unsatisfactory label prints. This does not constitute an "error" from the printer's perspective, and so as a result, the `manual` mode fallback is not triggered. This may lead to wasted labels. Admins should attempt to adjust the Admin Printing Config. Users may still have to print manually.

## EHR E2E Tests

For E2E testing documentation and guide please check the [E2E Testing Guide](./tests/e2e-readme/README.md)
