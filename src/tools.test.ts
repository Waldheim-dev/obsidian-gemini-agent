import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getObsidianTools } from './tools';

describe('Obsidian Tools', () => {
	let mockApp: any;

	beforeEach(() => {
		mockApp = {
			vault: {
				create: vi.fn(),
				modify: vi.fn(),
				read: vi.fn(),
				cachedRead: vi.fn(),
				getAbstractFileByPath: vi.fn(),
				createFolder: vi.fn(),
				getMarkdownFiles: vi.fn().mockReturnValue([])
			},
			workspace: {
				getActiveFile: vi.fn()
			},
			metadataCache: {
				getFileCache: vi.fn()
			},
			commands: {
				executeCommandById: vi.fn(),
				listCommands: vi.fn().mockReturnValue([])
			}
		};
	});

	describe('Exclusion List', () => {
		it('should block access to excluded paths', async () => {
			const excludedPaths = ['Private/', 'Secret.md'];
			const tools = getObsidianTools(mockApp, excludedPaths);

			const result = await tools.read_note({ path: 'Private/MyNote.md' });
			expect(result).toContain('Error: Access to Private/MyNote.md is excluded');
		});
	});

	describe('create_note', () => {
		it('should create a note with content and tags', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.create.mockResolvedValue({ path: 'test.md' });

			const result = await tools.create_note({ 
				path: 'test.md', 
				content: 'Hello', 
				tags: ['tag1', 'tag2'] 
			});

			expect(result).toContain('Successfully created note');
		});
	});

	describe('Folder Tools', () => {
		it('should create a folder', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.createFolder.mockResolvedValue(undefined);
			const result = await tools.create_folder({ path: 'NewFolder' });
			expect(result).toContain('Successfully created folder');
		});
	});

	describe('Power Tools', () => {
		it('should execute a command', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.commands.executeCommandById.mockReturnValue(true);
			const result = await tools.execute_command({ command_id: 'cmd1' });
			expect(result).toContain('Successfully executed');
		});

		it('should list commands', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.commands.listCommands.mockReturnValue([{ id: 'c1', name: 'N1' }]);
			const result = await tools.list_commands();
			expect(result).toContain('c1: N1');
		});

		it('should perform global search', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getMarkdownFiles.mockReturnValue([{ path: 'match.md' }]);
			mockApp.vault.cachedRead.mockResolvedValue('test query content');
			const result = await tools.global_search({ query: 'query' });
			expect(result).toContain('match.md');
		});

		it('should get active note', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'active.md' };
			mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
			mockApp.vault.read.mockResolvedValue('active content');
			const result = await tools.get_active_note();
			expect(result).toContain('active content');
		});
	});
});
