export interface ConversationTurn {
  /** Answer to send for this turn. */
  answer: string;
}

export interface TestScenario {
  label: string;
  /** Checks applied to the initial AI question before any answers are sent. */
  initialExpectContains: string[];
  conversation: ConversationTurn[];
}

// Urgent care visit — sore throat, patient answers as themselves.
export const TEST_SCENARIO: TestScenario = {
  label: 'Urgent care chatbot — sore throat visit',
  initialExpectContains: ['AI assistant', 'patient', 'guardian'],
  conversation: [
    { answer: 'I am the patient.' },
    { answer: 'I have a sore throat and fever that started two days ago.' },
    { answer: 'The pain is about a 6 out of 10. It gets worse when I swallow.' },
    { answer: 'I have no known drug allergies. I take no regular medications.' },
  ],
};
