export async function topLevelCatch(zambda: string, error: any): Promise<void> {
  console.error(`Top level catch block in ${zambda}: \n ${error} \n Error stringified: ${JSON.stringify(error)}`);
}
