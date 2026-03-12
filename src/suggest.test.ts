import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSuggestModal } from './suggest';
import { TFile } from 'obsidian';

describe('FileSuggestModal', () => {
	let mockApp: any;
	let onSelect: any;
	let modal: FileSuggestModal;

	beforeEach(() => {
		mockApp = {
			vault: {
				getMarkdownFiles: vi.fn().mockReturnValue([{ path: 'test.md' }])
			}
		};
		onSelect = vi.fn();
		modal = new FileSuggestModal(mockApp as any, onSelect);
	});

	it('should get items from vault', () => {
		const items = modal.getItems();
		expect(items).toHaveLength(1);
		expect(items[0].path).toBe('test.md');
	});

	it('should return file path as item text', () => {
		const mockFile = { path: 'folder/file.md' } as TFile;
		expect(modal.getItemText(mockFile)).toBe('folder/file.md');
	});

	it('should call onSelect when item is chosen', () => {
		const mockFile = { path: 'chosen.md' } as TFile;
		modal.onChooseItem(mockFile, {} as any);
		expect(onSelect).toHaveBeenCalledWith(mockFile);
	});
});
