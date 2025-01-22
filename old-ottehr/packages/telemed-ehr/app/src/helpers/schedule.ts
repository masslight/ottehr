export function getResource(
  scheduleType: 'office' | 'provider' | 'group',
): 'Location' | 'Practitioner' | 'HealthcareService' {
  if (scheduleType === 'office') {
    return 'Location';
  } else if (scheduleType === 'provider') {
    return 'Practitioner';
  } else if (scheduleType === 'group') {
    return 'HealthcareService';
  }

  console.log(`'scheduleType unknown ${scheduleType}`);
  throw new Error('scheduleType unknown');
}
