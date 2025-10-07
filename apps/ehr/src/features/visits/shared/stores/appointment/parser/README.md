# FHIR Appointment Parser

This module provides functionality for parsing FHIR (Fast Healthcare Interoperability Resources) appointment data and related resources. It extracts and processes information from various FHIR resources, including Appointment, Patient, Location, Encounter, and QuestionnaireResponse.

## Overview

The parser is designed to:

- Parse appointment and related FHIR resources
- Return both original resource values and processed data
- Keep original and processed data separate to avoid complex bugs and facilitate easy modifications
- Use extractors for retrieving data from resources without modifying the extracted data
- Implement business logic for processing data according to the current system's rules
- Allow for shared logic between products and easy addition of new specific logic
- Implement a parsing function that returns resource values and processed values separately

## Main Components

1. **Parser (`parser.ts`)**:

   - Main entry point for parsing FHIR bundles
   - Implements the parsing interface
   - Returns both source data and processed data

2. **Extractors (`extractors.ts`)**:

   - Responsible for extracting data from FHIR resources
   - Does not modify the extracted data

3. **Business Logic (`business-logic.ts`)**:

   - Contains rules for processing data in the current system
   - Allows for shared logic between products and easy addition of new specific logic (we may extend Parser Interface to implement different business logic for different products)

4. **Constants (`constants.ts`)**:

   - Defines constant values used throughout the module

5. **Types (`types.ts`)**:
   - Defines TypeScript types and interfaces used in the module

## Usage And Product Integration

This parsing functionality is integrated into the `useAppointment` hook located at `packages/ehr/app/src/features/in-person/hooks/useAppointment.ts`. This hook fetches appointment resources and performs the following actions:

1. Stores the raw data in the Telemed appointment Zustand store to ensure compatibility between Telemed components and CSS components.
2. Parses the data using this module and stores the parsed results in a separate Zustand store provided by `packages/ehr/app/src/features/in-person/store/parsedAppointment.store.ts`.

To use the parsed appointment data in your components, there are several options:

1. use Zustand store `packages/ehr/app/src/features/in-person/store/parsedAppointment.store.ts`
2. use return value from the hook `packages/ehr/app/src/features/in-person/hooks/useAppointment.ts`
3. use directly `parseBundle` or related utils
