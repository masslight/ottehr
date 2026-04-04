/**
 * Test cases for the HPI chatbot feature.
 *
 * Each case represents a patient chat transcript and the clinically expected
 * extraction. The `expected` field is used as reference_outputs by the
 * LLM-as-judge evaluator.
 */

export interface HpiChatbotCase {
  id: string;
  description: string;
  patientInfo: string;
  transcript: string;
  expected: Record<string, unknown>;
}

export const HPI_CHATBOT_CASES: HpiChatbotCase[] = [
  {
    id: 'chest_pain_adult',
    description: 'Adult with chest pain, multiple comorbidities',
    patientInfo: 'Age: 58 year old, Sex: male',
    transcript: [
      'Provider: What brings you in today?',
      "Patient: I've been having chest pain for the last two days.",
      'Provider: Can you describe the pain?',
      "Patient: It's a pressure-like feeling in the center of my chest. It gets worse when I walk up stairs or exert myself.",
      'Provider: Does anything make it better?',
      'Patient: Resting helps. It usually goes away after about 10 minutes of sitting down.',
      'Provider: Any shortness of breath, nausea, or sweating?',
      'Patient: No shortness of breath. No nausea or sweating either.',
      'Provider: Do you have any medical conditions?',
      'Patient: I have high blood pressure and type 2 diabetes. I also had my gallbladder removed in 2018.',
      'Provider: What medications are you taking?',
      'Patient: Lisinopril 10mg, I took it this morning around 8am. Also Metformin 500mg twice a day and baby aspirin.',
      'Provider: Any allergies?',
      'Patient: Penicillin gives me a rash. And I\'m allergic to sulfa drugs too.',
      'Provider: Any family history of heart disease?',
      'Patient: My father had a heart attack at 62. My mother had breast cancer.',
      'Provider: Do you smoke or drink?',
      'Patient: I quit smoking 5 years ago. I have a beer occasionally on weekends.',
      'Provider: Any hospitalizations?',
      'Patient: I was hospitalized for pneumonia in January 2023.',
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 58-year-old male presenting with chest pain for 2 days. ' +
        'He describes a pressure-like sensation in the center of his chest that worsens ' +
        'with exertion such as climbing stairs and improves with rest, typically resolving ' +
        'after about 10 minutes. He denies shortness of breath, nausea, or diaphoresis.',
      pastMedicalHistory: ['hypertension', 'type 2 diabetes'],
      pastSurgicalHistory: ['cholecystectomy 2018'],
      medicationsHistory: ['Lisinopril 10mg, last taken today 08:00', 'Metformin 500mg', 'Aspirin 81mg'],
      allergies: ['Penicillin - rash', 'Sulfa drugs'],
      socialHistory: ['former smoker, quit 5 years ago', 'occasional alcohol'],
      familyHistory: ['father - heart attack at age 62', 'mother - breast cancer'],
      hospitalizationsHistory: ['pneumonia January 2023'],
    },
  },
  {
    id: 'pediatric_ear_pain',
    description: 'Pediatric patient with ear pain, parent reporting',
    patientInfo: 'Age: 4 year old, Sex: female',
    transcript: [
      "Provider: What's going on with your daughter today?",
      "Parent: She's been pulling at her right ear and crying since yesterday. She had a fever of 101.5 this morning.",
      'Provider: Has she had any cold symptoms?',
      "Parent: Yes, she's had a runny nose for about a week now.",
      'Provider: Any ear infections before?',
      'Parent: She had one about 6 months ago. They gave her amoxicillin and it cleared up.',
      'Provider: Is she taking any medications right now?',
      "Parent: Just Children's Tylenol for the fever. I gave her some about two hours ago.",
      'Provider: Any allergies?',
      'Parent: No allergies that we know of.',
      'Provider: Any other medical conditions or surgeries?',
      "Parent: No, she's been healthy otherwise.",
      'Provider: Any family history of ear problems?',
      'Parent: Her older brother had tubes put in when he was 3.',
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 4-year-old female presenting with right ear pain since yesterday. ' +
        'She has been pulling at her right ear and crying. She had a fever of 101.5°F this morning. ' +
        'She has had rhinorrhea for approximately one week. She has a history of a prior ear ' +
        'infection approximately 6 months ago that was treated with amoxicillin.',
      pastMedicalHistory: ['prior ear infection'],
      medicationsHistory: ["Children's Tylenol (acetaminophen), last taken 2 hours ago"],
      familyHistory: ['brother - ear tubes (tympanostomy)'],
    },
  },
  {
    id: 'laceration_simple',
    description: 'Simple laceration, minimal medical history',
    patientInfo: 'Age: 32 year old, Sex: male',
    transcript: [
      'Provider: What happened?',
      'Patient: I was cutting vegetables and the knife slipped. I cut my left index finger.',
      'Provider: When did this happen?',
      'Patient: About an hour ago.',
      'Provider: Is there any numbness or tingling in the finger?',
      "Patient: No, it just hurts. I can move it fine.",
      'Provider: How would you rate the pain, 1 to 10?',
      'Patient: About a 6.',
      'Provider: Any medical conditions or medications?',
      "Patient: None. I'm healthy.",
      'Provider: Any allergies?',
      'Patient: No allergies.',
      'Provider: When was your last tetanus shot?',
      'Patient: I think about 3 years ago.',
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 32-year-old male presenting with a laceration to the left index ' +
        'finger sustained approximately one hour ago while cutting vegetables. He reports ' +
        'pain rated 6 out of 10. He denies numbness or tingling and has full range of motion ' +
        'in the affected finger.',
    },
  },
  {
    id: 'abdominal_pain_complex',
    description: 'Complex abdominal pain with extensive history',
    patientInfo: 'Age: 45 year old, Sex: female',
    transcript: [
      'Provider: What brings you in today?',
      "Patient: I've had really bad stomach pain for the last three days. It's in the right lower part of my belly.",
      'Provider: Can you describe the pain? Is it sharp, dull, crampy?',
      "Patient: It started as a dull ache around my belly button but now it's sharp and it's moved to the right lower side.",
      'Provider: Any nausea or vomiting?',
      "Patient: Yes, I've thrown up twice today. I also haven't had much appetite.",
      'Provider: Any fever?',
      'Patient: I checked this morning and it was 100.8.',
      'Provider: Any diarrhea or constipation?',
      "Patient: I haven't had a bowel movement in two days.",
      'Provider: Any medical history?',
      'Patient: I have hypothyroidism and GERD. I had a C-section in 2015.',
      'Provider: What medications do you take?',
      'Patient: Levothyroxine 75mcg every morning, and omeprazole 20mg.',
      'Provider: Allergies?',
      'Patient: Codeine makes me really nauseous. And latex gives me hives.',
      "Provider: Anyone in the family with GI issues?",
      'Patient: My mother had colon cancer at 60.',
      'Provider: Do you smoke or drink alcohol?',
      "Patient: I don't smoke. I have wine with dinner a few times a week.",
      'Provider: Any recent hospitalizations?',
      'Patient: No.',
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 45-year-old female presenting with abdominal pain for 3 days. ' +
        'The pain initially started as a dull ache periumbilically and has since migrated ' +
        'to the right lower quadrant, where it is now sharp in character. Associated symptoms ' +
        'include nausea with two episodes of vomiting today, decreased appetite, constipation ' +
        'for 2 days, and a low-grade fever of 100.8°F.',
      pastMedicalHistory: ['hypothyroidism', 'GERD'],
      pastSurgicalHistory: ['cesarean section 2015'],
      medicationsHistory: ['Levothyroxine 75mcg', 'Omeprazole 20mg'],
      allergies: ['Codeine - nausea', 'Latex - hives'],
      socialHistory: ['non-smoker', 'occasional alcohol'],
      familyHistory: ['mother - colon cancer at age 60'],
    },
  },
  {
    id: 'minimal_info',
    description: 'Patient provides very little information',
    patientInfo: 'Age: 22 year old, Sex: male',
    transcript: [
      'Provider: What brings you in today?',
      'Patient: I have a sore throat.',
      'Provider: How long have you had it?',
      'Patient: Since yesterday.',
      'Provider: Any fever?',
      "Patient: I don't think so.",
      'Provider: Any other symptoms? Cough, runny nose?',
      'Patient: No.',
      'Provider: Any medical conditions, medications, or allergies?',
      'Patient: No, nothing.',
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 22-year-old male presenting with sore throat since yesterday. ' +
        'He denies fever, cough, and rhinorrhea.',
    },
  },
];
