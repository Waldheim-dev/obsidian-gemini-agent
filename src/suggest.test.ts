import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSuggestModal } from './suggest';
import { App, TFile } from 'obsidian';

describe('FileSuggestModal', () => {
	let modal: FileSuggestModal;
	let mockApp: App;
	let onSelect: (file: TFile) => void;

	beforeEach(() => {
		onSelect = vi.fn();
		mockApp = {
			vault: {
				getMarkdownFiles: vi.fn().mockReturnValue([])
			}
		} as unknown as App;
		modal = new FileSuggestModal(mockApp, onSelect);
	});

	it('should return markdown files from vault', () => {
		const mockFiles = [new TFile(), new TFile()];
		(mockApp.vault.getMarkdownFiles as any).mockReturnValue(mockFiles);
		expect(modal.getItems()).toBe(mockFiles);
	});

	it('should return file path as item text', () => {
		const mockFile = new TFile();
		mockFile.path = 'folder/file.md';
		expect(modal.getItemText(mockFile)).toBe('folder/file.md');
	});

	it('should call onSelect when item is chosen', () => {
		const mockFile = new TFile();
		mockFile.path = 'chosen.md';
		modal.onChooseItem(mockFile, new MouseEvent('click'));
		expect(onSelect).toHaveBeenCalledWith(mockFile);
	});
});
