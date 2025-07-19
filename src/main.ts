import { Plugin} from 'obsidian';

import { BookSearchSettingTab, BookSearchPluginSettings, DEFAULT_SETTINGS } from '@settings/settings';
import { BookNote } from '@handlers/book_note_handler';

export default class BookSearchPlugin extends Plugin {
  settings: BookSearchPluginSettings;

  async onload() {
    await this.loadSettings();

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon('book-alert', 'Create new book note', () => this.createNewBookNote());
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('obsidian-book-search-plugin-ribbon-class');

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-book-search-modal',
      name: 'Create new book note',
      callback: () => this.createNewBookNote(),
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new BookSearchSettingTab(this.app, this));

    console.log(`Book Search: version ${this.manifest.version} (requires obsidian ${this.manifest.minAppVersion})`);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async createNewBookNote() {
    const selectedMediaNote = new BookNote(this.settings, this.app, this);
    selectedMediaNote.createNote();
  }
}
