import EmptyLineAroundCodeFences from '../src/rules/empty-line-around-code-fences';
import {getPositions, MDAstTypes} from '../src/utils/mdast';

const rule = EmptyLineAroundCodeFences.getRule();

type SpacingCase = {
  name: string;
  text: string;
  codeCount?: number;
};

const fences = [
  {name: 'backticks with language', open: '```js', body: ['const value = 1;'], close: '```'},
  {name: 'long tildes with metadata', open: '~~~~typescript title="sample"', body: ['const value = 1;'], close: '~~~~'},
  {name: 'long backticks containing short fences', open: '`````markdown', body: ['```js', 'const value = 1;', '```'], close: '`````'},
];

const placements = ['first block', 'after a paragraph', 'loose continuation'] as const;
const listCases: SpacingCase[] = [];

for (const marker of ['-', '*', '+', '1.', '12.', '1)', '123)']) {
  const indent = ' '.repeat(marker.length + 1);
  for (const fence of fences) {
    for (const placement of placements) {
      const code = [fence.open, ...fence.body, fence.close];
      let lines: string[];
      if (placement === 'first block') {
        lines = [`${marker} ${code[0]}`, ...code.slice(1).map((line) => indent + line)];
      } else {
        lines = [`${marker} before`, ...(placement === 'loose continuation' ? ['', indent, ''] : []), ...code.map((line) => indent + line)];
      }
      lines.push(...(placement === 'loose continuation' ? [indent, '', ''] : []), `${indent}after`, `${marker} sibling`);
      listCases.push({name: `${marker}: ${fence.name}, ${placement}`, text: lines.join('\n')});
    }
  }
}

const additionalCases: SpacingCase[] = [
  {
    name: 'unchecked task continuation after a paragraph',
    text: '- [ ] task\n  ```js\n  const value = 1;\n  ```\n  after\n- [x] done',
  },
  {
    name: 'checked task with intentional blank lines',
    text: '- [x] task\n\n  \n  ```\n  value\n  ```\n\n  \n  after\n- [ ] sibling',
  },
  {
    name: 'ordered task with a nested continuation fence',
    text: '12. [ ] task\n    paragraph\n    ~~~js\n    value\n    ~~~\n    after\n13. [x] done',
  },
  {
    name: 'task inside two blockquotes',
    text: '> > - [ ] task\n> >   ```js\n> >   value\n> >   ```\n> >   after\n> > - sibling',
  },
  {
    name: 'list inside blockquote inside an outer list',
    text: '- outer\n  > 1. inner\n  >    ```js\n  >    value\n  >    ```\n  >    after\n  > 2. sibling\n- tail',
  },
  {
    name: 'double blockquote inside list with intentional empty quote lines',
    text: '- outer\n  > > before\n  > >\n  > > \n  > > ```js\n  > > value\n  > > ```\n  > > \n  > >\n  > > after\n- tail',
  },
  {
    name: 'callout inside list',
    text: '- outer\n  > [!note]\n  > ```js\n  > value\n  > ```\n  > after\n- tail',
  },
  {
    name: 'list inside callout',
    text: '> [!note]\n> - item\n>   ```js\n>   value\n>   ```\n>   after\n> - sibling',
  },
  {
    name: 'multiple fenced blocks in one list item',
    text: '- parent\n  ```js\n  first\n  ```\n  paragraph\n  ~~~text\n  second\n  ~~~\n  after\n- sibling',
    codeCount: 2,
  },
  {
    name: 'multiple fenced blocks with intentional spacing in one list item',
    text: '- parent\n\n  ```js\n  first\n  ```\n  \n\n\n  ~~~text\n  second\n  ~~~\n  \n\n  after\n- sibling',
    codeCount: 2,
  },
  {
    name: 'empty fenced item',
    text: '- before\n- ```\n  ```\n- after',
  },
  {
    name: 'unclosed fence ending at the next item',
    text: '- before\n- ```js\n  const value = 1;\n- sibling',
  },
  {
    name: 'unclosed fence at document end',
    text: '- item\n  ```js\n  const value = 1;',
  },
  {
    name: 'list-looking code content remains literal',
    text: '- ```markdown\n  - inner\n    - deeper\n  12. ordered\n  > quote\n  ```\n- after',
  },
  {
    name: 'tab indentation plus marker-width spaces',
    text: '- root\n\t1. middle\n\t   - ```js\n\t     value\n\t     ```\n\t   - after',
  },
  {
    name: 'tab-only body indentation',
    text: '- root\n\t- ```js\n\t\tvalue\n\t\t```\n\t- after',
  },
  {
    name: 'CRLF list and intentional blank lines',
    text: '- parent\r\n\r\n  ```js\r\n  value\r\n  ```\r\n\r\n\r\n  after\r\n- sibling\r\n',
  },
  {
    name: 'blank lines at the start and end of a list document',
    text: '\n\n- ```js\n  value\n  ```\n\n\n',
  },
];

