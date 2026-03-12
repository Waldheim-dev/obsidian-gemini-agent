import { describe, it, expect, vi, beforeEach } from 'vitest';
import GeminiAgentPlugin, { DEFAULT_SETTINGS, GeminiAgentSettingTab } from './main';
import { Notice, requestUrl, App, TFile, WorkspaceLeaf, Command } from 'obsidian';

// Mock Google AI
vi.mock('@google/generative-ai', () => {
	return {
		GoogleGenerativeAI: class {
			getGenerativeModel = vi.fn().mockImplementation((config: { model: string }) => ({
				model: config.model,
				generateContent: vi.fn().mockResolvedValue({
					response: { text: () => 'Summary' }
				})
			}));
		}
	};
});

interface MockApp extends App {
	secretStorage: {
		getSecret: ReturnType<typeof vi.fn>;
		setSecret: ReturnType<typeof vi.fn>;
	};
}

describe('GeminiAgentPlugin', () => {
	let plugin: GeminiAgentPlugin;
	let mockApp: MockApp;

	beforeEach(() => {
		mockApp = {
			secretStorage: {
				getSecret: vi.fn(),
				setSecret: vi.fn()
			},
			workspace: {
				getActiveFile: vi.fn(),
				getLeavesOfType: vi.fn().mockReturnValue([]),
				getLeaf: vi.fn().mockReturnValue({ setViewState: vi.fn().mockResolvedValue(undefined) }),
				getRightLeaf: vi.fn().mockReturnValue({ setViewState: vi.fn().mockResolvedValue(undefined) }),
				revealLeaf: vi.fn(),
				detachLeavesOfType: vi.fn()
			},
			vault: {
				read: vi.fn().mockResolvedValue('Content'),
				adapter: {
					exists: vi.fn().mockResolvedValue(false),
					read: vi.fn().mockResolvedValue(''),
					write: vi.fn().mockResolvedValue(undefined)
				}
			},
			fileManager: {
				processFrontMatter: vi.fn()
			}
		} as unknown as MockApp;
		
		plugin = new GeminiAgentPlugin(mockApp, { id: 'test' } as any);
		plugin.app = mockApp;
		plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
		(plugin as any).saveData = vi.fn().mockResolvedValue(undefined);
		(plugin as any).loadData = vi.fn().mockResolvedValue({});
	});

	it('should load settings correctly', async () => {
		(plugin as any).loadData = vi.fn().mockResolvedValue({ modelName: 'm1' });
		mockApp.secretStorage.getSecret.mockReturnValue('key');
		await plugin.loadSettings();
		expect(plugin.settings.modelName).toBe('m1');
		expect(plugin.settings.apiKey).toBe('key');
	});

	it('should handle missing settings in loadSettings', async () => {
		(plugin as any).loadData = vi.fn().mockResolvedValue(null);
		await plugin.loadSettings();
		expect(plugin.settings.modelName).toBe('auto');
	});

	it('should save settings and handle empty API key', async () => {
		plugin.settings.apiKey = '';
		await plugin.saveSettings();
		expect(plugin.genAI).toBeNull();
	});

	it('should summarize current note and handle error', async () => {
		plugin.genAI = { getGenerativeModel: vi.fn().mockReturnValue({
			generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Summary' } })
		}) } as any;
		
		const mockFile = new TFile();
		mockFile.basename = 'test';
		(mockApp.workspace.getActiveFile as any).mockReturnValue(mockFile);
		(mockApp.fileManager.processFrontMatter as any).mockRejectedValue(new Error('fail fm'));
		
		await plugin.summarizeNote(mockFile);
		expect(Notice).toHaveBeenCalledWith('Error: fail fm');
	});

	it('should activate view in existing leaf', async () => {
		const mockLeaf = { 
			setViewState: vi.fn(),
			view: { getViewType: () => 'gemini-chat-view' }
		} as unknown as WorkspaceLeaf;
		(mockApp.workspace.getLeavesOfType as any).mockReturnValue([mockLeaf]);
		await plugin.activateView(false);
		expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
	});

	it('should refresh models and handle error', async () => {
		plugin.genAI = {} as any;
		(requestUrl as any).mockRejectedValue(new Error('api fail'));
		await plugin.refreshModels();
		expect(plugin.availableModels).toContain('gemini-1.5-flash');
	});

	it('should get models from API on refresh', async () => {
		plugin.genAI = {} as any;
		plugin.settings.apiKey = 'key';
		(requestUrl as any).mockResolvedValueOnce({
			json: { models: [{ name: 'models/gemini-pro' }] }
		});
		await plugin.refreshModels();
		expect(plugin.availableModels).toContain('gemini-pro');
	});

	it('should throw if all models fail in fallback', async () => {
		plugin.genAI = { getGenerativeModel: vi.fn().mockImplementation(() => { throw new Error('fail'); }) } as any;
		expect(() => plugin.getModelWithFallback('auto')).toThrow();
	});

	it('should handle ribbon and commands', async () => {
		(plugin as any).addRibbonIcon = vi.fn().mockReturnValue({ addClass: vi.fn() });
		(plugin as any).addCommand = vi.fn();
		
		await plugin.onload();
		
		const ribbonCalls = (plugin.addRibbonIcon as any).mock.calls;
		const ribbonCallback = ribbonCalls[0][2] as (e: MouseEvent) => void;
		
		const activateSpy = vi.spyOn(plugin, 'activateView').mockResolvedValue(undefined);
		ribbonCallback({ button: 0 } as MouseEvent);
		expect(activateSpy).toHaveBeenCalled();

		const commandCalls = (plugin.addCommand as any).mock.calls;
		const summarizeCmd = commandCalls.find((c: [Command]) => c[0].id === 'summarize-current-note')[0] as Command;
		(mockApp.workspace.getActiveFile as any).mockReturnValue(null);
		
		if (summarizeCmd.checkCallback) {
			expect(summarizeCmd.checkCallback(true)).toBe(false);
		}
		
		plugin.onunload();
	});

	it('should test SettingTab display', () => {
		const tab = new GeminiAgentSettingTab(mockApp, plugin);
		tab.containerEl = {
			empty: vi.fn(),
			createDiv: vi.fn().mockReturnValue({ createEl: vi.fn() }),
			createEl: vi.fn().mockReturnValue({ 
				text: vi.fn().mockReturnThis(), 
				desc: vi.fn().mockReturnThis(), 
				addToggle: vi.fn().mockReturnThis(), 
				addText: vi.fn().mockReturnThis(), 
				addDropdown: vi.fn().mockReturnThis(), 
				addTextArea: vi.fn().mockReturnThis(),
				setHeading: vi.fn().mockReturnThis(),
				setName: vi.fn().mockReturnThis(),
				setDesc: vi.fn().mockReturnThis(),
				addTextComponent: vi.fn().mockReturnThis(),
				inputEl: { type: '' }
			})
		} as unknown as HTMLElement;
		tab.display();
		expect(tab.containerEl.empty).toHaveBeenCalled();
	});

	it('should log to file', async () => {
		await plugin.logToFile('test log');
		expect(mockApp.vault.adapter.write).toHaveBeenCalled();
	});
});
