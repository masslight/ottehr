# Claim Write-Offs

Requirements for the **Write-offs** tab on the billing app claim detail page (`/claims/:id`).

## Placement

Each claim gets a **Write-offs** tab, positioned right before the **History** tab. (The former
"Write offs & Patient payments" tab is now just **Patient payments**.)

## Write-off dialog

The tab's "Write off balance" button opens a dialog with:

| Field | Behavior |
| --- | --- |
| Write-off amount | Single editable total at the top; defaults to the sum of the line balances. Errors when it exceeds the remaining claim balance. |
| Remaining claim balance | Read-only value next to the amount; claim balance minus the entered total. |
| Service lines | Read-only table of the claim's service lines: CPT Code, Billed, Adjusted, Ins. Paid, Pt. Paid, Balance, Amount. The Amount column shows the write-off total distributed proportionally to the line balances (display-time distribution; equal split when all balances are zero; last line absorbs rounding drift). |
| Write-off for | `Insurance` / `Non-insurance` / `Patient`, above the reason row; defaults from the claim's AR stage. Insurance adds a Primary/Secondary/Tertiary coverage picker; Non-insurance adds a payer picker. |
| Write-off date | Defaults to today. |
| Reason | Next to the date; the list depends on the write-off party (see below). |
| Notes | Free text, below date/reason. |

Saving requires: a payer selection when the party is Insurance or Non-insurance, a reason, a date,
and a positive total that does not exceed the remaining claim balance.

Per-line amounts: **Adjusted** is billed minus the remits' non-PR adjustments (CO/OA/PI — e.g.
contractual adjustments), i.e. what is actually receivable; PR amounts (deductible/coinsurance/
copay) stay receivable. **Balance** is adjusted minus paid. Insurance paid comes from the claim's
remits; patient payments are claim-level only, so they are prorated across lines by charges.

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
