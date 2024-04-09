import { CodeableConcept } from 'fhir/r4';
import { ExamCardsNames, ExamFieldsNames, SNOMEDCodeConceptInterface } from './save-chart-data.types';

const createCodingCode = (code: string, display: string): CodeableConcept => ({
  coding: [
    {
      code: code,
      display: display,
    },
  ],
});

export const examCardsMap: { [field in ExamCardsNames]: SNOMEDCodeConceptInterface | undefined } = {
  'general-comment': undefined,
  'head-comment': undefined,
  'eyes-comment': undefined,
  'nose-comment': undefined,
  'ears-comment': undefined,
  'mouth-comment': undefined,
  'neck-comment': undefined,
  'chest-comment': undefined,
  'abdomen-comment': undefined,
  'back-comment': undefined,
  'skin-comment': undefined,
  'extremities-musculoskeletal-comment': undefined,
  'neurological-comment': undefined,
  'psych-comment': undefined,
};

export const examFieldsMap: { [field in ExamFieldsNames]: SNOMEDCodeConceptInterface | undefined } = {
  alert: {
    code: createCodingCode('248233002', 'Mental alertness (observable entity)'),
  },
  awake: {
    code: createCodingCode('248218005', 'Awake (finding)'),
  },
  calm: {
    code: createCodingCode('102894008', 'Feeling calm (finding)'),
  },
  fussy: {
    code: createCodingCode('55929007', 'Feeling irritable (finding)'),
  },
  'well-hydrated': {
    code: createCodingCode('1144674006', 'Adequately hydrated (finding)'),
  },
  'not-well-hydrated': {
    code: createCodingCode('300892001', 'Finding of fluid loss (finding)'),
  },
  'tired-appearing': {
    code: createCodingCode('440398005', 'Level of fatigue (observable entity)'),
  },
  'ill-appearing': {
    code: createCodingCode('39104002', 'Illness (finding)'),
  },
  'distress-none': {
    code: createCodingCode('1193646009', 'Intensity of emotion (observable entity)'),
  },
  'distress-mild': {
    code: createCodingCode('1193646010', 'Intensity of emotion (observable entity)'),
  },
  'distress-moderate': {
    code: createCodingCode('1193646011', 'Intensity of emotion (observable entity)'),
  },
  'distress-severe': {
    code: createCodingCode('1193646012', 'Intensity of emotion (observable entity)'),
  },
  normocephaly: {
    code: createCodingCode('17621005', 'Normal (qualifier value)'),
    bodySite: createCodingCode('302548004', 'Entire head (body structure)'),
  },
  atraumatic: {
    code: createCodingCode('1149217004', 'No traumatic injury (situation)'),
    bodySite: createCodingCode('302548004', 'Entire head (body structure)'),
  },
  'clear-rhinorrhea': {
    code: createCodingCode('64531003', 'Nasal discharge (finding)'),
    bodySite: createCodingCode('45206000', 'Nasal structure (body structure)'),
  },
  'purulent-discharge': {
    code: createCodingCode('836475004', 'Mucopurulent discharge from nose (finding)'),
    bodySite: createCodingCode('45206001', 'Nasal structure (body structure)'),
  },
  congested: {
    code: createCodingCode('68235000', 'Nasal congestion (finding)'),
    bodySite: createCodingCode('45206002', 'Nasal structure (body structure)'),
  },
  'normal-ear-right': {
    code: createCodingCode('300196000', 'Ear normal (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'normal-ear-left': {
    code: createCodingCode('300196000', 'Ear normal (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'erythematous-ear-right': {
    code: createCodingCode('247441003', 'Erythema (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'erythematous-ear-left': {
    code: createCodingCode('247441003', 'Erythema (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'swelling-ear-right': {
    code: createCodingCode('300874009', 'Swelling of ear (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'swelling-ear-left': {
    code: createCodingCode('300874009', 'Swelling of ear (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'tender-ear-right': {
    code: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'tender-ear-left': {
    code: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  // this ear thing has same codes below
  'yellow-discharge-ear-right': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'yellow-discharge-ear-left': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'clear-discharge-ear-right': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'clear-discharge-ear-left': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  normal: {
    code: createCodingCode('162010006', 'No mouth problem (situation)'),
    bodySite: createCodingCode('123851003', 'Mouth region structure (body structure)'),
  },
  mmm: undefined,
  dry: {
    code: createCodingCode('262016004', 'Open mouth (finding)'),
    bodySite: createCodingCode('123851003', 'Mouth region structure (body structure)'),
  },
  'normal-tongue': {
    code: createCodingCode('300249003', 'Tongue normal (finding)'),
    bodySite: createCodingCode('21974007', 'Tongue structure (body structure)'),
  },
  'erythema-of-pharynx': {
    code: createCodingCode('247441003', 'Erythema (finding)'),
    bodySite: createCodingCode('54066008', 'Pharyngeal structure (body structure)'),
  },
  'ulcers-on-tongue-buccal-mucosa': {
    code: createCodingCode('66123000', 'Ulcer on tongue (disorder)'),
    bodySite: createCodingCode('21974007', 'Tongue structure (body structure)'),
  },
  'normal-respiratory-effort': {
    code: createCodingCode('1290338002', 'Normal respiratory effort (finding)'),
    bodySite: createCodingCode('45048000', 'Neck structure (body structure)'),
  },
  'supple-neck': {
    code: createCodingCode('48162006', 'Supple (qualifier value)'),
    bodySite: createCodingCode('45048000', 'Neck structure (body structure)'),
  },
  'moves-in-all-directions': {
    code: createCodingCode('298475003', 'Normal movement of neck (finding)'),
    bodySite: createCodingCode('786964009', 'Structure of cervical spine joint region (body structure)'),
  },
  'no-conversational-dyspnea': {
    code: createCodingCode('161938003', 'No breathlessness (situation)'),
  },
  tachypnea: {
    code: createCodingCode('271823003', 'Tachypnea (finding)'),
  },
  'suprasternal-retractions': {
    code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
    bodySite: createCodingCode('255569004', 'Suprasternal (qualifier value)'),
  },
  'intercostal-retractions': {
    code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
    bodySite: createCodingCode('1197041002', 'Intercostal (qualifier value)'),
  },
  'subcostal-retractions': {
    code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
    bodySite: createCodingCode('264208000', 'Subcostal (qualifier value)'),
  },
  'abdominal-breathing': {
    code: createCodingCode('57591009', 'Diaphragmatic breathing (finding)'),
    bodySite: createCodingCode('20139000', 'Structure of respiratory system (body structure)'),
  },
  grunting: {
    code: createCodingCode('62085005', 'Grunting respiration (finding)'),
    bodySite: createCodingCode('20139000', 'Structure of respiratory system (body structure)'),
  },
  flaring: {
    code: createCodingCode('248568003', 'Nasal flaring (finding)'),
    bodySite: createCodingCode('15562006', 'Structure of respiratory region of nose (body structure)'),
  },
  wheeze: {
    code: createCodingCode('56018004', 'Wheezing (finding)'),
    bodySite: createCodingCode('20139000', 'Structure of respiratory system (body structure)'),
  },
  'barky-cough': {
    code: createCodingCode('17986004', 'Barking cough (finding)'),
    bodySite: createCodingCode('321667001', 'Respiratory tract structure (body structure)'),
  },
  'stridor-with-each-breath': {
    code: createCodingCode('70407001', 'Stridor (finding)'),
    bodySite: createCodingCode('58675001', 'Upper respiratory tract structure (body structure)'),
  },
  'normal-appearing-on-parental-exam': {
    code: createCodingCode('163133003', 'Abdomen examined - no abnormality detected (finding)'),
    bodySite: createCodingCode(
      '818983003',
      'Structure of abdominopelvic cavity and/or content of abdominopelvic cavity and/or anterior abdominal wall (body structure)',
    ),
  },
  'non-tender-on-parental-exam': {
    code: createCodingCode('297125009', 'Abdominal tenderness absent (situation)'),
    bodySite: createCodingCode(
      '818983003',
      'Structure of abdominopelvic cavity and/or content of abdominopelvic cavity and/or anterior abdominal wall (body structure)',
    ),
  },
  tender: {
    code: createCodingCode('43478001', 'Abdominal tenderness (finding)'),
    bodySite: createCodingCode(
      '818983003',
      'Structure of abdominopelvic cavity and/or content of abdominopelvic cavity and/or anterior abdominal wall (body structure)',
    ),
  },
  'tenderness-location': {
    code: createCodingCode('43478001', 'Abdominal tenderness (finding)'),
  },
  'able-to-jump-up-down-without-abdominal-pain': undefined,
  'not-able-to-jump-up-down-due-to-abdominal-pain': undefined,
  'normal-back': undefined,
  'cva-tenderness': {
    code: createCodingCode('102830001', 'Renal angle tenderness (finding)'),
    bodySite: createCodingCode('91773002', 'Structure of costovertebral angle of twelfth rib (body structure)'),
  },
  'able-to-flex-and-extend-back-and-move-side-to-side': {
    code: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
    bodySite: createCodingCode('304035006', 'Regional back structure (body structure)'),
  },
  'no-rashes': {
    code: createCodingCode('225544001', 'Skin appearance normal (finding)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  'normal-activity': {
    code: createCodingCode('20658008', 'Normal muscle function (finding)'),
    bodySite: createCodingCode('71616004', 'Skeletal and/or smooth muscle structure (body structure)'),
  },
  'normal-gait': {
    code: createCodingCode('8117002', 'Gait normal (finding)'),
    bodySite: createCodingCode('71616004', 'Skeletal and/or smooth muscle structure (body structure)'),
  },
  'normal-rom': {
    code: createCodingCode('364564000 ', 'Range of joint movement (observable entity)'),
    bodySite: createCodingCode('71616004', 'Skeletal and/or smooth muscle structure (body structure)'),
  },
  'swelling-right-foot': {
    code: createCodingCode('297142003', 'Foot swelling (finding)'),
    bodySite: createCodingCode('7769000', 'Structure of right foot (body structure)'),
  },
  'swelling-left-foot': {
    code: createCodingCode('297142003', 'Foot swelling (finding)'),
    bodySite: createCodingCode('22335008', 'Structure of left foot (body structure)'),
  },
  'deformity-right-foot': {
    code: createCodingCode('229844004', 'Deformity of foot (finding)'),
    bodySite: createCodingCode('7769000', 'Structure of right foot (body structure)'),
  },
  'deformity-left-foot': {
    code: createCodingCode('229844004', 'Deformity of foot (finding)'),
    bodySite: createCodingCode('22335008', 'Structure of left foot (body structure)'),
  },
  'bruising-right-foot': {
    code: createCodingCode('74814004', 'Contusion of foot (disorder)'),
    bodySite: createCodingCode('7769000', 'Structure of right foot (body structure)'),
  },
  'bruising-left-foot': {
    code: createCodingCode('74814004', 'Contusion of foot (disorder)'),
    bodySite: createCodingCode('22335008', 'Structure of left foot (body structure)'),
  },
  'able-to-bear-weight-right-foot': {
    code: createCodingCode('298340002', 'Finding of weight-bearing (finding)'),
    bodySite: createCodingCode('7769000', 'Structure of right foot (body structure)'),
  },
  'able-to-bear-weight-left-foot': {
    code: createCodingCode('298340002', 'Finding of weight-bearing (finding)'),
    bodySite: createCodingCode('22335008', 'Structure of left foot (body structure)'),
  },
  'normal-mental-status': undefined,
  'normal-affect': undefined,
  'depressed-affect': undefined,
  'poor-eye-contact': undefined,
  'good-eye-contact': undefined,
};
