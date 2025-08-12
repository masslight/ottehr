import { CodeableConcept } from 'fhir/r4b';

export type ExamConfig = Record<string, ExamCard>;

type ExamCard = {
  label: string;
  components: {
    normal: Record<string, ExamCardNonTextComponent>;
    abnormal: Record<string, ExamCardNonTextComponent>;
    comment: Record<string, ExamCardTextComponent>;
  };
};

type ExamCardNonTextComponent = ExamCardCheckboxComponent;

export type ExamCardComponent = ExamCardNonTextComponent | ExamCardTextComponent;

type ExamCardCheckboxComponent = {
  label: string;
  defaultValue: boolean;
  type: 'checkbox';
  code?: CodeableConcept;
  bodySite?: CodeableConcept;
};

type ExamCardTextComponent = {
  label: string;
  type: 'text';
  code?: CodeableConcept;
};
