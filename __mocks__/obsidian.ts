import { vi } from 'vitest';

export const Notice = vi.fn();
export const addIcon = vi.fn();
export const setIcon = vi.fn();
export const requestUrl = vi.fn().mockResolvedValue({
	json: { models: [] }
});

interface MockElement {
	_tag?: string;
	_cls?: string;
	_children: Array<MockElement | string | null>;
	addEventListener: ReturnType<typeof vi.fn>;
	appendChild: ReturnType<typeof vi.fn>;
	createEl: ReturnType<typeof vi.fn>;
	createDiv: ReturnType<typeof vi.fn>;
	createSpan: ReturnType<typeof vi.fn>;
	addClass: ReturnType<typeof vi.fn>;
	removeClass: ReturnType<typeof vi.fn>;
	empty: ReturnType<typeof vi.fn>;
	remove: ReturnType<typeof vi.fn>;
	addOption: ReturnType<typeof vi.fn>;
	setPlaceholder: ReturnType<typeof vi.fn>;
	setValue: ReturnType<typeof vi.fn>;
	setCssProps: ReturnType<typeof vi.fn>;
	onChange: ReturnType<typeof vi.fn>;
	textContent: string;
	type: string;
	value: string;
	onclick: ((e: any) => void) | null;
	oninput: ((e: any) => void) | null;
	onchange: (() => void) | null;
	inputEl: any;
	style: { height: string };
	scrollTop: number;
	scrollHeight: number;
	firstElementChild: MockElement | null;
}

const createMockElement = (tag?: string, options?: { text?: string; cls?: string } | string): MockElement => {
	const children: Array<MockElement | string | null> = [];
	const text = (typeof options === 'string' ? options : options?.text) || '';
	if (text) children.push(text);

	const el: MockElement = {
		_tag: tag,
		_cls: typeof options === 'object' ? options?.cls : (typeof options === 'string' ? options : ''),
		_children: children,
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
		addClass: vi.fn().mockImplementation((cls) => { (el as any)._cls = cls; return el; }),
		removeClass: vi.fn().mockReturnThis(),
		empty: vi.fn().mockImplementation(() => { children.length = 0; }),
		remove: vi.fn().mockImplementation(() => { children.length = 0; }),
		addOption: vi.fn().mockReturnThis(),
		setPlaceholder: vi.fn().mockReturnThis(),
		setValue: vi.fn().mockReturnThis(),
		setCssProps: vi.fn().mockReturnThis(),
		onChange: vi.fn().mockReturnThis(),
		textContent: text,
		type: '',
		value: '',
		onclick: null,
		oninput: null,
		onchange: null,
		inputEl: null,
		style: { height: '' },
		scrollTop: 0,
		scrollHeight: 0,
		get firstElementChild() {
			return (children.find(c => typeof c === 'object' && c !== null) as MockElement) || null;
		}
	};
	el.inputEl = el;
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
	containerEl: HTMLElement = createMockElement() as any;
	constructor(public app: any, public plugin: any) {}
	display() {}
	hide() {}
}

export class Setting {
	constructor(public containerEl: HTMLElement) {}
	setName = vi.fn().mockReturnThis();
	setDesc = vi.fn().mockReturnThis();
	setHeading = vi.fn().mockReturnThis();
	addText = vi.fn().mockImplementation((cb: (text: any) => void) => {
		const el = createMockElement();
		cb(el);
		return this;
	});
	addDropdown = vi.fn().mockImplementation((cb: (dropdown: any) => void) => {
		const el = createMockElement();
		cb(el);
		return this;
	});
	addToggle = vi.fn().mockImplementation((cb: (toggle: any) => void) => {
		const el = createMockElement();
		cb(el);
		return this;
	});
	addTextArea = vi.fn().mockImplementation((cb: (textArea: any) => void) => {
		const el = createMockElement();
		cb(el);
		return this;
	});
}

export class ItemView {
	containerEl: HTMLElement = createMockElement() as any;
	contentEl: HTMLElement = createMockElement() as any;
	navigation = false;
	icon = '';
	constructor(public leaf: any) {}
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
	getItems(): T[] { return []; }
	onChooseItem(item: T, evt: MouseEvent | KeyboardEvent) {}
}

export class MarkdownRenderer {
	static render = vi.fn().mockImplementation((_app, text, el) => {
		el.textContent = text;
		return Promise.resolve();
	});
}

export class TFile {
	extension: string;
	path: string;
	basename: string;
}
export class TFolder {
	path: string;
	children: Array<TFile | TFolder>;
}
export class TAbstractFile {
	path: string;
}
