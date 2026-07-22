# External Labs Module Overview & Flow

The External Labs Module is responsible for lab ordering flows and result flows. The module is a combination of **Ottehr** (frontend EHR) UI, **zambdas** (EHR backend) and **Oystehr** (services backend) calls. The data layer consists of various FHIR resources including (but not limited to): Patient, ServiceRequest, DiagnosticReport, Observation, Location, Organization, Task, Coverage, Account, and DocumentReference.

Various zambdas involved in the External Labs Module make calls to the Oystehr Lab Service. This service provides endpoints responsible for surfacing searchable live lab compendium information (i.e. tests and their codes, along with any available specimen collection information), order submission, result parsing, and route creation. Documentation on each of these functionalities, as well as the FHIR resource requirements necessary for submitting a lab can be found here: [Oystehr Lab Service Documentation](https://docs.oystehr.com/oystehr/services/lab/). API docs can be found [here](https://api-reference.oystehr.com/reference/) (search for "Lab" using the search bar).

The following document is a high level overview of the various UI components and zambdas that constitute the External Labs module.

All file paths are relative to the ottehr repo root.

### For LabCorp/Quest Integration

The External Labs Module was certified in its capacity to order labs and display results. It was also certified in its capacity to properly handle unsolicited results. The External Labs Module must be utilized when establishing a LabCorp or Quest interface through Ottehr/Oystehr.

## Data Model

At a very high level, the data model is as follows:

- ServiceRequest: represents an ordered test. Contains test information and the order number/. Multiple tests included in the same requisition will have matching order numbers. This ServiceRequest references a Patient and an Encounter.
- QuestionnaireResponse: captures the answers to the AOE questions. Referenced by the ServiceRequest.
- DiagnosticReport: Corresponds to an OBR segment in an ORU HL7 message. References a test code and the order number. References one or many Observations corresponding to the actual result values.
- DocumentReference: Many documents are represented by DocumentReferences. These will be related to their respective resources (e.g. ServiceRequest, DiagnosticReport):
  - Order form PDF
  - Lab-generated eRequisition
  - Lab-generated ABN document
  - Ottehr-generated result form PDF
  - Lab-generated result form PDF
  - Original transmission HL7 txt
- Task: Drives the status flow for an order from creation to review. Tasks are associated with the ServiceRequest or DiagnosticReport.
- List: lab sets are represented by lists

## External Lab Flow Overview:

### Solicited Orders and Results

The External Labs flow for solicited results at a high level is as follows:

1. Establish a **[route](https://docs.oystehr.com/oystehr/services/lab/onboarding-a-lab/)** to the lab.

- You will need an account number. This will be provided by the laboratory
- Note that the lab's lab guid is environment dependent (sandbox vs production)
- For early development, we recommend establishing a route to AutoLab, `labGuid: 790b282d-77e9-4697-9f59-0cef8238033a` (sandbox). See [Testing the Lab Module](#testing-the-lab-module) below.
- For those forking Ottehr and deploying via Terraform and IaC, lab routes can be configured in `config/oystehr/labRoutes.json`, with references to account numbers and labGuids in the appropriate secrets file. See the [Deploy README](/deploy/README.md) for more information.
  - For those not forking Ottehr or not using IaC to manage their Ottehr app, routes will need to be created and managed manually on each of your environments. Please see the linked [Oystehr docs](https://docs.oystehr.com/oystehr/services/lab/onboarding-a-lab/) for more information.

2. Create an [Organization](https://docs.oystehr.com/oystehr/services/lab/submit-an-order/#organization) representing the lab

- For IaC managed Ottehr, the organization should live in `config/oystehr/miscFhirResources.json`. See the example `"AUTOLAB_ORGANIZATION"`

3. Update any Location resources that are able to order from the lab with the necessary information. Note, per the [Oystehr Lab Service docs](https://docs.oystehr.com/oystehr/services/lab/submit-an-order/#location), the Location must also have an address.

- For IaC managed Ottehr, this information can be added in `config/oystehr/locations-and-schedules.json`

```json
{
        "resourceType": "Location",
        "status": "active",
        ...
        "address": ...,
        "identifier": [
          ...,
          {
            "system": "https://identifiers.fhir.oystehr.com/lab-account-number",
            "value": "replace-with-account-number-assigned-to-location-by-lab",
            "assigner": {
              "type": "Organization",
              "reference": "Organization/..." # reference to Organization representing the lab
            }
          }
        ],
        ...
}

```

4. Create a lab order

- Form is populated by the `get-create-lab-order-resources` zambda
- Hits the Oystehr Lab Service [orderable item search](https://docs.oystehr.com/oystehr/services/lab/explore-the-compendium/#orderable-item-search) to populate the list of tests. Which laboratory's tests are populated is driven by which lab account numbers are associated with the ordering Location
- Multiple tests can be created at once. The zambda handles putting each test into its proper requisition. Labs prefer as many tests in a single requisition as possible to cut down on their accessioning fees.
- At least one Dx code is required. The form will pull from Dx currently associated with the chart / Encounter. The form also supports adding Dx directly via the order.
- This is the screen where the provider dictates whether the test will be ordered as PSC (specimen collected at a patient service center) or onsite at the practice
- This is the screen where the provider dictates the payment type for the test(s). If active patient insurance (Coverage) is detected, the form will render "Insurance" as an option. To enable Client Billing as an option, a Coverage with specific information must exist, see these [docs](https://docs.oystehr.com/oystehr/services/lab/submit-an-order/#client-bill).
  - Client Billing depends on an Organization resource representing the practice. This Organization's id is referenced in the `create-lab-order` zambda as `clientOrgId` and can look like the following. The `create-lab-order` will handle configuring the Coverage resource correctly:
  ```
  {
    "resourceType": "Organization",
    "active": true,
    "name": "Example Practice Name",
    "telecom": [
      {
        "system": "fax",
        "value": "123456789"
      }
    ],
    ...
  }
  ```
  - In standard Ottehr deployments, this Organization is IaC managed as `"OTTEHR_ORGANIZATION"` in `config/oystehr/miscFhirResources.json`
- If any lab sets are available in the environment, the form will render the button to add tests from the available lab sets. See [Ordering via Lab Sets](#ordering-via-lab-sets) below.
- The `create-lab-order` zambda is called on submit

5. Collect sample, answer AOEs ("answer on entry" questions), and mark the test as ready to submit from the order details page

- If the test was ordered as PSC, no specimen collection information will render. Otherwise, compendium-driven specimen collection information will render, and a specimen collection datetime must be populated.
- If collecting a specimen in house, a specimen collection label will generated.
- AOE questions are dynamically pulled from the lab's compendium for the given test. The answers are patient specific. Ottehr does not currently support pre-filling these tests, and we advise caution doing so.
  - AOEs are returned by the Oystehr Lab Service [Orderable Item Search](https://docs.oystehr.com/oystehr/services/lab/explore-the-compendium/#orderable-item-search) and can be found in the lab's compendium
- Required AOEs must be populated before the test can be marked as ready
- Labs require even PSC orders to populate AOE questions

5. Submit the lab

- Submit button only available once all tests in a requisition have been marked as "Ready"
- Labs prefer that as many tests as possible are included in a single requisition /bundle. For a given patient and encounter, tests are added to an in-progress requisition / bundle if they have the same properties listed below. Note that the Oystehr Lab Service will do additional validation to ensure all tests in a requisition are valid members:
  - Filler laboratory
  - PSC status
  - Payment method
- `submit-lab-order` zambda is called. Hits the Oystehr Submit Lab endpoint to validate the order and electronically submit the order to the lab. If submitted successfully, the zambda will generate a PDF order form to be included with the specimen or given to the patient in the case of a PSC order. LabCorp and Quest have distinct order forms different from the standard order form. These will be returned by the Oystehr Lab Submit endpoint if applicable, see [LabCorp and Quest](https://docs.oystehr.com/oystehr/services/lab/submit-an-order/#labcorp-and-quest).
- If submitting with Medicare/Medicaid to LabCorp/Quest, an ABN ("advance beneficiary notice") may be generated. This will be returned by the Oystehr Lab Submit endpoint if applicable and an appropriate banner will be displayed indicating a signature on the ABN must be obtained. See [LabCorp and Quest > ABN ](https://docs.oystehr.com/oystehr/services/lab/submit-an-order/#advance-beneficiary-notice-abn-documentreferences)

6. Get results

- The Oystehr Lab Service handles parsing HL7 into [results](https://docs.oystehr.com/oystehr/services/lab/results/) in the form of DiagnosticReports, Observations, and DocumentReferences for any lab provided PDFs.
- Ottehr handles multiple result types, including preliminary, final, corrected, cancelled, reflex and unsolicited results. For more information on unsolicited results, see the section below and the Oystehr Lab Service section on [unsolicited results](https://docs.oystehr.com/oystehr/services/lab/results/#unsolicited-results).
  - Final results will overwrite preliminary results. Corrected results will overwrite final results.
- The subscription zambda `handle-lab-result` is triggered by creation or updates to DiagnosticReports matching the lab result tag. The zambda handles updating/deleting tasks (which can be used for alert workflows), as well as generating result PDFs. See the `handle-lab-result` section below for more detail.

7. Mark results as reviewed once a provider has reviewed results.

- A new PDF bearing evidence of provider review will be generated.

### Unsolicited Results

Labs will occasionally send results that do not correspond to an order number/requisition number within your system; this can happen due to an error on the lab's part or if a patient independently requests results be sent to their provider. Ottehr and the Oystehr Lab Service are both equipped to handle these scenarios.

At a high level:

1. The Oystehr Lab Service receives an unsolicited result and writes the appropriate FHIR resources.
2. The `handle-lab-result` zambda is triggered.
3. A new task to match the result to a patient is created and is available in the `<UnsolicitedResultsInbox>`

- **Note**: The `<UnsolicitedResultsInbox>` is a legacy component. It is discussed here for simplicity, but the correct component for all Task-based workflows is the `<Tasks>` component which renders the Ottehr task inbox.

4. A provider matches the result to an existing order if applicable, or to a patient. If no match can be made, the provider rejects the result.
5. The `handle-lab-result` zambda is triggered again due to the update. Task resources are updated as necessary, and the result form PDF is created.
6. Provider reviews the result.

### Lab Order Status Determination

Status is computed by a helper within the `get-lab-orders` zambda. The helper is `parseLabOrderStatus()` (`packages/zambdas/src/ehr/lab/external/get-lab-orders/helpers.ts`). The function evaluates FHIR resources in a fixed priority order and returns the **first** matching status. Possible values come from `ExternalLabsStatus` (`packages/utils/lib/types/data/labs/labs.types.ts`).

**Note**: The result's status (as dictated by the laboratory) and the status in Ottehr are closely related but not identical.

Statuses as dictated by the laboratory are captured in `DiagnosticReport.status` and include values like `preliminary`, `final`, `corrected`, and `cancelled`.

The Ottehr statuses are partially driven by the result status but also encode additional information, e.g. `sent` vs `sent manually`.

#### Resources Consulted

| Resource           | Fields used                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ServiceRequest`   | `status` (`draft` / `active` / `revoked`), `extension` (rejected-ABN marker), `category.coding` (manual-order tag)                      |
| `Task`             | `status` (`ready` / `in-progress` / `completed` / `cancelled`), `code.coding[].code` (task type), `basedOn` (links to DiagnosticReport) |
| `DiagnosticReport` | `status` (`preliminary` / `final` / `corrected` / `cancelled`), `id` (matched via `Task.basedOn`)                                       |

Task type codes referenced below:

| Code     | Meaning                        |
| -------- | ------------------------------ |
| `PST`    | Pre-Submission Task            |
| `RFRT`   | Review Final Result Task       |
| `RCRT`   | Review Corrected Result Task   |
| `RPRT`   | Review Preliminary Result Task |
| `RCANRT` | Review Cancelled Result Task   |
| `MURT`   | Match Unsolicited Result Task  |

#### Status Evaluation Order (First Match Wins)

1. **`rejected abn`** — `ServiceRequest.extension` contains `https://extensions.fhir.oystehr.com/reason-sr-revoked` with `valueCode = "rejected-abn"`. Checked before everything else because an ABN rejection supersedes any result state.

2. **`cancelled by lab`** — One or more `RCANRT` Tasks exist (covering either the ordered test or a reflex test). These tasks are created by `handle-lab-result` when a DiagnosticReport with `status: cancelled` arrives.

3. **`pending`** — PST Task is `ready` or `in-progress` **and** `ServiceRequest.status === 'draft'`. This is the initial state after order creation before the provider has finished collecting the specimen and answering AOEs.

4. **`ready`** — PST Task is `completed` **and** `ServiceRequest.status === 'draft'`. The provider has marked the order ready but it has not been submitted yet.

5. **`sent`** / **`sent manually`** — PST Task is `completed`, `ServiceRequest.status === 'active'`, and no DiagnosticReports (preliminary or final) exist yet. If `ServiceRequest.category.coding` includes the `manual-lab-order` tag the status is `sent manually`; otherwise `sent`.

6. **`prelim`** — One or more DiagnosticReports with `status: preliminary` exist, PST Task is `completed`, and `ServiceRequest.status === 'active'`. Note: preliminary DiagnosticReports for a given test code are discarded once a final result arrives for that same code, so this status is only shown while results are truly still preliminary.

7. **`corrected`** — An `RCRT` Task with status `ready` or `in-progress` exists and its linked DiagnosticReport has `status: corrected`. Corrected results always overwrite previously reviewed final results.

8. **`received`** — An `RFRT` or `RCRT` Task with status `ready` or `in-progress` exists and its linked DiagnosticReport has `status: final` or `corrected`. The provider has not yet reviewed these results.

9. **`reviewed`** — An `RFRT` or `RCRT` Task with status `completed` exists and its linked DiagnosticReport has `status: final` or `corrected`. Provider review is complete.

10. **`unknown`** — No condition above matched. This is a fallback that should not appear in normal operation; when it does, `parseLabOrderStatus()` logs the full condition breakdown to aid debugging.

#### Variant: `parseLabOrderStatusWithSpecificTask()`

Used when a specific DiagnosticReport–Task pair is already known (e.g. for unsolicited or reflex results shown in a detail view). It evaluates the same conditions but scoped to a single Task rather than the full Task list for the order.

## Ordering via Lab Sets

Ottehr supports adding tests to a lab order via Lab Set. A Lab Set is a pre-defined collection of tests, for example a TSH, CBC, and Free T4 test together might constitute a Lab Set investigating thyroid function.

Lab Sets are self service from the admin panel. At their core, they are Lists containing the information necessary to populate the create lab order form. They can contain anywhere from one to many tests across a variety of laboratories. Note that the labGuid and test code corresponds to the information returned from the [Oystehr Lab Service Orderable Item Search](https://docs.oystehr.com/oystehr/services/lab/explore-the-compendium/#orderable-item-search).

Below is an example:

```
{
  "resourceType": "List",
  "status": "current",
  "mode": "working",
  "title": "Example Lab Set",
  "code": {
    "coding": [
      {
        "system": "https://fhir.ottehr.com/CodeSystem/lab-test-item-set",
        "code": "external-labs"
      }
    ]
  },
  "entry": [
    {
      "date": "2026-06-18T15:29:35.828-04:00",
      "item": {
        "identifier": {
          "system": "https://fhir.ottehr.com/Identifier/lab-test-item-set-labGuid-and-test-code",
          "value": "20ca27c9-dfe9-43f8-98b3-c5db896cccdd|007625"
        },
        "display": "(007625) Lead, Blood (Adult) / LabCorp",
        "extension": [
          {
            "url": "https://fhir.ottehr.com/Extension/orderable-item-search-fields",
            "extension": [
              {
                "url": "https://fhir.ottehr.com/Extension/search-field-labGuid",
                "valueString": "20ca27c9-dfe9-43f8-98b3-c5db896cccdd"
              },
              {
                "url": "https://fhir.ottehr.com/Extension/search-field-itemCode",
                "valueString": "007625"
              }
            ]
          }
        ]
      }
    },
    {
      "date": "2026-06-18T15:29:35.828-04:00",
      "item": {
        "identifier": {
          "system": "https://fhir.ottehr.com/Identifier/lab-test-item-set-labGuid-and-test-code",
          "value": "20ca27c9-dfe9-43f8-98b3-c5db896cccdd|008904"
        },
        "display": "(008904) Anaerobic Culture / LabCorp",
        "extension": [
          {
            "url": "https://fhir.ottehr.com/Extension/orderable-item-search-fields",
            "extension": [
              {
                "url": "https://fhir.ottehr.com/Extension/search-field-labGuid",
                "valueString": "20ca27c9-dfe9-43f8-98b3-c5db896cccdd"
              },
              {
                "url": "https://fhir.ottehr.com/Extension/search-field-itemCode",
                "valueString": "008904"
              }
            ]
          }
        ]
      }
    }
  ],
  "id": "3b92484e-8da6-4556-9928-9617b51beb80",
  "meta": {
    "versionId": "b1ed35d6-f0df-4f76-821f-5ad9ad8d14a4",
    "lastUpdated": "2026-06-18T19:29:36.049Z"
  }
}
```

## Ordering via Global Templates

Ottehr's Global Templates fall outside of the core External Labs Module. That said, Global Templates are capable of applying lab tests to a patient's chart, including any Dx associated with those tests.

For users forking core Ottehr and building their systems on top of Ottehr, global templates will integrate seamlessly. For users beginning from a non-Ottehr system, global templates will require additional integration work which is beyond the scope of this document.

## Testing the Lab Module

Ottehr makes available a fake lab capable of receiving orders and transmitting results. This is AutoLab. For more information on testing an end-to-end flow, see [Testing the Results Flow](https://docs.oystehr.com/oystehr/services/lab/results/#testing-the-results-flow).

To submit an order in Ottehr, follow the instructions above to properly configure Autolab. Then, from the EHR:

1. Once logged in, go ahead and add a patient / visit from the tracking board.
2. Fill out patient details (address, guarantor/responsible party, etc..).
3. Go to the patient chart where you can start experimenting with the lab module
4. Click "+ External Lab" to open the form. Fill out the form and submit. This will create a new order in status "Pending"

- **Tip**: Order the CBC test from AutoLab to experiment with AOEs

5. Click into the new row from the list view. This opens the order details
6. From order details, submit the necessary information, including any AOEs if applicable. Click "Mark as Ready". You will be redirected back to the list view where the order status will now be "Ready"
7. Submit the test from the list view. A PDF requisition form should open in a new tab, and the status of the test should be "Sent".
8. AutoLab on average takes 5-10 minutes to result a test. Once a result is generated, the test's status will be "Received". Click on the row to view details
9. A "Received" test's order details page will allow you to view the PDF of the results

---

## Flow: Solicited External Lab Orders and Results (from `ExternalLabOrdersListPage`)

### Pages

| Component                   | Path                                                                      | Role                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExternalLabOrdersListPage` | `apps/ehr/src/features/external-labs/pages/ExternalLabOrdersListPage.tsx` | Entry point. Lists all external lab orders for the current encounter. Hosts the order table and "New Order" button.                                         |
| `CreateExternalLabOrder`    | `apps/ehr/src/features/external-labs/pages/CreateExternalLabOrder.tsx`    | Multi-step order creation form: lab/test selection, diagnosis, AOE questions, specimen collection.                                                          |
| `OrderDetails`              | `apps/ehr/src/features/external-labs/pages/OrderDetails.tsx`              | Detail page for a single order. Delegates to `DetailsWithoutResults` (pending) or `DetailsWithResults` / `DiagnosticReportCentricResultDetails` (received). |

### Order List Components

| Component                    | Path                                                                                      | Role                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `LabsTablePatientChart`      | `apps/ehr/src/features/external-labs/components/labs-orders/LabsTablePatientChart.tsx`    | Encounter-scoped table with pagination. Orchestrates `LabsTableContainer`.                             |
| `LabsTableContainer`         | `apps/ehr/src/features/external-labs/components/labs-orders/LabsTableContainer.tsx`       | Groups orders into bundles. Handles submit-bundle and delete-order actions.                            |
| `LabsTable`                  | `apps/ehr/src/features/external-labs/components/labs-orders/LabsTable.tsx`                | Renders the MUI table with configurable columns (status, test, diagnosis, actions).                    |
| `LabsTableRow`               | `apps/ehr/src/features/external-labs/components/labs-orders/LabsTableRow.tsx`             | Individual row for one order with status chip and action buttons.                                      |
| `LabsTableBundleHeaderRow`   | `apps/ehr/src/features/external-labs/components/labs-orders/LabsTableBundleHeaderRow.tsx` | Header row for a requisition bundle — shows requisition number and PDF links.                          |
| `LabOrderLoading`            | `apps/ehr/src/features/external-labs/components/labs-orders/LabOrderLoading.tsx`          | Loading skeleton shown while fetching orders.                                                          |
| `usePatientLabOrders` (hook) | `apps/ehr/src/features/external-labs/components/labs-orders/usePatientLabOrders.ts`       | Data hook: fetches, paginates, deletes, and updates orders. Single source of truth for the order list. |

### Order Creation Components

| Component                          | Path                                                                                  | Role                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LabsAutocomplete`                 | `apps/ehr/src/features/external-labs/components/LabsAutocomplete.tsx`                 | Autocomplete for searching and selecting tests from a lab provider's compendium. Receives the `labSets` prop from `CreateExternalLabOrder`; owns the `handleSetSelectedLabsViaLabSets` callback; conditionally renders `<LabSets />` when lab sets are available.        |
| `ExternalSelectedTests`            | `apps/ehr/src/features/external-labs/components/create/ExternalSelectedTests.tsx`     | Chips display of currently selected tests with remove controls.                                                                                                                                                                                                          |
| `LabSets`                          | `apps/ehr/src/features/external-labs/components/LabSets.tsx`                          | Button + modal UI for selecting a predefined test bundle. Rendered as a child of `LabsAutocomplete` (not directly by `CreateExternalLabOrder`). Calls back via `setSelectedLabs` (i.e. `handleSetSelectedLabsViaLabSets`) to populate the autocomplete's selected tests. |
| `AOECard`                          | `apps/ehr/src/features/external-labs/components/AOECard.tsx`                          | Card wrapper around AOE question inputs.                                                                                                                                                                                                                                 |
| `AOEQuestion`                      | `apps/ehr/src/features/external-labs/components/AOEQuestion.tsx`                      | Dispatcher — renders the appropriate typed input based on AOE question type.                                                                                                                                                                                             |
| `AOEDateQuestion`                  | `apps/ehr/src/features/external-labs/components/AOEDateQuestion.tsx`                  | AOE date picker input.                                                                                                                                                                                                                                                   |
| `AOEFreeTextQuestion`              | `apps/ehr/src/features/external-labs/components/AOEFreeTextQuestion.tsx`              | AOE free-text input.                                                                                                                                                                                                                                                     |
| `AOEListQuestion`                  | `apps/ehr/src/features/external-labs/components/AOEListQuestion.tsx`                  | AOE single-select dropdown.                                                                                                                                                                                                                                              |
| `AOEMultiSelectListQuestion`       | `apps/ehr/src/features/external-labs/components/AOEMultiSelectListQuestion.tsx`       | AOE multi-select dropdown.                                                                                                                                                                                                                                               |
| `AOENumberQuestion`                | `apps/ehr/src/features/external-labs/components/AOENumberQuestion.tsx`                | AOE numeric input.                                                                                                                                                                                                                                                       |
| `AOEYesNoQuestion`                 | `apps/ehr/src/features/external-labs/components/AOEYesNoQuestion.tsx`                 | AOE yes/no toggle.                                                                                                                                                                                                                                                       |
| `OrderCollection`                  | `apps/ehr/src/features/external-labs/components/OrderCollection.tsx`                  | Specimen collection form — AOE answers, specimen date, PSC hold. Used in both creation and detail pages.                                                                                                                                                                 |
| `SampleCollectionInstructionsCard` | `apps/ehr/src/features/external-labs/components/SampleCollectionInstructionsCard.tsx` | Read-only card showing collection instructions for non-PSC orders.                                                                                                                                                                                                       |

### Order Detail Components

| Component                              | Path                                                                                              | Role                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DetailsWithoutResults`                | `apps/ehr/src/features/external-labs/components/details/DetailsWithoutResults.tsx`                | Detail view for pending/submitted orders with no results yet. Shows order info, diagnosis, and collection instructions. |
| `DetailsWithResults`                   | `apps/ehr/src/features/external-labs/components/details/DetailsWithResults.tsx`                   | Detail view for orders with received results. Lists result items and exposes "Mark as Reviewed".                        |
| `DiagnosticReportCentricResultDetails` | `apps/ehr/src/features/external-labs/components/details/DiagnosticReportCentricResultDetails.tsx` | Variant detail view for DiagnosticReport-centric results (reflex tests, PDF attachments).                               |
| `ResultItem`                           | `apps/ehr/src/features/external-labs/components/details/ResultItem.tsx`                           | Individual result entry — routes to `FinalCardView` or `PrelimCardView`.                                                |
| `FinalCardView`                        | `apps/ehr/src/features/external-labs/components/details/FinalCardView.tsx`                        | Card for final/corrected/cancelled results. Includes PDF link and reject-ABN action.                                    |
| `PrelimCardView`                       | `apps/ehr/src/features/external-labs/components/details/PrelimCardView.tsx`                       | Card for preliminary results showing received and reviewed timestamps.                                                  |
| `OrderInformationCard`                 | `apps/ehr/src/features/external-labs/components/OrderInformationCard.tsx`                         | Read-only card: requisition number, order date, ordering provider, facility.                                            |
| `OrderHistoryCard`                     | `apps/ehr/src/features/external-labs/components/OrderHistoryCard.tsx`                             | Timeline of order status changes.                                                                                       |

### Shared Display Components

| Component                | Path                                                                            | Role                                                                  |
| ------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ExternalLabsStatusChip` | `apps/ehr/src/features/external-labs/components/ExternalLabsStatusChip.tsx`     | Color-coded status chip for an order (pending, sent, received, etc.). |
| `StatusChip`             | `apps/ehr/src/features/external-labs/components/StatusChip.tsx`                 | Generic chip base used by `ExternalLabsStatusChip`.                   |
| `TaskBanner`             | `apps/ehr/src/features/external-labs/components/TaskBanner.tsx`                 | Banner surfacing task-related notifications on order detail pages.    |
| `BoldedTitleText`        | `apps/ehr/src/features/external-labs/components/BoldedTitleText.tsx`            | Styled text component for section headings.                           |
| `LabBreadcrumbs`         | `apps/ehr/src/features/external-labs/components/labs-orders/LabBreadcrumbs.tsx` | Breadcrumb navigation for order list → detail drilldown.              |
| `labs.helpers`           | `apps/ehr/src/features/external-labs/components/labs-orders/labs.helpers.tsx`   | Utility functions for column configuration, display formatting, etc.  |

### Zambdas Called — External Labs Order Flow

| Zambda                           | Path                                                                            | When called                                                                                                                                                                           | Purpose                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `get-lab-orders`                 | `packages/zambdas/src/ehr/lab/external/get-lab-orders/index.ts`                 | List page & detail page (via `usePatientLabOrders`)                                                                                                                                   | Grabs all lab orders or a specific lab order and details                                                                                   |
| `create-lab-order`               | `packages/zambdas/src/ehr/lab/external/create-lab-order/index.ts`               | Form submission in `CreateExternalLabOrder`                                                                                                                                           | Creates one or more draft tests using info from form                                                                                       |
| `delete-lab-order`               | `packages/zambdas/src/ehr/lab/external/delete-lab-order/index.ts`               | Delete action in `LabsTableContainer` / `usePatientLabOrders`                                                                                                                         | Soft-deletes a specific test marking teh ServiceRequest.status as revoked                                                                  |
| `submit-lab-order`               | `packages/zambdas/src/ehr/lab/external/submit-lab-order/index.ts`               | Submit bundle in `LabsTableContainer`                                                                                                                                                 | Takes the "Ready" tests and submits them. Also handles generating the requisition PDF or displaying the EReq from the Oystehr Lab Service. |
| `update-lab-order-resources`     | `packages/zambdas/src/ehr/lab/external/update-lab-order-resources/index.ts`     | Save collection data (`OrderCollection`), mark reviewed (`DetailsWithResults`, `DiagnosticReportCentricResultDetails`, `FinalCardView`), update specimen date (`usePatientLabOrders`) | Various functions.                                                                                                                         |
| `get-create-lab-order-resources` | `packages/zambdas/src/ehr/lab/external/get-create-lab-order-resources/index.ts` | Fetch lab compendium, ordering locations, and coverage info in `CreateExternalLabOrder` / `LabsAutocomplete`                                                                          | Populates the Create Lab Form on load, and handles populating searchable tests on user input.                                              |
| `icd-10-search`                  | `packages/zambdas/src/ehr/icd-10-search/index.ts`                               | Diagnosis autocomplete in `CreateExternalLabOrder`                                                                                                                                    | Search ICD-10 codes                                                                                                                        |

---

## Flow: Unsolicited Results Inbox (from `UnsolicitedResultsInbox`)

**Note**: The `<UnsolicitedResultsInbox>` is a legacy component. It is discussed here for simplicity, but the correct component for all Task-based workflows is the `<Tasks>` component which renders the Ottehr task inbox.

### Pages

| Component                  | Path                                                                     | Role                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `UnsolicitedResultsInbox`  | `apps/ehr/src/features/external-labs/pages/UnsolicitedResultsInbox.tsx`  | Entry point. Lists all pending unsolicited result tasks across all patients.                                           |
| `UnsolicitedResultsMatch`  | `apps/ehr/src/features/external-labs/pages/UnsolicitedResultsMatch.tsx`  | Patient/visit matching page. Provider searches for the patient and optionally selects the originating service request. |
| `UnsolicitedResultsReview` | `apps/ehr/src/features/external-labs/pages/UnsolicitedResultsReview.tsx` | Result review page. Shows the matched result details and allows marking as reviewed to close the task.                 |

### Inbox Components

| Component                    | Path                                                                                                | Role                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `UnsolicitedResultsTaskCard` | `apps/ehr/src/features/external-labs/components/unsolicited-results/UnsolicitedResultsTaskCard.tsx` | Card for a single pending task — shows description, received date, and navigation to match/review. |
| `UnsolicitedResultsIcon`     | `apps/ehr/src/features/external-labs/components/unsolicited-results/UnsolicitedResultsIcon.tsx`     | Icon/badge indicating unsolicited result status.                                                   |

### Match Flow Components

| Component                           | Path                                                                                                       | Role                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `UnsolicitedPatientMatchSearchCard` | `apps/ehr/src/features/external-labs/components/unsolicited-results/UnsolicitedPatientMatchSearchCard.tsx` | Patient search form (name, DOB) for finding the matching patient in the system.       |
| `UnsolicitedPatientSearchResults`   | `apps/ehr/src/features/external-labs/components/unsolicited-results/UnsolicitedPatientSearchResults.tsx`   | Displays patient search results with selection and confirmation controls.             |
| `UnsolicitedVisitMatchCard`         | `apps/ehr/src/features/external-labs/components/unsolicited-results/UnsolicitedVisitMatchCard.tsx`         | Radio group for selecting the specific visit/service request to attach the result to. |

### Review Flow Components

Result review reuses shared detail components from the order flow:

| Component            | Path                                                                            | Role                                                                                   |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `DetailsWithResults` | `apps/ehr/src/features/external-labs/components/details/DetailsWithResults.tsx` | Reused — shows result items and "Mark as Reviewed" for the matched unsolicited result. |
| `ResultItem`         | `apps/ehr/src/features/external-labs/components/details/ResultItem.tsx`         | Reused — individual result entry.                                                      |
| `FinalCardView`      | `apps/ehr/src/features/external-labs/components/details/FinalCardView.tsx`      | Reused — includes the reject-result action path for unsolicited results.               |

### Zambdas Called — Unsolicited Labs Flow

| Zambda                              | Path                                                                               | When called                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get-unsolicited-results-resources` | `packages/zambdas/src/ehr/lab/external/get-unsolicited-results-resources/index.ts` | Inbox task list (`UnsolicitedResultsInbox`), match data (`UnsolicitedResultsMatch`), visit/request list (`UnsolicitedVisitMatchCard`), result detail (`UnsolicitedResultsReview`), and patient-record unsolicited list (`UnsolicitedLabsTable`) — differentiated by `requestType` |
| `update-lab-order-resources`        | `packages/zambdas/src/ehr/lab/external/update-lab-order-resources/index.ts`        | Finalize patient/visit match (`UnsolicitedResultsMatch`), cancel match, mark as reviewed (`UnsolicitedResultsReview`, `FinalCardView`)                                                                                                                                            |

---

## Patient Record Variant

The following components power the **patient record** lab view (entry point: `PatientLabsTab` at `apps/ehr/src/components/PatientLabsTab.tsx`), which shows orders across all of a patient's visits rather than a single encounter:

| Component                    | Path                                                                                   | Role                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LabTablePatientRecord`      | `apps/ehr/src/features/external-labs/components/labs-orders/LabTablePatientRecord.tsx` | Cross-visit order table with visit-history-aware pagination and a per-patient lab search autocomplete.                                                                           |
| `LabsAutocompleteForPatient` | `apps/ehr/src/features/external-labs/components/LabsAutocompleteForPatient.tsx`        | Variant of `LabsAutocomplete` scoped to a patient rather than an encounter.                                                                                                      |
| `UnsolicitedLabsTable`       | `apps/ehr/src/features/external-labs/components/labs-orders/UnsolicitedLabsTable.tsx`  | Table of unsolicited results for a specific patient, shown alongside their ordered labs. Calls `get-unsolicited-results-resources` via `useGetUnsolicitedResultsForPatientList`. |

---

## Zambda Directory Reference

HTTP zambdas for external lab ordering and unsolicited results live under `packages/zambdas/src/ehr/lab/external/`:

```
packages/zambdas/src/ehr/lab/external/
├── create-lab-order/
├── delete-lab-order/
├── get-create-lab-order-resources/
├── get-lab-orders/
├── get-unsolicited-results-resources/
├── submit-lab-order/
└── update-lab-order-resources/
```

Lab sets admin zambdas live under `packages/zambdas/src/ehr/lab/lab-sets/`:

```
packages/zambdas/src/ehr/lab/lab-sets/
├── admin-add-lab-set/
├── admin-get-lab-sets/
└── admin-update-lab-set/
```

The results-handling subscription zambda lives separately:

```
packages/zambdas/src/subscriptions/diagnostic-report/
└── handle-lab-result/
```

---

## Flow 3: Results Handling (`handle-lab-result`), All Result Types

### Overview

`handle-lab-result` is a **FHIR subscription zambda** — it has no frontend caller. It fires automatically whenever a `DiagnosticReport` resource is created or updated in FHIR (i.e., when the external lab delivers results). Its job is to translate an incoming DiagnosticReport into the Task-based structures that the rest of the frontend flows consume. It also handles generation of the Ottehr result PDFs. This zambda is responsible for all result types: solicited (preliminary, final, corrected, cancelled), reflex, and unsolicited results.

For more information on subscription zambdas, see [Subscription Zambdas][https://docs.oystehr.com/oystehr/services/zambda/types/subscription/].

| Zambda              | Path                                                                              | Type                                      |
| ------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| `handle-lab-result` | `packages/zambdas/src/subscriptions/diagnostic-report/handle-lab-result/index.ts` | `subscription` (FHIR-triggered, not HTTP) |

Registered in `config/oystehr-core/zambdas.json` as `"type": "subscription"`.

---

### What It Does

#### 1. Classify the incoming result

The zambda first reads the `LAB_DR_TYPE_TAG` on the DiagnosticReport to determine which of four categories the result falls into:

| Category                    | Condition                                                | Notes                                                                      |
| --------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Solicited**               | Has a `ServiceRequest/` in `basedOn`, no unsolicited tag | Normal ordered lab result                                                  |
| **Unsolicited — unmatched** | Tagged as unsolicited, no `Patient/` subject             | Provider must match it to a patient/visit before reviewing                 |
| **Unsolicited — matched**   | Tagged as unsolicited, has a `Patient/` subject          | Already attached to a patient (e.g. after matching); ready for review      |
| **Reflex**                  | Tagged as reflex                                         | Lab-initiated follow-on test; treated like solicited for PDF/task purposes |

#### 2. Cancel prior Tasks

Any existing Task linked to the DiagnosticReport (via `Task:based-on`) that is `ready` or `in-progress` — except the pre-submission task — is PATCHed to `cancelled` (or `rejected` if the DR is itself cancelled). This ensures only one active review task exists per result at a time.

#### 3. Create a new review Task

A new Task is created with a code determined by the DR status and category:

| Task code                 | DR status / condition                 | Visible on task board?                    |
| ------------------------- | ------------------------------------- | ----------------------------------------- |
| `reviewFinalResult`       | `final`, solicited or matched         | Yes                                       |
| `reviewCorrectedResult`   | `corrected`                           | Yes                                       |
| `reviewPreliminaryResult` | `preliminary`                         | **No** (hidden unless unsolicited)        |
| `reviewCancelledResult`   | `cancelled`                           | Created as `completed` immediately        |
| `matchUnsolicitedResult`  | Any status, unsolicited and unmatched | Yes — feeds the Unsolicited Results Inbox |

Task `input` carries: test name, lab name, received date, patient name, appointment ID, DR type tag, and an `alert` flag (`abnormalLabResult`) if the DiagnosticReport contains abnormal result tags.

**Code path:** `helpers.ts` → `getCodeForNewTask()`

#### 4. Generate a result PDF

| Condition                     | PDF function                                          | Source                                                     |
| ----------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Solicited result              | `createExternalLabResultPDF(serviceRequestId, dr)`    | `packages/zambdas/src/shared/pdf/labs-results-form-pdf.ts` |
| Unsolicited-matched or reflex | `createExternalLabResultPDFBasedOnDr(drType, dr.id)`  | same file                                                  |
| Unsolicited-unmatched         | **Skipped** — PDF is generated after patient matching | —                                                          |

#### 5. Add attachments to patient lab folder

For solicited results and matched unsolicited results, any `DocumentReference` resources revincluded from the DiagnosticReport (lab-generated attachments) are appended to the patient's lab folder `List` resource.

**Code path:** `packages/zambdas/src/shared/pdf/lab-pdf-utils.ts` → `getLabListResource()` / `addDocsToLabList()`

---

### Internal Files

| File                           | Path                                                                                                  | Role                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                     | `packages/zambdas/src/subscriptions/diagnostic-report/handle-lab-result/index.ts`                     | Main handler — orchestrates all steps above                                                                             |
| `helpers.ts`                   | `packages/zambdas/src/subscriptions/diagnostic-report/handle-lab-result/helpers.ts`                   | `fetchRelatedResources` (patient, org, encounter, tasks, attachments via FHIR search + revinclude), `getCodeForNewTask` |
| `validateRequestParameters.ts` | `packages/zambdas/src/subscriptions/diagnostic-report/handle-lab-result/validateRequestParameters.ts` | Validates and parses the subscription payload                                                                           |

---

### How This Connects to the Other Flows

`handle-lab-result` produces Tasks; the frontend flows consume them:

- **`reviewFinalResult` / `reviewCorrectedResult` / `reviewCancelledResult` tasks** → surfaced on the order row in `LabsTableRow` and on the `OrderDetails` page via `get-lab-orders` (which includes task data in its response)
- **`reviewPreliminaryResult` tasks** → included in order data but not shown on the EHR task board
- **`matchUnsolicitedResult` tasks** → drive the entire **Flow 2** (Unsolicited Results Inbox); fetched by `get-unsolicited-results-resources` with `requestType: taskList`
- **Generated PDFs** → linked from `LabsTableBundleHeaderRow` and `FinalCardView` via DocumentReference attachments on the order
