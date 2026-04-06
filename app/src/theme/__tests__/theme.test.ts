import { darkTheme, lightTheme } from '../theme';

describe('Theme parity', () => {
  it('dark and light themes have identical top-level keys', () => {
    const darkKeys = Object.keys(darkTheme).sort();
    const lightKeys = Object.keys(lightTheme).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('dark and light color tokens have identical keys', () => {
    const darkColorKeys = Object.keys(darkTheme.colors).sort();
    const lightColorKeys = Object.keys(lightTheme.colors).sort();
    expect(darkColorKeys).toEqual(lightColorKeys);
  });

  it('dark and light text tokens have identical keys', () => {
    const darkTextKeys = Object.keys(darkTheme.text).sort();
    const lightTextKeys = Object.keys(lightTheme.text).sort();
    expect(darkTextKeys).toEqual(lightTextKeys);
  });

  it('dark and light shadow tokens have identical keys', () => {
    const darkShadowKeys = Object.keys(darkTheme.shadows).sort();
    const lightShadowKeys = Object.keys(lightTheme.shadows).sort();
    expect(darkShadowKeys).toEqual(lightShadowKeys);
  });

  it('all surface tokens are HSL strings', () => {
    const hslPattern = /^hsla?\(/;
    for (const [key, value] of Object.entries(darkTheme.colors)) {
      expect(value).toMatch(hslPattern);
    }
  });

  it('alert tokens match firmware levels', () => {
    expect(darkTheme.alert).toHaveProperty('safe');
    expect(darkTheme.alert).toHaveProperty('gentle');
    expect(darkTheme.alert).toHaveProperty('moderate');
    expect(darkTheme.alert).toHaveProperty('urgent');
    expect(darkTheme.alert).toHaveProperty('critical');
  });
});
