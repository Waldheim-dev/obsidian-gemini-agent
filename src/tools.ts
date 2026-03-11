import { App, TFile, TFolder, TAbstractFile } from 'obsidian';

export interface ObsidianTools {
	create_note: (args: { path: string; content: string; tags?: string[] }) => Promise<string>;
	update_note: (args: { path: string; new_content: string }) => Promise<string>;
	read_note: (args: { path: string }) => Promise<string>;
	get_metadata: (args: { path: string }) => Promise<string>;
	list_files: (args: { folder_path: string }) => Promise<string>;
	create_canvas: (args: { path: string; nodes: any[] }) => Promise<string>;
	add_node_to_canvas: (args: { path: string; node: any }) => Promise<string>;
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
				return `Error creating note: ${error.message}`;
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
				return `Error updating note: ${error.message}`;
			}
		},
		read_note: async ({ path }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (file && isFile(file)) {
					// Use cachedRead for better performance
					return await app.vault.cachedRead(file);
				}
				return `Error: File not found at ${path}`;
			} catch (error) {
				return `Error reading note: ${error.message}`;
			}
		},
		get_metadata: async ({ path }) => {
			if (isExcluded(path)) return `Error: Access to ${path} is excluded in settings.`;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (file && isFile(file)) {
					const cache = app.metadataCache.getFileCache(file);
					return JSON.stringify(cache, null, 2);
				}
				return `Error: File not found at ${path}`;
			} catch (error) {
				return `Error getting metadata: ${error.message}`;
			}
		},
		list_files: async ({ folder_path }) => {
			try {
				const folder = app.vault.getAbstractFileByPath(folder_path || '/');
				if (folder && isFolder(folder)) {
					const files = folder.children
						.filter(f => !isExcluded(f.path)) // Filter excluded files
						.map(f => `${isFolder(f) ? '[DIR] ' : ''}${f.path}`)
						.join('\n');
					return files || 'Folder is empty or all contents are excluded';
				}
				return `Error: Folder not found at ${folder_path}`;
			} catch (error) {
				return `Error listing files: ${error.message}`;
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
				return `Error creating canvas: ${error.message}`;
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
				return `Error adding node to canvas: ${error.message}`;
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
	}
];
