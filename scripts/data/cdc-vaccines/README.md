# CDC vaccine code sets

The immunization code tables (the vaccines that can be ordered, and vaccine manufacturers) are built from two files CDC publishes. This folder holds those files exactly as CDC serves them, and `scripts/generate-vaccine-code-lists.ts` turns them into `packages/utils/lib/types/data/immunization/*.generated.ts`.

Never edit a file in this folder or a generated table by hand. To change which vaccines are offered, change the filter (below) or refresh from CDC.

## Refreshing from CDC

```bash
npm run codes:vaccines:refresh
```

That one command, run from the repo root:

1. downloads the two files from CDC;
2. parses both, and stops without writing anything if one is not the file we expect (an error page, a truncated download, a changed layout);
3. replaces the files here and updates `sources.json`;
4. prints which codes were added, removed or reworded;
5. regenerates the two `*.generated.ts` tables.

Then review the diff and commit the source files, `sources.json` and the generated tables together. In the diff, look for:

- new CVX codes a practice wouldn't stock, which belong in `CVX_NOT_OFFERED`;
- vaccines that disappeared (CDC made them inactive) but are still in practices' quick picks.

If CDC has published nothing new, the command changes no files.

## The files

| File           | What it is                                                                         | CDC download                                                        |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `cvx.txt`      | Every CVX code: vaccines and other products, active or not                         | `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/cvx.txt` |
| `mvx.txt`      | Every MVX manufacturer code, active or not                                         | `https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/mvx.txt` |
| `sources.json` | For each file above: its URL, the date it was downloaded, its size and its SHA-256 | written by the refresh                                              |

CDC links the same downloads from its [CVX](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx) and [MVX](https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=mvx) pages.

The column layouts, which the parsers in `packages/utils/lib/types/data/immunization/vaccine-codes.ts` check on every row:

- `cvx.txt`: no header row; `code | short description | full name | notes | status | non-vaccine | last updated`.
- `mvx.txt`: no header row; `code | manufacturer name | notes | status | last updated`.

## What the generator keeps

The generated tables are a filtered view of the CDC files. Names and notes are CDC's text, unedited.

| Table                            | Rows kept                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `cvx-vaccines.generated.ts`      | status `Active`, non-vaccine `False`, and not in `CVX_NOT_OFFERED` |
| `mvx-manufacturers.generated.ts` | status `Active`                                                    |

The filter you can change is `CVX_NOT_OFFERED` in `vaccine-codes.ts`: active codes a practice wouldn't stock (stockpile, avian flu, Southern Hemisphere flu and similar).

After changing it, regenerate from the committed files without downloading:

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
- each summer, when the new flu season's codes are published;
- whenever staff can't find a vaccine or manufacturer in the list.
