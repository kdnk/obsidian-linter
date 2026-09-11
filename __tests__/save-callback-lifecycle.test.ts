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
  const vimSave = () => {};
  Object.assign(globalThis, {window: {CodeMirrorAdapter: {commands: {save: vimSave}}}});
  const handlers = new Map<string, () => Promise<void>>();
  const file = {path: 'note.md', extension: 'md'};
  const editor = {cm: {}, text: ''};
  const native = jest.fn((_checking: boolean) => true);
  const save = {checkCallback: native as (checking: boolean) => boolean | void};
  const app = {
    commands: {commands: {'editor:save-file': save}},
    workspace: {
      on: (event: string, callback: () => Promise<void>) => {
        handlers.set(event, callback);
        return {};
      },
      offref: () => {},
      onLayoutReady: () => {},
      getActiveFile: () => file,
      getActiveViewOfType: () => ({file, editor}),
    },
    metadataCache: {on: () => ({})},
    vault: {adapter: {exists: async () => true}},
  };
  const load = () => {
    const plugin = new LinterPlugin(app as never, {} as never);
    plugin.settings = {...DEFAULT_SETTINGS, lintOnSave: true, lintOnFileChange: true} as LinterSettings;
    plugin.runLinterEditor = async () => { editor.text += 'linted\n'; };
    plugin.registerEvents();
    return plugin;
  };
  return {save, native, editor, load, handlers, app, vimSave};
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

  it('leaves saving to the existing handler even with legacy auto-lint settings', () => {
    const f = fixture();
    f.load();
    expect(f.save.checkCallback(false)).toBe(true);
    expect(f.editor.text).toBe('');
    expect(f.save.checkCallback).toBe(f.native);
    expect(f.native).toHaveBeenCalledTimes(1);
  });

  it('leaves the existing Vim save handler installed', () => {
    const f = fixture();
    f.load();
    expect(window.CodeMirrorAdapter.commands.save).toBe(f.vimSave);
  });

  it('does not lint the previous file when the active leaf changes', async () => {
    const f = fixture();
    const plugin = f.load();
    plugin.runLinterFile = async () => { f.editor.text += 'linted\n'; };
    f.app.workspace.getActiveFile = () => ({path: 'other.md', extension: 'md'});
    await f.handlers.get('active-leaf-change')?.();
    expect(f.editor.text).toBe('');
  });

  it('removes legacy automatic formatting keys when persisting settings', async () => {
    const f = fixture();
    const plugin = f.load();
    plugin.settings = {
      ...plugin.settings,
      ruleConfigs: {},
      settingsConvertedToConfigKeyValues: true,
      displayChanged: false,
      displayLintOnFileChangeNotice: true,
    } as LinterSettings;
    let savedSettings: LinterSettings;
    plugin.saveSettings = async () => { savedSettings = JSON.parse(JSON.stringify(plugin.settings)); };

    await plugin['makeSureSettingsFilledInAndCleanupSettings']();

    expect(savedSettings).not.toHaveProperty('lintOnSave');
    expect(savedSettings).not.toHaveProperty('lintOnFileChange');
    expect(savedSettings).not.toHaveProperty('displayLintOnFileChangeNotice');
    expect(savedSettings.displayChanged).toBe(false);
    expect(savedSettings.ruleConfigs).toHaveProperty('yaml-timestamp');
  });

  it('preserves availability checks without running Linter', () => {
    const f = fixture();
    f.native.mockReturnValue(false);
    f.load();
    expect(f.save.checkCallback(true)).toBe(false);
    expect(f.editor.text).toBe('');
    expect(f.native).toHaveBeenCalledWith(true);
  });

});
