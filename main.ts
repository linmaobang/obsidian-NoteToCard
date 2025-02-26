import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { MarkdownRenderer } from 'obsidian';
import * as domtoimage from 'dom-to-image';

// Remember to rename these classes and interfaces!

interface NoteToCardSettings {
	backgroundColor: string;
	fontFamily: string;
	fontSize: string;
	padding: string;
	watermarkText: string;
	watermarkOpacity: number;
	exportPath: string;
	exportQuality: number;
	lastUsedGradient?: string;
}

const DEFAULT_SETTINGS: NoteToCardSettings = {
	backgroundColor: '#ffffff',
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
	fontSize: '16px',
	padding: '20px',
	watermarkText: '',
	watermarkOpacity: 0.1,
	exportPath: '',
	exportQuality: 0.95,
	lastUsedGradient: '#ffffff'
}

declare global {
	interface Window {
		require: (module: string) => any;
	}
}

declare module 'dom-to-image' {
	export function toBlob(node: HTMLElement, options?: {
		quality?: number;
		bgcolor?: string;
		style?: Record<string, string>;
	}): Promise<Blob>;
}

export default class NoteToCardPlugin extends Plugin {
	settings: NoteToCardSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'NoteToCard', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Hi');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new NoteToCardSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// 添加转换命令
		this.addCommand({
			id: 'convert-note-to-image',
			name: '将当前笔记转换为图片',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const content = editor.getValue();
				new NoteToCardModal(this.app, this, content).open();
			}
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class NoteToCardSettingTab extends PluginSettingTab {
	plugin: NoteToCardPlugin;

	constructor(app: App, plugin: NoteToCardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: '笔记转图片设置'});

		new Setting(containerEl)
			.setName('背景颜色')
			.setDesc('设置导出图片的背景颜色')
			.addText(text => text
				.setPlaceholder('#ffffff')
				.setValue(this.plugin.settings.backgroundColor)
				.onChange(async (value) => {
					this.plugin.settings.backgroundColor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('字体')
			.setDesc('设置文字字体')
			.addText(text => text
				.setPlaceholder('系统默认字体')
				.setValue(this.plugin.settings.fontFamily)
				.onChange(async (value) => {
					this.plugin.settings.fontFamily = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('字体大小')
			.setDesc('设置文字大小')
			.addText(text => text
				.setPlaceholder('16px')
				.setValue(this.plugin.settings.fontSize)
				.onChange(async (value) => {
					this.plugin.settings.fontSize = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('水印文字')
			.setDesc('设置水印内容（留空则不显示水印）')
			.addText(text => text
				.setPlaceholder('输入水印文字')
				.setValue(this.plugin.settings.watermarkText)
				.onChange(async (value) => {
					this.plugin.settings.watermarkText = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('水印透明度')
			.setDesc('设置水印的透明度（0-1）')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.watermarkOpacity)
				.onChange(async (value) => {
					this.plugin.settings.watermarkOpacity = value;
					await this.plugin.saveSettings();
				}));
	}
}

// 添加一个新的模态框类
class NoteToCardModal extends Modal {
	private plugin: NoteToCardPlugin;
	private content: string;
	private previewContainer: HTMLElement;
	private currentSettings: NoteToCardSettings;
	
	// 添加预设渐变色
	private static readonly PRESET_GRADIENTS = [
		{ name: '清新白', value: 'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)' },
		{ name: '暖阳', value: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' },
		{ name: '薄荷', value: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)' },
		{ name: '晚霞', value: 'linear-gradient(120deg, #a18cd1 0%, #fbc2eb 100%)' },
		{ name: '静谧蓝', value: 'linear-gradient(120deg, #89f7fe 0%, #66a6ff 100%)' },
		{ name: '珊瑚粉', value: 'linear-gradient(120deg, #ff9a9e 0%, #fecfef 100%)' },
		{ name: '青柠', value: 'linear-gradient(120deg, #96fbc4 0%, #f9f586 100%)' },
		{ name: '深邃', value: 'linear-gradient(120deg, #6e45e2 0%, #88d3ce 100%)' },
	];

	constructor(app: App, plugin: NoteToCardPlugin, content: string) {
		super(app);
		this.plugin = plugin;
		this.content = content;
		// 克隆当前设置以便预览时修改
		this.currentSettings = {...plugin.settings};
	}

	async onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		
		// 设置模态框尺寸
		this.modalEl.style.width = '100vw';
		this.modalEl.style.maxWidth = '1200px';
		this.modalEl.style.height = '80vh';
		
		// 创建预览和控制面板的容器
		const container = contentEl.createDiv('note-to-card-modal-container');
		
		// 创建左侧预览区
		const previewSection = container.createDiv('note-to-card-preview-section');
		previewSection.createEl('h3', {text: '预览'});
		this.previewContainer = previewSection.createDiv('note-to-card-preview');
		
		// 创建右侧控制面板
		const controlSection = container.createDiv('note-to-card-control-section');
		controlSection.createEl('h3', {text: '样式设置'});
		
		// 创建控制内容区域
		const controlContent = controlSection.createDiv('note-to-card-control-content');
		
		// 添加样式控制选项
		await this.createStyleControls(controlContent);
		
		// 添加操作按钮容器
		const buttonContainer = contentEl.createDiv('note-to-card-button-container');
		
		// 复制到剪贴板按钮
		const copyButton = buttonContainer.createEl('button', {
			text: '复制到剪贴板',
			cls: 'primary'
		});
		copyButton.addEventListener('click', () => this.generateAndCopy());
		
		// 保存到文件按钮
		const saveButton = buttonContainer.createEl('button', {
			text: '保存到文件'
		});
		saveButton.addEventListener('click', () => this.generateAndSave());
		
		// 初始化预览
		await this.updatePreview();
	}

	private async createStyleControls(container: HTMLElement) {
		// 背景样式
		new Setting(container)
			.setName('背景样式')
			.setDesc('选择预设渐变背景');
		
		const colorGrid = container.createDiv('note-to-card-color-grid');
		NoteToCardModal.PRESET_GRADIENTS.forEach(gradient => {
			const colorOption = colorGrid.createDiv('note-to-card-color-option');
			colorOption.style.background = gradient.value;
			colorOption.setAttribute('aria-label', gradient.name);
			if (this.currentSettings.backgroundColor === gradient.value) {
				colorOption.addClass('selected');
			}
			colorOption.addEventListener('click', async () => {
				colorGrid.findAll('.selected').forEach(el => el.removeClass('selected'));
				colorOption.addClass('selected');
				this.currentSettings.backgroundColor = gradient.value;
				await this.updatePreview();
			});
		});

		// 字体设置
		new Setting(container)
			.setName('字体')
			.setDesc('设置文字字体')
			.addDropdown(dropdown => {
				const fonts = [
					{ value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto', name: '系统默认' },
					{ value: '"Source Han Sans SC"', name: '思源黑体' },
					{ value: '"Microsoft YaHei"', name: '微软雅黑' },
					{ value: '"PingFang SC"', name: '苹方' },
				];
				fonts.forEach(font => dropdown.addOption(font.value, font.name));
				dropdown
					.setValue(this.currentSettings.fontFamily)
					.onChange(async (value) => {
						this.currentSettings.fontFamily = value;
						await this.updatePreview();
					});
			});

		// 字体大小
		new Setting(container)
			.setName('字体大小')
			.setDesc('调整文字大小（像素）')
			.addSlider(slider => slider
				.setLimits(12, 24, 1)
				.setValue(parseInt(this.currentSettings.fontSize))
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.currentSettings.fontSize = `${value}px`;
					await this.updatePreview();
				}));

		// 内边距
		new Setting(container)
			.setName('内边距')
			.setDesc('调整卡片内边距')
			.addSlider(slider => slider
				.setLimits(10, 50, 5)
				.setValue(parseInt(this.currentSettings.padding))
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.currentSettings.padding = `${value}px`;
					document.documentElement.style.setProperty('--card-padding', `${value}px`);
					await this.updatePreview();
				}));

		// 水印文字
		new Setting(container)
			.setName('水印文字')
			.setDesc('设置水印内容（留空则不显示水印）')
			.addText(text => text
				.setPlaceholder('输入水印文字')
				.setValue(this.currentSettings.watermarkText)
				.onChange(async (value) => {
					this.currentSettings.watermarkText = value;
					await this.updatePreview();
				}));

		// 水印透明度
		if (this.currentSettings.watermarkText) {
			new Setting(container)
				.setName('水印透明度')
				.setDesc('设置水印的透明度')
				.addSlider(slider => slider
					.setLimits(0, 1, 0.1)
					.setValue(this.currentSettings.watermarkOpacity)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.currentSettings.watermarkOpacity = value;
						await this.updatePreview();
					}));
		}
	}

	private async createRenderContainer(content: string, settings: NoteToCardSettings): Promise<HTMLElement> {
		const container = document.createElement('div');
		container.className = 'note-to-card-container';
		container.style.background = settings.backgroundColor;
		container.style.fontFamily = settings.fontFamily;
		container.style.padding = settings.padding;
		container.style.width = '600px';
		container.style.margin = '0';
		container.style.boxSizing = 'border-box';
		container.style.borderRadius = '8px';
		container.style.overflow = 'hidden';
		
		const contentEl = document.createElement('div');
		contentEl.className = 'note-to-card-content markdown-preview-view';
		contentEl.style.fontSize = settings.fontSize;
		contentEl.style.color = '#000000';
		contentEl.style.lineHeight = '1.6';
		
		// 安全地获取主题类名
		const bodyEl = document.querySelector('body');
		const theme = bodyEl ? bodyEl.className : '';
		contentEl.className = `note-to-card-content markdown-preview-view ${theme}`;
		
		await MarkdownRenderer.renderMarkdown(
			content,
			contentEl,
			'',
			this.plugin
		);
		
		container.appendChild(contentEl);
		
		if (settings.watermarkText) {
			const watermark = document.createElement('div');
			watermark.className = 'note-to-card-watermark';
			watermark.textContent = settings.watermarkText;
			watermark.style.opacity = String(settings.watermarkOpacity);
			container.appendChild(watermark);
		}
		
		return container;
	}

	private async updatePreview() {
		this.previewContainer.empty();
		const container = await this.createRenderContainer(
			this.content,
			this.currentSettings
		);
		this.previewContainer.appendChild(container);
	}

	private async generateAndCopy() {
		try {
			const container = await this.createRenderContainer(
				this.content,
				this.currentSettings
			);
			
			document.body.appendChild(container);
			try {
				const blob = await domtoimage.toBlob(container, {
					quality: 0.95,
					bgcolor: 'transparent',
					style: {
						'font-size': this.currentSettings.fontSize,
						'padding': this.currentSettings.padding,
						'background': this.currentSettings.backgroundColor,
						'font-family': this.currentSettings.fontFamily,
						'width': '600px',
						'margin': '0',
						'box-sizing': 'border-box',
						'border-radius': '16px',
						'overflow': 'hidden',
						'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.08)'
					}
				});

				await navigator.clipboard.write([
					new ClipboardItem({
						'image/png': blob
					})
				]);

				new Notice('图片已复制到剪贴板');
			} finally {
				document.body.removeChild(container);
			}
		} catch (error) {
			new Notice('复制图片失败: ' + error.message);
			console.error('复制图片失败:', error);
		}
	}

	// 添加一个辅助函数来生成时间戳
	private getTimestamp(): string {
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	}

	// 修改保存文件的方法
	private async generateAndSave() {
		try {
			const container = await this.createRenderContainer(
				this.content,
				this.currentSettings
			);
			
			document.body.appendChild(container);
			try {
				const blob = await domtoimage.toBlob(container, {
					quality: 0.95,
					bgcolor: 'transparent',
					style: {
						'font-size': this.currentSettings.fontSize,
						'padding': this.currentSettings.padding,
						'background': this.currentSettings.backgroundColor,
						'font-family': this.currentSettings.fontFamily,
						'width': '600px',
						'margin': '0',
						'box-sizing': 'border-box',
						'border-radius': '16px',
						'overflow': 'hidden',
						'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.08)'
					}
				});

				const timestamp = this.getTimestamp();
				const filename = `notecard-${timestamp}.png`;
				const arrayBuffer = await blob.arrayBuffer();

				// 使用 Obsidian 的保存方法
				const filePath = await this.app.vault.createBinary(
					filename,
					arrayBuffer
				);

				new Notice(`图片已保存至 ${filePath.path}`);
			} finally {
				document.body.removeChild(container);
			}
		} catch (error) {
			new Notice('保存图片失败: ' + error.message);
			console.error('保存图片失败:', error);
		}
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
