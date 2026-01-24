import { FormItemType, IntakeQuestionnaireItem } from 'utils';

export const getInputTypeForItem = (item: IntakeQuestionnaireItem): FormItemType => {
  let inputType: FormItemType = undefined;
  switch (item.type) {
    case 'string':
    case 'text':
      inputType = 'Text';
      break;
    case 'decimal':
      inputType = 'Decimal';
      break;
    case 'boolean':
      inputType = inputTypeForBoolean(item);
      break;
    case 'display':
      inputType = inputTypeForDisplayItem(item);
      break;
    case 'choice':
      inputType = inputTypeForChoiceItem(item);
      break;
    case 'open-choice':
      return 'Free Select';
    case 'date':
      return 'Date';
    case 'group':
      return 'Group';
    case 'attachment':
      return 'Attachment';
  }
  return inputType;
};

const h4Ids = [''];
const descriptionIds = [
  'patient-contact-additional-caption',
  'insurance-details-caption',
  'responsible-party-page-caption',
  'photo-id-page-caption',
  'contact-page-caption',
];

const inputTypeForBoolean = (item: IntakeQuestionnaireItem): FormItemType => {
  if (item.dataType === 'Payment Validation') {
    return 'Credit Card';
  }
  if (item.dataType === 'Medical History') {
    return 'Medical History';
  }
  if (item.preferredElement === 'Button') {
    return 'Button';
  }
  if (item.preferredElement === 'Link') {
    return 'Link';
  }
  return 'Checkbox';
};

const inputTypeForDisplayItem = (item: IntakeQuestionnaireItem): FormItemType => {
  if (h4Ids.includes(item.linkId) || item.preferredElement === 'h4') {
    return 'Header 4';
  }
  if (descriptionIds.includes(item.linkId) || item.preferredElement === 'p') {
    return 'Description';
  }
  if (item.dataType === 'Call Out') {
    return 'Call Out';
  }
  return 'Header 3';
};

const radioListIds = ['patient-filling-out-as'];
const inputTypeForChoiceItem = (item: IntakeQuestionnaireItem): FormItemType => {
  /*if (item.linkId === 'relay-phone') {
    console.log('preferred element', item.preferredElement);
  }*/
  if (
    item.preferredElement === 'Radio' ||
    item.preferredElement === 'Radio List' ||
    item.preferredElement === 'Select'
  ) {
    return item.preferredElement;
  }
  if (radioListIds.includes(item.id ?? '')) {
    return 'Radio List';
  }
  return 'Select';
};
