import { ExamCardsNames, ExamFieldsNames, SNOMEDCodeConceptInterface } from './save-chart-data.types';
import { CodeableConcept } from 'fhir/r4';

function createCodingCode(code: string, display?: string, system?: string): CodeableConcept {
  return {
    coding: [
      {
        code: code,
        display: display ?? undefined,
        system: system ?? undefined,
      },
    ],
  };
}

export const examCardsMap: { [field in ExamCardsNames]: SNOMEDCodeConceptInterface } = {
  'general-comment': {
    code: createCodingCode('38266002', 'Entire body as a whole (body structure)'),
  },
  'head-comment': {
    code: createCodingCode('298364001', 'Finding of head region (finding)'),
  },
  'eyes-comment': {
    code: createCodingCode('118235002', 'Eye / vision finding (finding)'),
  },
  'nose-comment': {
    code: createCodingCode('118237005', 'Nose finding (finding)'),
  },
  'ears-comment': {
    code: createCodingCode('247234006', 'Ear finding (finding)'),
  },
  'mouth-comment': {
    code: createCodingCode('423066003', 'Finding of mouth region (finding)'),
  },
  'neck-comment': {
    code: createCodingCode('298378000', 'Finding of neck region (finding)'),
  },
  'chest-comment': {
    code: createCodingCode('724622000', 'Problem of chest (finding)'),
  },
  'abdomen-comment': {
    code: createCodingCode('609624008', 'Finding of abdomen (finding)'),
  },
  'back-comment': {
    code: createCodingCode('414252009', 'Finding of back (finding)'),
  },
  'skin-comment': {
    code: createCodingCode('106076001', 'Skin finding (finding)'),
  },
  'extremities-musculoskeletal-comment': {
    code: createCodingCode('106028002', 'Musculoskeletal finding (finding)'),
  },
  'neurological-comment': {
    code: createCodingCode('102957003', 'Neurological finding (finding)'),
  },
  'psych-comment': {
    code: createCodingCode('116367006', 'Psychological finding (finding)'),
  },
};

