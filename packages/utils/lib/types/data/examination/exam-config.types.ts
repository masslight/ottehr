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

type ExamCardNonTextComponent = ExamCardCheckboxComponent | ExamCardDropdownComponent | ExamCardColumnComponent;

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

type ExamCardTextComponent = {
  label: string;
  type: 'text';
  code?: CodeableConcept;
};
