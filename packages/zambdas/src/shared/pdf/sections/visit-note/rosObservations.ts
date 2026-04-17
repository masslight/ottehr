import { Content } from 'pdfmake/interfaces';
import { ExamObservationDTO, InPersonRosConfig } from 'utils';
import { PdfDataComposerInput, ProgressNoteSectionCreator } from '../../types';

export interface RosObservationsData {
  systems: { label: string; items: string[] }[];
}

export function composeRosObservations({ allChartData }: PdfDataComposerInput): RosObservationsData {
  const observations = allChartData.rosObservations || [];
  const checked = observations.filter((o) => o.value === true);

  const systems: { label: string; items: string[] }[] = [];
  for (const [_systemKey, system] of Object.entries(InPersonRosConfig)) {
    const systemItems = checked
      .filter((obs: ExamObservationDTO) => obs.field in system.items)
      .map((obs: ExamObservationDTO) => system.items[obs.field]?.label || obs.label || obs.field);
    if (systemItems.length > 0) {
      systems.push({ label: system.label, items: systemItems });
    }
  }

  return { systems };
}

export function createRosObservationsSection(): ProgressNoteSectionCreator<'rosObservations'> {
  return {
    key: 'rosObservations',
    create: (data: RosObservationsData): Content[] => {
      if (data.systems.length === 0) return [];

      const content: Content[] = [
        {
          text: 'REVIEW OF SYSTEMS',
          style: 'sectionHeader',
          margin: [0, 10, 0, 4],
        },
      ];

      for (const system of data.systems) {
        content.push({
          text: [
            { text: `${system.label}: `, bold: true, fontSize: 9 },
            { text: system.items.join(', '), fontSize: 9 },
          ],
          margin: [0, 2, 0, 0],
        });
      }

      return content;
    },
  };
}
