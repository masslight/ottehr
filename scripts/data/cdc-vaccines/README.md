# CDC vaccine code sets

The immunization picker offers every vaccine in `CVX_VACCINES`, and `MVX_MANUFACTURERS` lists the vaccine manufacturers. Both tables are generated from the two files CDC publishes, kept here exactly as CDC serves them (UTF-8 with BOM, CRLF line endings).

| File           | Source                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cvx.txt`      | CVX code set: `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/cvx.txt` (linked from [CDC's CVX page](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx)) |
| `mvx.txt`      | MVX code set: `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/mvx.txt` (linked from [CDC's MVX page](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=mvx)) |
| `sources.json` | For each file: its URL, the date it was downloaded, its size and SHA-256                                                                                                               |

Never edit these files or the generated tables by hand.

## Generated tables

`scripts/generate-vaccine-code-lists.ts` parses the files with `parseCdcCvx` / `parseCdcMvx` (`packages/utils/lib/types/data/immunization/vaccine-codes.ts`) and writes `packages/utils/lib/types/data/immunization/*.generated.ts`.

| Table                            | Rows kept                                                      | Order |
| -------------------------------- | -------------------------------------------------------------- | ----- |
| `cvx-vaccines.generated.ts`      | status `Active`, non-vaccine `False`, not in `CVX_NOT_OFFERED` | name  |
| `mvx-manufacturers.generated.ts` | status `Active`                                                | code  |

`CVX_NOT_OFFERED` lists active codes a practice would not stock (national stockpile, avian and Southern Hemisphere flu, self-administered nasal flu, the shortage-only yellow fever product). Names and notes are CDC's text, unedited.

The parsers check every row (`cvx.txt`: `code | short description | full name | notes | status | non-vaccine | last updated`; `mvx.txt`: `code | manufacturer | notes | status | last updated`, no header row) and fail on anything else, so an error page or a changed layout never reaches the tables.

## Commands

Run from the repo root.

```bash
npm run codes:vaccines:refresh   # download both files from CDC, update sources.json, regenerate the tables
npm run codes:vaccines           # regenerate the tables from the committed files (after changing CVX_NOT_OFFERED)
```

A refresh writes nothing if a download does not parse, and leaves a file and its `sources.json` entry alone when CDC has published nothing new. Review the diff, then commit the files, `sources.json` and the tables together. Look out for new active codes a practice would not stock (add them to `CVX_NOT_OFFERED`) and for vaccines that dropped out of the list: an order placed with one keeps it, but a quick pick saved with one no longer fills in the vaccine.

## Test

`packages/utils/lib/types/data/immunization/vaccine-codes.test.ts` fails when a file here no longer matches its size and SHA-256 in `sources.json`, or a generated table no longer matches its file. It does not download anything, so it cannot tell that CDC has published a newer file: refresh before a release and whenever staff cannot find a vaccine.
