import { vi } from 'vitest';

export const Notice = vi.fn();
export const addIcon = vi.fn();
export const setIcon = vi.fn();
export const requestUrl = vi.fn().mockResolvedValue({
	json: { models: [] }
});

const createMockElement = (tag?: string, options?: any) => {
	const children: any[] = [];
	const text = (typeof options === 'string' ? options : options?.text) || '';
	if (text) children.push(text);

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
		createSpan: vi.fn().mockImplementation((opts) => {
			const child = createMockElement('span', opts);
			children.push(child);
			return child;
		}),
		type: '',
		value: '',
		onclick: null as any,
		textContent: text,
		addClass: vi.fn().mockImplementation((cls) => { el._cls = cls; return el; }),
		removeClass: vi.fn().mockReturnThis(),
		empty: vi.fn().mockImplementation(() => { children.length = 0; }),
		remove: vi.fn().mockImplementation(() => {
			children.length = 0;
		}),
		addOption: vi.fn().mockReturnThis(),
		setPlaceholder: vi.fn().mockReturnThis(),
		setValue: vi.fn().mockReturnThis(),
		setCssProps: vi.fn().mockReturnThis(),
		onChange: vi.fn().mockReturnThis(),
		inputEl: { type: '' },
		style: {
			height: ''
		},
		scrollTop: 0,
		scrollHeight: 0,
		_tag: tag,
		_cls: typeof options === 'object' ? options?.cls : (typeof options === 'string' ? options : ''),
		_children: children,
		firstElementChild: null as any
	};
	el.inputEl = el; 
	
	Object.defineProperty(el, 'firstElementChild', {
		get: () => children.find(c => typeof c === 'object') || null
	});

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
	setHeading = vi.fn().mockReturnThis();
	addText = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange = vi.fn().mockImplementation((changeCb: any) => {
			changeCb('new-value');
			return el;
		});
		cb(el);
		return this;
	});
	addDropdown = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange = vi.fn().mockImplementation((changeCb: any) => {
			changeCb('new-model');
			return el;
		});
		cb(el);
		return this;
	});
	addToggle = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange = vi.fn().mockImplementation((changeCb: any) => {
			changeCb(true);
			return el;
		});
		cb(el);
		return this;
	});
	addTextArea = vi.fn().mockImplementation((cb: any) => {
		const el = createMockElement();
		el.onChange = vi.fn().mockImplementation((changeCb: any) => {
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
		this.containerEl._children = [null, this.contentEl];
	}
	async onOpen() {}
	async onClose() {}
	getViewType() { return ''; }
	getDisplayText() { return ''; }
}

export class SuggestModal<T> {
	constructor(public app: any) {}
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
	static render = vi.fn().mockImplementation((app, text, el) => {
		el.textContent = text;
		return Promise.resolve();
	});
}

export class TFile {}
export class TFolder {}
export class TAbstractFile {}