describe('list fence spacing coverage matrix', () => {
  test.each([...listCases, ...additionalCases])('$name', ({text, codeCount = 1}) => {
    // Require real fenced code nodes so a malformed fixture cannot pass merely
    // because the Markdown parser treated its fences as ordinary text.
    const codePositions = getPositions(MDAstTypes.Code, text);
    const listPositions = getPositions(MDAstTypes.ListItem, text);
    expect(codePositions).toHaveLength(codeCount);
    for (const code of codePositions) {
      expect(text.slice(code.start.offset, code.end.offset)).toMatch(/^(`{3,}|~{3,})/);
      expect(listPositions.some((list) => list.start.offset <= code.start.offset && list.end.offset >= code.end.offset)).toBe(true);
    }
    const once = rule.apply(text);
    expect(once).toBe(text);
    expect(rule.apply(once)).toBe(text);
  });

  test.each(['```', '~~~~'])('formats neighboring top-level %s fences without changing list spacing', (fence) => {
    const list = '- item\n\n  \n  ```js\n  list value\n  ```\n  \n\n  after\n- sibling';
    const before = ['Before', `${fence}text`, 'first', fence, 'Between', '', list, '', 'Outside', `${fence}text`, 'last', fence, 'After'].join('\n');
    const expected = ['Before', '', `${fence}text`, 'first', fence, '', 'Between', '', list, '', 'Outside', '', `${fence}text`, 'last', fence, '', 'After'].join('\n');
    expect(getPositions(MDAstTypes.Code, before)).toHaveLength(3);
    const once = rule.apply(before);
    expect(once).toBe(expected);
    expect(rule.apply(once)).toBe(expected);
  });

  test('retains existing ordinary blockquote spacing after a nested list ends', () => {
    const list = '> - item\n>   ```js\n>   list value\n>   ```\n> - sibling';
    const before = `${list}\n>\n> Outside\n> ~~~text\n> quoted value\n> ~~~\n> After`;
    // The existing blockquote helper deliberately keeps spacing next to normal
    // quote fences. Callout headers take the formatting path checked below.
    expect(getPositions(MDAstTypes.Code, before)).toHaveLength(2);
    const once = rule.apply(before);
    expect(once).toBe(before);
    expect(rule.apply(once)).toBe(before);
  });

  test('formats a neighboring callout fence outside the list', () => {
    const list = '- item\n  ```js\n  list value\n  ```\n- sibling';
    const before = `${list}\n\n> [!note]\n> ~~~text\n> quoted value\n> ~~~`;
    const expected = `${list}\n\n> [!note]\n>\n> ~~~text\n> quoted value\n> ~~~`;
    expect(getPositions(MDAstTypes.Code, before)).toHaveLength(2);
    const once = rule.apply(before);
    expect(once).toBe(expected);
    expect(rule.apply(once)).toBe(expected);
  });
});
