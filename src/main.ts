import { App, Plugin, PluginSettingTab, Setting, Notice, WorkspaceLeaf } from 'obsidian';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiChatView, VIEW_TYPE_GEMINI_CHAT } from './view';

interface GeminiAgentSettings {
	apiKey: string;
	modelName: string;
	excludedPaths: string;
	autoAcceptTools: boolean;
}

export const DEFAULT_SETTINGS: GeminiAgentSettings = {
	apiKey: '',
	modelName: 'gemini-2.5-flash',
	excludedPaths: '',
	autoAcceptTools: true
}

export default class GeminiAgentPlugin extends Plugin {
	settings: GeminiAgentSettings;
	genAI: GoogleGenerativeAI | null = null;
	availableModels: string[] = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3-pro'];

	async onload() {
		await this.loadSettings();
		await this.refreshModels();

		this.registerView(
			VIEW_TYPE_GEMINI_CHAT,
			(leaf) => new GeminiChatView(leaf, this)
		);

		this.addRibbonIcon('bot', 'Gemini chat', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-gemini-chat',
			name: 'Open Gemini chat',
			callback: () => {
				this.activateView();
			}
		});

		this.addCommand({
			id: 'refresh-gemini-models',
			name: 'Refresh available models',
			callback: async () => {
				await this.refreshModels();
				new Notice('Gemini models refreshed');
			}
		});

		this.addCommand({
			id: 'summarize-current-note',
			name: 'Summarize current note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					if (!checking) {
						this.summarizeNote(file);
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new GeminiAgentSettingTab(this.app, this));

		console.log('Gemini Agent Plugin loaded');
	}

	async refreshModels() {
		if (!this.genAI) return;
		try {
			// Note: listModels might not be available in all SDK versions or requires specific auth
			// We try to fetch or use a sensible default list
			const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.apiKey}`);
			const data = await response.json();
			if (data.models) {
				this.availableModels = data.models
					.map((m: any) => m.name.replace('models/', ''))
					.filter((name: string) => name.includes('gemini'));
			}
		} catch (error) {
			console.error('Failed to fetch models:', error);
		}
	}

	async getModelWithFallback(preferredModel: string): Promise<any> {
		if (!this.genAI) throw new Error('GenAI not initialized');
		
		const modelsToTry = [preferredModel, 'gemini-2.5-flash', 'gemini-1.5-flash'];
		let lastError: any = null;

		for (const modelName of modelsToTry) {
			try {
				const model = this.genAI.getGenerativeModel({ model: modelName });
				return model;
			} catch (error) {
				lastError = error;
				if (error.message?.includes('429') || error.message?.includes('quota')) {
					new Notice(`Rate limit hit for ${modelName}, trying fallback...`);
					continue;
				}
				throw error;
			}
		}
		throw lastError;
	}

	async summarizeNote(file: import('obsidian').TFile) {
		if (!this.genAI || !this.settings) {
			new Notice('Gemini API Key not configured');
			return;
		}

		new Notice(`Summarizing ${file.basename}...`);
		
		try {
			const content = await this.app.vault.read(file);
			const model = await this.getModelWithFallback(this.settings.modelName);
			
			const prompt = `Fasse folgende Notiz kurz und prägnant zusammen:\n\n${content}`;
			const result = await model.generateContent(prompt);
			const response = await result.response;
			const summary = response.text();
			
			// Update frontmatter with summary
			await this.app.fileManager.processFrontMatter(file, (frontmatter: any) => {
				frontmatter['summary'] = summary;
			});
			
			new Notice('Summary added to frontmatter');
		} catch (error) {
			new Notice(`Error: ${error.message}`);
			console.error(error);
		}
	}

	async activateView() {
		const { workspace } = this.app;

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_GEMINI_CHAT);
		let leaf: WorkspaceLeaf | null = null;

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_GEMINI_CHAT,
					active: true,
				});
				leaf = rightLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_GEMINI_CHAT);
		console.log('Gemini Agent Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Load API key from SecretStorage if available
		const secretKey = this.app.secretStorage.getSecret('gemini-api-key');
		if (secretKey) {
			this.settings.apiKey = secretKey;
		}

		if (this.settings.apiKey) {
			this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Save API key to SecretStorage
		if (this.settings.apiKey) {
			this.app.secretStorage.setSecret('gemini-api-key', this.settings.apiKey);
		} else {
			// Obsidian SecretStorage doesn't have a delete method, so we set to empty string
			this.app.secretStorage.setSecret('gemini-api-key', '');
		}

		if (this.settings.apiKey) {
			this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
		} else {
			this.genAI = null;
		}

		new Notice('Gemini settings saved');
	}}

export class GeminiAgentSettingTab extends PluginSettingTab {
	plugin: GeminiAgentPlugin;

	constructor(app: App, plugin: GeminiAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Gemini AI Agent Settings' });

		new Setting(containerEl)
			.setName('Google Gemini API Key')
			.setDesc('Enter your Google Gemini API Key. It will be stored securely in your system keychain.')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				})
				.inputEl.type = 'password'
			);

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Choose the Gemini model to use.')
			.addDropdown(dropdown => {
				this.plugin.availableModels.forEach(model => {
					dropdown.addOption(model, model);
				});
				dropdown.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Auto-accept tools')
			.setDesc('If enabled, the agent can execute Obsidian tools automatically. If disabled, you might need to confirm actions (not yet implemented in UI).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAcceptTools)
				.onChange(async (value) => {
					this.plugin.settings.autoAcceptTools = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Excluded paths')
			.setDesc('Comma-separated list of paths or folders to exclude from the AI agent (e.g. "Private/, SecretNote.md").')
			.addTextArea(text => text
				.setPlaceholder('Enter paths to exclude')
				.setValue(this.plugin.settings.excludedPaths)
				.onChange(async (value) => {
					this.plugin.settings.excludedPaths = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
