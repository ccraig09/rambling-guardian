/**
 * Minimal react-native stub for node-environment unit tests.
 * Exports the functions/components actually used by modules under test.
 */
export const useColorScheme = () => null;
export const useWindowDimensions = () => ({ width: 393, height: 852 });

export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';

export const Animated = {
  Value: class {
    constructor(public _value: number) {}
  },
  View: 'Animated.View',
  loop: () => ({ start: () => {}, stop: () => {} }),
  sequence: () => ({}),
  timing: () => ({}),
};

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
};
