import LinterPlugin from '../src/main';
import {DEFAULT_SETTINGS, LinterSettings} from '../src/settings-data';

jest.mock('obsidian', () => ({
  ...jest.requireActual('../__mocks__/obsidian'),
  Plugin: class {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
  },
  PluginSettingTab: class {},
  EditorSuggest: class {},
  ItemView: class {},
  MarkdownView: class {},
  debounce: (callback: unknown) => callback,
  normalizePath: (path: string) => path,
}));

function fixture(currentSettings: LinterSettings | null) {
  const legacySettings = {...DEFAULT_SETTINGS, linterLocale: 'ja'} as LinterSettings;
  const adapter = {
    exists: jest.fn().mockResolvedValue(true),
    read: jest.fn().mockResolvedValue(JSON.stringify(legacySettings)),
  };
  const plugin = new LinterPlugin({vault: {configDir: '.obsidian', adapter}} as never, {} as never);
  plugin.loadData = jest.fn().mockResolvedValue(currentSettings);
  plugin.saveData = jest.fn().mockResolvedValue();
  plugin.setOrUpdateMomentInstance = jest.fn().mockResolvedValue();
  plugin.updatePasteOverrideStatus = jest.fn();
  plugin.updateHasCustomCommandStatus = jest.fn();
  return {adapter, legacySettings, plugin};
}

describe('settings ID migration', () => {
  it('copies settings from the previous plugin ID when no current settings exist', async () => {
    const f = fixture(null);

    await f.plugin.loadSettings();

    expect(f.adapter.exists).toHaveBeenCalledWith('.obsidian/plugins/obsidian-linter/data.json');
    expect(f.adapter.read).toHaveBeenCalledWith('.obsidian/plugins/obsidian-linter/data.json');
    expect(f.plugin.saveData).toHaveBeenCalledWith(f.legacySettings);
    expect(f.plugin.settings.linterLocale).toBe('ja');
  });

  it('keeps settings already stored under the new plugin ID', async () => {
    const currentSettings = {...DEFAULT_SETTINGS, linterLocale: 'de'} as LinterSettings;
    const f = fixture(currentSettings);

    await f.plugin.loadSettings();

    expect(f.adapter.exists).not.toHaveBeenCalled();
    expect(f.plugin.saveData).not.toHaveBeenCalled();
    expect(f.plugin.settings.linterLocale).toBe('de');
  });
});
