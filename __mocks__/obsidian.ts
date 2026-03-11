import { vi } from 'vitest';

export const Notice = vi.fn();
export const addIcon = vi.fn();

const createMockElement = (tag?: string, options?: any) => {
	const children: any[] = [];
	const el: any = {
		addEventListener: vi.fn(),
		appendChild: vi.fn().mockImplementation((child) => {
			children.push(child);
			return child;
		}),
		createEl: vi.fn().mockImplementation((t, opts) => {
			const child = createMockElement(t, opts);
			children.push(child);
			return child;
		}),
		createDiv: vi.fn().mockImplementation((opts) => {
			const child = createMockElement('div', opts);
			children.push(child);
			return child;
		}),
		type: '',
		value: '',
		onclick: null as any,
		textContent: (typeof options === 'string' ? options : options?.text) || '',
		querySelector: vi.fn().mockImplementation((sel) => {
			if (sel === 'h4') return children.find(c => c._tag === 'h4');
			if (sel === '.gemini-message-content') {
				const found = children.find(c => c._cls === 'gemini-message-content');
				if (found) return found;
				// recursive search
				for (const child of children) {
					const deep = child.querySelector(sel);
					if (deep && deep.textContent !== '') return deep; // dummy check for found
				}
			}
			if (sel === '.gemini-header-title') return children.find(c => c._cls === 'gemini-header-title');
			// Return a mock element instead of empty object to avoid "empty is not a function"
			return createMockElement('div', { cls: 'mock-found' });
		}),
		addClass: vi.fn().mockImplementation((cls) => { el._cls = cls; return el; }),
		removeClass: vi.fn().mockReturnThis(),
		empty: vi.fn().mockImplementation(() => { children.length = 0; }),
		remove: vi.fn(),
		addOption: vi.fn().mockReturnThis(),
		setPlaceholder: vi.fn().mockReturnThis(),
		setValue: vi.fn().mockReturnThis(),
		onChange: vi.fn().mockImplementation((changeCb: any) => {
			if (typeof changeCb === 'function') {
				// can be triggered manually in tests
			}
			return el;
		}),
		inputEl: { type: '' },
		style: { height: '' },
		scrollTop: 0,
		scrollHeight: 0,
		_tag: tag,
		_cls: typeof options === 'object' ? options?.cls : ''
	};
	el.inputEl = el; // For Setting component compatibility
	return el;
};

export class Plugin {
	app: any;
	manifest: any;
	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}
	loadData = vi.fn();
	saveData = vi.fn();
	addSettingTab = vi.fn();
	addRibbonIcon = vi.fn();
	addCommand = vi.fn();
	registerView = vi.fn();
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: HTMLElement;
	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}
	display() {}
	hide() {}
}

export class Setting {
	constructor(public containerEl: HTMLElement) {}
	setName = vi.fn().mockReturnThis();
	setDesc = vi.fn().mockReturnThis();
	addText = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange.mockImplementation((changeCb: any) => {
			changeCb('new-value');
			return el;
		});
		cb(el);
		return this;
	});
	addDropdown = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange.mockImplementation((changeCb: any) => {
			changeCb('new-model');
			return el;
		});
		cb(el);
		return this;
	});
	addToggle = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange.mockImplementation((changeCb: any) => {
			changeCb(true);
			return el;
		});
		cb(el);
		return this;
	});
	addTextArea = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange.mockImplementation((changeCb: any) => {
			changeCb('new-paths');
			return el;
		});
		cb(el);
		return this;
	});
}

export class ItemView {
	containerEl: any;
	contentEl: any;
	navigation = false;
	icon = '';
	constructor(public leaf: any) {
		this.contentEl = createMockElement();
		this.containerEl = createMockElement();
		this.containerEl.children = [null, this.contentEl];
	}
	async onOpen() {}
	async onClose() {}
	getViewType() { return ''; }
	getDisplayText() { return ''; }
}

export class SuggestModal<T> {
	constructor(public app: App) {}
	open() {}
	close() {}
	setPlaceholder(p: string) {}
}

export class FuzzySuggestModal<T> extends SuggestModal<T> {
	getItemText(item: T) { return ''; }
	getItems() { return []; }
	onChooseItem(item: T, evt: any) {}
}

export class MarkdownRenderer {
	static render = vi.fn().mockResolvedValue(undefined);
}

export class TFile {}
export class TFolder {}
export class TAbstractFile {}
