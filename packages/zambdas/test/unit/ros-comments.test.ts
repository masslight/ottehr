import { Observation, Resource } from 'fhir/r4b';
import { collectKnownExamFields } from 'utils/lib/config-helpers/exam-observations';
import { collectKnownRosFieldsWithComments } from 'utils/lib/config-helpers/review-of-systems';
import { chartDataTagSystem } from 'utils/lib/fhir/constants';
import { examConfig } from 'utils/lib/ottehr-config/examination';
import { ExamObservationDTO, ROS_OBSERVATION_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, test, vi } from 'vitest';
import { analyzeTemplateVersionData } from '../../src/ehr/shared/template-helpers';
import { makeExamObservationDTO, makeRosObservationResource } from '../../src/shared/chart-data';
import { progressNoteDataToText } from '../../src/shared/pdf/progress-note-text';
import {
  composeRosObservations,
  createRosObservationsSection,
} from '../../src/shared/pdf/sections/visit-note/rosObservations';
import { PdfAssets, PdfClient, PdfStyles, ProgressNoteData, RosObservations } from '../../src/shared/pdf/types';

const composeFor = (rosObservations: ExamObservationDTO[]): RosObservations =>
  composeRosObservations({ allChartData: { chartData: { rosObservations } } } as never);

describe('makeRosObservationResource / makeExamObservationDTO', () => {
  test('writes the comment as note and reads it back, with no valueBoolean', () => {
    const resource = makeRosObservationResource('enc-1', 'pat-1', {
      field: 'ros-constitutional-comment',
      label: 'Constitutional comment',
      note: 'Tired for two weeks',
    });

    expect(resource.note).toEqual([{ text: 'Tired for two weeks' }]);
    expect(resource.valueBoolean).toBeUndefined();
    expect(resource.code.text).toBe('Constitutional comment');
    expect(resource.meta?.tag?.[0]?.code).toBe('ros-constitutional-comment');

    const dto = makeExamObservationDTO({ ...resource, id: 'obs-1' });
    expect(dto).toMatchObject({
      resourceId: 'obs-1',
      field: 'ros-constitutional-comment',
      label: 'Constitutional comment',
      note: 'Tired for two weeks',
    });
    expect(dto.value).toBeUndefined();
  });

  test('a finding without a note writes no note', () => {
    const resource = makeRosObservationResource('enc-1', 'pat-1', {
      field: 'ros-constitutional-fever-denies',
      label: 'Fever',
      value: true,
    });
    expect(resource.valueBoolean).toBe(true);
    expect(resource.note).toBeUndefined();
  });
});

describe('composeRosObservations — comments', () => {
  test('a system with findings and a comment carries both', () => {
    const composed = composeFor([
      { field: 'ros-constitutional-fever-denies', label: 'Fever', value: true },
      { field: 'ros-constitutional-comment', label: 'Constitutional comment', note: '  Tired for two weeks  ' },
    ]);
    expect(composed.rosObservations.Constitutional).toEqual({
      items: [{ field: 'ros-constitutional-fever-denies', label: 'Fever', abnormal: false }],
      comment: 'Tired for two weeks',
    });
  });

  test('a comment-only system is emitted with no items', () => {
    const composed = composeFor([{ field: 'ros-eyes-comment', label: 'Eyes comment', note: 'Wears glasses' }]);
    expect(composed.rosObservations).toEqual({ Eyes: { items: [], comment: 'Wears glasses' } });
  });

  test('a whitespace-only comment is ignored', () => {
    const composed = composeFor([{ field: 'ros-eyes-comment', label: 'Eyes comment', note: '   ' }]);
    expect(composed.rosObservations).toEqual({});
  });

  test('an unchecked finding is dropped while the comment is kept', () => {
    const composed = composeFor([
      { field: 'ros-constitutional-fever-denies', label: 'Fever', value: false },
      { field: 'ros-constitutional-chills-reports', label: 'Chills' },
      { field: 'ros-constitutional-comment', label: 'Constitutional comment', note: 'Tired' },
    ]);
    expect(composed.rosObservations).toEqual({ Constitutional: { items: [], comment: 'Tired' } });
  });

  test('a system without a comment has no comment key', () => {
    const composed = composeFor([{ field: 'ros-constitutional-chills-reports', label: 'Chills', value: true }]);
    expect(composed.rosObservations.Constitutional).toEqual({
      items: [{ field: 'ros-constitutional-chills-reports', label: 'Chills', abnormal: true }],
    });
    expect('comment' in composed.rosObservations.Constitutional).toBe(false);
  });
});

