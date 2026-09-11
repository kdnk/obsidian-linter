import {formatYAML} from '../utils/yaml';
import {Options, RuleType} from '../rules';
import RuleBuilder, {BooleanOptionBuilder, ExampleBuilder, OptionBuilderBase} from './rule-builder';
import dedent from 'ts-dedent';
import {isScalar, parseDocument, visit} from 'yaml';

class CompactYamlOptions implements Options {
  innerNewLines: boolean = false;
}

@RuleBuilder.register
export default class CompactYaml extends RuleBuilder<CompactYamlOptions> {
  constructor() {
    super({
      nameKey: 'rules.compact-yaml.name',
      descriptionKey: 'rules.compact-yaml.description',
      type: RuleType.SPACING,
    });
  }
  get OptionsClass(): new () => CompactYamlOptions {
    return CompactYamlOptions;
  }
  apply(text: string, options: CompactYamlOptions): string {
    return formatYAML(text, (text) => {
      // The closing frontmatter marker is not a second YAML document. Keep the
      // opening marker so scalar ranges refer to the original text offsets.
      const document = parseDocument(text.slice(0, -3));
      if (document.errors.length > 0) {
        return text;
      }

      const scalarRanges: [number, number][] = [];
      const anchors = new Set<string>();
      let hasUnresolvedAlias = false;
      visit(document, {
        Alias: (_key, node) => {
          // Validate references in source order without expanding alias graphs.
          if (!anchors.has(node.source)) {
            hasUnresolvedAlias = true;
            return visit.BREAK;
          }
        },
        Value: (_key, node) => {
          if (node.anchor) anchors.add(node.anchor);
          if (isScalar(node) && node.range) {
            scalarRanges.push([node.range[0], node.range[1]]);
          }
        },
      });
      if (hasUnresolvedAlias) {
        return text;
      }

      return text.replace(/\n{2,}/g, (newlines: string, offset: number) => {
        const atBoundary = offset === 3 || offset + newlines.length === text.length - 3;
        if (!options.innerNewLines && !atBoundary) {
          return newlines;
        }

        let compacted = '\n';
        for (let i = 1; i < newlines.length; i++) {
          // Scalar ranges include meaningful blank lines, including trailing
          // newlines preserved by the keep chomping indicator (|+ and >+).
          if (scalarRanges.some(([start, end]) => start <= offset + i && offset + i < end)) {
            compacted += '\n';
          }
        }

        return compacted;
      });
    });
  }
  get exampleBuilders(): ExampleBuilder<CompactYamlOptions>[] {
    return [
      new ExampleBuilder({
        description: 'Remove blank lines at the start and end of the YAML',
        before: dedent`
          ---
          ${''}
          date: today
          ${''}
          title: unchanged without inner new lines turned on
          ${''}
          ---
        `,
        after: dedent`
          ---
          date: today
          ${''}
          title: unchanged without inner new lines turned on
          ---
        `,
      }),
      new ExampleBuilder({
        description: 'Remove blank lines anywhere in YAML with inner new lines set to true',
        before: dedent`
          ---
          ${''}
          date: today
          ${''}
          ${''}
          title: remove inner new lines
          ${''}
          ---
          ${''}
          # Header 1
          ${''}
          ${''}
          Body content here.
        `,
        after: dedent`
          ---
          date: today
          title: remove inner new lines
          ---
          ${''}
          # Header 1
          ${''}
          ${''}
          Body content here.
        `,
        options: {
          innerNewLines: true,
        },
      }),
    ];
  }
  get optionBuilders(): OptionBuilderBase<CompactYamlOptions>[] {
    return [
      new BooleanOptionBuilder({
        OptionsClass: CompactYamlOptions,
        nameKey: 'rules.compact-yaml.inner-new-lines.name',
        descriptionKey: 'rules.compact-yaml.inner-new-lines.description',
        optionsKey: 'innerNewLines',
      }),
    ];
  }
}
