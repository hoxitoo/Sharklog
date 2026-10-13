import { readFileSync } from 'fs';
import { join } from 'path';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('FilterPicker', () => {
  it('drops the keyboard before opening its sheet', () => {
    // On iOS the sheet opened UNDER a keyboard left up by the stake field, and
    // the later options were out of reach.
    const src = read('components', 'FilterPicker.tsx');
    const open = src.slice(src.indexOf('function open_()'), src.indexOf('function close()'));
    expect(open).toMatch(/Keyboard\.dismiss\(\)/);
  });
});

describe('ThemePicker', () => {
  it('keeps the "coming soon" circles pressable', () => {
    // RN 0.85's TouchableOpacity treats accessibilityState.disabled as
    // `disabled` and drops the press: the circles were dead and the alert that
    // explains them never appeared.
    const src = read('screens', 'SettingsScreen', 'ThemePicker.tsx');
    expect(src).not.toMatch(/accessibilityState=\{\{[^}]*disabled/);
    expect(src).not.toMatch(/\bdisabled=\{/);
  });
});
