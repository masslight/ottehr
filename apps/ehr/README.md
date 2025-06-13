# EHR README

## EHR E2E Tests

For E2E testing documentation and guide please check the [E2E Testing Guide](./tests/e2e-readme/README.md)

## FEATURE FLAGS

For feature flag configuration, application environment variables are used. For this purpose, a constant has been established in ehr: `apps/ehr/src/constants/feature-flags.ts`. This configuration shows which feature flags are currently used in the application and what they are called.

```
export const FEATURE_FLAGS = {
  LAB_ORDERS_ENABLED: import.meta.env.VITE_APP_IS_LAB_ORDERS_ENABLED_FEATURE_FLAG === 'true',
  IN_HOUSE_LABS_ENABLED: import.meta.env.VITE_APP_IS_IN_HOUSE_LABS_ENABLED_FEATURE_FLAG === 'true',
  NURSING_ORDERS_ENABLED: import.meta.env.VITE_APP_IS_NURSING_ORDERS_ENABLED_FEATURE_FLAG === 'true',
};
```

## LABEL PRINTING

### DYMO 550 Turbo

1. Follow the quick setup guide included with your label maker.

- Install DYMO connect for Desktop. Make sure you install before connecting the printer to your computer
- You may need to give additional permissions to DYMO Connect. You may need to restart your computer afterwards.

2. Printing

#### Chrome, Safari, and Edge

Chrome and Safari are the preferred browsers for the label printing workflow, but these settings will also work for Edge.

- Open the label pdf in the browser
- Click the print button, or ctrl+P (or cmd+P on Mac)
- (Chrome & Edge): Select "Print using system dialog..."
- Printer setting: Select the DYMO LabelWriter 550 Turbo printer
- Paper size setting: select the option corresponding to 2.25x1.25 inches -- this may open a menu showing additional label paper types of the same size. Choose 30334
- Select Landscape orientation
- Scaling should be 100%
- Ensure nothing is selected under the Layout section
- Under the Paper Handling section, ensure nothing is selected. DO NOT scale to fit paper size
- Click Print

When you next print, under "Presets" select "Last Used Settings." You can also save these settings as a preset.

##### A Note on Edge

Edge had odd printing behavior at times, for example only allowing a pdf to be printed once after which the print button in the browser and hot keys stop responding. This can be remedied by refreshing the page.

#### Firefox

We have observed that Firefox does not correctly transmit orientation metadata to the printer and as a result labels are not printed correctly from Firefox. This is a known issue with Firefox. We do not recommend printing labels through this browser at this time.
