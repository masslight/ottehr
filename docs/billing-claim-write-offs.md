# Claim Write-Offs

Requirements for the **Write-offs** tab on the billing app claim detail page (`/claims/:id`).

## Placement

Each claim gets a **Write-offs** tab, positioned right before the **History** tab. (The former
"Write offs & Patient payments" tab is now just **Patient payments**.)

## Write-off dialog

The tab's "Write off balance" button opens a dialog with:

| Field | Behavior |
| --- | --- |
| Responsible party | `Patient` / `Insurance` / `Non-insurance` |
| Insurance | Shown only when party = Insurance. Select which coverage: Primary, Secondary, or Tertiary (only coverages present on the claim are offered). |
| Non-Insurance Payer | Shown only when party = Non-insurance. Select the claim's non-insurance payer. |
| Reason | Write-off reason; the list depends on the responsible party (see below). |
| Select Service Lines | Table of the claim's service lines (CPT Code, Billed, Balance) with a checkbox and a per-line `$` Amount input. Checking a line defaults the amount to the line balance. |
| Total adjusted amount | Read-only; sum of entered amounts. |
| Remaining claim balance | Read-only; claim balance minus the total adjusted amount. |
| Note | Free text. |
| Date | Defaults to today. |

Saving requires: a responsible party, a payer selection when the party is Insurance or
Non-insurance, a reason, a date, and at least one service line amount (no amount may exceed the
line's balance).

## Reason lists

"Other" is always the **last** option.

### Insurance and Non-insurance write-off reasons

1. Administrative Write Off
2. Bundled or Inclusive
3. Case Rate or Capitated
4. Contractual Adjustment
5. Credentialing or Contracting
6. Efforts Exhausted
7. Friends & Family Discount Adjustment
8. Interest
9. No Authorization Referral
10. Non Covered Max Benefit
11. Not Medically Necessary
12. Out-of-Network Write Off
13. Primary Paid Max Benefits
14. Small Balance
15. Stale Date
16. Timely Filing
17. Timely Filing Late Encounter
18. Uncollectible or Non Billable
19. Other

### Patient write-off reasons

Nothing additional to select for patient write-offs — just the reason:

1. Bad Debt
2. Bankruptcy
3. Charity or Financial Assistance
4. Collection Agency
5. Deceased
6. Friends & Family Discount Adjustment
7. Out-of-Network Courtesy Adjustment
8. Patient Experience or Service Recovery
9. Prompt Pay Discount
10. Small Balance
11. Uncollectible or Non Billable
12. Other

## Implementation notes

- UI prototype only for now: write-offs live in claim-page state
  (`apps/billing/src/components/claim/ClaimWriteOffs.tsx`) and are not persisted; backend wiring is
  a follow-up. The claim header's **Balance** reflects saved write-offs (balance minus total
  written off).
- Saved write-offs are listed in the tab (date, responsible party, payer, reason, service lines,
  note, amount) and reduce the per-line balances offered to subsequent write-offs in the session.
