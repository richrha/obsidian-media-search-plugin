import { Notice, TFile, requestUrl } from 'obsidian';
import { BookSearchModal } from '@views/book_search_modal';
import { BookSuggestModal } from '@views/book_suggest_modal';
import { Book } from '@models/book.model';
import { BookSearchPluginSettings } from '@settings/settings';
import {
  getTemplateContents,
  applyTemplateTransformations,
  useTemplaterPluginInFile,
  executeInlineScriptsTemplates,
} from '@utils/template';
import { replaceVariableSyntax, makeFileName, applyDefaultFrontMatter, toStringFrontMatter } from '@utils/utils';
import { CursorJumper } from '@utils/cursor_jumper';


export class BookNote {
  settings: BookSearchPluginSettings;
  app: unknown;
  bookplugin: unknown;

  constructor (settings, app, thisplugin){
    this.settings = settings;
    this.app = app;
    this.bookplugin =thisplugin;
  }
  
  async createNote(): Promise<void> {
    try {
      const book = await this.searchBookMetadata();
      const renderedContents = await this.getRenderedContents(book);
  
      // TODO: If the same file exists, it asks if you want to overwrite it.
      // create new File
      const fileName = makeFileName(book, this.settings.fileNameFormat);
      const filePath = `${this.settings.folder}/${fileName}`;
      const targetFile = await this.app.vault.create(filePath, renderedContents);
  
      // if use Templater plugin
      await useTemplaterPluginInFile(this.app, targetFile);
      this.openNewBookNote(targetFile);
    } catch (err) {
        console.warn(err);
        this.showNotice(err);
      }
  }
  
  // open modal for book search
  async searchBookMetadata(query?: string): Promise<Book> {
    const searchedBooks = await this.openBookSearchModal(query);
    return await this.openBookSuggestModal(searchedBooks);
  }
  
  async openBookSearchModal(query = ''): Promise<Book[]> {
    return new Promise((resolve, reject) => {
      return new BookSearchModal(this.bookplugin, query, (error, results) => {
        return error ? reject(error) : resolve(results);
      }).open();
    });
  }
  
  async openBookSuggestModal(books: Book[]): Promise<Book> {
    return new Promise((resolve, reject) => {
      return new BookSuggestModal(this.app, this.settings.showCoverImageInSearch, books, (error, selectedBook) => {
        return error ? reject(error) : resolve(selectedBook);
      }).open();
    });
  }
  
  async getRenderedContents(book: Book) {
    const {
      templateFile,
      useDefaultFrontmatter,
      defaultFrontmatterKeyType,
      enableCoverImageSave,
      coverImagePath,
      frontmatter, // @deprecated
      content, // @deprecated
    } = this.settings;
  
    let contentBody = '';
  
    if (enableCoverImageSave) {
      const coverImageUrl = book.coverLargeUrl || book.coverMediumUrl || book.coverSmallUrl || book.coverUrl;
      if (coverImageUrl) {
        const imageName = makeFileName(book, this.settings.fileNameFormat, 'jpg');
        book.localCoverImage = await this.downloadAndSaveImage(imageName, coverImagePath, coverImageUrl);
      }
    }
  
    if (templateFile) {
      const templateContents = await getTemplateContents(this.app, templateFile);
      const replacedVariable = replaceVariableSyntax(book, applyTemplateTransformations(templateContents));
      contentBody += executeInlineScriptsTemplates(book, replacedVariable);
    } else {
      let replacedVariableFrontmatter = replaceVariableSyntax(book, frontmatter); // @deprecated
      if (useDefaultFrontmatter) {
        replacedVariableFrontmatter = toStringFrontMatter(
          applyDefaultFrontMatter(book, replacedVariableFrontmatter, defaultFrontmatterKeyType),
        );
      }
      const replacedVariableContent = replaceVariableSyntax(book, content);
      contentBody += replacedVariableFrontmatter
        ? `---\n${replacedVariableFrontmatter}\n---\n${replacedVariableContent}`
        : replacedVariableContent;
    }
  
    return contentBody;
  }
  
  
  async openNewBookNote(targetFile: TFile) {
    if (!this.settings.openPageOnCompletion) return;

    // open file
    const activeLeaf = this.app.workspace.getLeaf();
    if (!activeLeaf) {
      console.warn('No active leaf');
      return;
    }

    await activeLeaf.openFile(targetFile, { state: { mode: 'source' } });
    activeLeaf.setEphemeralState({ rename: 'all' });
    // cursor focus
    await new CursorJumper(this.app).jumpToNextCursorLocation();
  }

  async downloadAndSaveImage(imageName: string, directory: string, imageUrl: string): Promise<string> {
    const { enableCoverImageSave } = this.settings;
    if (!enableCoverImageSave) {
      console.warn('Cover image saving is not enabled.');
      return '';
    }

    try {
      // Use Obsidian's requestUrl method to fetch the image data:
      const response = await requestUrl({
        url: imageUrl,
        method: 'GET',
        headers: {
          Accept: 'image/*',
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const imageData = response.arrayBuffer;
      const filePath = `${directory}/${imageName}`;
      await this.app.vault.adapter.writeBinary(filePath, imageData);
      return filePath;
    } catch (error) {
      console.error('Error downloading or saving image:', error);
      return '';
    }
  }

  showNotice(message: unknown) {
    try {
      new Notice(message?.toString());
    } catch {
      // eslint-disable
    }
  }

}