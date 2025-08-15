import { CodeableConcept } from 'fhir/r4b';

export type ExamConfigType = {
  telemed: Record<
    string,
    {
      components: ExamItemConfig;
    }
  >;
  inPerson: Record<
    string,
    {
      components: ExamItemConfig;
    }
  >;
};

export type ExamItemConfig = Record<string, ExamCard>;

type ExamCard = {
  label: string;
  components: {
    normal: Record<string, ExamCardNonTextComponent>;
    abnormal: Record<string, ExamCardNonTextComponent>;
    comment: Record<string, ExamCardTextComponent>;
  };
};

type ExamCardNonTextComponent =
  | ExamCardCheckboxComponent
  | ExamCardDropdownComponent
  | ExamCardColumnComponent
  | ExamCardFormComponent
  | ExamCardMultiSelectComponent;

export type ExamCardComponent = ExamCardNonTextComponent | ExamCardTextComponent;

type ExamCardCheckboxComponent = {
  label: string;
  defaultValue: boolean;
  type: 'checkbox';
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
};

type ExamCardDropdownComponent = {
  label: string;
  placeholder?: string;
  type: 'dropdown';
  components: Record<
    string,
    { label: string; defaultValue: boolean; type: 'option'; code?: CodeableConcept; bodySite?: CodeableConcept }
  >;
};

type ExamCardColumnComponent = {
  label: string;
  type: 'column';
  components: Record<string, ExamCardComponent>;
};

export type ExamCardFormComponent = {
  label: string;
  type: 'form';
  components: Record<string, ExamCardFormElement>;
  fields: Record<string, ExamCardFormField>;
};

type ExamCardFormElement = {
  defaultValue: boolean;
  type: 'form-element';
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
};

type ExamCardFormField = {
  label: string;
  type: 'radio' | 'dropdown' | 'text';
  enabledWhen?: {
    field: string;
    value: string;
  };
  options?: Record<string, ExamCardFormFieldOption>;
};

type ExamCardFormFieldOption = {
  label: string;
};

type ExamCardMultiSelectComponent = {
  label: string;
  type: 'multi-select';
  options: Record<string, ExamCardMultiSelectOption>;
};

type ExamCardMultiSelectOption = {
  label: string;
  defaultValue: boolean;
  description?: string;
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
};

type ExamCardTextComponent = {
  label: string;
  type: 'text';
  code?: CodeableConcept;
};