describe('createRosObservationsSection — comments', () => {
  const styles = {
    textStyles: {
      examCardHeader: { name: 'header' },
      examBoldField: { name: 'bold', spacing: 2 },
      examRegularField: { name: 'regular', spacing: 2 },
      examProviderComment: { name: 'comment' },
    },
    imageStyles: { examColorDotsStyle: { width: 5 } },
    lineStyles: { separator: {} },
  } as unknown as PdfStyles;
  const assets = { icons: { redDot: 'red', greenDot: 'green' } } as unknown as PdfAssets;

  const render = (data: RosObservations): { calls: string[]; drawText: ReturnType<typeof vi.fn> } => {
    const calls: string[] = [];
    let leftBound = 50;
    const drawText = vi.fn((text: string) => calls.push(`drawText:${text}`));
    const client = {
      drawText,
      drawTextSequential: vi.fn((text: string) => calls.push(`seq:${text}`)),
      drawImage: vi.fn(),
      drawSeparatedLine: vi.fn(() => calls.push('separator')),
      getTextDimensions: vi.fn().mockReturnValue({ height: 10, width: 40 }),
      getLeftBound: vi.fn(() => leftBound),
      setLeftBound: vi.fn((value: number) => {
        leftBound = value;
      }),
      getX: vi.fn().mockReturnValue(100),
      getRightBound: vi.fn().mockReturnValue(500),
      newLine: vi.fn(() => calls.push('newLine')),
      getY: vi.fn().mockReturnValue(700),
      setY: vi.fn(),
    } as unknown as PdfClient;
    const section = createRosObservationsSection<{ rosObservations?: RosObservations }>();
    section.render(client, data, styles, assets);
    return { calls, drawText };
  };

  test('draws the comment after the findings', () => {
    const { calls, drawText } = render({
      rosObservations: {
        Constitutional: {
          items: [{ field: 'ros-constitutional-fever-denies', label: 'Fever', abnormal: false }],
          comment: 'Tired for two weeks',
        },
      },
    });

    const finding = calls.indexOf('seq: Fever   ');
    const comment = calls.indexOf('drawText:Tired for two weeks');
    expect(finding).toBeGreaterThan(-1);
    expect(comment).toBeGreaterThan(finding);
    expect(drawText).toHaveBeenCalledWith('Tired for two weeks', styles.textStyles.examProviderComment);
  });

  test('a comment-only system draws its header and the comment', () => {
    const { calls } = render({ rosObservations: { Eyes: { items: [], comment: 'Wears glasses' } } });
    expect(calls).toEqual(['seq:Eyes:   ', 'newLine', 'drawText:Wears glasses', 'separator']);
  });

  test('a system without a comment draws no comment text', () => {
    const { drawText } = render({
      rosObservations: {
        Constitutional: { items: [{ field: 'ros-constitutional-fever-denies', label: 'Fever', abnormal: false }] },
      },
    });
    expect(drawText).not.toHaveBeenCalled();
  });

  test('shouldRender is true for a comment-only ROS', () => {
    const section = createRosObservationsSection<{ rosObservations?: RosObservations }>();
    const data: RosObservations = { rosObservations: { Eyes: { items: [], comment: 'Wears glasses' } } };
    expect(section.shouldRender?.(data, { rosObservations: data })).toBe(true);
    expect(section.shouldRender?.({ rosObservations: {} }, {})).toBe(false);
  });
});

describe('progressNoteDataToText — ROS comments', () => {
  const emptyNote = {
    rosObservations: { rosObservations: {} },
    examination: { examination: {} },
  } as unknown as ProgressNoteData;

  test('appends the comment after the findings', () => {
    const text = progressNoteDataToText({
      ...emptyNote,
      rosObservations: {
        rosObservations: {
          Constitutional: {
            items: [{ field: 'ros-constitutional-fever-denies', label: 'Fever', abnormal: false }],
            comment: 'Tired for two weeks',
          },
        },
      },
    } as unknown as ProgressNoteData);

    expect(text).toContain('- Constitutional: Fever (denies) | comment: Tired for two weeks');
    expect(text).toContain('REVIEW OF SYSTEMS:\nSystems documented with at least one item: 1');
  });

  test('lists a comment-only system without counting it', () => {
    const text = progressNoteDataToText({
      ...emptyNote,
      rosObservations: {
        rosObservations: {
          Constitutional: { items: [{ field: 'ros-constitutional-fever-denies', label: 'Fever', abnormal: false }] },
          Eyes: { items: [], comment: 'Wears glasses' },
        },
      },
    } as unknown as ProgressNoteData);

    expect(text).toContain('REVIEW OF SYSTEMS:\nSystems documented with at least one item: 1');
    expect(text).toContain('- Constitutional: Fever (denies)\n');
    expect(text).toContain('- Eyes: comment: Wears glasses');
  });
});

describe('analyzeTemplateVersionData — ROS comments', () => {
  const rosTagSystem = chartDataTagSystem(ROS_OBSERVATION_META_SYSTEM);
  const rosObservation = (field: string, extra: Partial<Observation> = {}): Observation => ({
    resourceType: 'Observation',
    status: 'final',
    code: { text: field },
    meta: { tag: [{ system: rosTagSystem, code: field }] },
    ...extra,
  });
  const analyze = (contained: Resource[]): ReturnType<typeof analyzeTemplateVersionData> =>
    analyzeTemplateVersionData({
      contained,
      examTagSystem: chartDataTagSystem('exam-observation-field'),
      rosTagSystem,
      legacyRosTagSystem: chartDataTagSystem('ros'),
      knownExamFields: collectKnownExamFields(examConfig.default.components),
      knownRosFields: collectKnownRosFieldsWithComments(),
    });

  test('a template with a ROS comment stays current', () => {
    const result = analyze([
      rosObservation('ros-constitutional-fever-denies', { valueBoolean: true }),
      rosObservation('ros-constitutional-comment', { note: [{ text: 'Tired' }] }),
    ]);
    expect(result.isCurrentVersion).toBe(true);
    expect(result.unmatchedRosFields).toEqual([]);
    expect(result.rosObservations).toHaveLength(2);
  });

  test('an unknown comment-shaped field is still flagged', () => {
    const result = analyze([rosObservation('ros-not-a-system-comment', { note: [{ text: 'x' }] })]);
    expect(result.isCurrentVersion).toBe(false);
    expect(result.unmatchedRosFields).toEqual(['ros-not-a-system-comment']);
  });
});
