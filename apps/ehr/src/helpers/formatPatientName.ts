export function formatPatientName({
  lastName,
  firstName,
  middleName,
  nickname,
}: {
  lastName: string;
  firstName: string;
  middleName?: string;
  nickname?: string;
}): string {
  let result = `${lastName}, ${firstName}`;

  if (middleName) {
    result += `, ${middleName}`;
  }

  if (nickname) {
    result += ` (${nickname})`;
  }

  return result;
}
