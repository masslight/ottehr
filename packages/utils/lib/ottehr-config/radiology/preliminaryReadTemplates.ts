import type { PreliminaryReadTemplatesConfig } from 'config-types/config/radiology';

// Fracture descriptors shared by every extremity: adult types first, then the pediatric ones (children only).
const PEDIATRIC_FRACTURE_TYPES = ['Buckle (torus)', 'Greenstick', 'Salter-Harris I', 'Salter-Harris II'];
const FRACTURE_TYPES = [
  'Nondisplaced',
  'Minimally displaced',
  'Displaced',
  'Angulated',
  'Comminuted',
  'Avulsion',
  ...PEDIATRIC_FRACTURE_TYPES,
];
const FX_TYPE = { title: 'Fracture type', options: FRACTURE_TYPES, childOnlyOptions: PEDIATRIC_FRACTURE_TYPES };

const NONE = '';

/**
 * Template sentences offered above the Preliminary Read field, keyed by body region. Wording follows the
 * conventional plain-film read; choice lists are ordered most-common-first. `{side}` is supplied by the
 * order's laterality, every other `{blank}` names an entry in `choices`.
 */
export const PRELIMINARY_READ_TEMPLATES: PreliminaryReadTemplatesConfig = {
  choices: {
    // ---- shared ----
    negOpening: { title: 'Opening', options: ['No acute fracture or dislocation.', 'No acute osseous abnormality.'] },
    incidental: {
      title: 'Incidental finding',
      options: [
        NONE,
        'Soft-tissue swelling without underlying fracture.',
        'Degenerative changes, no acute findings.',
        'Postsurgical hardware in place and intact.',
        'Radiopaque foreign body in the soft tissues at the site of concern.',
      ],
    },
    physes: {
      title: 'Growth plates (children only)',
      childOnly: true,
      options: ['Growth plates appear normal.', NONE],
    },
    growthPlate: {
      title: 'Growth plate (children only)',
      childOnly: true,
      options: ['Growth plate not involved.', 'Extends to the growth plate.', NONE],
    },
    fxType: FX_TYPE,
    fxTypeBuckle: { ...FX_TYPE, childDefault: 'Buckle (torus)' },
    fxTypeSalter: { ...FX_TYPE, childDefault: 'Salter-Harris I' },
    fxClose: { title: 'Closing line', options: ['No dislocation. Alignment maintained.', 'No dislocation.', NONE] },
    effusion: { title: 'Joint effusion', options: [NONE, 'Joint effusion present.'] },
    ray: { title: 'Ray', options: ['5th', '4th', '3rd', '2nd', '1st'] },
    shaftSite: { title: 'Site', options: ['base', 'shaft', 'neck', 'head'] },
    phalanx: { title: 'Phalanx', options: ['proximal phalanx', 'middle phalanx', 'distal phalanx (tuft)'] },
    // ---- chest ----
    chestNeg: {
      title: 'Opening',
      options: [
        'No focal consolidation, pleural effusion or pneumothorax. Heart size normal. No acute cardiopulmonary process.',
        'No acute cardiopulmonary process.',
      ],
    },
    chestIncidental: {
      title: 'Incidental finding',
      options: [
        NONE,
        'Mild peribronchial thickening, which can be seen with bronchitis or a viral process.',
        'Mild scoliosis.',
        'Mild degenerative changes of the thoracic spine.',
        'Postsurgical changes.',
      ],
    },
    opacity: {
      title: 'Opacity',
      options: [
        'Focal airspace opacity',
        'Patchy airspace opacities',
        'Consolidation',
        'Streaky interstitial opacities',
      ],
    },
    lobe: {
      title: 'Location',
      options: [
        'right lower lobe',
        'left lower lobe',
        'right middle lobe',
        'right upper lobe',
        'left upper lobe',
        'lingula',
        'bilateral lower lobes',
        'both lungs',
      ],
    },
    pleura: { title: 'Pleura', options: ['No pleural effusion or pneumothorax.', 'Small pleural effusion.', NONE] },
    edema: {
      title: 'Finding',
      options: [
        'Findings suggestive of pulmonary edema.',
        'Cardiomegaly with pulmonary vascular congestion.',
        'Cardiomegaly without acute findings.',
      ],
    },
    edemaPleura: { title: 'Pleura', options: ['No focal consolidation.', 'Small bilateral pleural effusions.', NONE] },
    // ---- ribs ----
    rib: {
      title: 'Rib',
      options: ['5th', '6th', '7th', '8th', '9th', '10th', '4th', '3rd', '2nd', '11th', '12th', '1st'],
    },
    ribPleura: {
      title: 'Pleura',
      options: ['No pneumothorax or pleural effusion.', 'Small pneumothorax.', 'Small pleural effusion.', NONE],
    },
    // ---- spine ----
    cspineIncidental: {
      title: 'Incidental finding',
      options: [
        NONE,
        'Degenerative changes, no acute findings.',
        'Loss of the normal cervical lordosis, likely positional or due to muscle spasm.',
        'Postsurgical hardware in place and intact.',
      ],
    },
    spineIncidental: {
      title: 'Incidental finding',
      options: [
        NONE,
        'Degenerative changes, no acute findings.',
        'Mild scoliosis.',
        'Postsurgical hardware in place and intact.',
        'Transitional lumbosacral anatomy.',
      ],
    },
    cervicalLevel: { title: 'Level', options: ['C2', 'C5', 'C6', 'C7', 'C1', 'C3', 'C4'] },
    thoracicLevel: {
      title: 'Level',
      options: ['T12', 'T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'],
    },
    lumbarLevel: { title: 'Level', options: ['L1', 'L2', 'L3', 'L4', 'L5'] },
    compression: {
      title: 'Fracture',
      options: [
        'Mild (<25%) anterior wedge compression fracture',
        'Moderate (25-50%) compression fracture',
        'Compression fracture',
      ],
    },
    compressionAge: {
      title: 'Acuity',
      options: [
        'Age indeterminate; recommend correlation with prior imaging or CT.',
        'Appears chronic.',
        'Appears acute.',
        NONE,
      ],
    },
    sacrumSite: { title: 'Site', options: ['coccyx', 'distal sacrum', 'sacral ala'] },
    // ---- pelvis / lower extremity ----
    hipBone: {
      title: 'Bone',
      options: ['femoral neck', 'intertrochanteric femur', 'pubic ramus', 'acetabulum', 'greater trochanter'],
    },
    femurSite: { title: 'Site', options: ['mid-shaft', 'distal', 'proximal'] },
    kneeBone: {
      title: 'Bone',
      options: ['patella', 'tibial plateau', 'proximal fibula (head/neck)', 'distal femur', 'tibial tuberosity'],
    },
    legBone: {
      title: 'Bone',
      options: ['tibial shaft', 'fibular shaft', 'proximal fibula', 'distal tibia', 'distal fibula'],
    },
    ankleIncidental: {
      title: 'Soft tissue',
      options: [
        NONE,
        'Soft-tissue swelling over the lateral malleolus.',
        'Soft-tissue swelling over the medial malleolus.',
        'Degenerative changes, no acute findings.',
      ],
    },
    ankleBone: {
      title: 'Bone',
      options: [
        'distal fibula (lateral malleolus)',
        'medial malleolus',
        'posterior malleolus',
        'distal tibia',
        'base of the 5th metatarsal',
      ],
    },
    ankleClose: { title: 'Closing line', options: ['Ankle mortise intact.', 'Widening of the ankle mortise.', NONE] },
    footBone: { title: 'Bone', options: ['metatarsal', 'proximal phalanx', 'middle phalanx', 'distal phalanx'] },
    calcaneusSite: { title: 'Site', options: ['tuberosity', 'body', 'anterior process'] },
    toe: { title: 'Toe', options: ['5th toe', '4th toe', '3rd toe', '2nd toe', 'great toe'] },
    // ---- upper extremity ----
    shoulderBone: {
      title: 'Bone',
      options: [
        'mid-shaft clavicle',
        'distal (lateral) clavicle',
        'proximal humerus',
        'greater tuberosity of the humerus',
        'scapular body',
      ],
    },
    dislocation: { title: 'Direction', options: ['Anterior', 'Posterior', 'Inferior'] },
    dislocationFx: { title: 'Associated fracture', options: ['No associated fracture identified.', NONE] },
    humerusSite: { title: 'Site', options: ['proximal', 'mid-shaft', 'distal'] },
    elbowBone: {
      title: 'Bone',
      options: ['radial head/neck', 'supracondylar humerus', 'olecranon', 'lateral condyle', 'medial epicondyle'],
    },
    fatPads: { title: 'Fat pads', options: ['Elevated fat pads consistent with joint effusion.', NONE] },
    forearmBone: {
      title: 'Bone',
      options: ['distal radius', 'ulnar shaft', 'radial shaft', 'radial head/neck', 'distal ulna'],
    },
    wristBone: {
      title: 'Bone',
      options: ['distal radius', 'radial styloid', 'ulnar styloid', 'scaphoid', 'distal ulna'],
    },
    wristClose: {
      title: 'Closing line',
      options: ['No dislocation. Alignment maintained.', 'Mild dorsal angulation.', 'No dislocation.', NONE],
    },
    finger: {
      title: 'Finger',
      options: ['5th (small) finger', '4th (ring) finger', '3rd (long) finger', '2nd (index) finger', 'thumb'],
    },
    // ---- abdomen ----
    kubIncidental: { title: 'Incidental finding', options: [NONE, 'Mild stool burden.', 'Phleboliths in the pelvis.'] },
    stoolBurden: { title: 'Stool burden', options: ['Moderate', 'Moderate-to-large', 'Large', 'Mild'] },
    fbLocation: { title: 'Location', options: ['stomach', 'small bowel', 'colon', 'pelvis'] },
    // ---- face ----
    facialBones: { title: 'Bones', options: ['nasal bones', 'facial bones'] },
    facialSite: {
      title: 'Site',
      options: ['nasal bones', 'zygomatic arch', 'orbital floor', 'lateral wall of the maxillary sinus'],
    },
  },
  regions: [
    {
      name: 'Chest',
      cptCodes: ['71045', '71046', '71047', '71048'],
      templates: [
        { name: 'Negative', text: '{chestNeg} {chestIncidental}' },
        { name: 'Pneumonia', text: '{opacity} in the {lobe} concerning for pneumonia. {pleura}' },
        { name: 'Pulmonary edema', text: '{edema} {edemaPleura}' },
      ],
    },
    {
      name: 'Ribs',
      cptCodes: ['71100', '71101', '71110', '71111'],
      templates: [
        { name: 'Negative', text: 'No acute rib fracture identified. No pneumothorax or pleural effusion.' },
        { name: 'Rib fracture', text: '{fxType} fracture of the {side} {rib} rib. {ribPleura}' },
      ],
    },
    {
      name: 'Cervical spine',
      cptCodes: ['72040', '72050', '72052'],
      templates: [
        {
          name: 'Negative',
          text: 'Normal alignment. No acute fracture or dislocation of the cervical spine. Prevertebral soft tissues normal. {cspineIncidental}',
        },
        {
          name: 'Possible fracture',
          text: 'Possible fracture at {cervicalLevel}. Recommend CT for further evaluation.',
        },
      ],
    },
    {
      name: 'Thoracic spine',
      cptCodes: ['72070', '72072', '72074'],
      templates: [
        { name: 'Negative', text: 'Normal alignment. No acute fracture of the thoracic spine. {spineIncidental}' },
        { name: 'Compression fracture', text: '{compression} of {thoracicLevel}. {compressionAge}' },
      ],
    },
    {
      name: 'Lumbar spine',
      cptCodes: ['72100', '72110', '72114', '72120'],
      templates: [
        {
          name: 'Negative',
          text: 'Normal alignment. No acute fracture or listhesis of the lumbar spine. {spineIncidental}',
        },
        { name: 'Compression fracture', text: '{compression} of {lumbarLevel}. {compressionAge}' },
      ],
    },
    {
      name: 'Sacrum and coccyx',
      cptCodes: ['72220'],
      templates: [
        { name: 'Negative', text: 'No acute fracture of the sacrum or coccyx. {incidental}' },
        { name: 'Fracture', text: '{fxType} fracture of the {sacrumSite}.' },
      ],
    },
    {
      name: 'Pelvis and hip',
      cptCodes: ['72170', '72190', '73501', '73502', '73503', '73521', '73522', '73523'],
      templates: [
        { name: 'Negative', text: 'No acute fracture or dislocation of the pelvis or hips. {incidental}' },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {hipBone}.' },
      ],
    },
    {
      name: 'Femur',
      cptCodes: ['73551', '73552'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {femurSite} femur. {growthPlate} {fxClose}' },
      ],
    },
    {
      name: 'Knee',
      cptCodes: ['73560', '73562', '73564', '73565'],
      templates: [
        {
          name: 'Negative',
          text: '{negOpening} Alignment and joint spaces maintained. {effusion} {incidental} {physes}',
        },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {kneeBone}. {effusion} {growthPlate} {fxClose}' },
      ],
    },
    {
      name: 'Tibia and fibula',
      cptCodes: ['73590'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {legBone}. {growthPlate} {fxClose}' },
      ],
    },
    {
      name: 'Ankle',
      cptCodes: ['73600', '73610'],
      templates: [
        { name: 'Negative', text: '{negOpening} Ankle mortise intact. {ankleIncidental} {physes}' },
        { name: 'Fracture', text: '{fxTypeSalter} fracture of the {side} {ankleBone}. {growthPlate} {ankleClose}' },
      ],
    },
    {
      name: 'Foot',
      cptCodes: ['73620', '73630'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment and joint spaces maintained. {incidental} {physes}' },
        {
          name: 'Fracture',
          text: '{fxType} fracture of the {shaftSite} of the {side} {ray} {footBone}. {growthPlate} {fxClose}',
        },
      ],
    },
    {
      name: 'Heel',
      cptCodes: ['73650'],
      templates: [
        { name: 'Negative', text: 'No acute fracture of the {side} calcaneus. {incidental}' },
        { name: 'Fracture', text: '{fxType} fracture of the {side} calcaneal {calcaneusSite}.' },
      ],
    },
    {
      name: 'Toes',
      cptCodes: ['73660'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment and joint spaces maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxType} fracture of the {phalanx} of the {side} {toe}. {growthPlate} {fxClose}' },
      ],
    },
    {
      name: 'Shoulder and clavicle',
      cptCodes: ['73000', '73010', '73020', '73030'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment and joint spaces maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {shoulderBone}. {growthPlate} {fxClose}' },
        { name: 'Dislocation', text: '{dislocation} dislocation of the {side} shoulder. {dislocationFx}' },
        {
          name: 'AC separation',
          text: 'Widening of the {side} acromioclavicular joint consistent with AC separation. No fracture.',
        },
      ],
    },
    {
      name: 'Humerus',
      cptCodes: ['73060'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {humerusSite} humerus. {growthPlate} {fxClose}' },
      ],
    },
    {
      name: 'Elbow',
      cptCodes: ['73070', '73080'],
      templates: [
        {
          name: 'Negative',
          text: '{negOpening} Alignment and joint spaces maintained. {effusion} {incidental} {physes}',
        },
        {
          name: 'Fat pad sign',
          text: 'Elevated anterior and posterior fat pads consistent with joint effusion, without visible fracture; occult fracture possible.',
        },
        { name: 'Fracture', text: '{fxType} fracture of the {side} {elbowBone}. {fatPads} {growthPlate} {fxClose}' },
      ],
    },
    {
      name: 'Forearm',
      cptCodes: ['73090'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxTypeBuckle} fracture of the {side} {forearmBone}. {growthPlate} {wristClose}' },
        {
          name: 'Both-bone fracture',
          text: '{fxTypeBuckle} fractures of the {side} distal radius and ulna. {growthPlate} {wristClose}',
        },
      ],
    },
    {
      name: 'Wrist',
      cptCodes: ['73100', '73110'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment and joint spaces maintained. {incidental} {physes}' },
        { name: 'Fracture', text: '{fxTypeBuckle} fracture of the {side} {wristBone}. {growthPlate} {wristClose}' },
        {
          name: 'Radius and ulna fracture',
          text: '{fxTypeBuckle} fractures of the {side} distal radius and ulna. {growthPlate} {wristClose}',
        },
      ],
    },
    {
      name: 'Hand',
      cptCodes: ['73120', '73130'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment and joint spaces maintained. {incidental} {physes}' },
        {
          name: 'Metacarpal fracture',
          text: '{fxType} fracture of the {shaftSite} of the {side} {ray} metacarpal. {growthPlate} {fxClose}',
        },
        {
          name: 'Phalanx fracture',
          text: '{fxType} fracture of the {phalanx} of the {side} {finger}. {growthPlate} {fxClose}',
        },
      ],
    },
    {
      name: 'Finger',
      cptCodes: ['73140'],
      templates: [
        { name: 'Negative', text: '{negOpening} Alignment and joint spaces maintained. {incidental} {physes}' },
        {
          name: 'Fracture',
          text: '{fxType} fracture of the {phalanx} of the {side} {finger}. {growthPlate} {fxClose}',
        },
      ],
    },
    {
      name: 'Abdomen (KUB)',
      cptCodes: ['74018', '74019', '74021', '74022'],
      templates: [
        {
          name: 'Negative',
          text: 'Nonobstructive bowel gas pattern. No free air. No radiopaque foreign body. {kubIncidental}',
        },
        {
          name: 'Increased stool burden',
          text: '{stoolBurden} colonic stool burden consistent with constipation. No evidence of obstruction or free air.',
        },
        {
          name: 'Foreign body',
          text: 'Radiopaque foreign body projecting over the {fbLocation}. No evidence of obstruction or free air.',
        },
      ],
    },
    {
      name: 'Facial and nasal bones',
      cptCodes: ['70140', '70150', '70160'],
      templates: [
        { name: 'Negative', text: 'No acute fracture of the {facialBones}. {incidental}' },
        { name: 'Fracture', text: '{fxType} fracture of the {facialSite}.' },
      ],
    },
  ],
};
