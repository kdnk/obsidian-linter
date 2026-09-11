import RemoveSpaceBeforeOrAfterCharacters from '../src/rules/remove-space-before-or-after-characters';
import dedent from 'ts-dedent';
import {ruleTest} from './common';

ruleTest({
  RuleBuilderClass: RemoveSpaceBeforeOrAfterCharacters,
  testCases: [
    {
      testName: 'Make sure that checklists completion indicator does not get affected by the rule',
      before: dedent`
        # Title
        ${''}
        - [ ] ]Task 1 starting with opening square brace keeps initial space
        - [ ] Task 2
        - [x] Task 3
        - [ ] Task 4 .
        ${''}
      `,
      after: dedent`
        # Title
        ${''}
        - [ ] ]Task 1 starting with opening square brace keeps initial space
        - [ ] Task 2
        - [x] Task 3
        - [ ] Task 4.
        ${''}
      `,
    },
    {
      testName: 'Make sure that checklists completion indicator does not get affected by the rule when there is a sublist',
      before: dedent`
        # Title
        ${''}
        - [ ] Task 1
          - [ ] Task 2
          - [x] Task 3 ,
        - [ ] Task 4 .
        ${''}
      `,
      after: dedent`
        # Title
        ${''}
        - [ ] Task 1
          - [ ] Task 2
          - [x] Task 3,
        - [ ] Task 4.
        ${''}
      `,
    },
  ],
});

describe('Whitespace in punctuation settings', () => {
  const rule = RemoveSpaceBeforeOrAfterCharacters.getRule();
  const listWithCode = '- first\n\n  continued\n\n  ```js\n  const value = 1;\n  ```\n\n- second\n';

  it.each(['charactersToRemoveSpacesBefore', 'charactersToRemoveSpacesAfter'])(
      'preserves list continuation and fenced code indentation with whitespace in %s',
      (option) => {
        const options = {[option]: '¿¡‘“([ \t\n\u00a0'};
        const actual = rule.apply(listWithCode, options);

        expect(actual).toBe(listWithCode);
        expect(rule.apply(actual, options)).toBe(actual);
      },
  );

  it('ignores whitespace in both sets while still formatting punctuation', () => {
    expect(rule.apply('- ( hello ) , world !\n\n  more  words\n', {
      charactersToRemoveSpacesBefore: ' ,!\t)\n',
      charactersToRemoveSpacesAfter: ' (\t\n',
    })).toBe('- (hello), world!\n\n  more  words\n');
  });

  it('leaves text intact when both sets contain only whitespace', () => {
    expect(rule.apply('first  second\n\n' + listWithCode, {
      charactersToRemoveSpacesBefore: ' \t\n\u00a0',
      charactersToRemoveSpacesAfter: ' \t\n\u00a0',
    })).toBe('first  second\n\n' + listWithCode);
  });

  it.each([
    {charactersToRemoveSpacesBefore: ' \t', charactersToRemoveSpacesAfter: '(', before: '( hello !', after: '(hello !'},
    {charactersToRemoveSpacesBefore: '!', charactersToRemoveSpacesAfter: ' \t', before: '( hello !', after: '( hello!'},
  ])('still uses the nonempty punctuation set when the other contains only whitespace', ({before, after, ...options}) => {
    expect(rule.apply(before, options)).toBe(after);
  });

  it.each(['! - ?', '? - !'])('treats hyphens literally in the before set %s', (symbols) => {
    const options = {charactersToRemoveSpacesBefore: symbols, charactersToRemoveSpacesAfter: ''};
    const actual = rule.apply('first 7 second ! text ? end - tail', options);

    expect(actual).toBe('first 7 second! text? end- tail');
    expect(rule.apply(actual, options)).toBe(actual);
  });

  it.each(['! - ?', '? - !'])('treats hyphens literally in the after set %s', (symbols) => {
    const options = {charactersToRemoveSpacesBefore: '', charactersToRemoveSpacesAfter: symbols};
    const actual = rule.apply('first 7 second ! text ? end - tail', options);

    expect(actual).toBe('first 7 second !text ?end -tail');
    expect(rule.apply(actual, options)).toBe(actual);
  });
});
