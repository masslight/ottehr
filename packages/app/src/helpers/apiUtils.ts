export function chooseJson(json: any, isLocal: boolean): any {
  return isLocal ? json : json.output;
}
