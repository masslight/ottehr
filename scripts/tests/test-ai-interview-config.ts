export interface CategoryCheck {
  label: string;
  expected: string;
}

export interface InterviewScenario {
  label: string;
  transcript: string;
  categoryChecks: CategoryCheck[];
}

export const TEST_SCENARIO: InterviewScenario = {
  label:
    'Sore throat with fever, hypertension, diabetes, appendectomy, penicillin allergy, smoker, family cardiac history',
  transcript: `Provider: "What brings you in today?"
Patient: "I have a sore throat and a headache."
Provider: "How long have you had these symptoms?"
Patient: "Three days."
Provider: "Have you had any fever?"
Patient: "Yes, 101.5°F since yesterday."
Provider: "Do you have any past medical conditions?"
Patient: "I have high blood pressure and type 2 diabetes."
Provider: "Any surgeries in the past?"
Patient: "Yes, I had my appendix out about five years ago."
Provider: "Have you ever been hospitalized?"
Patient: "Yes, I was hospitalized for a diabetic ketoacidosis episode about two years ago. I was in the hospital for three days."
Provider: "Are you currently taking any medications?"
Patient: "Lisinopril 10mg daily, metformin 500mg twice a day, and atorvastatin 20mg at night."
Provider: "Do you have any known allergies?"
Patient: "Yes, I'm allergic to penicillin."
Provider: "Do you smoke or drink alcohol?"
Patient: "I usually smoke a cigarette a day"
Provider: "Any significant family history?"
Patient: "My father has type 2 diabetes."`,
  categoryChecks: [
    {
      label: 'History of Present Illness',
      expected: 'sore throat, headache, 3-day duration, fever of 101.5°F starting yesterday',
    },
    {
      label: 'Past Medical History',
      expected: 'hypertension (high blood pressure) and type 2 diabetes',
    },
    {
      label: 'Past Surgical History',
      expected: 'appendectomy approximately five years ago',
    },
    {
      label: 'Hospitalizations History',
      expected: 'hospitalized for diabetic ketoacidosis approximately two years ago, 3-day stay',
    },
    {
      label: 'Medications',
      expected: 'Lisinopril 10mg daily, metformin 500mg twice a day, and atorvastatin 20mg nightly',
    },
    {
      label: 'Allergies',
      expected: 'penicillin allergy',
    },
    {
      label: 'Social History',
      expected: 'usually smokes a cigarette a day',
    },
    {
      label: 'Family History',
      expected: 'father has type 2 diabetes',
    },
  ],
};
