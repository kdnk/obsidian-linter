import LinterPlugin from '../src/main';
import {DEFAULT_SETTINGS, LinterSettings} from '../src/settings-data';

jest.mock('obsidian', () => ({
  ...jest.requireActual('../__mocks__/obsidian'),
  Plugin: class {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    registerEvent() {}
  },
  PluginSettingTab: class {},
  EditorSuggest: class {},
  ItemView: class {},
  MarkdownView: class {},
  debounce: (callback: unknown) => callback,
  normalizePath: (path: string) => path,
}));

function fixture() {
  Object.assign(globalThis, {window: {CodeMirrorAdapter: {commands: {}}}});
  const file = {path: 'note.md', extension: 'md'};
  const editor = {cm: {}, text: ''};
  const native = jest.fn((_checking: boolean) => true);
  const save = {checkCallback: native as (checking: boolean) => boolean | void};
  const app = {
    commands: {commands: {'editor:save-file': save}},
    workspace: {
      on: () => ({}),
      offref: () => {},
      onLayoutReady: () => {},
      getActiveFile: () => file,
      getActiveViewOfType: () => ({file, editor}),
    },
    metadataCache: {on: () => ({})},
  };
  const load = () => {
    const plugin = new LinterPlugin(app as never, {} as never);
    plugin.settings = {...DEFAULT_SETTINGS, lintOnSave: true} as LinterSettings;
    plugin.runLinterEditor = async () => { editor.text += 'linted\n'; };
    plugin.registerEventsAndSaveCallback();
    return plugin;
  };
  return {save, native, editor, load};
}

describe('save callback lifecycle', () => {
  it('keeps a later wrapper installed when Linter unloads', async () => {
    const f = fixture();
    const plugin = f.load();
    const previous = f.save.checkCallback;
    const laterWrapper = (checking: boolean) => previous(checking);
    f.save.checkCallback = laterWrapper;

    await plugin.onunload();
    expect(f.save.checkCallback).toBe(laterWrapper);
    expect(f.save.checkCallback(false)).toBe(true);
    expect(f.editor.text).toBe('');
    expect(f.native).toHaveBeenCalledTimes(1);
  });

  it.each(['older first', 'newer first'])('runs only the enabled Linter after unloading %s', async (order) => {
    const f = fixture();
    const older = f.load();
    const newer = f.load();
    const first = order === 'older first' ? older : newer;
    const second = order === 'older first' ? newer : older;
    await first.onunload();

    f.save.checkCallback(false);
    expect(f.editor.text).toBe('linted\n');
    expect(f.native).toHaveBeenCalledTimes(1);

    await second.onunload();
    expect(f.save.checkCallback(false)).toBe(true);
    expect(f.editor.text).toBe('linted\n');
    expect(f.native).toHaveBeenCalledTimes(2);
  });

  it('preserves availability checks without running Linter', () => {
    const f = fixture();
    f.native.mockReturnValue(false);
    f.load();
    expect(f.save.checkCallback(true)).toBe(false);
    expect(f.editor.text).toBe('');
    expect(f.native).toHaveBeenCalledWith(true);
  });

  it('keeps delegating when lint-on-save is disabled', () => {
    const f = fixture();
    const plugin = f.load();
    plugin.settings.lintOnSave = false;
    expect(f.save.checkCallback(false)).toBe(true);
    expect(f.editor.text).toBe('');
    expect(f.native).toHaveBeenCalledWith(false);
  });
});
