import { App, TFile, TFolder, TAbstractFile } from 'obsidian';

export interface CanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	type: 'text' | 'file' | 'group' | 'link';
	text?: string;
	file?: string;
}

export interface ObsidianCommand {
	id: string;
	name: string;
}

export interface ObsidianCommands {
	executeCommandById(id: string): boolean;
	listCommands(): ObsidianCommand[];
}

export interface ObsidianApp extends App {
	commands: ObsidianCommands;
}

export interface ObsidianTools {
	[key: string]: ((args: any) => Promise<string>) | undefined;
	create_note: (args: { path: string; content: string; tags?: string[] }) => Promise<string>;
	update_note: (args: { path: string; new_content: string }) => Promise<string>;
	read_note: (args: { path: string }) => Promise<string>;
	get_metadata: (args: { path: string }) => Promise<string>;
	list_files: (args: { folder_path: string }) => Promise<string>;
	create_canvas: (args: { path: string; nodes: CanvasNode[] }) => Promise<string>;
	add_node_to_canvas: (args: { path: string; node: CanvasNode }) => Promise<string>;
	create_folder: (args: { path: string }) => Promise<string>;
	execute_command: (args: { command_id: string }) => Promise<string>;
	list_commands: () => Promise<string>;
	global_search: (args: { query: string }) => Promise<string>;
	get_active_note: () => Promise<string>;
}

