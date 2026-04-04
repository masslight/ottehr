/**
 * Test cases for the ambient scribe feature.
 *
 * Each case simulates a provider-patient conversation transcript as would be
 * generated from an audio recording. These are more natural/conversational
 * than the chatbot cases and include provider clinical observations and
 * treatment plans (labs, erx, procedures).
 */

export interface AmbientScribeCase {
  id: string;
  description: string;
  patientInfo: string;
  isWorkersComp?: boolean;
  transcript: string;
  expected: Record<string, unknown>;
}

export const AMBIENT_SCRIBE_CASES: AmbientScribeCase[] = [
  {
    id: 'ankle_sprain_visit',
    description: 'In-person visit for ankle sprain with exam findings and treatment',
    patientInfo: 'Age: 28 year old, Sex: female',
    transcript: [
      "Provider: Hi, I'm Dr. Smith. What happened to your ankle?",
      "Patient: I was playing basketball last night and landed on someone's foot. My right ankle just rolled under me.",
      'Provider: When exactly did this happen?',
      'Patient: Around 8pm last night, so about 14 hours ago.',
      "Provider: How's the pain? Scale of 1 to 10?",
      "Patient: It's about a 7 right now. It's really swollen.",
      'Provider: Can you put weight on it?',
      "Patient: I can a little bit but it really hurts. I've been using crutches my roommate had.",
      'Provider: Have you iced it or taken anything for the pain?',
      'Patient: I iced it last night and took some ibuprofen 400mg about 4 hours ago.',
      'Provider: Any previous ankle injuries?',
      'Patient: I sprained the same ankle about 2 years ago playing soccer.',
      'Provider: Any medical conditions, medications, allergies?',
      'Patient: I take birth control pills. No allergies. No other medical problems.',
      'Provider: OK, let me examine your ankle. I see significant swelling and ecchymosis over the lateral malleolus. Tender over the ATFL. Negative squeeze test. Anterior drawer is mildly positive. Let\'s get an X-ray to rule out a fracture.',
      'Patient: OK.',
      "Provider: X-ray is back and it's negative for fracture. This looks like a grade 2 lateral ankle sprain. I'm going to put you in an air stirrup brace. I want you to follow RICE protocol. I'll prescribe naproxen 500mg twice a day for pain.",
      'Patient: How long until I can play basketball again?',
      'Provider: Typically 4-6 weeks. Follow up with orthopedics in one week.',
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 28-year-old female presenting with right ankle pain after an ' +
        'inversion injury sustained while playing basketball approximately 14 hours ago. ' +
        'She reports pain of 7/10 with significant swelling. She is able to bear weight ' +
        'minimally. She has been using ice and took ibuprofen 400mg approximately 4 hours ' +
        'prior to presentation. She has a history of a right ankle sprain 2 years ago.',
      pastMedicalHistory: ['prior right ankle sprain 2 years ago'],
      medicationsHistory: ['oral contraceptive pills', 'Ibuprofen 400mg, last taken 4 hours ago'],
      erx: ['Naproxen 500mg'],
      procedures: ['air stirrup brace application'],
      labs: ['X-ray right ankle'],
    },
  },
  {
    id: 'uti_visit',
    description: 'UTI visit with labs ordered and prescription',
    patientInfo: 'Age: 35 year old, Sex: female',
    transcript: [
      "Provider: What's going on today?",
      "Patient: I've been having burning when I pee for the past two days. I also feel like I have to go all the time but only a little comes out.",
      'Provider: Any blood in your urine?',
      'Patient: I noticed a little bit of pink yesterday.',
      'Provider: Any fever, back pain, or nausea?',
      'Patient: No fever. No back pain. Just uncomfortable.',
      'Provider: Have you had UTIs before?',
      'Patient: Yes, I had one about a year ago. They gave me Bactrim and it worked.',
      'Provider: Any medical conditions?',
      'Patient: Just seasonal allergies.',
      'Provider: Medications?',
      'Patient: Cetirizine 10mg daily and a multivitamin.',
      'Provider: Any drug allergies?',
      'Patient: Amoxicillin gives me a rash.',
      "Provider: OK let's get a urinalysis and a urine culture. I'm going to start you on trimethoprim-sulfamethoxazole 160/800mg twice daily for 3 days. We'll adjust if the culture shows resistance.",
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 35-year-old female presenting with dysuria and urinary frequency ' +
        'for 2 days. She reports mild hematuria noticed yesterday. She denies fever, flank ' +
        'pain, and nausea. She has a history of a prior UTI approximately 1 year ago that ' +
        'responded to trimethoprim-sulfamethoxazole.',
      pastMedicalHistory: ['seasonal allergies', 'prior UTI'],
      medicationsHistory: ['Cetirizine 10mg', 'multivitamin'],
      allergies: ['Amoxicillin - rash'],
      labs: ['urinalysis', 'urine culture'],
      erx: ['trimethoprim-sulfamethoxazole 160/800mg'],
    },
  },
  {
    id: 'elderly_fall',
    description: 'Elderly patient fall with multiple comorbidities and polypharmacy',
    patientInfo: 'Age: 78 year old, Sex: male',
    transcript: [
      'Provider: Hi Mr. Johnson, I understand you had a fall today?',
      'Patient: Yes, I was getting up from my chair and felt dizzy. Next thing I know I was on the floor.',
      'Provider: Did you hit your head?',
      "Patient: I don't think so. I landed on my right hip and my right wrist.",
      'Provider: Did you lose consciousness?',
      'Patient: No, I was awake the whole time. My wife helped me up.',
      "Provider: How's the pain?",
      'Patient: My hip is sore, maybe a 5 out of 10. My wrist hurts too, about a 4.',
      'Provider: Have you fallen before?',
      'Patient: I fell once about 3 months ago but I was fine then.',
      'Provider: Any dizziness or lightheadedness regularly?',
      'Patient: Sometimes when I stand up too fast.',
      'Provider: Tell me about your medical history.',
      'Patient: I have atrial fibrillation, hypertension, type 2 diabetes, and chronic kidney disease. I also had a knee replacement on my left side in 2020.',
      'Provider: And your medications?',
      'Patient: Let me look at my list... Apixaban 5mg twice a day, metoprolol 50mg twice a day, lisinopril 20mg once a day, amlodipine 5mg once a day, metformin 1000mg twice a day, and insulin glargine 20 units at bedtime.',
      'Provider: Allergies?',
      'Patient: ACE inhibitors make me cough. And iodine contrast dye.',
      'Provider: Family history?',
      'Patient: My father had a stroke. My mother had diabetes.',
      'Provider: Do you smoke or drink?',
      'Patient: Never smoked. I stopped drinking years ago.',
      'Provider: Any hospitalizations?',
      'Patient: I was in the hospital last year for my afib, they did a cardioversion. And the knee surgery in 2020.',
      "Provider: OK, let me examine you. Let's get X-rays of the right hip and right wrist. We'll also do a CBC and BMP to check your blood counts and electrolytes given the dizziness.",
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 78-year-old male presenting after a fall from standing. He reports ' +
        'feeling dizzy while rising from a chair and fell onto his right hip and right wrist. ' +
        'He denies loss of consciousness and head strike. He reports right hip pain of 5/10 ' +
        'and right wrist pain of 4/10. He has a history of a prior fall approximately 3 months ' +
        'ago without injury. He reports intermittent orthostatic dizziness.',
      pastMedicalHistory: ['atrial fibrillation', 'hypertension', 'type 2 diabetes', 'chronic kidney disease'],
      pastSurgicalHistory: ['left total knee replacement 2020'],
      medicationsHistory: [
        'Apixaban 5mg',
        'Metoprolol 50mg',
        'Lisinopril 20mg',
        'Amlodipine 5mg',
        'Metformin 1000mg',
        'Insulin glargine 20 units',
      ],
      allergies: ['ACE inhibitors - cough', 'iodine contrast dye'],
      socialHistory: ['never smoker', 'no alcohol use'],
      familyHistory: ['father - stroke', 'mother - diabetes'],
      hospitalizationsHistory: ['atrial fibrillation cardioversion last year', 'left knee replacement 2020'],
      labs: ['CBC', 'BMP', 'X-ray right hip', 'X-ray right wrist'],
    },
  },
  {
    id: 'workers_comp_back_injury',
    description: "Workers' comp visit with mechanism of injury",
    patientInfo: 'Age: 42 year old, Sex: male',
    isWorkersComp: true,
    transcript: [
      'Provider: I understand you were injured at work today?',
      'Patient: Yeah, I was lifting a heavy box at the warehouse - probably 60 or 70 pounds - and I felt a sharp pain in my lower back. It was sudden.',
      'Provider: What time did this happen?',
      'Patient: Around 10am this morning, about 3 hours ago.',
      'Provider: Were you twisting when you lifted?',
      'Patient: Yeah, I was turning to put it on the shelf while lifting.',
      'Provider: Where exactly is the pain?',
      'Patient: Lower back, mostly on the left side. It shoots down my left leg too.',
      'Provider: Rate the pain?',
      "Patient: 8 out of 10. It's really bad when I try to bend forward.",
      'Provider: Any numbness or weakness in your legs?',
      'Patient: A little tingling in my left foot.',
      'Provider: Any prior back injuries?',
      "Patient: I strained my back about 5 years ago doing the same kind of work but it wasn't this bad.",
      'Provider: Medical conditions or medications?',
      "Patient: I take lisinopril for blood pressure. That's it.",
      'Provider: Allergies?',
      'Patient: None.',
      "Provider: I'm going to order an X-ray of your lumbar spine. I'll prescribe cyclobenzaprine 10mg three times a day and ibuprofen 800mg three times a day. No heavy lifting. Follow up in one week.",
    ].join('\n'),
    expected: {
      mechanismOfInjury:
        'The patient sustained a lower back injury while lifting a heavy box weighing ' +
        'approximately 60-70 pounds at a warehouse. The injury occurred while simultaneously ' +
        'lifting and twisting to place the box on a shelf. The onset of pain was sudden and ' +
        'immediate at the time of the lift.',
      historyOfPresentIllness:
        'The patient is a 42-year-old male presenting with acute lower back pain with left-sided ' +
        'radiculopathy after a workplace lifting injury approximately 3 hours ago. He reports ' +
        'pain of 8/10, worst with forward flexion, with radiation down the left leg and tingling ' +
        'in the left foot. He has a history of a prior back strain 5 years ago.',
      pastMedicalHistory: ['hypertension', 'prior back strain 5 years ago'],
      medicationsHistory: ['Lisinopril'],
      erx: ['Cyclobenzaprine 10mg', 'Ibuprofen 800mg'],
      labs: ['X-ray lumbar spine'],
    },
  },
  {
    id: 'pediatric_asthma_exacerbation',
    description: 'Child with asthma exacerbation, parent present',
    patientInfo: 'Age: 7 year old, Sex: male',
    transcript: [
      "Provider: Hi, what's happening with your son today?",
      "Parent: He's been wheezing really bad since last night. He woke up coughing at 3am and couldn't stop. His breathing sounds really tight.",
      'Provider: Has he had any recent cold symptoms or been sick?',
      "Parent: He had a runny nose starting about 4 days ago. A few kids at school have been sick.",
      'Provider: Did you give him his rescue inhaler?',
      'Parent: Yes, I gave him 2 puffs of albuterol at 3am and again at 7am. It helped a little but not as much as usual.',
      'Provider: Is he on any controller medications?',
      'Parent: He takes fluticasone 44mcg, 2 puffs twice a day. And montelukast at bedtime.',
      'Provider: Has he been hospitalized for asthma before?',
      'Parent: He was in the hospital once when he was 4 for a bad attack. He needed a breathing treatment.',
      'Provider: Any allergies?',
      'Parent: He\'s allergic to cats and dust mites. No drug allergies.',
      'Provider: Any other medical conditions?',
      'Parent: Just the asthma and eczema.',
      'Provider: Family history of asthma?',
      'Parent: I have asthma too, and his grandmother has COPD.',
      "Provider: I can hear bilateral wheezing. He's using accessory muscles a little. O2 sat is 94%. Let's start a nebulized albuterol treatment now and recheck in 20 minutes. We'll also do a chest X-ray. I'm going to start him on prednisolone 30mg daily for 5 days.",
    ].join('\n'),
    expected: {
      historyOfPresentIllness:
        'The patient is a 7-year-old male with a history of asthma presenting with acute ' +
        'wheezing and cough since last night, waking from sleep at 3am. He has had URI symptoms ' +
        'for 4 days. He received albuterol rescue inhaler at 3am and 7am with partial relief. ' +
        'He is on fluticasone and montelukast as controller medications. He has a history of ' +
        'a prior asthma hospitalization at age 4.',
      pastMedicalHistory: ['asthma', 'eczema'],
      medicationsHistory: ['Fluticasone 44mcg inhaler', 'Montelukast', 'Albuterol rescue inhaler, last taken 7am'],
      allergies: ['cats', 'dust mites'],
      familyHistory: ['mother - asthma', 'grandmother - COPD'],
      hospitalizationsHistory: ['asthma exacerbation at age 4'],
      labs: ['chest X-ray'],
      erx: ['Prednisolone 30mg'],
      procedures: ['nebulized albuterol treatment'],
    },
  },
];
