# Immunization forecast engine

Pure TypeScript implementation of the CDC **CDSi Logic Specification for ACIP Recommendations v4.6** (evaluation of
administered doses, forecasting of the next dose, series selection, vaccine-group assembly), driven by the CDSi
supporting data shipped as JSON under `data/<version>/`. No I/O, no clock, no FHIR: the caller passes the patient's
doses and marks and gets one result per vaccine group. Used by Flowsheets › Immunizations, the Due today box and
the shot record.

## Public API

```ts
import { forecastImmunizations } from 'utils/lib/immunization-forecast/engine';
import { ImmunizationForecastInput, ImmunizationForecast } from 'utils/lib/immunization-forecast/types';

const result: ImmunizationForecast = forecastImmunizations(input);
```

`forecastImmunizations(input: ImmunizationForecastInput, rules?: RulesData): ImmunizationForecast`
(`rules` defaults to the shipped data; tests pass other data.)

### Input (`types.ts`)

| Field | Meaning |
| --- | --- |
| `dob` | ISO `yyyy-mm-dd`. |
| `sex` | FHIR administrative gender; only the HPV series depend on it. |
| `birthCountry` | Default `"U.S."`; only used for varicella immunity by date of birth. |
| `asOf` | Assessment date (CDSi "assessment date"), ISO. Pass today in the practice's time zone. |
| `doses[]` | `{ id, date: string \| null, cvx, source: 'administered' \| 'outside', outsideSource? }`. `outsideSource` is the NIP001 code (`IMMUNIZATION_REPORT_ORIGIN`): `'04'` = the patient's or family's recall. |
| `marks` | Per group: `{ type: 'immune' \| 'contraindicated' \| 'declined', date, by, note? }`. A mark overrides the group's status. |
| `groups` | Optional list of group ids to compute. |

