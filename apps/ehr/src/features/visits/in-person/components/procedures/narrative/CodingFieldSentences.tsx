import { Add } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import { FC, Fragment, ReactNode } from 'react';
import { ProcedureFamilyModel } from 'utils/lib/procedure-coding/model.types';
import {
  CodingField,
  getStructuredFieldsData,
  RowsCodingField,
  ScalarCodingField,
  StructuredFacts,
  StructuredRow,
  StructuredValue,
} from 'utils/lib/procedure-coding/structured-fields';
import { MultiBlank, SelectBlank, Sentence, TextBlank } from './InlineBlanks';

const YES_NO = ['yes', 'no'];

/** One coding field as an inline blank. Checkboxes become a yes/no pick so the sentence stays readable.
 * Main answers are flagged while empty; `details` answers are optional by definition. */
export interface FieldBlankOptions {
  /** Flag a details field as required when the sentence treats it as part of the main answer. */
  need?: boolean;
  /** Shorter placeholder for an input blank; the field label stays its accessible name. */
  placeholder?: string;
  /** Wording for the blank and its popover when the field's own label reads wrong in the sentence. */
  label?: string;
}

export function fieldBlank(
  field: ScalarCodingField,
  current: StructuredValue,
  change: (next: StructuredValue) => void,
  readOnly: boolean,
  options: FieldBlankOptions = {}
): ReactNode {
  const need = options.need ?? !field.details;
  const label = options.label ?? field.label;
  if (field.kind === 'checkbox')
    return (
      <SelectBlank
        label={label.toLowerCase()}
        title={label}
        options={YES_NO}
        value={current === true ? 'yes' : current === false ? 'no' : undefined}
        onChange={(value) => change(value === undefined ? undefined : value === 'yes')}
        readOnly={readOnly}
        helperText={field.helperText}
      />
    );
  if (field.kind === 'select')
    return (
      <SelectBlank
        label={label.toLowerCase()}
        title={label}
        options={[...field.options].sort((a, b) => a.localeCompare(b))}
        value={typeof current === 'string' ? current : undefined}
        onChange={change}
        readOnly={readOnly}
        need={need}
        clearable
        helperText={field.helperText}
      />
    );
  return (
    <TextBlank
      label={label.toLowerCase()}
      placeholder={options.placeholder}
      kind={field.kind}
      value={typeof current === 'string' || typeof current === 'number' ? current : undefined}
      onChange={(raw) => change(raw === '' ? undefined : field.kind === 'number' ? Number(raw) : raw)}
      readOnly={readOnly}
      need={need && field.kind !== 'text'}
      min={field.kind === 'number' ? field.min : undefined}
      step={field.kind === 'number' ? field.step : undefined}
    />
  );
}

export interface RowRenderArgs {
  row: StructuredRow;
  readOnly: boolean;
  /** Blank for one of the row's fields, or null when its `visible` condition hides it. */
  blank: (key: string, options?: FieldBlankOptions) => ReactNode;
  /** The row's `details: true` fields: checkboxes behind a "+ details" popover, the rest as label/blank pieces.
   * Keys the sentence already places with `blank` are left out. */
  details: (placedKeys?: readonly string[]) => ReactNode;
}

interface Props {
  family: ProcedureFamilyModel;
  value: StructuredFacts;
  onChange: (value: StructuredFacts) => void;
  readOnly: boolean;
  medicationUsed?: string;
  /** Hand-written sentence for a repeating group; the generic "label: [blank]" wording is the default. */
  renderRow?: (args: RowRenderArgs) => ReactNode;
}

/** Turns a coding family's field definitions into sentences with inline blanks. The visibility, defaults and
 * answer normalisation are the same calls the old structured form made, so the engine sees identical facts. */
