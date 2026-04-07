// Mock transitive dependencies before importing the component module
jest.mock('../../theme/theme', () => ({
  useTheme: () => ({}),
}));

jest.mock('../../db/exercises', () => ({
  getStreaksForMonth: jest.fn().mockResolvedValue([]),
  getCurrentStreak: jest.fn().mockResolvedValue(0),
}));

import { calculateCellSize } from '../StreakCalendar';

const GAP = 4;
const COLUMNS = 7;

describe('calculateCellSize', () => {
  test.each([
    [320, 'iPhone SE'],
    [375, 'iPhone 8'],
    [393, 'iPhone 15'],
    [430, 'iPhone 16 Pro Max'],
  ])('width %i (%s) fits 7 columns without overflow', (screenWidth, _name) => {
    const cellSize = calculateCellSize(screenWidth as number);
    const totalWidth = COLUMNS * cellSize + (COLUMNS - 1) * GAP;
    const available = (screenWidth as number) - 64; // 16+16 padding on each side
    expect(totalWidth).toBeLessThanOrEqual(available);
  });

  test('cell size is at least 30 (minimum touch target)', () => {
    const cellSize = calculateCellSize(320); // narrowest phone
    expect(cellSize).toBeGreaterThanOrEqual(30);
  });

  test('custom padding parameters work', () => {
    const cellSize = calculateCellSize(400, 20, 20);
    const available = 400 - (20 + 20) * 2;
    const totalWidth = 7 * cellSize + 6 * GAP;
    expect(totalWidth).toBeLessThanOrEqual(available);
  });
});