Input rules (decisions #5 and #6):

- Undated doses are shown (`status: 'not-counted'`, reason "Date unknown") but never counted.
- Recalled doses (`outsideSource: '04'`) are not counted, **except** COVID-19, influenza, PPSV23 (CVX 33) and polio
  given at 18 y or older (the CDC self-report rule).
- Every other outside source counts like an administered dose.
- A CVX that maps to none of the forecast antigens is returned in `unmappedDoses`.

### Output

`ImmunizationForecast { asOf, dataVersion, groups: ImmunizationGroupForecast[], unmappedDoses }`. Per group:

| Field | Meaning |
| --- | --- |
| `group`, `label` | Lane id (`hepb`, `rota`, `dtap`, `hib`, `pcv`, `ipv`, `rsv`, `flu`, `covid`, `mmr`, `var`, `hepa`, `hpv`, `menacwy`, `menb`, `zoster`, `pneumo-adult`, `rsv-adult`) and display name. See `groups.ts`. |
| `status` | `notyet` (nothing given, not due) · `uptodate` (every dose due so far given, more later) · `due` (recommended ≤ asOf ≤ past due) · `pastdue` · `complete` (series finished, aged out, or no more doses recommended) · `immune` / `contraindicated` / `declined` (marks, or immunity by date of birth). |
| `seriesStatus` | The CDSi status behind it: `Not Complete`, `Complete`, `Aged Out`, `Not Recommended`, `Immune`. `Aged Out` and `Not Recommended` show as `complete`; `notes` says why. |
| `targetDoses`, `targetText` | `4` / `"4"`, `"5, then Tdap at 11–12 y"`, `"Every season"`. |
| `doses[]` | One per input dose of the group: `doseNumber`, `status` (`valid`, `invalid`, `extraneous`, `not-counted`), `reason`, `counted`, and for counted doses the `window` it was due in (earliest / recommended / pastDue) plus `timing` (`early`, `on-time`, `late`). The Flowsheets timeline draws the windows behind past doses. |
| `next` | `{ n, earliest, recommended, pastDue \| null, latest \| null, cvx[], note, seasonEnd? }` or `null`. Seasonal doses have no past-due date; `seasonEnd` is the season's last day (inclusive) when the data publishes one (flu, infant RSV; COVID has none). `cvx` lists the vaccines the data recommends for the dose (forecastVaccineType = Y). |
| `notNeeded` | 1-based dose numbers the patient no longer needs (skipped by age or history, e.g. Hib/PCV dose 4 for a healthy child 5 y or older). |
| `mark`, `notes` | The active mark; plain-language notes (skip descriptions, "Patient has exceeded the maximum age", …). |

Adult-only lanes (`pneumo-adult`, `rsv-adult`) are returned for patients 19 y and older; the childhood `pcv` and `rsv`
lanes are returned for children, or for adults who have doses in them. Pass `groups` to force any lane.

## How it works (files)

| File | CDSi chapter |
| --- | --- |
| `dates.ts` | 3.4 date calculations (`"6 weeks - 4 days"`, CALCDT-1..6). |
| `engine.ts` | 4.2 organize history (CVX → antigens, incl. age-dependent associations such as zoster → varicella), 5.1 relevant series, 8 select best series, 9 vaccine group forecast, Ottehr status mapping, marks, self-report rule. Public entry point. |
| `evaluate.ts` | 6 evaluate each dose (conditional skip, inadvertent vaccine, age with the 4-day grace period, preferable/allowable intervals, live-virus conflicts, preferable/allowable vaccine) and 7 forecast (skip, immunity, forecast need, dates, validate). Also computes the window of each counted dose. |
| `groups.ts` | Output lanes ↔ CDSi vaccine groups / series groups. |
| `rules-types.ts` | Shape of the converted supporting data. |
| `data/rules-data.ts` | Loads the current data version and builds the lookups. |

What is **not** implemented: coded patient observations (indications, contraindications, immunity by clinical
history), so Risk series are not shipped and risk-based extra doses are the provider's call (decision #6, option C);
dose conditions (expired lot, sub-potent); trade-name/volume checks (CDSi ignores them for validity too).

## Rules data and versioning

`data/<version>/` holds `manifest.json` (sources and versions), `schedule.json` (CVX → antigen map, live-virus
conflicts, vaccine groups) and `antigens/<antigen>.json`. The engine imports one version (`data/rules-data.ts`);
older versions can stay in the repo for diffing.

Current version **2026-11**:

| Antigens | Source | Version |
| --- | --- | --- |
| Influenza, COVID-19, RSV | AIRA medical societies (AAP/AAFP/ACOG/IDSA) Supporting Data, `Version 26.1.zip` (Sept 2026, 2026–27 season) | 26.1 |
| All others (HepB, Rotavirus, Diphtheria/Tetanus/Pertussis, Hib, Pneumococcal, Polio, Measles/Mumps/Rubella, Varicella, HepA, HPV, Meningococcal, Meningococcal B, Zoster) and the schedule file | CDC CDSi Supporting Data `supporting-data-4.64-508.zip` (AIRA mirror) | 4.64 |

AIRA's medical-societies release 26.1 covers **only** the respiratory-season antigens; AIRA has not published
CDSi-format data for the rest of the 2026 AAP childhood schedule ("currently out of scope" in its release notes), so
the childhood routine schedule comes from the CDC data. Differences from the AAP 2026 schedule that this data
therefore cannot encode must be checked against AAP's published schedule when AIRA ships a fuller release; the
known one is the AAP's MMRV guidance (CDC 4.65 reverted its MMRV change under the legal stay). CDC 4.65/4.66 and
test cases 4.46/4.47 are on cdc.gov behind a bot check that refuses scripted downloads; 4.64 and test cases 4.45
came from AIRA's mirror.

### Updating the data (each season, and when CDC/AIRA publish)

1. Download the zips: CDC from https://www.cdc.gov/iis/cdsi/index.html (use a browser), AIRA from
   https://www.immregistries.org/clinical-decision-support. Unzip each into its own folder.
2. Convert:
   ```sh
   npx tsx scripts/immunization-forecast/convert-supporting-data.ts \
     --cdc "<cdc folder>/XML" --cdc-version 4.66 \
     --aira "<aira folder>/XML" --aira-version 27.1 \
     --out packages/utils/lib/immunization-forecast/data/2027-09
   ```
   Antigens present in the AIRA folder replace the CDC ones.
3. Point `data/rules-data.ts` at the new folder (imports + nothing else).
4. Refresh the CDSi test fixture if a new test-case workbook exists:
   ```sh
   npx tsx scripts/immunization-forecast/convert-test-cases.ts \
     --xlsx "<CDSi_Healthy_Childhood_and_Adult_Test_Cases_vX.xlsx>" --version X \
     --out packages/utils/lib/immunization-forecast/test-data/cdsi-test-cases.json
   ```
   The seasonal groups in the CDC workbook describe the CDC season; the test converts the matching CDC seasonal
   antigens into `test-data/cdc-<version>/` (`--antigens "Influenza,COVID-19,RSV"`) and runs FLU/COVID-19/RSV on them.
5. Run the tests (below) and update `test-data/cdsi-known-failures.json` only for failures you have understood.

Raw downloads are not committed (the CDC zip is 2.4 MB, the AIRA zip 0.5 MB; `manifest.json` records file names).

## Tests

```sh
cd packages/utils
npx vitest run lib/immunization-forecast                      # everything
npx vitest run lib/immunization-forecast/cdsi-test-cases.test.ts --silent=false   # with the per-group report
```

- `cdsi-test-cases.test.ts`: all 1013 CDC CDSi healthy childhood and adult test cases (v4.45). The suite prints
  pass/fail per vaccine group and asserts that the failing ids equal `test-data/cdsi-known-failures.json`
  (currently empty: 1013/1013 pass).
- `mockup-patients.test.ts`: readable hand tests for the mockup patients Maya and Leo and the Ottehr input rules.
- `dates.test.ts`: the CALCDT date rules.