export const CodingFieldSentences: FC<Props> = ({ family, value, onChange, readOnly, medicationUsed, renderRow }) => {
  const pieces = (
    fields: readonly ScalarCodingField[],
    answers: StructuredFacts | StructuredRow,
    update: (next: StructuredFacts | StructuredRow) => void
  ): ReactNode =>
    fields.map((field, index) => (
      <Fragment key={field.key}>
        {index > 0 && '; '}
        {field.label}:{' '}
        {fieldBlank(
          field,
          answers[field.key] as StructuredValue,
          (next) => update({ ...answers, [field.key]: next }),
          readOnly
        )}
      </Fragment>
    ));

  const detailsPieces = (
    fields: readonly ScalarCodingField[],
    answers: StructuredFacts | StructuredRow,
    update: (next: StructuredFacts | StructuredRow) => void
  ): ReactNode => {
    if (!fields.length) return null;
    const checkboxes = fields.filter((field) => field.kind === 'checkbox');
    const others = fields.filter((field) => field.kind !== 'checkbox');
    const chosen = checkboxes.filter((field) => answers[field.key] === true).map((field) => field.key);
    return (
      <>
        {checkboxes.length > 0 && (
          <>
            {chosen.length > 0 && 'Details: '}
            <MultiBlank
              label="details"
              title="Details (optional)"
              options={checkboxes.map((field) => ({ value: field.key, label: field.label }))}
              values={chosen}
              onChange={(keys) =>
                update({
                  ...answers,
                  ...Object.fromEntries(checkboxes.map((field) => [field.key, keys.includes(field.key)])),
                })
              }
              readOnly={readOnly}
            />
            {chosen.length > 0 && '.'}
          </>
        )}
        {others.length > 0 && <> {pieces(others, answers, update)}.</>}
      </>
    );
  };

  const render = (
    fields: readonly CodingField[],
    answers: StructuredFacts,
    update: (next: StructuredFacts) => void
  ): ReactNode => {
    const displayed = getStructuredFieldsData({ structuredFacts: answers }, fields);
    const visible = fields.filter((field) => !field.visible || field.visible(displayed));
    const scalars = visible.filter((field): field is ScalarCodingField => field.kind !== 'rows');
    const rows = visible.filter((field): field is RowsCodingField => field.kind === 'rows');
    const main = scalars.filter((field) => !field.details);
    const details = scalars.filter((field) => field.details);
    const scalarUpdate = (next: StructuredFacts | StructuredRow): void => update(next as StructuredFacts);
    return (
      <>
        {(main.length > 0 || details.length > 0) && (
          <Sentence>
            {pieces(main, displayed, scalarUpdate)}
            {main.length > 0 && '. '}
            {detailsPieces(details, displayed, scalarUpdate)}
          </Sentence>
        )}
        {rows.map((field) => renderRows(field, displayed, update))}
      </>
    );
  };

  const renderRows = (
    field: RowsCodingField,
    answers: StructuredFacts,
    update: (next: StructuredFacts) => void
  ): ReactNode => {
    const current = answers[field.key];
    // The page feeds this component through resolveFamilyFacts, and every family that has a
    // repeating group opens with one row ready to fill, so the ordinary visit needs no "Add" click.
    // This fallback is only for a value that arrives without rows.
    const rows = Array.isArray(current) ? current : [];
    const change = (next: StructuredRow[]): void => update({ ...answers, [field.key]: next });
    return (
      <Box key={field.key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {rows.map((row, index) => {
          const displayed = getStructuredFieldsData({ structuredFacts: row }, field.fields) as StructuredRow;
          const visible = field.fields.filter((child) => !child.visible || child.visible(displayed));
          const rowUpdate = (next: StructuredFacts | StructuredRow): void =>
            change(rows.map((r, i) => (i === index ? (next as StructuredRow) : r)));
          const blank = (key: string, options?: FieldBlankOptions): ReactNode => {
            const child = visible.find((item) => item.key === key);
            return child
              ? fieldBlank(child, displayed[key], (next) => rowUpdate({ ...displayed, [key]: next }), readOnly, options)
              : null;
          };
          const details = (placedKeys: readonly string[] = []): ReactNode =>
            detailsPieces(
              visible.filter((child) => child.details && !placedKeys.includes(child.key)),
              displayed,
              rowUpdate
            );
          return (
            <Sentence
              key={index}
              onRemove={readOnly ? undefined : () => change(rows.filter((_, i) => i !== index))}
              removeLabel={`Remove ${field.rowLabel} ${index + 1}`}
            >
              {renderRow ? (
                renderRow({ row: displayed, readOnly, blank, details })
              ) : (
                <>
                  {field.rowLabel} {index + 1}:{' '}
                  {pieces(
                    visible.filter((child) => !child.details),
                    displayed,
                    rowUpdate
                  )}
                  . {details()}
                </>
              )}
            </Sentence>
          );
        })}
        {!readOnly && (
          <Button
            size="small"
            startIcon={<Add />}
            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            onClick={() =>
              change([
                ...rows,
                {
                  ...Object.fromEntries(
                    field.fields.filter((f) => f.defaultValue !== undefined).map((f) => [f.key, f.defaultValue])
                  ),
                  ...(field.key === 'administrations' && medicationUsed ? { drug: medicationUsed } : {}),
                },
              ])
            }
          >
            Add {rows.length ? 'another ' : ''}
            {field.rowLabel.toLowerCase()}
          </Button>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {render(family.fields, value, (next) =>
        onChange(getStructuredFieldsData({ structuredFacts: next }, family.fields))
      )}
    </Box>
  );
};

/** Laceration wounds read as a repair sentence; the blanks are the family's real field keys. */
/** The laceration closure option that needs no suture/staple count. */
const ADHESIVE_ONLY = 'adhesive only';

/** Material and count are `details` answers in the family (optional), so they keep the grey empty style. */
export const LacerationSentences: FC<Omit<Props, 'renderRow'>> = (props) => (
  <CodingFieldSentences
    {...props}
    renderRow={({ row, readOnly, blank, details }) => (
      <>
        {/* The family calls this "Closure"; in the sentence that read as the closure material. */}
        {blank('closure', { label: 'Repair type' })} repair of a {blank('length')} cm laceration of the {blank('site')}{' '}
        ({blank('side')}), closed with {blank('material', { placeholder: 'material' })}
        {/* Display only: an adhesive closure has no count to show, but a stored count is left as it is. */}
        {row.closure !== ADHESIVE_ONLY && !(readOnly && row.sutureCount === undefined) && (
          <> ({blank('sutureCount')} sutures/staples)</>
        )}
        . {details(['sutureCount', 'material'])}
      </>
    )}
  />
);
