import { vi } from 'vitest';

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
		const text = {
			setPlaceholder: vi.fn().mockReturnThis(),
			setValue: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockImplementation((changeCb: any) => {
				changeCb('new-value');
				return text;
			}),
			inputEl: { type: '' }
		};
		cb(text);
		return this;
	});
	addDropdown = vi.fn().mockImplementation((cb: any) => {
		cb({
			addOption: vi.fn().mockReturnThis(),
			setValue: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockImplementation((changeCb: any) => {
				changeCb('new-model');
				return { addOption: vi.fn().mockReturnThis(), setValue: vi.fn().mockReturnThis() };
			})
		});
		return this;
	});
	addToggle = vi.fn().mockImplementation((cb: any) => {
		cb({
			setValue: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockImplementation((changeCb: any) => {
				changeCb(true);
				return { setValue: vi.fn().mockReturnThis() };
			})
		});
		return this;
	});
	addTextArea = vi.fn().mockImplementation((cb: any) => {
		cb({
			setPlaceholder: vi.fn().mockReturnThis(),
			setValue: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockImplementation((changeCb: any) => {
				changeCb('new-paths');
				return { setPlaceholder: vi.fn().mockReturnThis(), setValue: vi.fn().mockReturnThis() };
			})
		});
		return this;
	});
}

export const Notice = vi.fn();

export class ItemView {
	containerEl: any;
	constructor(public leaf: any) {
		this.containerEl = {
			children: [
				null,
				{
					empty: vi.fn(),
					addClass: vi.fn(),
					createEl: vi.fn().mockImplementation((tag: string) => {
						const el = {
							addEventListener: vi.fn(),
							appendChild: vi.fn(),
							createEl: vi.fn().mockReturnThis(),
							createDiv: vi.fn().mockReturnThis(),
							type: '',
							value: '',
							onclick: null as any,
							textContent: '',
							querySelector: vi.fn().mockReturnValue({ textContent: '' })
						};
						return el;
					}),
					createDiv: vi.fn().mockImplementation(() => {
						const el = {
							createDiv: vi.fn().mockReturnThis(),
							createEl: vi.fn().mockImplementation((tag: string) => {
								return {
									addEventListener: vi.fn(),
									appendChild: vi.fn(),
									createEl: vi.fn().mockReturnThis(),
									createDiv: vi.fn().mockReturnThis(),
									type: '',
									value: '',
									onclick: null as any,
									textContent: '',
									querySelector: vi.fn().mockReturnValue({ textContent: '' })
								};
							}),
							appendChild: vi.fn(),
							scrollTop: 0,
							scrollHeight: 0,
							querySelector: vi.fn().mockReturnValue({ textContent: '' }),
							addClass: vi.fn()
						};
						return el;
					})
				}
			]
		};
	}
	async onOpen() {}
	async onClose() {}
}

export class TFile {}
export class TFolder {}
export class TAbstractFile {}
