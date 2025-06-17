import { DateTime, Interval } from 'luxon';

export async function makePromiseWithTimeout<T>(
  effect: Promise<T>,
  timeoutInMS: number,
  promiseName?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${promiseName ?? ''} promise with timeout rejected. Timed out after ${timeoutInMS} ms.`));
    }, timeoutInMS);
    const start = DateTime.now();

    effect
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      })
      .finally(() => {
        clearTimeout(timer);
        const end = DateTime.now();
        const messagesExecutionTime = Interval.fromDateTimes(start, end).length('milliseconds');
        console.log(`${promiseName ?? ''} promise with timeout took ${messagesExecutionTime} ms`);
      });
  });
}