export const examFieldsMap: { [field in ExamFieldsNames]: SNOMEDCodeConceptInterface } = {
  // >>> CARD = general
  // >> GROUP = normal
  alert: {
    code: createCodingCode('248233002', 'Mental alertness (observable entity)'),
  },
  awake: {
    code: createCodingCode('248218005', 'Awake (finding)'),
  },
  calm: {
    code: createCodingCode('102894008', 'Feeling calm (finding)'),
  },
  'well-hydrated': {
    code: createCodingCode('405006006', 'Hydration status (observable entity)'),
  },
  'moist-mucous-membrane': {
    code: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
    bodySite: createCodingCode('123851003', 'Mouth region structure (body structure)'),
  },
  'distress-none': {
    code: createCodingCode('69328002', 'Distress (finding)'),
  },
  'playful-and-active': {
    code: createCodingCode('300776002', 'Does play (finding)'),
  },
  // >> GROUP = abnormal
  'tired-appearing': {
    code: createCodingCode('224960004', 'Tired (finding)'),
  },
  'ill-appearing': {
    code: createCodingCode('39104002', 'Illness (finding)'),
  },
  fussy: {
    code: createCodingCode('55929007', 'Feeling irritable (finding)'),
  },
  'dry-mucous-membranes': {
    code: createCodingCode('123640000', 'Mucous membrane dryness (finding)'),
    bodySite: createCodingCode('276413003', 'Nasal mucosa moist (finding)'),
  },
  'sunken-eye': {
    code: createCodingCode('246923005', 'Sunken eyes (finding)'),
    bodySite: createCodingCode('81745001', 'Structure of eye proper (body structure)'),
  },
  'mild-distress': {
    code: createCodingCode('69328003', 'Distress (finding)'),
  },
  'moderate-distress': {
    code: createCodingCode('69328004', 'Distress (finding)'),
  },
  'severe-distress': {
    code: createCodingCode('69328005', 'Distress (finding)'),
  },
  // >>> CARD = head
  // >> GROUP = normal
  normocephaly: {
    code: createCodingCode('17621005', 'Normal (qualifier value)'),
    bodySite: createCodingCode('302548004', 'Entire head (body structure)'),
  },
  atraumatic: {
    code: createCodingCode('1149217004', 'No traumatic injury (situation)'),
    bodySite: createCodingCode('302548004', 'Entire head (body structure)'),
  },
  // >>> CARD = eyes
  // >> GROUP = normal
  'pupils-symmetric': {
    code: createCodingCode('301943000', 'Pupils equal (finding)'),
    bodySite: createCodingCode('392406005', 'Pupil structure (body structure)'),
  },
  eomi: {
    code: createCodingCode('103251002', 'Normal ocular motility (finding)'),
    bodySite: createCodingCode('371398005', 'Eye region structure (body structure)'),
  },
  // >> GROUP = abnormal
  'pupils-asymmetric': {
    code: createCodingCode('247010007', 'Pupil finding (finding)'),
    bodySite: createCodingCode('392406005', 'Pupil structure (body structure)'),
  },
  // >> GROUP = rightEye
  'right-eye-normal': {
    code: createCodingCode('860970003', 'Normal eye proper (finding)'),
    bodySite: createCodingCode('1290043002', 'Entire right eye proper (body structure)'),
  },
  'right-eye-injected': {
    code: createCodingCode('246806002', 'Injection of caruncle of eye (finding)'),
    bodySite: createCodingCode('43045000', 'Lacrimal caruncle structure (body structure)'),
  },
  'right-eye-discharge': {
    code: createCodingCode('246679005', 'Discharge from eye (finding)'),
    bodySite: createCodingCode('371398005', 'Eye region structure (body structure)'),
  },
  'right-eye-watering': {
    code: createCodingCode('420103007', 'Watery eye (finding)'),
    bodySite: createCodingCode('1284806009', 'Structure of lumen of lacrimal apparatus (body structure)'),
  },
  'right-eye-puffy-eyelids': {
    code: createCodingCode('193967004', 'Swelling of eyelid (finding)'),
    bodySite: createCodingCode('80243003', 'Eyelid structure (body structure)'),
  },
  'right-eye-small-round-mass-in-eyelid': {
    code: createCodingCode('248514008', 'Lump in eyelid (finding)'),
    bodySite: createCodingCode('80243003', 'Eyelid structure (body structure)'),
  },
  // >> GROUP = leftEye
  'left-eye-normal': {
    code: createCodingCode('860970003', 'Normal eye proper (finding)'),
    bodySite: createCodingCode('1290041000', 'Entire left eye proper (body structure)'),
  },
  'left-eye-injected': {
    code: createCodingCode('246806002', 'Injection of caruncle of eye (finding)'),
    bodySite: createCodingCode('43045000', 'Lacrimal caruncle structure (body structure)'),
  },
  'left-eye-discharge': {
    code: createCodingCode('246679005', 'Discharge from eye (finding)'),
    bodySite: createCodingCode('371398005', 'Eye region structure (body structure)'),
  },
  'left-eye-watering': {
    code: createCodingCode('420103007', 'Watery eye (finding)'),
    bodySite: createCodingCode('1284806009', 'Structure of lumen of lacrimal apparatus (body structure)'),
  },
  'left-eye-puffy-eyelids': {
    code: createCodingCode('193967004', 'Swelling of eyelid (finding)'),
    bodySite: createCodingCode('80243003', 'Eyelid structure (body structure)'),
  },
  'left-eye-small-round-mass-in-eyelid': {
    code: createCodingCode('248514008', 'Lump in eyelid (finding)'),
    bodySite: createCodingCode('80243003', 'Eyelid structure (body structure)'),
  },
  // >>> CARD = nose
  // >> GROUP = normal
  'no-drainage': {
    code: createCodingCode('64531003', 'Nasal discharge (finding)'),
    bodySite: createCodingCode('45206002', 'Nasal structure (body structure)'),
  },
  // >> GROUP = abnormal
  'clear-rhinorrhea': {
    code: createCodingCode('64531003', 'Nasal discharge (finding)'),
    bodySite: createCodingCode('45206000', 'Nasal structure (body structure)'),
  },
  'purulent-discharge': {
    code: createCodingCode('836475004', 'Mucopurulent discharge from nose (finding)'),
    bodySite: createCodingCode('45206001', 'Nasal structure (body structure)'),
  },
  // >>> CARD = ears
  // >> GROUP = rightEar
  'normal-ear-right': {
    code: createCodingCode('300196000', 'Ear normal (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'erythema-ear-right': {
    code: createCodingCode('247441003', 'Erythema (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'swelling-ear-right': {
    code: createCodingCode('300874009', 'Swelling of ear (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'pain-with-movement-of-pinna-ear-right': {
    code: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'drainage-from-ear-canal-right': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  'clear-discharge-ear-right': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('25577004', 'Right ear structure (body structure)'),
  },
  // >> GROUP = leftEar
  'normal-ear-left': {
    code: createCodingCode('300196000', 'Ear normal (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'erythema-ear-left': {
    code: createCodingCode('247441003', 'Erythema (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'swelling-ear-left': {
    code: createCodingCode('300874009', 'Swelling of ear (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'pain-with-movement-of-pinna-ear-left': {
    code: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'drainage-from-ear-canal-left': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  'clear-discharge-ear-left': {
    code: createCodingCode('300132001', 'Ear discharge (finding)'),
    bodySite: createCodingCode('89644007', 'Left ear structure (body structure)'),
  },
  // >>> CARD = mouth
  // >> GROUP = normal
  'mouth-normal': {
    code: createCodingCode('162010006', 'No mouth problem (situation)'),
    bodySite: createCodingCode('123851003', 'Mouth region structure (body structure)'),
  },
  'mouth-moist-mucous-membrane': {
    code: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
    bodySite: createCodingCode('123851003', 'Mouth region structure (body structure)'),
  },
  'normal-tongue': {
    code: createCodingCode('300249003', 'Tongue normal (finding)'),
    bodySite: createCodingCode('21974007', 'Tongue structure (body structure)'),
  },
  'uvula-midline': {
    code: createCodingCode('249884003', 'Deviation of uvula (finding)'),
  },
  'tonsils-symmetric-and-not-enlarged': {
    code: createCodingCode('306962003', 'Tonsil asymmetry (finding)'),
    bodySite: createCodingCode('26140008', 'Uvula palatina structure (body structure)'),
  },
  'normal-voice': {
    code: createCodingCode('10503001', 'Normal voice (finding)'),
    bodySite: createCodingCode('4596009', 'Laryngeal structure (body structure)'),
  },
  // >> GROUP = abnormal
  'mouth-dry-mucous-membranes': {
    code: createCodingCode('262016004', 'Open mouth (finding)'),
    bodySite: createCodingCode('123851003', 'Mouth region structure (body structure)'),
  },
  'erythema-of-pharynx': {
    code: createCodingCode('247441003', 'Erythema (finding)'),
    bodySite: createCodingCode('54066008', 'Pharyngeal structure (body structure)'),
  },
  'white-patches-on-tongue-andor-buccal-mucosa-that-do-not-wipe-off': {
    code: createCodingCode('698193000', 'Coating of mucous membrane of tongue (finding)'),
    bodySite: createCodingCode('21974007', 'Tongue structure (body structure)'),
  },
  'strawberry-tongue': {
    code: createCodingCode('42631002', 'Strawberry tongue (disorder)'),
    bodySite: createCodingCode('21974007', 'Tongue structure (body structure)'),
  },
  'uvula-deviated': {
    code: createCodingCode('249884003', 'Deviation of uvula (finding)'),
    bodySite: createCodingCode('26140008', 'Uvula palatina structure (body structure)'),
  },
  'tonsils-erythematous': {
    code: createCodingCode('195666007', 'Acute erythematous tonsillitis (disorder)'),
  },
  'exudate-on-tonsils': {
    code: createCodingCode('301791008', 'Exudate on tonsils (finding)'),
    bodySite: createCodingCode('91636008', 'Bilateral palatine tonsils (body structure)'),
  },
  'hoarse-voice': {
    code: createCodingCode('50219008', 'Hoarse (finding)'),
    bodySite: createCodingCode('4596009', 'Laryngeal structure (body structure)'),
  },
  'hot-potato-voice': {
    code: createCodingCode('100000000', 'NOT REAL CODE Hot potato voice (finding)'),
    bodySite: createCodingCode('4596009', 'Laryngeal structure (body structure)'),
  },
  // >>> CARD = neck
  // >> GROUP = normal
  'supple-neck': {
    code: createCodingCode('48162006', 'Supple (qualifier value)'),
    bodySite: createCodingCode('45048000', 'Neck structure (body structure)'),
  },
  'moves-in-all-directions': {
    code: createCodingCode('298475003', 'Normal movement of neck (finding)'),
    bodySite: createCodingCode('786964009', 'Structure of cervical spine joint region (body structure)'),
  },
  // >>> CARD = chest
  // >> GROUP = normal
  'normal-respiratory-effort': {
    code: createCodingCode('1290338002', 'Normal respiratory effort (finding)'),
    bodySite: createCodingCode('45048000', 'Neck structure (body structure)'),
  },
  'no-tachypnea': {
    code: createCodingCode('20716004', 'Respiratory rate normal (finding)'),
    bodySite: createCodingCode('20139000', 'Structure of respiratory system (body structure)'),
  },
  'no-retractions': {
    code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
    bodySite: createCodingCode('302551006', 'Entire thorax (body structure)'),
  },
  'no-conversational-dyspnea': {
    code: createCodingCode('161938003', 'No breathlessness (situation)'),
  },
  // >> GROUP = abnormal
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
  'nasal-flaring': {
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
  // >>> CARD = back
  // >> GROUP = normal
  'back-normal': {
    code: createCodingCode('17621005', 'Normal (qualifier value)'),
    bodySite: createCodingCode('732054000', 'Entire regional back (body structure)'),
  },
  'able-to-flex-and-extend-back-and-move-side-to-side': {
    code: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
    bodySite: createCodingCode('304035006', 'Regional back structure (body structure)'),
  },
  // >> GROUP = abnormal
  'cva-tenderness': {
    code: createCodingCode('102830001', 'Renal angle tenderness (finding)'),
    bodySite: createCodingCode('91773002', 'Structure of costovertebral angle of twelfth rib (body structure)'),
  },
  // >>> CARD = skin
  // >> GROUP = normal
  'no-rashes': {
    code: createCodingCode('225544001', 'Skin appearance normal (finding)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  // >> GROUP = form
  'consistent-with-viral-exam': {
    code: createCodingCode('271756005', 'Macular eruption (disorder)'),
    bodySite: createCodingCode('22943007', 'Trunk structure (body structure)'),
  },
  'consistent-with-insect-bites': {
    code: createCodingCode('276433004', 'Insect bite - wound (disorder)'),
  },
  'consistent-with-urticaria': {
    code: createCodingCode('126485001', 'Urticaria (disorder)'),
  },
  'consistent-with-coxsackievirus': {
    code: createCodingCode('240546009', 'Coxsackie virus exanthem (disorder)'),
  },
  'consistent-with-irritant-diaper-rash': {
    code: createCodingCode('91487003', 'Diaper rash (disorder)'),
    bodySite: createCodingCode('264104007', 'Structure of diaper area (body structure)'),
  },
  'consistent-with-ringworm': {
    code: createCodingCode('47382004', 'Dermatophytosis (disorder)'),
    bodySite: createCodingCode('48075008', 'Structure of integumentary system (body structure)'),
  },
  'consistent-with-impetigo': {
    code: createCodingCode('48277006', 'Impetigo (disorder)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  'consistent-with-fifths-disease': {
    code: createCodingCode('1264021005', 'Eruption of skin of face (disorder)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  'consistent-with-atopic-dermatitis': {
    code: createCodingCode('24079001', 'Atopic dermatitis (disorder)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  'consistent-with-paronychia': {
    code: createCodingCode('71906005', 'Paronychia (disorder)'),
    bodySite: createCodingCode('280418005', 'Periungual skin structure (body structure)'),
  },
  'consistent-with-poison-ivy-contact-dermatitis': {
    code: createCodingCode('46259007', 'Hedera helix poisoning (disorder)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  'consistent-with-tinea-capitis': {
    code: createCodingCode('5441008', 'Tinea capitis (disorder)'),
    bodySite: createCodingCode('64013008', 'Structure of hair of scalp (body structure)'),
  },
  'consistent-with-pityriasis-rosea': {
    code: createCodingCode('77252004', 'Pityriasis rosea (disorder)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  'consistent-with-lyme-ecm': {
    code: createCodingCode('23502006', 'Lyme disease (disorder)'),
    bodySite: createCodingCode('39937001', 'Skin structure (body structure)'),
  },
  // >>> CARD = abdomen
  // >> GROUP = normal
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
  'able-to-jump-up-down-without-abdominal-pain': {
    code: createCodingCode('282600008', 'Able to jump (finding)'),
    bodySite: createCodingCode('108350001', 'Structure of abdomen excluding retroperitoneal region (body structure)'),
  },
  // >> GROUP = abnormal
  'left-lower-quadrant-abdomen': {
    code: createCodingCode('68505006', 'Structure of left lower quadrant of abdomen (body structure)'),
  },
  'right-lower-quadrant-abdomen': {
    code: createCodingCode('48544008', 'Structure of right lower quadrant of abdomen (body structure)'),
  },
  'right-upper-quadrant-abdomen': {
    code: createCodingCode('50519007', 'Structure of right upper quadrant of abdomen (body structure)'),
  },
  'left-upper-quadrant-abdomen': {
    code: createCodingCode('86367003', 'Structure of left upper quadrant of abdomen (body structure)'),
  },
  'epigastric-region-abdomen': {
    code: createCodingCode('27947004', 'Epigastric region structure (body structure)'),
  },
  'left-abdominal-lumbar-region-abdomen': {
    code: createCodingCode('1017212007', 'Structure of left abdominal lumbar region (body structure)'),
  },
  'right-abdominal-lumbar-region-abdomen': {
    code: createCodingCode('1017213002', 'Structure of right abdominal lumbar region (body structure)'),
  },
  'not-able-to-jump-up-down-due-to-abdominal-pain': {
    code: createCodingCode('282600008', 'Able to jump (finding)'),
    bodySite: createCodingCode('108350001', 'Structure of abdomen excluding retroperitoneal region (body structure)'),
  },
  // >>> CARD = musculoskeletal
  // >> GROUP = normal
  'moving-extemities-equally': {
    code: createCodingCode('20658008', 'Normal muscle function (finding)'),
    bodySite: createCodingCode('71616004', 'Skeletal and/or smooth muscle structure (body structure)'),
  },
  'normal-gait': {
    code: createCodingCode('8117002', 'Gait normal (finding)'),
    bodySite: createCodingCode('71616004', 'Skeletal and/or smooth muscle structure (body structure)'),
  },
  'normal-rom': {
    code: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
    bodySite: createCodingCode('71616004', 'Skeletal and/or smooth muscle structure (body structure)'),
  },
  'no-swelling': {
    code: createCodingCode('65124004', 'Swelling (finding)'),
  },
  'no-bruising': {
    code: createCodingCode('297950006', 'Finding related to bruising (finding)'),
  },
  'no-deformity': {
    code: createCodingCode('417893002', 'Deformity (finding)'),
  },
  // >> GROUP = form
  'swelling-left-finger-index': {
    code: createCodingCode('65124006', 'Swelling (finding)'),
    bodySite: createCodingCode('770841009', 'Structure of left index finger (body structure)'),
  },
  'swelling-right-finger-index': {
    code: createCodingCode('65124007', 'Swelling (finding)'),
    bodySite: createCodingCode('770842002', 'Structure of right index finger (body structure)'),
  },
  'swelling-left-finger-middle': {
    code: createCodingCode('65124008', 'Swelling (finding)'),
    bodySite: createCodingCode('770884005', 'Structure of left middle finger (body structure)'),
  },
  'swelling-right-finger-middle': {
    code: createCodingCode('65124009', 'Swelling (finding)'),
    bodySite: createCodingCode('770885006', 'Structure of right middle finger (body structure)'),
  },
  'swelling-left-finger-ring': {
    code: createCodingCode('65124010', 'Swelling (finding)'),
    bodySite: createCodingCode('770882009', 'Structure of left ring finger (body structure)'),
  },
  'swelling-right-finger-ring': {
    code: createCodingCode('65124011', 'Swelling (finding)'),
    bodySite: createCodingCode('770883004', 'Structure of right ring finger (body structure)'),
  },
  'swelling-left-finger-little': {
    code: createCodingCode('65124014', 'Swelling (finding)'),
    bodySite: createCodingCode('762101005', 'Structure of left little finger (body structure)'),
  },
  'swelling-right-finger-little': {
    code: createCodingCode('65124015', 'Swelling (finding)'),
    bodySite: createCodingCode('762102003', 'Structure of right little finger (body structure)'),
  },
  'swelling-left-finger-thumb': {
    code: createCodingCode('65124016', 'Swelling (finding)'),
    bodySite: createCodingCode('734143007', 'Structure of left thumb (body structure)'),
  },
  'swelling-right-finger-thumb': {
    code: createCodingCode('65124017', 'Swelling (finding)'),
    bodySite: createCodingCode('734144001', 'Structure of right thumb (body structure)'),
  },
  'swelling-left-hand': {
    code: createCodingCode('65124018', 'Swelling (finding)'),
    bodySite: createCodingCode('85151006', 'Structure of left hand (body structure)'),
  },
  'swelling-right-hand': {
    code: createCodingCode('65124019', 'Swelling (finding)'),
    bodySite: createCodingCode('78791008', 'Structure of right hand (body structure)'),
  },
  'swelling-left-foot': {
    code: createCodingCode('65124020', 'Swelling (finding)'),
    bodySite: createCodingCode('239919000', 'Entire left foot (body structure)'),
  },
  'swelling-right-foot': {
    code: createCodingCode('65124021', 'Swelling (finding)'),
    bodySite: createCodingCode('239830003', 'Entire right foot (body structure)'),
  },
  'swelling-left-toe-great': {
    code: createCodingCode('65124024', 'Swelling (finding)'),
    bodySite: createCodingCode('723724004', 'Structure of left great toe (body structure)'),
  },
  'swelling-right-toe-great': {
    code: createCodingCode('65124025', 'Swelling (finding)'),
    bodySite: createCodingCode('723730004', 'Structure of right great toe (body structure)'),
  },
  'swelling-left-toe-second': {
    code: createCodingCode('65124026', 'Swelling (finding)'),
    bodySite: createCodingCode('1285624003', 'Structure of left second toe (body structure)'),
  },
  'swelling-right-toe-second': {
    code: createCodingCode('65124027', 'Swelling (finding)'),
    bodySite: createCodingCode('1285623009', 'Structure of right second toe (body structure)'),
  },
  'swelling-left-toe-third': {
    code: createCodingCode('65124028', 'Swelling (finding)'),
    bodySite: createCodingCode('1285627005', 'Structure of left third toe (body structure)'),
  },
  'swelling-right-toe-third': {
    code: createCodingCode('65124029', 'Swelling (finding)'),
    bodySite: createCodingCode('1285628000', 'Structure of right third toe (body structure)'),
  },
  'swelling-left-toe-fourth': {
    code: createCodingCode('65124030', 'Swelling (finding)'),
    bodySite: createCodingCode('1285632006', 'Structure of left fourth toe (body structure)'),
  },
  'swelling-right-toe-fourth': {
    code: createCodingCode('65124031', 'Swelling (finding)'),
    bodySite: createCodingCode('1285633001', 'Structure of right fourth toe (body structure)'),
  },
  'swelling-left-toe-fifth': {
    code: createCodingCode('65124032', 'Swelling (finding)'),
    bodySite: createCodingCode('895650002', 'Structure of fifth toe of left foot (body structure)'),
  },
  'swelling-right-toe-fifth': {
    code: createCodingCode('65124033', 'Swelling (finding)'),
    bodySite: createCodingCode('895651003', 'Structure of fifth toe of right foot (body structure)'),
  },
  'swelling-left-wrist': {
    code: createCodingCode('65124036', 'Swelling (finding)'),
    bodySite: createCodingCode('5951000', 'Structure of left wrist region (body structure)'),
  },
  'swelling-right-wrist': {
    code: createCodingCode('65124037', 'Swelling (finding)'),
    bodySite: createCodingCode('9736006', 'Structure of right wrist region (body structure)'),
  },
  'swelling-left-forearm': {
    code: createCodingCode('65124038', 'Swelling (finding)'),
    bodySite: createCodingCode('66480008', 'Structure of left forearm (body structure)'),
  },
  'swelling-right-forearm': {
    code: createCodingCode('65124039', 'Swelling (finding)'),
    bodySite: createCodingCode('64262003', 'Structure of right forearm (body structure)'),
  },
  'swelling-left-elbow': {
    code: createCodingCode('65124040', 'Swelling (finding)'),
    bodySite: createCodingCode('368148009', 'Left elbow region structure (body structure)'),
  },
  'swelling-right-elbow': {
    code: createCodingCode('65124041', 'Swelling (finding)'),
    bodySite: createCodingCode('368149001', 'Right elbow region structure (body structure)'),
  },
  'swelling-left-upperarm': {
    code: createCodingCode('65124042', 'Swelling (finding)'),
    bodySite: createCodingCode('368208006', 'Left upper arm structure (body structure)'),
  },
  'swelling-right-upperarm': {
    code: createCodingCode('65124043', 'Swelling (finding)'),
    bodySite: createCodingCode('368209003', 'Right upper arm structure (body structure)'),
  },
  'swelling-left-shoulder': {
    code: createCodingCode('65124044', 'Swelling (finding)'),
    bodySite: createCodingCode('91775009', 'Structure of left shoulder region (body structure)'),
  },
  'swelling-right-shoulder': {
    code: createCodingCode('65124045', 'Swelling (finding)'),
    bodySite: createCodingCode('91774008', 'Structure of right shoulder region (body structure)'),
  },
  'swelling-left-knee': {
    code: createCodingCode('65124046', 'Swelling (finding)'),
    bodySite: createCodingCode('82169009', 'Structure of left knee region (body structure)'),
  },
  'swelling-right-knee': {
    code: createCodingCode('65124047', 'Swelling (finding)'),
    bodySite: createCodingCode('6757004', 'Structure of right knee region (body structure)'),
  },
  'swelling-left-lowerleg': {
    code: createCodingCode('65124048', 'Swelling (finding)'),
    bodySite: createCodingCode('48979004', 'Structure of left lower leg (body structure)'),
  },
  'swelling-right-lowerleg': {
    code: createCodingCode('65124049', 'Swelling (finding)'),
    bodySite: createCodingCode('32696007', 'Structure of right lower leg (body structure)'),
  },
  'swelling-left-ankle': {
    code: createCodingCode('65124050', 'Swelling (finding)'),
    bodySite: createCodingCode('51636004', 'Structure of left ankle (body structure)'),
  },
  'swelling-right-ankle': {
    code: createCodingCode('65124051', 'Swelling (finding)'),
    bodySite: createCodingCode('6685009', 'Structure of right ankle (body structure)'),
  },
  'deformity-left-finger-index': {
    code: createCodingCode('417893004', 'Deformity (finding)'),
    bodySite: createCodingCode('770841009', 'Structure of left index finger (body structure)'),
  },
  'deformity-right-finger-index': {
    code: createCodingCode('417893005', 'Deformity (finding)'),
    bodySite: createCodingCode('770842002', 'Structure of right index finger (body structure)'),
  },
  'deformity-left-finger-middle': {
    code: createCodingCode('417893006', 'Deformity (finding)'),
    bodySite: createCodingCode('770884005', 'Structure of left middle finger (body structure)'),
  },
  'deformity-right-finger-middle': {
    code: createCodingCode('417893007', 'Deformity (finding)'),
    bodySite: createCodingCode('770885006', 'Structure of right middle finger (body structure)'),
  },
  'deformity-left-finger-ring': {
    code: createCodingCode('417893008', 'Deformity (finding)'),
    bodySite: createCodingCode('770882009', 'Structure of left ring finger (body structure)'),
  },
  'deformity-right-finger-ring': {
    code: createCodingCode('417893009', 'Deformity (finding)'),
    bodySite: createCodingCode('770883004', 'Structure of right ring finger (body structure)'),
  },
  'deformity-left-finger-little': {
    code: createCodingCode('417893012', 'Deformity (finding)'),
    bodySite: createCodingCode('762101005', 'Structure of left little finger (body structure)'),
  },
  'deformity-right-finger-little': {
    code: createCodingCode('417893013', 'Deformity (finding)'),
    bodySite: createCodingCode('762102003', 'Structure of right little finger (body structure)'),
  },
  'deformity-left-finger-thumb': {
    code: createCodingCode('417893014', 'Deformity (finding)'),
    bodySite: createCodingCode('734143007', 'Structure of left thumb (body structure)'),
  },
  'deformity-right-finger-thumb': {
    code: createCodingCode('417893015', 'Deformity (finding)'),
    bodySite: createCodingCode('734144001', 'Structure of right thumb (body structure)'),
  },
  'deformity-left-hand': {
    code: createCodingCode('417893016', 'Deformity (finding)'),
    bodySite: createCodingCode('85151006', 'Structure of left hand (body structure)'),
  },
  'deformity-right-hand': {
    code: createCodingCode('417893017', 'Deformity (finding)'),
    bodySite: createCodingCode('78791008', 'Structure of right hand (body structure)'),
  },
  'deformity-left-foot': {
    code: createCodingCode('417893018', 'Deformity (finding)'),
    bodySite: createCodingCode('239919000', 'Entire left foot (body structure)'),
  },
  'deformity-right-foot': {
    code: createCodingCode('417893019', 'Deformity (finding)'),
    bodySite: createCodingCode('239830003', 'Entire right foot (body structure)'),
  },
  'deformity-left-toe-great': {
    code: createCodingCode('417893022', 'Deformity (finding)'),
    bodySite: createCodingCode('723724004', 'Structure of left great toe (body structure)'),
  },
  'deformity-right-toe-great': {
    code: createCodingCode('417893023', 'Deformity (finding)'),
    bodySite: createCodingCode('723730004', 'Structure of right great toe (body structure)'),
  },
  'deformity-left-toe-second': {
    code: createCodingCode('417893024', 'Deformity (finding)'),
    bodySite: createCodingCode('1285624003', 'Structure of left second toe (body structure)'),
  },
  'deformity-right-toe-second': {
    code: createCodingCode('417893025', 'Deformity (finding)'),
    bodySite: createCodingCode('1285623009', 'Structure of right second toe (body structure)'),
  },
  'deformity-left-toe-third': {
    code: createCodingCode('417893026', 'Deformity (finding)'),
    bodySite: createCodingCode('1285627005', 'Structure of left third toe (body structure)'),
  },
  'deformity-right-toe-third': {
    code: createCodingCode('417893027', 'Deformity (finding)'),
    bodySite: createCodingCode('1285628000', 'Structure of right third toe (body structure)'),
  },
  'deformity-left-toe-fourth': {
    code: createCodingCode('417893028', 'Deformity (finding)'),
    bodySite: createCodingCode('1285632006', 'Structure of left fourth toe (body structure)'),
  },
  'deformity-right-toe-fourth': {
    code: createCodingCode('417893029', 'Deformity (finding)'),
    bodySite: createCodingCode('1285633001', 'Structure of right fourth toe (body structure)'),
  },
  'deformity-left-toe-fifth': {
    code: createCodingCode('417893030', 'Deformity (finding)'),
    bodySite: createCodingCode('895650002', 'Structure of fifth toe of left foot (body structure)'),
  },
  'deformity-right-toe-fifth': {
    code: createCodingCode('417893031', 'Deformity (finding)'),
    bodySite: createCodingCode('895651003', 'Structure of fifth toe of right foot (body structure)'),
  },
  'deformity-left-wrist': {
    code: createCodingCode('417893034', 'Deformity (finding)'),
    bodySite: createCodingCode('5951000', 'Structure of left wrist region (body structure)'),
  },
  'deformity-right-wrist': {
    code: createCodingCode('417893035', 'Deformity (finding)'),
    bodySite: createCodingCode('9736006', 'Structure of right wrist region (body structure)'),
  },
  'deformity-left-forearm': {
    code: createCodingCode('417893036', 'Deformity (finding)'),
    bodySite: createCodingCode('66480008', 'Structure of left forearm (body structure)'),
  },
  'deformity-right-forearm': {
    code: createCodingCode('417893037', 'Deformity (finding)'),
    bodySite: createCodingCode('64262003', 'Structure of right forearm (body structure)'),
  },
  'deformity-left-elbow': {
    code: createCodingCode('417893038', 'Deformity (finding)'),
    bodySite: createCodingCode('368148009', 'Left elbow region structure (body structure)'),
  },
  'deformity-right-elbow': {
    code: createCodingCode('417893039', 'Deformity (finding)'),
    bodySite: createCodingCode('368149001', 'Right elbow region structure (body structure)'),
  },
  'deformity-left-upperarm': {
    code: createCodingCode('417893040', 'Deformity (finding)'),
    bodySite: createCodingCode('368208006', 'Left upper arm structure (body structure)'),
  },
  'deformity-right-upperarm': {
    code: createCodingCode('417893041', 'Deformity (finding)'),
    bodySite: createCodingCode('368209003', 'Right upper arm structure (body structure)'),
  },
  'deformity-left-shoulder': {
    code: createCodingCode('417893042', 'Deformity (finding)'),
    bodySite: createCodingCode('91775009', 'Structure of left shoulder region (body structure)'),
  },
  'deformity-right-shoulder': {
    code: createCodingCode('417893043', 'Deformity (finding)'),
    bodySite: createCodingCode('91774008', 'Structure of right shoulder region (body structure)'),
  },
  'deformity-left-knee': {
    code: createCodingCode('417893044', 'Deformity (finding)'),
    bodySite: createCodingCode('82169009', 'Structure of left knee region (body structure)'),
  },
  'deformity-right-knee': {
    code: createCodingCode('417893045', 'Deformity (finding)'),
    bodySite: createCodingCode('6757004', 'Structure of right knee region (body structure)'),
  },
  'deformity-left-lowerleg': {
    code: createCodingCode('417893046', 'Deformity (finding)'),
    bodySite: createCodingCode('48979004', 'Structure of left lower leg (body structure)'),
  },
  'deformity-right-lowerleg': {
    code: createCodingCode('417893047', 'Deformity (finding)'),
    bodySite: createCodingCode('32696007', 'Structure of right lower leg (body structure)'),
  },
  'deformity-left-ankle': {
    code: createCodingCode('417893048', 'Deformity (finding)'),
    bodySite: createCodingCode('51636004', 'Structure of left ankle (body structure)'),
  },
  'deformity-right-ankle': {
    code: createCodingCode('417893049', 'Deformity (finding)'),
    bodySite: createCodingCode('6685009', 'Structure of right ankle (body structure)'),
  },
  'bruising-left-finger-index': {
    code: createCodingCode('297950008', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('770841009', 'Structure of left index finger (body structure)'),
  },
  'bruising-right-finger-index': {
    code: createCodingCode('297950009', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('770842002', 'Structure of right index finger (body structure)'),
  },
  'bruising-left-finger-middle': {
    code: createCodingCode('297950010', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('770884005', 'Structure of left middle finger (body structure)'),
  },
  'bruising-right-finger-middle': {
    code: createCodingCode('297950011', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('770885006', 'Structure of right middle finger (body structure)'),
  },
  'bruising-left-finger-ring': {
    code: createCodingCode('297950012', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('770882009', 'Structure of left ring finger (body structure)'),
  },
  'bruising-right-finger-ring': {
    code: createCodingCode('297950013', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('770883004', 'Structure of right ring finger (body structure)'),
  },
  'bruising-left-finger-little': {
    code: createCodingCode('297950016', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('762101005', 'Structure of left little finger (body structure)'),
  },
  'bruising-right-finger-little': {
    code: createCodingCode('297950017', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('762102003', 'Structure of right little finger (body structure)'),
  },
  'bruising-left-finger-thumb': {
    code: createCodingCode('297950018', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('734143007', 'Structure of left thumb (body structure)'),
  },
  'bruising-right-finger-thumb': {
    code: createCodingCode('297950019', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('734144001', 'Structure of right thumb (body structure)'),
  },
  'bruising-left-hand': {
    code: createCodingCode('297950020', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('85151006', 'Structure of left hand (body structure)'),
  },
  'bruising-right-hand': {
    code: createCodingCode('297950021', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('78791008', 'Structure of right hand (body structure)'),
  },
  'bruising-left-foot': {
    code: createCodingCode('297950022', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('239919000', 'Entire left foot (body structure)'),
  },
  'bruising-right-foot': {
    code: createCodingCode('297950023', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('239830003', 'Entire right foot (body structure)'),
  },
  'bruising-left-toe-great': {
    code: createCodingCode('297950026', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('723724004', 'Structure of left great toe (body structure)'),
  },
  'bruising-right-toe-great': {
    code: createCodingCode('297950027', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('723730004', 'Structure of right great toe (body structure)'),
  },
  'bruising-left-toe-second': {
    code: createCodingCode('297950028', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('1285624003', 'Structure of left second toe (body structure)'),
  },
  'bruising-right-toe-second': {
    code: createCodingCode('297950029', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('1285623009', 'Structure of right second toe (body structure)'),
  },
  'bruising-left-toe-third': {
    code: createCodingCode('297950030', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('1285627005', 'Structure of left third toe (body structure)'),
  },
  'bruising-right-toe-third': {
    code: createCodingCode('297950031', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('1285628000', 'Structure of right third toe (body structure)'),
  },
  'bruising-left-toe-fourth': {
    code: createCodingCode('297950032', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('1285632006', 'Structure of left fourth toe (body structure)'),
  },
  'bruising-right-toe-fourth': {
    code: createCodingCode('297950033', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('1285633001', 'Structure of right fourth toe (body structure)'),
  },
  'bruising-left-toe-fifth': {
    code: createCodingCode('297950034', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('895650002', 'Structure of fifth toe of left foot (body structure)'),
  },
  'bruising-right-toe-fifth': {
    code: createCodingCode('297950035', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('895651003', 'Structure of fifth toe of right foot (body structure)'),
  },
  'bruising-left-wrist': {
    code: createCodingCode('297950038', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('5951000', 'Structure of left wrist region (body structure)'),
  },
  'bruising-right-wrist': {
    code: createCodingCode('297950039', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('9736006', 'Structure of right wrist region (body structure)'),
  },
  'bruising-left-forearm': {
    code: createCodingCode('297950040', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('66480008', 'Structure of left forearm (body structure)'),
  },
  'bruising-right-forearm': {
    code: createCodingCode('297950041', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('64262003', 'Structure of right forearm (body structure)'),
  },
  'bruising-left-elbow': {
    code: createCodingCode('297950042', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('368148009', 'Left elbow region structure (body structure)'),
  },
  'bruising-right-elbow': {
    code: createCodingCode('297950043', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('368149001', 'Right elbow region structure (body structure)'),
  },
  'bruising-left-upperarm': {
    code: createCodingCode('297950044', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('368208006', 'Left upper arm structure (body structure)'),
  },
  'bruising-right-upperarm': {
    code: createCodingCode('297950045', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('368209003', 'Right upper arm structure (body structure)'),
  },
  'bruising-left-shoulder': {
    code: createCodingCode('297950046', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('91775009', 'Structure of left shoulder region (body structure)'),
  },
  'bruising-right-shoulder': {
    code: createCodingCode('297950047', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('91774008', 'Structure of right shoulder region (body structure)'),
  },
  'bruising-left-knee': {
    code: createCodingCode('297950048', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('82169009', 'Structure of left knee region (body structure)'),
  },
  'bruising-right-knee': {
    code: createCodingCode('297950049', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('6757004', 'Structure of right knee region (body structure)'),
  },
  'bruising-left-lowerleg': {
    code: createCodingCode('297950050', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('48979004', 'Structure of left lower leg (body structure)'),
  },
  'bruising-right-lowerleg': {
    code: createCodingCode('297950051', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('32696007', 'Structure of right lower leg (body structure)'),
  },
  'bruising-left-ankle': {
    code: createCodingCode('297950052', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('51636004', 'Structure of left ankle (body structure)'),
  },
  'bruising-right-ankle': {
    code: createCodingCode('297950053', 'Finding related to bruising (finding)'),
    bodySite: createCodingCode('6685009', 'Structure of right ankle (body structure)'),
  },
  'abletobearweight-left-finger-index': {
    code: createCodingCode('249981007', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('770841009', 'Structure of left index finger (body structure)'),
  },
  'abletobearweight-right-finger-index': {
    code: createCodingCode('249981008', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('770842002', 'Structure of right index finger (body structure)'),
  },
  'abletobearweight-left-finger-middle': {
    code: createCodingCode('249981009', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('770884005', 'Structure of left middle finger (body structure)'),
  },
  'abletobearweight-right-finger-middle': {
    code: createCodingCode('249981010', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('770885006', 'Structure of right middle finger (body structure)'),
  },
  'abletobearweight-left-finger-ring': {
    code: createCodingCode('249981011', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('770882009', 'Structure of left ring finger (body structure)'),
  },
  'abletobearweight-right-finger-ring': {
    code: createCodingCode('249981012', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('770883004', 'Structure of right ring finger (body structure)'),
  },
  'abletobearweight-left-finger-little': {
    code: createCodingCode('249981015', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('762101005', 'Structure of left little finger (body structure)'),
  },
  'abletobearweight-right-finger-little': {
    code: createCodingCode('249981016', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('762102003', 'Structure of right little finger (body structure)'),
  },
  'abletobearweight-left-finger-thumb': {
    code: createCodingCode('249981017', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('734143007', 'Structure of left thumb (body structure)'),
  },
  'abletobearweight-right-finger-thumb': {
    code: createCodingCode('249981018', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('734144001', 'Structure of right thumb (body structure)'),
  },
  'abletobearweight-left-hand': {
    code: createCodingCode('249981019', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('85151006', 'Structure of left hand (body structure)'),
  },
  'abletobearweight-right-hand': {
    code: createCodingCode('249981020', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('78791008', 'Structure of right hand (body structure)'),
  },
  'abletobearweight-left-foot': {
    code: createCodingCode('249981021', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('239919000', 'Entire left foot (body structure)'),
  },
  'abletobearweight-right-foot': {
    code: createCodingCode('249981022', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('239830003', 'Entire right foot (body structure)'),
  },
  'abletobearweight-left-toe-great': {
    code: createCodingCode('249981025', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('723724004', 'Structure of left great toe (body structure)'),
  },
  'abletobearweight-right-toe-great': {
    code: createCodingCode('249981026', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('723730004', 'Structure of right great toe (body structure)'),
  },
  'abletobearweight-left-toe-second': {
    code: createCodingCode('249981027', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('1285624003', 'Structure of left second toe (body structure)'),
  },
  'abletobearweight-right-toe-second': {
    code: createCodingCode('249981028', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('1285623009', 'Structure of right second toe (body structure)'),
  },
  'abletobearweight-left-toe-third': {
    code: createCodingCode('249981029', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('1285627005', 'Structure of left third toe (body structure)'),
  },
  'abletobearweight-right-toe-third': {
    code: createCodingCode('249981030', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('1285628000', 'Structure of right third toe (body structure)'),
  },
  'abletobearweight-left-toe-fourth': {
    code: createCodingCode('249981031', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('1285632006', 'Structure of left fourth toe (body structure)'),
  },
  'abletobearweight-right-toe-fourth': {
    code: createCodingCode('249981032', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('1285633001', 'Structure of right fourth toe (body structure)'),
  },
  'abletobearweight-left-toe-fifth': {
    code: createCodingCode('249981033', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('895650002', 'Structure of fifth toe of left foot (body structure)'),
  },
  'abletobearweight-right-toe-fifth': {
    code: createCodingCode('249981034', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('895651003', 'Structure of fifth toe of right foot (body structure)'),
  },
  'abletobearweight-left-wrist': {
    code: createCodingCode('249981037', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('5951000', 'Structure of left wrist region (body structure)'),
  },
  'abletobearweight-right-wrist': {
    code: createCodingCode('249981038', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('9736006', 'Structure of right wrist region (body structure)'),
  },
  'abletobearweight-left-forearm': {
    code: createCodingCode('249981039', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('66480008', 'Structure of left forearm (body structure)'),
  },
  'abletobearweight-right-forearm': {
    code: createCodingCode('249981040', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('64262003', 'Structure of right forearm (body structure)'),
  },
  'abletobearweight-left-elbow': {
    code: createCodingCode('249981041', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('368148009', 'Left elbow region structure (body structure)'),
  },
  'abletobearweight-right-elbow': {
    code: createCodingCode('249981042', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('368149001', 'Right elbow region structure (body structure)'),
  },
  'abletobearweight-left-upperarm': {
    code: createCodingCode('249981043', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('368208006', 'Left upper arm structure (body structure)'),
  },
  'abletobearweight-right-upperarm': {
    code: createCodingCode('249981044', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('368209003', 'Right upper arm structure (body structure)'),
  },
  'abletobearweight-left-shoulder': {
    code: createCodingCode('249981045', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('91775009', 'Structure of left shoulder region (body structure)'),
  },
  'abletobearweight-right-shoulder': {
    code: createCodingCode('249981046', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('91774008', 'Structure of right shoulder region (body structure)'),
  },
  'abletobearweight-left-knee': {
    code: createCodingCode('249981047', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('82169009', 'Structure of left knee region (body structure)'),
  },
  'abletobearweight-right-knee': {
    code: createCodingCode('249981048', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('6757004', 'Structure of right knee region (body structure)'),
  },
  'abletobearweight-left-lowerleg': {
    code: createCodingCode('249981049', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('48979004', 'Structure of left lower leg (body structure)'),
  },
  'abletobearweight-right-lowerleg': {
    code: createCodingCode('249981050', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('32696007', 'Structure of right lower leg (body structure)'),
  },
  'abletobearweight-left-ankle': {
    code: createCodingCode('249981051', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('51636004', 'Structure of left ankle (body structure)'),
  },
  'abletobearweight-right-ankle': {
    code: createCodingCode('249981052', 'Weight-bearing (finding)'),
    bodySite: createCodingCode('6685009', 'Structure of right ankle (body structure)'),
  },
  'decreasedrom-left-finger-index': {
    code: createCodingCode('304309006', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('770841009', 'Structure of left index finger (body structure)'),
  },
  'decreasedrom-right-finger-index': {
    code: createCodingCode('304309007', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('770842002', 'Structure of right index finger (body structure)'),
  },
  'decreasedrom-left-finger-middle': {
    code: createCodingCode('304309008', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('770884005', 'Structure of left middle finger (body structure)'),
  },
  'decreasedrom-right-finger-middle': {
    code: createCodingCode('304309009', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('770885006', 'Structure of right middle finger (body structure)'),
  },
  'decreasedrom-left-finger-ring': {
    code: createCodingCode('304309010', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('770882009', 'Structure of left ring finger (body structure)'),
  },
  'decreasedrom-right-finger-ring': {
    code: createCodingCode('304309011', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('770883004', 'Structure of right ring finger (body structure)'),
  },
  'decreasedrom-left-finger-little': {
    code: createCodingCode('304309014', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('762101005', 'Structure of left little finger (body structure)'),
  },
  'decreasedrom-right-finger-little': {
    code: createCodingCode('304309015', 'Decreased range of finger movement (finding)'),
    bodySite: createCodingCode('762102003', 'Structure of right little finger (body structure)'),
  },
  'decreasedrom-left-finger-thumb': {
    code: createCodingCode('304313006', 'Decreased range of thumb movement (finding)'),
    bodySite: createCodingCode('734143007', 'Structure of left thumb (body structure)'),
  },
  'decreasedrom-right-finger-thumb': {
    code: createCodingCode('304313006', 'Decreased range of thumb movement (finding)'),
    bodySite: createCodingCode('734144001', 'Structure of right thumb (body structure)'),
  },
  'decreasedrom-left-hand': {
    code: createCodingCode('70733008', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('85151006', 'Structure of left hand (body structure)'),
  },
  'decreasedrom-right-hand': {
    code: createCodingCode('70733008', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('78791008', 'Structure of right hand (body structure)'),
  },
  'decreasedrom-left-foot': {
    code: createCodingCode('304330008', 'Decreased range of foot movement (finding)'),
    bodySite: createCodingCode('239919000', 'Entire left foot (body structure)'),
  },
  'decreasedrom-right-foot': {
    code: createCodingCode('304330008', 'Decreased range of foot movement (finding)'),
    bodySite: createCodingCode('239830003', 'Entire right foot (body structure)'),
  },
  'decreasedrom-left-toe-great': {
    code: createCodingCode('70733010', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('723724004', 'Structure of left great toe (body structure)'),
  },
  'decreasedrom-right-toe-great': {
    code: createCodingCode('70733011', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('723730004', 'Structure of right great toe (body structure)'),
  },
  'decreasedrom-left-toe-second': {
    code: createCodingCode('70733012', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('1285624003', 'Structure of left second toe (body structure)'),
  },
  'decreasedrom-right-toe-second': {
    code: createCodingCode('70733013', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('1285623009', 'Structure of right second toe (body structure)'),
  },
  'decreasedrom-left-toe-third': {
    code: createCodingCode('70733014', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('1285627005', 'Structure of left third toe (body structure)'),
  },
  'decreasedrom-right-toe-third': {
    code: createCodingCode('70733015', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('1285628000', 'Structure of right third toe (body structure)'),
  },
  'decreasedrom-left-toe-fourth': {
    code: createCodingCode('70733016', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('1285632006', 'Structure of left fourth toe (body structure)'),
  },
  'decreasedrom-right-toe-fourth': {
    code: createCodingCode('70733017', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('1285633001', 'Structure of right fourth toe (body structure)'),
  },
  'decreasedrom-left-toe-fifth': {
    code: createCodingCode('70733018', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('895650002', 'Structure of fifth toe of left foot (body structure)'),
  },
  'decreasedrom-right-toe-fifth': {
    code: createCodingCode('70733019', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('895651003', 'Structure of fifth toe of right foot (body structure)'),
  },
  'decreasedrom-left-wrist': {
    code: createCodingCode('304305005', 'Decreased range of wrist movement (finding)'),
    bodySite: createCodingCode('5951000', 'Structure of left wrist region (body structure)'),
  },
  'decreasedrom-right-wrist': {
    code: createCodingCode('304305005', 'Decreased range of wrist movement (finding)'),
    bodySite: createCodingCode('9736006', 'Structure of right wrist region (body structure)'),
  },
  'decreasedrom-left-forearm': {
    code: createCodingCode('70733008', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('66480008', 'Structure of left forearm (body structure)'),
  },
  'decreasedrom-right-forearm': {
    code: createCodingCode('70733008', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('64262003', 'Structure of right forearm (body structure)'),
  },
  'decreasedrom-left-elbow': {
    code: createCodingCode('304301001', 'Decreased range of elbow movement (finding)'),
    bodySite: createCodingCode('368148009', 'Left elbow region structure (body structure)'),
  },
  'decreasedrom-right-elbow': {
    code: createCodingCode('304301001', 'Decreased range of elbow movement (finding)'),
    bodySite: createCodingCode('368149001', 'Right elbow region structure (body structure)'),
  },
  'decreasedrom-left-upperarm': {
    code: createCodingCode('70733008', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('368208006', 'Left upper arm structure (body structure)'),
  },
  'decreasedrom-right-upperarm': {
    code: createCodingCode('70733009', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('368209003', 'Right upper arm structure (body structure)'),
  },
  'decreasedrom-left-shoulder': {
    code: createCodingCode('70733010', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('91775009', 'Structure of left shoulder region (body structure)'),
  },
  'decreasedrom-right-shoulder': {
    code: createCodingCode('70733011', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('91774008', 'Structure of right shoulder region (body structure)'),
  },
  'decreasedrom-left-knee': {
    code: createCodingCode('70733012', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('82169009', 'Structure of left knee region (body structure)'),
  },
  'decreasedrom-right-knee': {
    code: createCodingCode('70733013', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('6757004', 'Structure of right knee region (body structure)'),
  },
  'decreasedrom-left-lowerleg': {
    code: createCodingCode('70733014', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('48979004', 'Structure of left lower leg (body structure)'),
  },
  'decreasedrom-right-lowerleg': {
    code: createCodingCode('70733015', 'Limitation of joint movement (finding)'),
    bodySite: createCodingCode('32696007', 'Structure of right lower leg (body structure)'),
  },
  'decreasedrom-left-ankle': {
    code: createCodingCode('304326005', 'Decreased range of ankle movement (finding)'),
    bodySite: createCodingCode('51636004', 'Structure of left ankle (body structure)'),
  },
  'decreasedrom-right-ankle': {
    code: createCodingCode('304326005', 'Decreased range of ankle movement (finding)'),
    bodySite: createCodingCode('6685009', 'Structure of right ankle (body structure)'),
  },
  // >>> CARD = neurological
  // >> GROUP = normal
  'normal-mental-status': {
    code: createCodingCode('17326005', 'Well in self (finding)'),
  },
  // >>> CARD = psych
  // >> GROUP = normal
  'normal-affect': {
    code: createCodingCode('134417007', 'Level of mood - normal (finding)'),
  },
  'good-eye-contact': {
    code: createCodingCode('400968009', 'Maintains good eye contact (finding)'),
  },
  // >> GROUP = abnormal
  'depressed-affect': {
    code: createCodingCode('366979004', 'Depressed mood (finding)'),
  },
  'poor-eye-contact': {
    code: createCodingCode('412786000', 'Poor eye contact (finding)'),
  },
};
