import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getObsidianTools, ObsidianApp } from './tools';
import { App, TFile, TFolder } from 'obsidian';

describe('Obsidian Tools', () => {
	let mockApp: App;

	beforeEach(() => {
		mockApp = {
			vault: {
				create: vi.fn(),
				modify: vi.fn(),
				cachedRead: vi.fn(),
				read: vi.fn(),
				getAbstractFileByPath: vi.fn(),
				createFolder: vi.fn(),
				getMarkdownFiles: vi.fn().mockReturnValue([]),
				adapter: {
					exists: vi.fn(),
					read: vi.fn(),
					write: vi.fn()
				}
			},
			workspace: {
				getActiveFile: vi.fn()
			},
			metadataCache: {
				getFileCache: vi.fn()
			},
			commands: {
				executeCommandById: vi.fn(),
				listCommands: vi.fn()
			}
		} as unknown as App;
	});

	describe('Exclusion List', () => {
		it('should block access to excluded paths', async () => {
			const excludedPaths = ['Private/', 'Secret.md'];
			const tools = getObsidianTools(mockApp, excludedPaths);

			expect(await tools.read_note({ path: 'Private/MyNote.md' })).toContain('Error: access to Private/MyNote.md is excluded');
			expect(await tools.update_note({ path: 'Private/MyNote.md', new_content: '' })).toContain('Error: access to Private/MyNote.md is excluded');
			expect(await tools.get_metadata({ path: 'Private/MyNote.md' })).toContain('Error: access to Private/MyNote.md is excluded');
			expect(await tools.create_note({ path: 'Private/MyNote.md', content: '' })).toContain('Error: access to Private/MyNote.md is excluded');
			expect(await tools.create_canvas({ path: 'Private/MyNote.canvas', nodes: [] })).toContain('Error: access to Private/MyNote.canvas is excluded');
			expect(await tools.add_node_to_canvas({ path: 'Private/MyNote.canvas', node: {} as any })).toContain('Error: access to Private/MyNote.canvas is excluded');
		});
	});

	describe('create_note', () => {
		it('should create a note with content and tags', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.create as any).mockResolvedValue({ path: 'test.md' });

			const result = await tools.create_note({ 
				path: 'test.md', 
				content: 'hello',
				tags: ['tag1', 'tag2']
			});

			expect(result).toContain('Successfully created note');
			expect(mockApp.vault.create).toHaveBeenCalledWith('test.md', expect.stringContaining('tags: [tag1, tag2]'));
		});

		it('should handle creation error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.create as any).mockRejectedValue(new Error('fail'));
			const result = await tools.create_note({ path: 'fail.md', content: '' });
			expect(result).toContain('Error creating note: fail');
		});
	});

	describe('update_note', () => {
		it('should update an existing note', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { extension: 'md' } as TFile;
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(mockFile);
			const result = await tools.update_note({ path: 'test.md', new_content: 'new' });
			expect(result).toContain('Successfully updated');
			expect(mockApp.vault.modify).toHaveBeenCalledWith(mockFile, 'new');
		});

		it('should handle file not found', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(null);
			const result = await tools.update_note({ path: 'missing.md', new_content: '' });
			expect(result).toContain('Error: file not found');
		});

		it('should handle update error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue({ extension: 'md' });
			(mockApp.vault.modify as any).mockRejectedValue(new Error('modify failed'));
			const result = await tools.update_note({ path: 'fail.md', new_content: '' });
			expect(result).toContain('Error updating note: modify failed');
		});
	});

	describe('read_note', () => {
		it('should read a note', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue({ extension: 'md' });
			(mockApp.vault.cachedRead as any).mockResolvedValue('content');
			const result = await tools.read_note({ path: 'test.md' });
			expect(result).toBe('content');
		});

		it('should handle read error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue({ extension: 'md' });
			(mockApp.vault.cachedRead as any).mockRejectedValue(new Error('read error'));
			const result = await tools.read_note({ path: 'fail.md' });
			expect(result).toContain('Error reading note: read error');
		});
	});

	describe('get_metadata', () => {
		it('should get file metadata', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { extension: 'md' } as TFile;
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(mockFile);
			(mockApp.metadataCache.getFileCache as any).mockReturnValue({ frontmatter: { key: 'val' } });
			const result = await tools.get_metadata({ path: 'test.md' });
			expect(result).toContain('frontmatter');
		});

		it('should handle missing file in metadata', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(null);
			const result = await tools.get_metadata({ path: 'missing.md' });
			expect(result).toContain('Error: file not found');
		});

		it('should handle metadata error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockImplementation(() => { throw new Error('meta fail'); });
			const result = await tools.get_metadata({ path: 'err.md' });
			expect(result).toContain('Error getting metadata: meta fail');
		});
	});

	describe('list_files', () => {
		it('should list files in a folder', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile1 = { path: 'file1.md', extension: 'md' } as TFile;
			const mockSub = { path: 'sub/', children: [] } as unknown as TFolder;
			const mockFolder = { 
				children: [mockFile1, mockSub] 
			} as unknown as TFolder;
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(mockFolder);
			const result = await tools.list_files({ folder_path: '/' });
			expect(result).toContain('file1.md');
			expect(result).toContain('[DIR] sub/');
		});

		it('should list files recursively', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile2 = { path: 'sub/file2.md', extension: 'md' } as TFile;
			const mockSub = { path: 'sub/', children: [mockFile2] } as unknown as TFolder;
			const mockFile1 = { path: 'file1.md', extension: 'md' } as TFile;
			const mockFolder = { 
				path: '/',
				children: [mockFile1, mockSub] 
			} as unknown as TFolder;
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(mockFolder);
			const result = await tools.list_files({ folder_path: '/', recursive: true });
			expect(result).toContain('file1.md');
			expect(result).toContain('sub/file2.md');
		});

		it('should handle empty folder', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue({ children: [] });
			const result = await tools.list_files({ folder_path: '/' });
			expect(result).toBe('Folder is empty or all contents are excluded');
		});

		it('should handle list error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockImplementation(() => { throw new Error('list fail'); });
			const result = await tools.list_files({ folder_path: '/' });
			expect(result).toContain('Error listing files: list fail');
		});
	});

	describe('Canvas Tools', () => {
		it('should create a canvas', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.create as any).mockResolvedValue({ path: 'test.canvas' });
			const result = await tools.create_canvas({ path: 'test.canvas', nodes: [] });
			expect(result).toContain('Successfully created canvas');
		});

		it('should handle canvas create error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.create as any).mockRejectedValue(new Error('canvas error'));
			const result = await tools.create_canvas({ path: 'fail.canvas', nodes: [] });
			expect(result).toContain('Error creating canvas: canvas error');
		});

		it('should add a node to canvas', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue({ extension: 'canvas' });
			(mockApp.vault.read as any).mockResolvedValue(JSON.stringify({ nodes: [], edges: [] }));
			const result = await tools.add_node_to_canvas({ path: 'test.canvas', node: { id: '1' } as any });
			expect(result).toContain('Successfully added node');
			expect(mockApp.vault.modify).toHaveBeenCalled();
		});

		it('should handle add node error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue({ extension: 'canvas' });
			(mockApp.vault.read as any).mockRejectedValue(new Error('add node error'));
			const result = await tools.add_node_to_canvas({ path: 'test.canvas', node: {} as any });
			expect(result).toContain('Error adding node to canvas: add node error');
		});
	});

	describe('Folder Tools', () => {
		it('should create a folder', async () => {
			const tools = getObsidianTools(mockApp);
			const result = await tools.create_folder({ path: 'NewFolder' });
			expect(result).toContain('Successfully created folder');
		});

		it('should handle folder creation error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.createFolder as any).mockRejectedValue(new Error('folder fail'));
			const result = await tools.create_folder({ path: 'fail' });
			expect(result).toContain('Error creating folder: folder fail');
		});
	});

	describe('Power Tools', () => {
		it('should execute a command', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp as unknown as ObsidianApp).commands.executeCommandById = vi.fn().mockReturnValue(true);
			const result = await tools.execute_command({ command_id: 'test-cmd' });
			expect(result).toContain('Successfully executed');
		});

		it('should handle command execution failure', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp as unknown as ObsidianApp).commands.executeCommandById = vi.fn().mockReturnValue(false);
			const result = await tools.execute_command({ command_id: 'bad-cmd' });
			expect(result).toContain('Error: command bad-cmd not found');
		});

		it('should handle command execution error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp as unknown as ObsidianApp).commands.executeCommandById = vi.fn().mockImplementation(() => { throw new Error('exec error'); });
			const result = await tools.execute_command({ command_id: 'err' });
			expect(result).toContain('Error executing command: exec error');
		});

		it('should list commands', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp as unknown as ObsidianApp).commands.listCommands = vi.fn().mockReturnValue([{ id: 'c1', name: 'N1' }]);
			const result = await tools.list_commands();
			expect(result).toContain('c1: N1');
		});

		it('should handle list commands error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp as unknown as ObsidianApp).commands.listCommands = null as any;
			const result = await tools.list_commands();
			expect(result).toContain('Error: could not list commands');
		});

		it('should perform global search with results', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getMarkdownFiles as any).mockReturnValue([{ path: 'match.md' }]);
			(mockApp.vault.cachedRead as any).mockResolvedValue('test query content');
			const result = await tools.global_search({ query: 'query' });
			expect(result).toContain('match.md');
		});

		it('should perform global search with no matches', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getMarkdownFiles as any).mockReturnValue([{ path: 'no-match.md' }]);
			(mockApp.vault.cachedRead as any).mockResolvedValue('empty');
			const result = await tools.global_search({ query: 'missing' });
			expect(result).toBe('No matches found in the vault');
		});

		it('should respect exclusions in global search', async () => {
			const tools = getObsidianTools(mockApp, ['Secret/']);
			(mockApp.vault.getMarkdownFiles as any).mockReturnValue([{ path: 'Secret/note.md' }]);
			const result = await tools.global_search({ query: 'anything' });
			expect(result).toBe('No matches found in the vault');
		});

		it('should handle search error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.vault.getMarkdownFiles as any).mockImplementation(() => { throw new Error('search fail'); });
			const result = await tools.global_search({ query: 'q' });
			expect(result).toContain('Error searching vault: search fail');
		});

		it('should get active note', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'active.md' } as TFile;
			(mockApp.workspace.getActiveFile as any).mockReturnValue(mockFile);
			(mockApp.vault.read as any).mockResolvedValue('active content');
			const result = await tools.get_active_note();
			expect(result).toContain('active content');
		});

		it('should handle no active file', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.workspace.getActiveFile as any).mockReturnValue(null);
			const result = await tools.get_active_note();
			expect(result).toBe('Error: no active file found');
		});

		it('should handle get active note error', async () => {
			const tools = getObsidianTools(mockApp);
			(mockApp.workspace.getActiveFile as any).mockReturnValue({ path: 'err.md' });
			(mockApp.vault.read as any).mockRejectedValue(new Error('active fail'));
			const result = await tools.get_active_note();
			expect(result).toContain('Error getting active file: active fail');
		});
	});
});
