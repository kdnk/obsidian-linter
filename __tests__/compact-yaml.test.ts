import {parse} from 'yaml';
import CompactYaml from '../src/rules/compact-yaml';

describe('Compact YAML scalar preservation', () => {
  const rule = CompactYaml.getRule();
  const cases = [
    {name: 'literal', source: 'value: |\n  first\n\n  second\n', value: 'first\n\nsecond\n'},
    {name: 'folded', source: 'value: >\n  first\n\n  second\n', value: 'first\nsecond\n'},
    {name: 'stripped literal', source: 'value: |-\n  first\n\n  second\n', value: 'first\n\nsecond'},
    {name: 'stripped folded', source: 'value: >-\n  first\n\n  second\n', value: 'first\nsecond'},
    {name: 'single quoted', source: "value: 'first\n\n  second'\n", value: 'first\nsecond'},
    {name: 'double quoted', source: 'value: "first\n\n  second"\n', value: 'first\nsecond'},
    {name: 'plain multiline', source: 'value: first\n\n  second\n', value: 'first\nsecond'},
    {name: 'explicit indentation', source: 'value: |2\n  first\n\n    indented\n', value: 'first\n\n  indented\n'},
    {name: 'leading scalar blank lines', source: 'value: |\n\n\n  first\n', value: '\n\nfirst\n'},
  ];

  it.each(cases)('preserves $name scalar values while removing structural blank lines', ({source, value}) => {
    const before = '---\n\n' + source + '\n\nnext: unchanged\n\n---\n\nBody\n\ntext\n';
    const expected = '---\n' + source + 'next: unchanged\n---\n\nBody\n\ntext\n';
    const actual = rule.apply(before, {innerNewLines: true});

    expect(parse(before.slice(4, before.indexOf('\n---', 4)))).toEqual({value, next: 'unchanged'});
    expect(parse(actual.slice(4, actual.indexOf('\n---', 4)))).toEqual({value, next: 'unchanged'});
    expect(actual).toBe(expected);
    expect(rule.apply(actual, {innerNewLines: true})).toBe(actual);
  });

  it.each(['|+', '>+', '|2+', '>+2'])('preserves trailing newlines in %s scalars at the frontmatter boundary', (style) => {
    const before = '---\n\nvalue: ' + style + '\n  first\n\n\n---\nBody';
    for (const innerNewLines of [false, true]) {
      const actual = rule.apply(before, {innerNewLines});
      const yaml = actual.slice(4, actual.indexOf('---', 4));

      expect(parse(yaml)).toEqual({value: 'first\n\n\n'});
      expect(actual).toBe('---\nvalue: ' + style + '\n  first\n\n\n---\nBody');
      expect(rule.apply(actual, {innerNewLines})).toBe(actual);
    }
  });

  it('preserves nested scalar values and comments while compacting mapping and sequence gaps', () => {
    const source = '---\n\n# Header\n\nitems:\n\n  - value: |+\n      first\n\n      second\n\n\n    next: "third\n\n      fourth"\n\n  - value: tail\n\n---';
    const actual = rule.apply(source, {innerNewLines: true});

    expect(parse(actual.slice(4, -3))).toEqual({items: [
      {value: 'first\n\nsecond\n\n\n', next: 'third\nfourth'},
      {value: 'tail'},
    ]});
    expect(actual).toBe('---\n# Header\nitems:\n  - value: |+\n      first\n\n      second\n\n\n    next: "third\n\n      fourth"\n  - value: tail\n---');
    expect(rule.apply(actual, {innerNewLines: true})).toBe(actual);
  });

  it('compacts only the boundaries when inner newlines are disabled', () => {
    expect(rule.apply('---\n\na: first\n\nb: second\n\n---')).toBe('---\na: first\n\nb: second\n---');
  });

  it('leaves malformed YAML intact because scalar boundaries cannot be trusted', () => {
    const source = '---\n\nvalue: "unterminated\n\n  text\n\n---';
    expect(rule.apply(source, {innerNewLines: true})).toBe(source);
  });

  it.each([
    'value: *missing\n\nnext: unchanged\n',
    'value:\n  child: *missing\n\nnext: unchanged\n',
    'value: *later\n\nnext: &later available\n',
  ])('leaves YAML with unresolved aliases intact: %s', (yaml) => {
    const source = '---\n\n' + yaml + '\n---';
    for (const innerNewLines of [false, true]) {
      expect(rule.apply(source, {innerNewLines})).toBe(source);
    }
  });

  it('compacts valid aliases while preserving anchored scalar values', () => {
    const source = '---\n\nvalue: &text |\n  first\n\n  second\n\ncopy: *text\n\n---';
    const actual = rule.apply(source, {innerNewLines: true});

    expect(actual).toBe('---\nvalue: &text |\n  first\n\n  second\ncopy: *text\n---');
    expect(parse(actual.slice(4, -3))).toEqual({value: 'first\n\nsecond\n', copy: 'first\n\nsecond\n'});
    expect(rule.apply(actual, {innerNewLines: true})).toBe(actual);
  });

  it('compacts recursive aliases without expanding their contents', () => {
    const source = '---\n\nvalue: &root\n  self: *root\n\nnext: tail\n\n---';
    const actual = rule.apply(source, {innerNewLines: true});
    const parsed = parse(actual.slice(4, -3));

    expect(actual).toBe('---\nvalue: &root\n  self: *root\nnext: tail\n---');
    expect(parsed.value.self).toBe(parsed.value);
    expect(parsed.next).toBe('tail');
    expect(rule.apply(actual, {innerNewLines: true})).toBe(actual);
  });
});
