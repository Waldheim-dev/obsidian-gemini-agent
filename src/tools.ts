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
	[key: string]: ((args: Record<string, unknown>) => Promise<string>) | undefined;
	create_note: (args: { path: string; content: string; tags?: string[] }) => Promise<string>;
	update_note: (args: { path: string; new_content: string }) => Promise<string>;
	read_note: (args: { path: string }) => Promise<string>;
	get_metadata: (args: { path: string }) => Promise<string>;
	list_files: (args: { folder_path: string; recursive?: boolean }) => Promise<string>;
	create_canvas: (args: { path: string; nodes: CanvasNode[] }) => Promise<string>;
	add_node_to_canvas: (args: { path: string; node: CanvasNode }) => Promise<string>;
	create_folder: (args: { path: string }) => Promise<string>;
	execute_command: (args: { command_id: string }) => Promise<string>;
	list_commands: () => Promise<string>;
	global_search: (args: { query: string }) => Promise<string>;
	get_active_note: () => Promise<string>;
}

export const getObsidianTools = (app: App, excludedPaths: string[] = []): ObsidianTools => {
	const isExcluded = (path: string): boolean => {
		return excludedPaths.some(excluded => path.startsWith(excluded.trim()));
	};

	const isFile = (file: TAbstractFile | null): file is TFile => {
		return file instanceof TFile;
	};

	const isFolder = (file: TAbstractFile | null): file is TFolder => {
		return file instanceof TFolder;
	};

	return {
		create_note: async ({ path, content, tags }): Promise<string> => {
			if (isExcluded(path)) return `Error: access to ${path} is excluded in settings.`;
			try {
				let fullContent = content;
				if (tags && Array.isArray(tags) && tags.length > 0) {
					fullContent = `---\ntags: [${tags.join(', ')}]\n---\n${content}`;
				}
				
				const file = await app.vault.create(path, fullContent);
				return `Successfully created note at ${file.path}`;
			} catch (error) {
				return `Error creating note: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		update_note: async ({ path, new_content }): Promise<string> => {
			if (isExcluded(path)) return `Error: access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (isFile(file)) {
					await app.vault.modify(file, new_content);
					return `Successfully updated note at ${path}`;
				}
				return `Error: file not found at ${path}`;
			} catch (error) {
				return `Error updating note: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		read_note: async ({ path }): Promise<string> => {
			if (isExcluded(path)) return `Error: access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (isFile(file)) {
					return await app.vault.cachedRead(file);
				}
				return `Error: file not found at ${path}`;
			} catch (error) {
				return `Error reading note: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		get_metadata: async (args): Promise<string> => {
			const path = String(args.path);
			if (isExcluded(path)) return `Error: access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (isFile(file)) {
					const cache = app.metadataCache.getFileCache(file);
					return JSON.stringify(cache, null, 2);
				}
				return `Error: file not found at ${path}`;
			} catch (error) {
				return `Error getting metadata: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		list_files: async (args): Promise<string> => {
			const folder_path = typeof args.folder_path === 'string' ? args.folder_path : '/';
			const recursive = Boolean(args.recursive);
			try {
				const folder = app.vault.getAbstractFileByPath(folder_path);
				if (isFolder(folder)) {
					const results: string[] = [];
					
					const walk = (f: TFolder | TFile): void => {
						if (isExcluded(f.path)) return;
						results.push(`${f instanceof TFolder ? '[DIR] ' : ''}${f.path}`);
						if (recursive && f instanceof TFolder) {
							f.children.forEach(child => {
								if (child instanceof TFile || child instanceof TFolder) walk(child);
							});
						}
					};

					if (recursive) {
						walk(folder);
					} else {
						folder.children.forEach(child => {
							if (child instanceof TFile || child instanceof TFolder) walk(child);
						});
					}

					return results.join('\n') || 'Folder is empty or all contents are excluded';
				}
				return `Error: folder not found at ${folder_path}`;
			} catch (error) {
				return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		create_canvas: async ({ path, nodes }): Promise<string> => {
			if (isExcluded(path)) return `Error: access to ${path} is excluded in settings.`;
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
		add_node_to_canvas: async ({ path, node }): Promise<string> => {
			if (isExcluded(path)) return `Error: access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (isFile(file)) {
					const content = await app.vault.read(file);
					const data = JSON.parse(content);
					if (data && Array.isArray(data.nodes)) {
						data.nodes.push(node);
						await app.vault.modify(file, JSON.stringify(data, null, 2));
						return `Successfully added node to canvas at ${path}`;
					}
					return `Error: invalid canvas format at ${path}`;
				}
				return `Error: canvas file not found at ${path}`;
			} catch (error) {
				return `Error adding node to canvas: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		create_folder: async ({ path }): Promise<string> => {
			try {
				await app.vault.createFolder(path);
				return `Successfully created folder at ${path}`;
			} catch (error) {
				return `Error creating folder: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		execute_command: async (args): Promise<string> => {
			const command_id = String(args.command_id);
			try {
				const obsidianApp = app as ObsidianApp;
				if (obsidianApp.commands && obsidianApp.commands.executeCommandById(command_id)) {
					return `Successfully executed command ${command_id}`;
				}
				return `Error: command ${command_id} not found or failed to execute`;
			} catch (error) {
				return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		list_commands: async (): Promise<string> => {
			try {
				const obsidianApp = app as ObsidianApp;
				if (!obsidianApp.commands || !obsidianApp.commands.listCommands) return 'Error: could not list commands';
				const list = obsidianApp.commands.listCommands()
					.map((c: ObsidianCommand) => `${c.id}: ${c.name}`)
					.join('\n');
				return `Available commands:\n${list}`;
			} catch (error) {
				return `Error listing commands: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		global_search: async (args): Promise<string> => {
			const query = String(args.query);
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
					if (results.length >= 10) break;
				}
				return results.length > 0 
					? `Found query in files:\n${results.join('\n')}` 
					: 'No matches found in the vault';
			} catch (error) {
				return `Error searching vault: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		get_active_note: async (): Promise<string> => {
			try {
				const file = app.workspace.getActiveFile();
				if (isFile(file)) {
					const content = await app.vault.read(file);
					return `Active file: ${file.path}\nContent:\n${content}`;
				}
				return 'Error: no active file found';
			} catch (error) {
				return `Error getting active file: ${error instanceof Error ? error.message : String(error)}`;
			}
		}
	}
};

export const toolDeclarations = [
	{
		name: "create_note",
		description: "Creates a new note in the vault. Use this to save research, summaries, or new information.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The full path for the new file (e.g., 'Folder/Note.md'). Must end in .md" },
				content: { type: "string", description: "The markdown content for the note." },
				tags: { type: "array", items: { type: "string" }, description: "Optional tags to add to the frontmatter." }
			},
			required: ["path", "content"]
		}
	},
	{
		name: "update_note",
		description: "Updates the content of an existing note. Use this to refine notes or add more information.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The path of the file to update." },
				new_content: { type: "string", description: "The complete new content for the file." }
			},
			required: ["path", "new_content"]
		}
	},
	{
		name: "read_note",
		description: "Reads the full content of a note. Use this to gain context from files mentioned by the user or found via search.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The path of the file to read." }
			},
			required: ["path"]
		}
	},
	{
		name: "get_metadata",
		description: "Extracts frontmatter and links from a file. Use this to understand the relationships and tags of a note.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The path of the file." }
			},
			required: ["path"]
		}
	},
	{
		name: "list_files",
		description: "Lists files and folders in the vault. Use this to explore the structure or check if a file exists.",
		parameters: {
			type: "object",
			properties: {
				folder_path: { type: "string", description: "The folder path (leave empty for root '/')." },
				recursive: { type: "boolean", description: "If true, lists all nested files and subfolders recursively." }
			}
		}
	},
	{
		name: "create_canvas",
		description: "Creates a new .canvas file. Use this for visual mapping or workflows.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The full path for the canvas file (e.g., 'Diagrams/Map.canvas')." },
				nodes: { type: "array", items: { type: "object" }, description: "Initial nodes for the canvas." }
			},
			required: ["path"]
		}
	},
	{
		name: "add_node_to_canvas",
		description: "Adds a node to an existing canvas file.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The path of the canvas file." },
				node: { type: "object", description: "The node object with id, x, y, width, height, type, and text/file." }
			},
			required: ["path", "node"]
		}
	},
	{
		name: "create_folder",
		description: "Creates a new folder in the vault. Use this to organize files into a hierarchy.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The path of the new folder (e.g., 'Projects/Research')." }
			},
			required: ["path"]
		}
	},
	{
		name: "execute_command",
		description: "Executes an internal Obsidian command by its ID. Use this to trigger UI actions or plugin features.",
		parameters: {
			type: "object",
			properties: {
				command_id: { type: "string", description: "The ID of the command (e.g., 'app:toggle-left-sidebar')." }
			},
			required: ["command_id"]
		}
	},
	{
		name: "list_commands",
		description: "Lists all available commands and their IDs. Use this to discover what actions you can perform.",
		parameters: { type: "object", properties: {} }
	},
	{
		name: "global_search",
		description: "Performs a full-text search across all markdown files in the vault. Use this to find specific information when you don't know the exact file path.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "The text to search for." }
			},
			required: ["query"]
		}
	},
	{
		name: "get_active_note",
		description: "Retrieves the path and content of the note currently open in the editor. Use this to get immediate context on what the user is working on.",
		parameters: { type: "object", properties: {} }
	}
];
