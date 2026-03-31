import { CPTCodeDTO, GetChartDataResponse } from 'utils';

export function mapResourceByNameField(data: { name?: string }[] | CPTCodeDTO[]): string[] {
  const result: string[] = [];
  data.forEach((element) => {
    if ('name' in element && element.name) {
      result.push(element.name);
    } else if ('display' in element && element.display) {
      result.push(element.display);
    }
  });
  return result;
}

export function mapMedicalConditions(chartData: GetChartDataResponse): string[] {
  const medicalConditions: string[] = [];
  const conditions = chartData?.conditions?.filter((condition) => condition.current === true);
  conditions?.forEach((mc) => {
    if (mc.display && mc.code) medicalConditions.push(`${mc.display} ${mc.code}`);
  });
  return medicalConditions;
}
