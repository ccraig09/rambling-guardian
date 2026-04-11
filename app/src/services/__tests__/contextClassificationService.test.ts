import { classifyContext } from '../contextClassificationService';

describe('classifyContext', () => {
  test('returns null when below minimum segment floor', () => {
    const counts = new Map([['Speaker 0', 14]]);
    expect(classifyContext(counts, 14)).toBeNull();
  });

  test('returns null for 0 segments', () => {
    expect(classifyContext(new Map(), 0)).toBeNull();
  });

  test('returns solo for 1 speaker at floor', () => {
    const counts = new Map([['Speaker 0', 15]]);
    expect(classifyContext(counts, 15)).toBe('solo');
  });

  test('returns with_others for 2 speakers even split', () => {
    const counts = new Map([['Speaker 0', 8], ['Speaker 1', 7]]);
    expect(classifyContext(counts, 15)).toBe('with_others');
  });

  test('returns presentation when dominant speaker has 85%+ and 3+ speakers', () => {
    const counts = new Map([['Speaker 0', 17], ['Speaker 1', 2], ['Speaker 2', 1]]);
    expect(classifyContext(counts, 20)).toBe('presentation');
  });

  test('returns with_others when dominant has 85%+ but only 2 speakers', () => {
    const counts = new Map([['Speaker 0', 18], ['Speaker 1', 2]]);
    expect(classifyContext(counts, 20)).toBe('with_others');
  });

  test('returns with_others when dominant has 80% with 3 speakers (below threshold)', () => {
    const counts = new Map([['Speaker 0', 16], ['Speaker 1', 2], ['Speaker 2', 2]]);
    expect(classifyContext(counts, 20)).toBe('with_others');
  });

  test('returns presentation at exactly 85% boundary', () => {
    const counts = new Map([['Speaker 0', 85], ['Speaker 1', 10], ['Speaker 2', 5]]);
    expect(classifyContext(counts, 100)).toBe('presentation');
  });

  test('returns with_others at just below 85% boundary', () => {
    const counts = new Map([['Speaker 0', 84], ['Speaker 1', 10], ['Speaker 2', 6]]);
    expect(classifyContext(counts, 100)).toBe('with_others');
  });
});
