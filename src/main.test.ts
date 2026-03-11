import { describe, it, expect, vi, beforeEach } from 'vitest';
import GeminiAgentPlugin, { DEFAULT_SETTINGS, GeminiAgentSettingTab } from './main';
import { Notice } from 'obsidian';

// Mock Google AI
vi.mock('@google/generative-ai', () => {
	return {
		GoogleGenerativeAI: class {
			getGenerativeModel = vi.fn().mockReturnValue({
				generateContent: vi.fn().mockResolvedValue({
					response: { text: () => 'Summary' }
				})
			});
		}
	};
});

describe('GeminiAgentPlugin', () => {
	let plugin: GeminiAgentPlugin;
	let mockApp: any;

	beforeEach(() => {
		mockApp = {
			secretStorage: {
				getSecret: vi.fn(),
				setSecret: vi.fn()
			},
			workspace: {
				getActiveFile: vi.fn(),
				getLeavesOfType: vi.fn().mockReturnValue([]),
				getRightLeaf: vi.fn().mockReturnValue({ setViewState: vi.fn() }),
				revealLeaf: vi.fn(),
				detachLeavesOfType: vi.fn()
			},
			vault: {
				read: vi.fn().mockResolvedValue('Content')
			},
			fileManager: {
				processFrontMatter: vi.fn()
			}
		};
		plugin = new GeminiAgentPlugin(mockApp, { id: 'test' } as any);
		plugin.app = mockApp;
	});

	it('should load settings without secret key', async () => {
		plugin.loadData = vi.fn().mockResolvedValue({});
		mockApp.secretStorage.getSecret.mockReturnValue(null);
		await plugin.loadSettings();
		expect(plugin.settings.apiKey).toBe('');
		expect(plugin.genAI).toBeNull();
	});

	it('should handle missing settings in loadSettings', async () => {
		plugin.loadData = vi.fn().mockResolvedValue(null);
		await plugin.loadSettings();
		expect(plugin.settings.modelName).toBe('gemini-2.5-flash');
	});

	it('should save settings and secret', async () => {
		plugin.settings = { apiKey: 'new-key', modelName: 'm1', excludedPaths: '', autoAcceptTools: true };
		await plugin.saveSettings();

		expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
		expect(mockApp.secretStorage.setSecret).toHaveBeenCalledWith('gemini-api-key', 'new-key');
		expect(Notice).toHaveBeenCalled();
	});

	it('should save settings and handle empty API key', async () => {
		plugin.settings = { apiKey: '', modelName: 'm1', excludedPaths: '', autoAcceptTools: true };
		await plugin.saveSettings();
		expect(mockApp.secretStorage.setSecret).toHaveBeenCalledWith('gemini-api-key', '');
		expect(plugin.genAI).toBeNull();
	});

	it('should summarize current note', async () => {
		plugin.settings = { modelName: 'm1', apiKey: 'k', excludedPaths: '', autoAcceptTools: true };
		plugin.genAI = { getGenerativeModel: vi.fn() } as any;
		const mockModel = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Summary' } }) };
		(plugin.genAI.getGenerativeModel as any).mockReturnValue(mockModel);
		
		const mockFile = { basename: 'test' };
		mockApp.workspace.getActiveFile.mockReturnValue(mockFile);

		await plugin.summarizeNote(mockFile as any);

		expect(mockApp.vault.read).toHaveBeenCalledWith(mockFile);
		expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
	});

	it('should handle missing AI during summarize', async () => {
		plugin.genAI = null;
		const mockFile = { basename: 'test' };
		await plugin.summarizeNote(mockFile as any);
		expect(Notice).toHaveBeenCalledWith('Gemini API Key not configured');
	});

	it('should run onload', async () => {
		await plugin.onload();
		expect(mockApp.secretStorage.getSecret).toHaveBeenCalled();
		expect(plugin.registerView).toHaveBeenCalled();
		expect(plugin.addRibbonIcon).toHaveBeenCalled();
		expect(plugin.addCommand).toHaveBeenCalled();
		expect(plugin.addSettingTab).toHaveBeenCalled();
	});

	it('should test SettingTab display and onChange', async () => {
		plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
		const tab = new GeminiAgentSettingTab(mockApp, plugin);
		tab.containerEl = document.createElement('div');
		(tab.containerEl as any).empty = vi.fn();
		(tab.containerEl as any).createEl = vi.fn();
		
		plugin.saveSettings = vi.fn().mockResolvedValue(undefined);

		tab.display();
		
		expect(plugin.settings.apiKey).toBe('new-value');
		expect(plugin.settings.modelName).toBe('new-model');
		expect(plugin.settings.excludedPaths).toBe('new-paths');
		expect(plugin.settings.autoAcceptTools).toBe(true);
	});

	it('should activate view (existing leaf)', async () => {
		const mockLeaf = { setViewState: vi.fn() };
		mockApp.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);
		await plugin.activateView();
		expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
	});

	it('should activate view (new leaf)', async () => {
		const mockLeaf = { setViewState: vi.fn() };
		mockApp.workspace.getLeavesOfType.mockReturnValue([]);
		mockApp.workspace.getRightLeaf.mockReturnValue(mockLeaf);
		await plugin.activateView();
		expect(mockLeaf.setViewState).toHaveBeenCalled();
		expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
	});

	it('should run onload and handle secret key', async () => {
		mockApp.secretStorage.getSecret.mockReturnValue('secret-key');
		await plugin.onload();
		expect(plugin.settings.apiKey).toBe('secret-key');
	});

	it('should handle frontmatter update error in summarizeNote', async () => {
		plugin.settings = { modelName: 'm1', apiKey: 'k', excludedPaths: '', autoAcceptTools: true };
		plugin.genAI = { getGenerativeModel: vi.fn().mockReturnValue({
			generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Summary' } })
		}) } as any;
		
		const mockFile = { basename: 'test' };
		mockApp.vault.read.mockResolvedValue('content');
		mockApp.fileManager.processFrontMatter.mockRejectedValue(new Error('Frontmatter error'));
		
		await plugin.summarizeNote(mockFile as any);
		expect(Notice).toHaveBeenCalledWith('Error: Frontmatter error');
	});

	it('should handle checkCallback in summarize-current-note command', async () => {
		await plugin.onload();
		// @ts-expect-error - testing internals
		const command = plugin.addCommand.mock.calls.find(c => c[0].id === 'summarize-current-note')[0];
		
		mockApp.workspace.getActiveFile.mockReturnValue(null);
		expect(command.checkCallback(true)).toBe(false);

		const mockFile = { basename: 'test' };
		mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
		expect(command.checkCallback(true)).toBe(true);
		
		plugin.summarizeNote = vi.fn();
		command.checkCallback(false);
		expect(plugin.summarizeNote).toHaveBeenCalledWith(mockFile);
	});

	it('should handle open-gemini-chat command', async () => {
		await plugin.onload();
		// @ts-expect-error - testing internals
		const command = plugin.addCommand.mock.calls.find(c => c[0].id === 'open-gemini-chat')[0];
		plugin.activateView = vi.fn();
		command.callback();
		expect(plugin.activateView).toHaveBeenCalled();
	});

	it('should cover unload', () => {
		plugin.onunload();
		expect(mockApp.workspace.detachLeavesOfType).toHaveBeenCalled();
	});
});
