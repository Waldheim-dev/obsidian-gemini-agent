import { App, Plugin, PluginSettingTab, Setting, Notice, WorkspaceLeaf, addIcon, requestUrl, TFile } from 'obsidian';
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { GeminiChatView } from './view';
import { ConversationManager, Conversation } from './conversations';

export const VIEW_TYPE_GEMINI_CHAT = "gemini-chat-view";

const GEMINI_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 22C12 22 11.5 17 8 13.5C4.5 10 0 9.5 0 9.5C0 9.5 4.5 9 8 5.5C11.5 2 12 0 12 0C12 0 12.5 2 16 5.5C19.5 9 24 9.5 24 9.5C24 9.5 19.5 10 16 13.5C12.5 17 12 22 12 22Z" fill="currentColor"/>
</svg>`;

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
	'gemini-2.0-flash': 'Gemini 2.0 flash (fast)',
	'gemini-2.0-flash-exp': 'Gemini 2.0 flash experimental',
	'gemini-1.5-pro': 'Gemini 1.5 pro (complex tasks)',
	'gemini-1.5-flash': 'Gemini 1.5 flash (efficient)',
	'gemini-1.5-flash-8b': 'Gemini 1.5 flash 8b (super fast)',
	'auto': '✨ Auto-select (smart fallback)'
};

interface GeminiAgentSettings {
	apiKey: string;
	modelName: string;
	excludedPaths: string;
	autoAcceptTools: boolean;
	conversations: Conversation[];
}

export const DEFAULT_SETTINGS: GeminiAgentSettings = {
	apiKey: '',
	modelName: 'auto',
	excludedPaths: '',
	autoAcceptTools: true,
	conversations: []
}

interface GeminiModelResponse {
	models?: Array<{ name: string }>;
}

export default class GeminiAgentPlugin extends Plugin {
	settings: GeminiAgentSettings = DEFAULT_SETTINGS;
	genAI: GoogleGenerativeAI | null = null;
	availableModels: string[] = ['auto', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
	conversationManager: ConversationManager | null = null;

	onload = async (): Promise<void> => {
		await this.loadSettings();
		this.conversationManager = new ConversationManager(this.settings);
		this.conversationManager.garbageCollect();
		await this.logToFile('Plugin loading...');
		await this.refreshModels();

		addIcon('gemini-sparkle', GEMINI_ICON);

		this.registerView(
			VIEW_TYPE_GEMINI_CHAT,
			(leaf) => new GeminiChatView(leaf, this)
		);

		this.addRibbonIcon('gemini-sparkle', 'Gemini chat', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-gemini-chat',
			name: 'Open Gemini chat',
			callback: () => {
				void this.activateView();
			}
		});

		this.addCommand({
			id: 'open-gemini-chat-center',
			name: 'Open Gemini chat in center tab (for testing)',
			callback: () => {
				void this.activateView(true);
			}
		});

		this.addCommand({
			id: 'gemini-debug-info',
			name: 'Debug Gemini plugin state',
			callback: () => {
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_GEMINI_CHAT);
				const status = `
					API Key set: ${!!this.settings.apiKey}
					GenAI initialized: ${!!this.genAI}
					Available models: ${this.availableModels.length}
					Active leaves: ${leaves.length}
				`;
				void this.logToFile(`Debug info requested: ${status}`).then(() => {
					new Notice(`Gemini debug: ${leaves.length} leaves found. Check log file for details.`);
				});
			}
		});

		this.addCommand({
			id: 'refresh-gemini-models',
			name: 'Refresh available models',
			callback: () => {
				void this.refreshModels().then(() => {
					void this.logToFile('Models refreshed manually');
					new Notice('Gemini models refreshed');
				});
			}
		});

		this.addCommand({
			id: 'summarize-current-note',
			name: 'Summarize current note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file instanceof TFile) {
					if (!checking) {
						void this.summarizeNote(file);
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new GeminiAgentSettingTab(this.app, this));

		await this.logToFile('Plugin loaded successfully');
	};

	refreshModels = async (): Promise<void> => {
		if (!this.genAI) return;
		try {
			const response = await requestUrl({
				url: `https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.apiKey}`,
				method: 'GET',
			});
			const data = response.json as GeminiModelResponse;
			if (data.models && Array.isArray(data.models)) {
				const apiModels = data.models
					.map((m) => m.name.replace('models/', ''))
					.filter((name) => name.includes('gemini'));
				this.availableModels = ['auto', ...apiModels];
			}
		} catch (error) {
			console.error('Failed to fetch models:', error);
		}
	};

	getModelWithFallback = (preferredModel: string): GenerativeModel => {
		if (!this.genAI) throw new Error('GenAI not initialized');
		
		const modelsToTry = [preferredModel];
		if (preferredModel === 'auto' || preferredModel === '') {
			modelsToTry.length = 0;
			modelsToTry.push('gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash');
		} else {
			if (!modelsToTry.includes('gemini-1.5-flash')) modelsToTry.push('gemini-1.5-flash');
		}

		let lastError: Error | null = null;
		for (const modelName of modelsToTry) {
			try {
				return this.genAI.getGenerativeModel({ model: modelName });
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				const msg = lastError.message || '';
				if (msg.includes('429') || msg.includes('quota') || msg.includes('not found')) {
					console.warn(`Model ${modelName} failed, trying fallback...`, lastError);
					continue;
				}
				throw lastError;
			}
		}
		throw lastError || new Error('Failed to initialize model');
	};

	summarizeNote = async (file: TFile): Promise<void> => {
		if (!this.genAI) {
			new Notice('Gemini API key not configured');
			return;
		}

		new Notice(`Summarizing ${file.basename}...`);
		
		try {
			const content = await this.app.vault.read(file);
			const model = this.getModelWithFallback(this.settings.modelName);
			
			const prompt = `Fasse folgende Notiz kurz und prägnant zusammen:\n\n${content}`;
			const result = await model.generateContent(prompt);
			const response = result.response;
			const summary = response.text();
			
			await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
				frontmatter['summary'] = summary;
			});
			
			new Notice('Summary added to frontmatter');
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
			console.error(error);
		}
	};

	logToFile = async (message: string, isError = false): Promise<void> => {
		const timestamp = new Date().toISOString();
		const logLine = `[${timestamp}] ${isError ? 'ERROR' : 'INFO'} ${message}\n`;
		console.debug(`Gemini: ${message}`);
		
		try {
			const logPath = 'gemini-agent-debug.log';
			const adapter = this.app.vault.adapter;
			if (await adapter.exists(logPath)) {
				const currentContent = await adapter.read(logPath);
				await adapter.write(logPath, currentContent + logLine);
			} else {
				await adapter.write(logPath, logLine);
			}
		} catch (e) {
			console.error('Failed to write to log file:', e);
		}
	};

	activateView = async (center = false): Promise<void> => {
		try {
			await this.logToFile(`Activating view (center: ${center})...`);
			const { workspace } = this.app;

			const leaves = workspace.getLeavesOfType(VIEW_TYPE_GEMINI_CHAT);
			let leaf: WorkspaceLeaf | null = null;

			if (leaves.length > 0) {
				await this.logToFile(`Found ${leaves.length} existing leaves`);
				leaf = leaves[0];
			} else {
				await this.logToFile(`Creating new leaf (mode: ${center ? 'center' : 'right'})`);
				const newLeaf = center ? workspace.getLeaf('tab') : workspace.getRightLeaf(false);

				if (newLeaf) {
					await this.logToFile('Setting view state...');
					await newLeaf.setViewState({
						type: VIEW_TYPE_GEMINI_CHAT,
						active: true,
					});
					leaf = newLeaf;
					await this.logToFile('View state set successfully');
				} else {
					await this.logToFile('Could not get a leaf from workspace', true);
				}
			}

			if (leaf) {
				await this.logToFile('Revealing leaf');
				await workspace.revealLeaf(leaf);
				new Notice('Gemini chat opened');
			} else {
				await this.logToFile('Failed to find or create leaf (leaf is null)', true);
				new Notice('Error: could not open Gemini chat. See log file.');
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			await this.logToFile(`CRITICAL ERROR in activateView: ${msg}`, true);
			if (error instanceof Error && error.stack) await this.logToFile(`Stack: ${error.stack}`, true);
			new Notice('Critical error opening Gemini chat. Check log file.');
		}
	};

	onunload = (): void => {
		console.debug('Gemini agent plugin unloaded');
	};

	loadSettings = async (): Promise<void> => {
		const loadedData = await this.loadData() as Partial<GeminiAgentSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		const secretKey = this.app.secretStorage.getSecret('gemini-api-key');
		if (typeof secretKey === 'string' && secretKey !== '') {
			this.settings.apiKey = secretKey;
		}

		if (this.settings.apiKey) {
			this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
		}
	};

	saveSettings = async (): Promise<void> => {
		if (this.conversationManager) {
			this.settings.conversations = this.conversationManager.toJSON();
		}
		await this.saveData(this.settings);

		if (this.settings.apiKey) {
			this.app.secretStorage.setSecret('gemini-api-key', this.settings.apiKey);
			this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
		} else {
			this.app.secretStorage.setSecret('gemini-api-key', '');
			this.genAI = null;
		}

		new Notice('Gemini settings saved');
	};
}

export class GeminiAgentSettingTab extends PluginSettingTab {
	plugin: GeminiAgentPlugin;

	constructor(app: App, plugin: GeminiAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setHeading()
			.setName('Gemini AI agent settings');

		new Setting(containerEl)
			.setName('Google Gemini API key')
			.setDesc('Enter your Google Gemini API key. It will be stored securely in your system keychain.')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange((value) => {
					this.plugin.settings.apiKey = value;
					void this.plugin.saveSettings();
				})
				.inputEl.type = 'password'
			);

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Choose the Gemini model to use.')
			.addDropdown(dropdown => {
				this.plugin.availableModels.forEach(model => {
					dropdown.addOption(model, MODEL_DISPLAY_NAMES[model] || model);
				});
				dropdown.setValue(this.plugin.settings.modelName)
					.onChange((value) => {
						this.plugin.settings.modelName = value;
						void this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Auto-accept tools')
			.setDesc('If enabled, the agent can execute tools automatically. If disabled, you will be asked to approve each action in the chat.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAcceptTools)
				.onChange((value) => {
					this.plugin.settings.autoAcceptTools = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Excluded paths')
			.setDesc('Comma-separated list of paths or folders to exclude from the AI agent (e.g. "Private/, SecretNote.md").')
			.addTextArea(text => text
				.setPlaceholder('Enter paths to exclude')
				.setValue(this.plugin.settings.excludedPaths)
				.onChange((value) => {
					this.plugin.settings.excludedPaths = value;
					void this.plugin.saveSettings();
				})
			);
	}
}
