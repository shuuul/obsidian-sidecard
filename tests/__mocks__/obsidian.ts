export class TAbstractFile {
  path: string;

  constructor(path = '') {
    this.path = path;
  }
}

export class TFile extends TAbstractFile {
  basename: string;
  extension: string;

  constructor(path: string) {
    super(path);
    const name = path.split('/').pop() ?? path;
    const extensionMatch = /\.([^.]+)$/.exec(name);
    this.extension = extensionMatch?.[1] ?? '';
    this.basename = extensionMatch ? name.slice(0, -(this.extension.length + 1)) : name;
  }
}

export class Plugin {
  app: any;
  private data: unknown;

  constructor(app?: any, data?: unknown) {
    this.app = app ?? { vault: { getAbstractFileByPath: jest.fn() } };
    this.data = data;
  }

  loadData = jest.fn(async () => this.data);
  saveData = jest.fn(async (data: unknown) => {
    this.data = data;
  });
}

export class Notice {
  constructor(public message: string) {}
}

export class ItemView {}
export class MarkdownView {}
export class WorkspaceLeaf {}

export const MarkdownRenderer = {
  render: jest.fn(async () => undefined),
};

export function setIcon(): void {}
