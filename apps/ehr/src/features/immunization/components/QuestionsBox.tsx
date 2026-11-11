import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BOX_SX } from './DueTodayBox';
import { CounselingAnswer, counselingAnswerFor, CounselingAnswers } from './immunizationCodes';
import { ImmunizationLine } from './immunizationLines';

// The counseling mockup's styles: .q rows, .seg answers (assumed / picked / off), .why caption and .qlink.
const Q_SX = { py: '4px', pb: '2px', fontSize: 14, lineHeight: 1.8, '& + &': { borderTop: '1px solid #d6e0ec' } };
const SEG_SX = {
  display: 'inline',
  font: 'inherit',
  color: 'inherit',
  border: 0,
  m: 0,
  borderRadius: '3px',
  padding: '1px 8px',
  background: 'rgba(33,105,245,.15)',
  cursor: 'pointer',
  '&:hover': { background: 'rgba(33,105,245,.3)' },
} as const;
const SEG_STATE_SX = {
  assumed: { background: 'transparent', outline: '1px dashed #2169F5', outlineOffset: '-1px' },
  picked: { background: 'rgba(46,125,50,.15)' },
  off: { background: 'rgba(0,0,0,.05)', color: 'rgba(0,0,0,.6)' },
} as const;
const WHY_SX = { display: 'block', fontSize: 12, color: 'rgba(0,0,0,.6)', lineHeight: 1.5 } as const;
const QLINK_SX = {
  fontSize: 12,
  fontFamily: 'inherit',
  color: '#2169F5',
  background: 'none',
  border: 0,
  p: 0,
  cursor: 'pointer',
  '&:hover': { textDecoration: 'underline' },
} as const;

type SegState = keyof typeof SEG_STATE_SX;

const segStates = ({ value, assumed }: { value: CounselingAnswer; assumed: boolean }): [SegState, SegState] =>
  assumed ? ['assumed', 'off'] : value === 'yes' ? ['picked', 'off'] : ['off', 'picked'];

const YesNo: FC<{
  answer: { value: CounselingAnswer; assumed: boolean };
  onAnswer: (value: CounselingAnswer) => void;
}> = ({ answer, onAnswer }) => {
  const [yes, no] = segStates(answer);
  const seg = (label: string, value: CounselingAnswer, state: SegState): JSX.Element => (
    <Box
      component="button"
      type="button"
      aria-pressed={state === 'picked'}
      sx={{ ...SEG_SX, ...SEG_STATE_SX[state] }}
      onClick={() => onAnswer(value)}
    >
      {label}
    </Box>
  );
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '6px', ml: 1 }}>
      {seg('Yes', 'yes', yes)}
      {seg('No', 'no', no)}
    </Box>
  );
};

/** The Questions box beside the order: whether the vaccines on lines with suggested codes were counseled on. The
 * answer only changes the suggested codes; it never blocks ordering. */
export const QuestionsBox: FC<{
  /** The lines with suggested codes. */
  lines: ImmunizationLine[];
  answers: CounselingAnswers;
  onChange: (answers: CounselingAnswers) => void;
}> = ({ lines, answers, onChange }) => {
  const visit = counselingAnswerFor(answers);
  return (
    <Box sx={BOX_SX} data-testid={dataTestIds.orderVaccinePage.questionsBox}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Questions
      </Typography>
      {answers.perVaccine ? (
        <>
          {lines.map((line) => (
            <Box key={line.key} sx={Q_SX} data-testid={dataTestIds.orderVaccinePage.counselingQuestion}>
              {line.details.medication?.name} counseled?
              <YesNo
                answer={counselingAnswerFor(answers, line.key)}
                onAnswer={(value) => onChange({ ...answers, each: { ...answers.each, [line.key]: value } })}
              />
            </Box>
          ))}
          <Box sx={Q_SX}>
            <Box
              component="button"
              type="button"
              sx={QLINK_SX}
              onClick={() => onChange({ ...answers, perVaccine: false, each: {} })}
              data-testid={dataTestIds.orderVaccinePage.counselingJoin}
            >
              Same answer for all
            </Box>
          </Box>
        </>
      ) : (
        <Box sx={Q_SX} data-testid={dataTestIds.orderVaccinePage.counselingQuestion}>
          Counseled on today&apos;s vaccines?
          <YesNo answer={visit} onAnswer={(value) => onChange({ ...answers, visit: value })} />
          <Box component="span" sx={WHY_SX}>
            {visit.assumed
              ? 'Codes assume yes until answered.'
              : visit.value === 'yes'
              ? '90460 / 90461 on the suggested lines.'
              : '90471 / 90472 on the suggested lines.'}
          </Box>
          <Box
            component="button"
            type="button"
            sx={QLINK_SX}
            onClick={() => onChange({ ...answers, perVaccine: true })}
            data-testid={dataTestIds.orderVaccinePage.counselingSplit}
          >
            Answers differ by vaccine
          </Box>
        </Box>
      )}
    </Box>
  );
};
