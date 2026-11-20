# CDC vaccine code sets

The vaccine catalog's code tables are built from three files CDC publishes. This folder holds those files exactly as CDC serves them, and `scripts/generate-vaccine-code-lists.ts` turns them into `packages/utils/lib/types/data/immunization/*.generated.ts`.

Never edit a file in this folder or a generated table by hand. To change what the catalog offers, change a filter (below) or refresh from CDC.

## Refreshing from CDC

```bash
npm run codes:vaccines:refresh
```

That one command, run from the repo root:

1. downloads the three files from CDC;
2. parses all three, and stops without writing anything if one is not the file we expect (an error page, a truncated download, a changed layout);
3. replaces the files here and updates `sources.json`;
4. prints which codes were added, removed or reworded;
5. regenerates the three `*.generated.ts` tables.

Then review the diff and commit the source files, `sources.json` and the generated tables together. In the diff, look for:

- new CVX codes a practice wouldn't stock, which belong in `CVX_NOT_OFFERED`;
- vaccines that disappeared (CDC made them inactive) but are still in practices' catalogs.

If CDC has published nothing new, the command changes no files.

## The files

| File                 | What it is                                                                         | CDC download                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `cvx.txt`            | Every CVX code: vaccines and other products, active or not                         | `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/cvx.txt`                     |
| `mvx.txt`            | Every MVX manufacturer code, active or not                                         | `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/mvx.txt`                     |
| `cdc-ndc-lookup.txt` | NDC crosswalk: which box is which vaccine from which manufacturer                  | `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/NDC/get_all_ndc_display.txt` |
| `sources.json`       | For each file above: its URL, the date it was downloaded, its size and its SHA-256 | written by the refresh                                                                  |

CDC links the same downloads from its [CVX](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx), [MVX](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=mvx) and [NDC](https://www2a.cdc.gov/vaccines/iis/iisstandards/ndc_tableaccess.asp) pages.

The column layouts, which the parsers in `packages/utils/lib/types/data/immunization/vaccine-codes.ts` check on every row:

- `cvx.txt`: no header row; `code | short description | full name | notes | status | non-vaccine | last updated`.
- `mvx.txt`: no header row; `code | manufacturer name | notes | status | last updated`.
- `cdc-ndc-lookup.txt`: header row, quoted cells; columns are found by name.

## What the generator keeps

The generated tables are a filtered view of the CDC files. Names and notes are CDC's text, unedited.

| Table                            | Rows kept                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `cvx-vaccines.generated.ts`      | status `Active`, non-vaccine `False`, and not in `CVX_NOT_OFFERED`                                           |
| `mvx-manufacturers.generated.ts` | status `Active`                                                                                              |
| `ndc-vaccines.generated.ts`      | packages of a vaccine in the CVX table whose sale has not ended, or ended on or after `NDC_KEEP_ENDED_SINCE` |

The two filters you can change:

- `CVX_NOT_OFFERED` in `vaccine-codes.ts`: active codes a practice wouldn't stock (stockpile, avian flu, Southern Hemisphere flu and similar).
- `NDC_KEEP_ENDED_SINCE` in `scripts/generate-vaccine-code-lists.ts` (and its copy in `vaccine-codes.test.ts`).

After changing a filter, regenerate from the committed files without downloading:

```bash
npm run codes:vaccines
```

## What the test checks

```bash
cd packages/utils && npx vitest run lib/types/data/immunization/vaccine-codes.test.ts
```

- Each source file here still has the size and SHA-256 that `sources.json` recorded when it was downloaded, so a hand edit fails.
- Each generated table equals what the generator produces from the source files.

The test does not download anything, so it cannot tell that CDC has published a newer file.

## When to refresh

Nothing alerts us when CDC changes these lists. Suggested triggers:

- before each Ottehr release;
- each summer, when the new flu season's codes and NDCs are published;
- whenever staff can't find a vaccine, box or manufacturer in the catalog.