export const getObsidianTools = (app: App, excludedPaths: string[] = []): ObsidianTools => {
	const isExcluded = (path: string) => {
		return excludedPaths.some(excluded => path.startsWith(excluded.trim()));
	};

	const isFile = (file: TAbstractFile): file is TFile => {
		return 'extension' in file;
	};

	const isFolder = (file: TAbstractFile): file is TFolder => {
		return 'children' in file;
	};

	return {
		create_note: async ({ path, content, tags }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const fullContent = tags && tags.length > 0 
					? `---\ntags: [${tags.join(', ')}]\n---\n${content}`
					: content;
				
				const file = await app.vault.create(path, fullContent);
				return `Successfully created note at ${file.path}`;
			} catch (error) {
				return `Error creating note: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		update_note: async ({ path, new_content }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (file && isFile(file)) {
					await app.vault.modify(file, new_content);
					return `Successfully updated note at ${path}`;
				}
				return `Error: File not found at ${path}`;
			} catch (error) {
				return `Error updating note: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		read_note: async ({ path }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (file && isFile(file)) {
					return await app.vault.cachedRead(file);
				}
				return `Error: File not found at ${path}`;
			} catch (error) {
				return `Error reading note: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		get_metadata: ({ path }) => {
			if (isExcluded(path)) return Promise.resolve(`Error: Access to ${path} is excluded in settings.`);
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (file && isFile(file)) {
					const cache = app.metadataCache.getFileCache(file);
					return Promise.resolve(JSON.stringify(cache, null, 2));
				}
				return Promise.resolve(`Error: File not found at ${path}`);
			} catch (error) {
				return Promise.resolve(`Error getting metadata: ${error instanceof Error ? error.message : String(error)}`);
			}
		},
		list_files: ({ folder_path }) => {
			try {
				const folder = app.vault.getAbstractFileByPath(folder_path || '/');
				if (folder && isFolder(folder)) {
					const files = folder.children
						.filter(f => !isExcluded(f.path)) 
						.map(f => `${isFolder(f) ? '[DIR] ' : ''}${f.path}`)
						.join('\n');
					return Promise.resolve(files || 'Folder is empty or all contents are excluded');
				}
				return Promise.resolve(`Error: Folder not found at ${folder_path}`);
			} catch (error) {
				return Promise.resolve(`Error listing files: ${error instanceof Error ? error.message : String(error)}`);
			}
		},
		create_canvas: async ({ path, nodes }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const canvasData = {
					nodes: nodes || [],
					edges: []
				};
				const file = await app.vault.create(path, JSON.stringify(canvasData, null, 2));
				return `Successfully created canvas at ${file.path}`;
			} catch (error) {
				return `Error creating canvas: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		add_node_to_canvas: async ({ path, node }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (file && isFile(file)) {
					const content = await app.vault.read(file);
					const data = JSON.parse(content);
					data.nodes.push(node);
					await app.vault.modify(file, JSON.stringify(data, null, 2));
					return `Successfully added node to canvas at ${path}`;
				}
				return `Error: Canvas file not found at ${path}`;
			} catch (error) {
				return `Error adding node to canvas: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		create_folder: async ({ path }) => {
			try {
				await app.vault.createFolder(path);
				return `Successfully created folder at ${path}`;
			} catch (error) {
				return `Error creating folder: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		execute_command: ({ command_id }) => {
			try {
				// Accessing internal command manager
				const commands = (app as ObsidianApp).commands;
				if (commands && commands.executeCommandById(command_id)) {
					return Promise.resolve(`Successfully executed command ${command_id}`);
				}
				return Promise.resolve(`Error: Command ${command_id} not found or failed to execute`);
			} catch (error) {
				return Promise.resolve(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
			}
		},
		list_commands: () => {
			try {
				const commands = (app as ObsidianApp).commands;
				if (!commands || !commands.listCommands) return Promise.resolve('Error: Could not list commands');
				const list = commands.listCommands()
					.map((c: ObsidianCommand) => `${c.id}: ${c.name}`)
					.join('\n');
				return Promise.resolve(`Available Commands:\n${list}`);
			} catch (error) {
				return Promise.resolve(`Error listing commands: ${error instanceof Error ? error.message : String(error)}`);
			}
		},
		global_search: async ({ query }) => {
			try {
				const files = app.vault.getMarkdownFiles();
				const results = [];
				const lowerQuery = query.toLowerCase();

				for (const file of files) {
					if (isExcluded(file.path)) continue;
					const content = await app.vault.cachedRead(file);
					if (content.toLowerCase().includes(lowerQuery)) {
						results.push(file.path);
					}
					if (results.length >= 10) break; // Limit results for context
				}
				return results.length > 0 
					? `Found query in files:\n${results.join('\n')}` 
					: 'No matches found in the vault';
			} catch (error) {
				return `Error searching vault: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		get_active_note: async () => {
			try {
				const file = app.workspace.getActiveFile();
				if (file) {
					const content = await app.vault.read(file);
					return `Active File: ${file.path}\nContent:\n${content}`;
				}
				return 'Error: No active file found';
			} catch (error) {
				return `Error getting active file: ${error instanceof Error ? error.message : String(error)}`;
			}
		}
	}
};

export const toolDeclarations = [
	{
		name: "create_note",
		description: "Erstellt eine neue Notiz im Vault",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad der neuen Datei (z.B. 'Notizen/NeueNotiz.md')" },
				content: { type: "string", description: "Der Inhalt der Notiz" },
				tags: { type: "array", items: { type: "string" }, description: "Optionale Tags für die Notiz" }
			},
			required: ["path", "content"]
		}
	},
	{
		name: "update_note",
		description: "Ändert den Inhalt einer bestehenden Notiz",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad der zu ändernden Datei" },
				new_content: { type: "string", description: "Der neue Inhalt der Datei" }
			},
			required: ["path", "new_content"]
		}
	},
	{
		name: "read_note",
		description: "Liest den Inhalt einer Notiz für den Kontext",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad der zu lesenden Datei" }
			},
			required: ["path"]
		}
	},
	{
		name: "get_metadata",
		description: "Extrahiert Frontmatter und Verlinkungen einer Datei",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad der Datei" }
			},
			required: ["path"]
		}
	},
	{
		name: "list_files",
		description: "Listet Dateien in einem bestimmten Ordner auf",
		parameters: {
			type: "object",
			properties: {
				folder_path: { type: "string", description: "Der Pfad des Ordners (leer lassen für den Root-Ordner)" }
			}
		}
	},
	{
		name: "create_canvas",
		description: "Erstellt eine neue Canvas-Datei (.canvas)",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad der neuen Canvas-Datei (z.B. 'Design/Workflow.canvas')" },
				nodes: { type: "array", items: { type: "object" }, description: "Anfängliche Knoten für den Canvas" }
			},
			required: ["path"]
		}
	},
	{
		name: "add_node_to_canvas",
		description: "Fügt einen Knoten zu einer bestehenden Canvas-Datei hinzu",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad der Canvas-Datei" },
				node: { type: "object", description: "Der hinzuzufügende Knoten (mit id, x, y, width, height, type, text/file/etc.)" }
			},
			required: ["path", "node"]
		}
	},
	{
		name: "create_folder",
		description: "Erstellt einen neuen Ordner im Vault",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Der Pfad des neuen Ordners (z.B. 'Projekte/AI-Agent')" }
			},
			required: ["path"]
		}
	},
	{
		name: "execute_command",
		description: "Führt einen Obsidian-Befehl anhand seiner ID aus (entspricht der Command Palette)",
		parameters: {
			type: "object",
			properties: {
				command_id: { type: "string", description: "Die ID des Befehls (z.B. 'app:toggle-left-sidebar')" }
			},
			required: ["command_id"]
		}
	},
	{
		name: "list_commands",
		description: "Listet alle verfügbaren Obsidian-Befehle auf, damit der Agent weiß, was er steuern kann",
		parameters: { type: "object", properties: {} }
	},
	{
		name: "global_search",
		description: "Sucht im gesamten Vault nach einem bestimmten Textinhalt (Inhaltssuche)",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Der zu suchende Text" }
			},
			required: ["query"]
		}
	},
	{
		name: "get_active_note",
		description: "Holt den Pfad und Inhalt der aktuell im Editor geöffneten Notiz",
		parameters: { type: "object", properties: {} }
	}
];
