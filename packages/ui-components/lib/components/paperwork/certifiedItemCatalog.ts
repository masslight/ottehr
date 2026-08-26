import { QuestionnaireDataType } from 'config-types';
import { FormItemType } from 'utils/lib/types/common';
import { FormElement, IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';

/**
 * The certified parts catalog for the paperwork renderer.
 *
 * Every questionnaire item shape the paperwork feature supports must appear here with the
 * FormItemType it renders as. `utils.test.ts` proves each case against the real dispatcher
 * (`getInputTypeForItem`), and the compile-time assertion at the bottom of this file forces
 * anyone adding a `FormItemType` member to either certify it here or explicitly mark it
 * legacy-only. Downstream instance-certification tooling consumes this table as the source
 * of truth for "does this customer's questionnaire use only certified parts?".
 */

/** FormItemType members the paperwork dispatcher can actually produce. */
export const PAPERWORK_FORM_ITEM_TYPES = [
  'Text',
  'Select',
  'Radio',
  'Radio List',
  'Free Select',
  'Date',
  'Checkbox',
  'Header 3',
  'Header 4',
  'Description',
  'Button',
  'Group',
  'Attachment',
  'Credit Card',
  'Medical History',
  'Call Out',
  'Link',
  'Decimal',
] as const satisfies readonly NonNullable<FormItemType>[];

/**
 * FormItemType members that only the legacy, pre-questionnaire form system produces
 * (apps/intake/src/components/PageForm.tsx and apps/intake/src/helpers/form/getFormInput.tsx).
 * `getInputTypeForItem` can never return these. They leave this list only when the legacy
 * form system is removed, at which point they should be deleted from FormItemType itself.
 */
export const LEGACY_ONLY_FORM_ITEM_TYPES = [
  'Year',
  'File',
  'Photos',
  'Date Year',
  'Date Month',
  'Date Day',
  'Form list',
] as const satisfies readonly NonNullable<FormItemType>[];

export interface CertifiedDispatchCase {
  /** Human-readable part name; shows up in test output and certification reports. */
  label: string;
  /** Minimal questionnaire item of this shape. */
  item: IntakeQuestionnaireItem;
  /** The FormItemType the dispatcher must resolve the item to. */
  rendersAs: NonNullable<FormItemType>;
}

const item = (
  type: IntakeQuestionnaireItem['type'],
  extras: Partial<IntakeQuestionnaireItem> & { dataType?: QuestionnaireDataType; preferredElement?: FormElement } = {}
): IntakeQuestionnaireItem => ({
  linkId: 'certified-catalog-item',
  type,
  acceptsMultipleAnswers: false,
  alwaysFilter: false,
  ...extras,
});

/**
 * One row per certified (item.type, dataType, preferredElement) shape, including the
 * precedence rules and the legacy linkId/id special cases the dispatcher carries.
 */
export const CERTIFIED_DISPATCH_CASES: CertifiedDispatchCase[] = [
  { label: 'string item', item: item('string'), rendersAs: 'Text' },
  { label: 'text item', item: item('text'), rendersAs: 'Text' },
  { label: 'decimal item', item: item('decimal'), rendersAs: 'Decimal' },
  { label: 'date item', item: item('date'), rendersAs: 'Date' },
  { label: 'open-choice item', item: item('open-choice'), rendersAs: 'Free Select' },
  { label: 'group item', item: item('group'), rendersAs: 'Group' },
  { label: 'attachment item', item: item('attachment'), rendersAs: 'Attachment' },

  { label: 'plain boolean', item: item('boolean'), rendersAs: 'Checkbox' },
  {
    label: 'boolean with Payment Validation dataType',
    item: item('boolean', { dataType: 'Payment Validation' }),
    rendersAs: 'Credit Card',
  },
  {
    label: 'boolean with Medical History dataType',
    item: item('boolean', { dataType: 'Medical History' }),
    rendersAs: 'Medical History',
  },
  { label: 'boolean with Button element', item: item('boolean', { preferredElement: 'Button' }), rendersAs: 'Button' },
  { label: 'boolean with Link element', item: item('boolean', { preferredElement: 'Link' }), rendersAs: 'Link' },
  {
    label: 'boolean dataType beats preferredElement',
    item: item('boolean', { dataType: 'Payment Validation', preferredElement: 'Button' }),
    rendersAs: 'Credit Card',
  },

  { label: 'plain display', item: item('display'), rendersAs: 'Header 3' },
  { label: 'display with h4 element', item: item('display', { preferredElement: 'h4' }), rendersAs: 'Header 4' },
  { label: 'display with p element', item: item('display', { preferredElement: 'p' }), rendersAs: 'Description' },
  {
    label: 'display with legacy caption linkId',
    item: item('display', { linkId: 'insurance-details-caption' }),
    rendersAs: 'Description',
  },
  { label: 'display with Call Out dataType', item: item('display', { dataType: 'Call Out' }), rendersAs: 'Call Out' },
  {
    label: 'display h4 element beats Call Out dataType',
    item: item('display', { preferredElement: 'h4', dataType: 'Call Out' }),
    rendersAs: 'Header 4',
  },

  { label: 'plain choice', item: item('choice'), rendersAs: 'Select' },
  { label: 'choice with Radio element', item: item('choice', { preferredElement: 'Radio' }), rendersAs: 'Radio' },
  {
    label: 'choice with Radio List element',
    item: item('choice', { preferredElement: 'Radio List' }),
    rendersAs: 'Radio List',
  },
  { label: 'choice with Select element', item: item('choice', { preferredElement: 'Select' }), rendersAs: 'Select' },
  {
    label: 'choice with legacy patient-filling-out-as element id',
    // The legacy radio-list list matches on the item's *element id*, not its linkId.
    item: item('choice', { id: 'patient-filling-out-as', linkId: 'patient-filling-out-as' }),
    rendersAs: 'Radio List',
  },
  {
    label: 'choice with patient-filling-out-as linkId only stays a Select',
    item: item('choice', { linkId: 'patient-filling-out-as' }),
    rendersAs: 'Select',
  },
];

type CatalogedFormItemType = (typeof PAPERWORK_FORM_ITEM_TYPES)[number] | (typeof LEGACY_ONLY_FORM_ITEM_TYPES)[number];
type UncatalogedFormItemType = Exclude<NonNullable<FormItemType>, CatalogedFormItemType>;

/**
 * Compile-time gate: this line stops building when a FormItemType member is neither in the
 * certified paperwork list nor explicitly marked legacy-only. New parts get certified first.
 */
export const everyFormItemTypeIsCataloged: UncatalogedFormItemType extends never ? true : never = true;
