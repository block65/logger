import { afterAll, beforeEach, describe, jest, test } from '@jest/globals';

describe('Child Logger', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('GCP', async () => {});
});
