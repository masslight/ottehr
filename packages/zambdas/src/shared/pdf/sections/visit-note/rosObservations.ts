import { Content } from 'pdfmake/interfaces';
import { ExamObservationDTO, InPersonRosConfig } from 'utils';
import { PdfDataComposerInput, ProgressNoteSectionCreator } from '../../types';

export interface RosObservationsData {
  systems: { label: string; denies: string[]; reports: string[] }[];
}

export function composeRosObservations({ allChartData }: PdfDataComposerInput): RosObservationsData {
  const observations = allChartData.rosObservations || [];
  const obsMap = new Map<string, ExamObservationDTO>();
  for (const obs of observations) {
    if (obs.value) obsMap.set(obs.field, obs);
  }

  const systems: { label: string; denies: string[]; reports: string[] }[] = [];
  for (const [_systemKey, system] of Object.entries(InPersonRosConfig)) {
    const denies: string[] = [];
    const reports: string[] = [];

    for (const [fieldKey, item] of Object.entries(system.items)) {
      if (obsMap.has(`${fieldKey}-denies`)) denies.push(item.label);
      if (obsMap.has(`${fieldKey}-reports`)) reports.push(item.label);
    }

    if (denies.length > 0 || reports.length > 0) {
      systems.push({ label: system.label, denies, reports });
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
        const parts: any[] = [{ text: `${system.label}: `, bold: true, fontSize: 9 }];
        if (system.denies.length > 0) {
          parts.push({ text: `Denies ${system.denies.join(', ')}`, fontSize: 9, color: '#2e7d32' });
        }
        if (system.denies.length > 0 && system.reports.length > 0) {
          parts.push({ text: '; ', fontSize: 9 });
        }
        if (system.reports.length > 0) {
          parts.push({ text: `Reports ${system.reports.join(', ')}`, fontSize: 9, color: '#d32f2f' });
        }
        content.push({ text: parts, margin: [0, 2, 0, 0] });
      }

      return content;
    },
  };
}
