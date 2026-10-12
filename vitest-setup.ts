import { beforeEach, vi } from 'vitest';

// Use a fixed date for deterministic snapshots
const FIXED_DATE = new Date('2025-01-01T00:00:00.000Z');

// Mock node:os hostname for deterministic snapshots
vi.mock('node:os', () => ({
  hostname: () => 'test-host',
}));

// Mock process.pid for deterministic snapshots
Object.defineProperty(process, 'pid', {
  value: 12345,
  writable: true,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);
});