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
				getAbstractFileByPath: vi.fn()
			},
			metadataCache: {
				getFileCache: vi.fn()
			}
		};
	});

	describe('Exclusion List', () => {
		it('should block access to excluded paths', async () => {
			const excludedPaths = ['Private/', 'Secret.md'];
			const tools = getObsidianTools(mockApp, excludedPaths);

			const result = await tools.read_note({ path: 'Private/MyNote.md' });
			expect(result).toContain('Error: Access to Private/MyNote.md is excluded');
			
			const result2 = await tools.create_note({ path: 'Private/New.md', content: 'test' });
			expect(result2).toContain('Error: Access to Private/New.md is excluded');

			const result3 = await tools.update_note({ path: 'Secret.md', new_content: 'test' });
			expect(result3).toContain('Error: Access to Secret.md is excluded');

			const result4 = await tools.get_metadata({ path: 'Secret.md' });
			expect(result4).toContain('Error: Access to Secret.md is excluded');

			const result5 = await tools.create_canvas({ path: 'Private/test.canvas', nodes: [] });
			expect(result5).toContain('Error: Access to Private/test.canvas is excluded');

			const result6 = await tools.add_node_to_canvas({ path: 'Secret.md', node: {} });
			expect(result6).toContain('Error: Access to Secret.md is excluded');
		});

		it('should allow access to non-excluded paths', async () => {
			const excludedPaths = ['Private/'];
			const tools = getObsidianTools(mockApp, excludedPaths);
			
			const mockFile = { path: 'Public/Note.md', extension: 'md' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.cachedRead.mockResolvedValue('Note content');

			const result = await tools.read_note({ path: 'Public/Note.md' });
			expect(result).toBe('Note content');
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
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				'test.md', 
				'---\ntags: [tag1, tag2]\n---\nHello'
			);
		});

		it('should handle creation error', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.create.mockRejectedValue(new Error('Fail'));
			const result = await tools.create_note({ path: 'test.md', content: 'Hello' });
			expect(result).toContain('Error creating note: Fail');
		});
	});

	describe('update_note', () => {
		it('should update note if it exists', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'test.md', extension: 'md' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			
			const result = await tools.update_note({ path: 'test.md', new_content: 'Updated' });
			expect(result).toContain('Successfully updated note');
			expect(mockApp.vault.modify).toHaveBeenCalledWith(mockFile, 'Updated');
		});

		it('should return error if file not found', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const result = await tools.update_note({ path: 'nonexistent.md', new_content: '' });
			expect(result).toContain('Error: File not found');
		});

		it('should return error if not a file', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockReturnValue({ children: [] }); // Folder
			const result = await tools.update_note({ path: 'folder', new_content: '' });
			expect(result).toContain('Error: File not found');
		});

		it('should handle update errors', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'test.md', extension: 'md' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.modify.mockRejectedValue(new Error('Modify failed'));
			const result = await tools.update_note({ path: 'test.md', new_content: '' });
			expect(result).toContain('Error updating note: Modify failed');
		});
	});

	describe('read_note', () => {
		it('should handle read error', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'test.md', extension: 'md' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.cachedRead.mockRejectedValue(new Error('Read error'));

			const result = await tools.read_note({ path: 'test.md' });
			expect(result).toContain('Error reading note: Read error');
		});

		it('should handle file not found', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const result = await tools.read_note({ path: 'test.md' });
			expect(result).toContain('Error: File not found');
		});
	});

	describe('get_metadata', () => {
		it('should return metadata', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'test.md', extension: 'md' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.metadataCache.getFileCache.mockReturnValue({ tags: ['t1'] });

			const result = await tools.get_metadata({ path: 'test.md' });
			expect(result).toContain('"tags": [\n    "t1"\n  ]');
		});

		it('should handle file not found', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const result = await tools.get_metadata({ path: 'test.md' });
			expect(result).toContain('Error: File not found');
		});

		it('should handle errors', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockImplementation(() => { throw new Error('metadata fail'); });
			const result = await tools.get_metadata({ path: 'test.md' });
			expect(result).toContain('Error getting metadata: metadata fail');
		});
	});

	describe('list_files', () => {
		it('should list files in root', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFolder = {
				path: '/',
				children: [
					{ path: 'note1.md', extension: 'md' },
					{ path: 'folder1', children: [] }
				]
			};
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFolder);

			const result = await tools.list_files({ folder_path: '' });
			expect(result).toContain('note1.md');
			expect(result).toContain('[DIR] folder1');
		});

		it('should filter out excluded files from listing', async () => {
			const excludedPaths = ['Secret/'];
			const tools = getObsidianTools(mockApp, excludedPaths);

			const mockFolder = {
				path: 'Root',
				children: [
					{ path: 'Root/Public.md', extension: 'md' },
					{ path: 'Secret/Private.md', extension: 'md' },
					{ path: 'Root/SubFolder', children: [] }
				]
			};
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFolder);

			const result = await tools.list_files({ folder_path: 'Root' });
			expect(result).toContain('Root/Public.md');
			expect(result).toContain('[DIR] Root/SubFolder');
			expect(result).not.toContain('Secret/Private.md');
		});

		it('should handle empty folder', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFolder = { path: 'empty', children: [] };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFolder);
			const result = await tools.list_files({ folder_path: 'empty' });
			expect(result).toBe('Folder is empty or all contents are excluded');
		});

		it('should handle non-folder path', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockReturnValue({ path: 'file.md', extension: 'md' });
			const result = await tools.list_files({ folder_path: 'file.md' });
			expect(result).toContain('Error: Folder not found');
		});

		it('should handle errors', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockImplementation(() => { throw new Error('list fail'); });
			const result = await tools.list_files({ folder_path: '/' });
			expect(result).toContain('Error listing files: list fail');
		});
	});

	describe('Canvas Tools', () => {
		it('should create a canvas', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.create.mockResolvedValue({ path: 'test.canvas' });

			const result = await tools.create_canvas({ path: 'test.canvas', nodes: [{ id: '1' }] });
			expect(result).toContain('Successfully created canvas');
			expect(mockApp.vault.create).toHaveBeenCalled();
		});

		it('should handle canvas creation error', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.create.mockRejectedValue(new Error('Canvas creation failed'));
			const result = await tools.create_canvas({ path: 'test.canvas' });
			expect(result).toContain('Error creating canvas: Canvas creation failed');
		});

		it('should add a node to canvas', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'test.canvas', extension: 'canvas' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.read.mockResolvedValue(JSON.stringify({ nodes: [], edges: [] }));

			const result = await tools.add_node_to_canvas({ path: 'test.canvas', node: { id: '2' } });
			expect(result).toContain('Successfully added node');
			expect(mockApp.vault.modify).toHaveBeenCalled();
			const modifyArg = mockApp.vault.modify.mock.calls[0][1];
			expect(modifyArg).toContain('"id": "2"');
		});

		it('should handle missing canvas file for add_node', async () => {
			const tools = getObsidianTools(mockApp);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			const result = await tools.add_node_to_canvas({ path: 'missing.canvas', node: {} });
			expect(result).toContain('Error: Canvas file not found');
		});

		it('should handle add_node errors', async () => {
			const tools = getObsidianTools(mockApp);
			const mockFile = { path: 'test.canvas', extension: 'canvas' };
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.read.mockRejectedValue(new Error('Read fail'));
			const result = await tools.add_node_to_canvas({ path: 'test.canvas', node: {} });
			expect(result).toContain('Error adding node to canvas: Read fail');
		});
	});
});
