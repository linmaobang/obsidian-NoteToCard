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
	fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
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

// 首先添加一个接口来定义笔记数据的结构
interface NoteData {
	title: string;
	content: string;
	path: string;
	created: number;
	modified: number;
	tags: string[];
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
				new NoteToCardModal(this.app, this, editor, view).open();
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

// 修改 NoteToCardModal 类的构造函数和相关方法
class NoteToCardModal extends Modal {
	private plugin: NoteToCardPlugin;
	private noteData: NoteData;
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

	constructor(app: App, plugin: NoteToCardPlugin, editor: Editor, view: MarkdownView) {
		super(app);
		this.plugin = plugin;
		
		// 获取笔记数据
		const file = view.file;
		if (!file) {
			throw new Error('文件不存在');
		}
		const cache = this.app.metadataCache.getFileCache(file);
		
		this.noteData = {
			title: file.basename,
			content: editor.getValue(),
			path: file.path,
			created: file.stat.ctime,
			modified: file.stat.mtime,
			tags: cache?.tags?.map(t => t.tag) || []
		};
		
		// 克隆当前设置以便预览时修改
		this.currentSettings = {...plugin.settings};
	}

	async onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		
		// 设置模态框尺寸
		this.modalEl.style.width = '80vw';
		this.modalEl.style.maxWidth = '1000px';
		this.modalEl.style.height = '80vh';
		
		// 创建主容器
		const mainContainer = contentEl.createDiv({cls: 'note-to-card-main-container'});
		mainContainer.style.display = 'flex';
		mainContainer.style.height = '100%';
		mainContainer.style.gap = '10px';
		mainContainer.style.padding = '20px';
		
		// 创建左侧预览区（不再放在滚动容器中）
		const previewSection = mainContainer.createDiv('note-to-card-preview-section');
		previewSection.style.flex = '1';
		previewSection.style.overflow = 'auto'; // 让预览区域自己滚动
		// previewSection.createEl('h3', {text: '预览'});
		this.previewContainer = previewSection.createDiv('note-to-card-preview');
		
		// 创建右侧控制面板
		const controlSection = mainContainer.createDiv('note-to-card-control-section');
		controlSection.style.width = '300px';
		controlSection.style.display = 'flex';
		controlSection.style.flexDirection = 'column';
		
		// 控制面板标题
		// controlSection.createEl('h3', {text: '样式设置'});
		
		// 创建控制内容区域（可滚动）
		const controlContent = controlSection.createDiv('note-to-card-control-content');
		controlContent.style.flex = '1';
		controlContent.style.overflow = 'auto';
		
		// 添加样式控制选项
		await this.createStyleControls(controlContent);
		
		// 在控制面板底部添加按钮
		const buttonContainer = controlSection.createDiv('note-to-card-button-container');
		buttonContainer.style.padding = '10px 0';
		buttonContainer.style.borderTop = '1px solid var(--background-modifier-border)';
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		
		// 复制到剪贴板按钮
		const copyButton = buttonContainer.createEl('button', {
			text: '复制到剪贴板',
			cls: 'mod-cta'
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
			.setDesc('选择预设渐变背景或自定义颜色')
			.addColorPicker(color => color
				.setValue(this.currentSettings.backgroundColor)
				.onChange(async (value) => {
					this.currentSettings.backgroundColor = value;
					await this.updatePreview();
				}));
		
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
					{ value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto', name: '系统默认' },
					{ value: 'Source Han Sans SC, Noto Sans SC', name: '思源黑体' },
					{ value: 'Microsoft YaHei', name: '微软雅黑' },
					{ value: 'PingFang SC', name: '苹方' },
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

	private async createRenderContainer(noteData: NoteData, settings: NoteToCardSettings): Promise<HTMLElement> {
		const container = document.createElement('div');
		container.className = 'note-to-card-container';
		container.style.background = settings.backgroundColor;
		container.style.fontFamily = settings.fontFamily.replace(/"/g, '\'');
		container.style.boxSizing = 'border-box';
		container.style.position = 'relative';
		
		// 创建内容包装器
		const wrapper = document.createElement('div');
		wrapper.className = 'note-to-card-wrapper';
		wrapper.style.padding = settings.padding;
		container.appendChild(wrapper);
		
		// 添加标题
		if (noteData.title) {
			const titleEl = document.createElement('div');
			titleEl.className = 'note-to-card-title';
			titleEl.textContent = noteData.title;
			wrapper.appendChild(titleEl);
		}
		
		// 添加标签
		if (noteData.tags.length > 0) {
			const tagsEl = document.createElement('div');
			tagsEl.className = 'note-to-card-tags';
			noteData.tags.forEach(tag => {
				const tagSpan = document.createElement('span');
				tagSpan.className = 'note-to-card-tag';
				tagSpan.textContent = tag;
				tagsEl.appendChild(tagSpan);
			});
			wrapper.appendChild(tagsEl);
		}
		
		// 内容区域
		const contentEl = document.createElement('div');
		contentEl.className = 'note-to-card-content markdown-preview-view';
		contentEl.style.fontSize = settings.fontSize;
		contentEl.style.color = '#000000';
		contentEl.style.lineHeight = '1.6';
		contentEl.style.fontFamily = 'inherit';
		
		// 等待 Markdown 渲染完成
		await MarkdownRenderer.renderMarkdown(
			noteData.content,
			contentEl,
			'',
			this.plugin
		);
		
		wrapper.appendChild(contentEl);
		
		// 添加水印
		if (settings.watermarkText) {
			const watermark = document.createElement('div');
			watermark.className = 'note-to-card-watermark';
			watermark.textContent = settings.watermarkText;
			watermark.style.opacity = String(settings.watermarkOpacity);
			wrapper.appendChild(watermark);
		}
		
		// 不强制设置高度，让容器自适应内容
		document.body.appendChild(container);
		
		// 设置初始宽度
		container.style.width = '800px';
		
		// 根据内容高度自动调整整体高度
		const contentActualHeight = wrapper.scrollHeight;
		container.style.height = 'auto';
		
		document.body.removeChild(container);
		
		return container;
	}

	private async updatePreview() {
		this.previewContainer.empty();
		const container = await this.createRenderContainer(
			this.noteData,
			this.currentSettings
		);
		
		// 添加到预览容器
		this.previewContainer.appendChild(container);
		
		// 确保容器和内容完全渲染
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// 获取容器和预览区的尺寸
		const previewRect = this.previewContainer.getBoundingClientRect();
		const containerRect = container.getBoundingClientRect();
		
		// 计算最佳缩放比例，留出边距
		const padding = 40; // 预留边距
		const scaleX = (previewRect.width - padding) / containerRect.width;
		const scaleY = (previewRect.height - padding) / containerRect.height;
		const scale = Math.min(1, Math.min(scaleX, scaleY));
		
		// 应用缩放
		container.style.transform = `scale(${scale})`;
		
		// 调整位置使其居中
		if (scale < 1) {
			container.style.transformOrigin = 'center';
		} else {
			container.style.margin = '0 auto';
		}
	}

	private async generateAndCopy() {
		try {
			// 创建渲染容器
			const container = await this.createRenderContainer(
				this.noteData,
				this.currentSettings
			);
			
			// 先添加到 DOM 以计算正确的尺寸
			document.body.appendChild(container);
			
			try {
				// 设置固定宽度
				container.style.width = '800px';
				
				// 添加额外包装器以确保正确捕获
				const outerWrapper = document.createElement('div');
				outerWrapper.style.position = 'absolute';
				outerWrapper.style.left = '-9999px';
				outerWrapper.style.top = '0';
				outerWrapper.style.width = '800px';
				outerWrapper.style.padding = '0';
				outerWrapper.style.margin = '0';
				outerWrapper.style.background = 'transparent';
				outerWrapper.appendChild(container.cloneNode(true));
				document.body.appendChild(outerWrapper);
				
				// 等待内容完全渲染
				await new Promise(resolve => setTimeout(resolve, 100));
				
				// 获取实际高度并设置固定高度
				const wrapper = outerWrapper.querySelector('.note-to-card-wrapper') as HTMLElement;
				const actualHeight = wrapper.scrollHeight + 40; // 添加额外空间
				outerWrapper.firstChild.setAttribute('style', `
					width: 800px;
					height: ${actualHeight}px;
					background: ${this.currentSettings.backgroundColor};
					font-family: ${this.currentSettings.fontFamily.replace(/"/g, '\'')};
					border-radius: 16px;
					overflow: visible;
					position: relative;
					box-sizing: border-box;
				`);
				
				// 等待所有图片加载
				const images = outerWrapper.querySelectorAll('img');
				if (images.length > 0) {
					await Promise.all(Array.from(images).map(img => {
						if (img.complete) return Promise.resolve();
						return new Promise(resolve => {
							img.onload = resolve;
							img.onerror = resolve;
						});
					}));
				}
				
				// 使用 dom-to-image 生成图片
				const blob = await domtoimage.toBlob(outerWrapper.firstChild as HTMLElement, {
					quality: 0.95,
					bgcolor: 'transparent',
					style: {
						'font-size': this.currentSettings.fontSize,
						'padding': this.currentSettings.padding,
						'background': this.currentSettings.backgroundColor,
						'border-radius': '16px',
						'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.08)'
					}
				});

				// 复制到剪贴板
				await navigator.clipboard.write([
					new ClipboardItem({
						'image/png': blob
					})
				]);

				new Notice('图片已复制到剪贴板');
			} finally {
				// 清理 DOM
				document.body.removeChild(container);
				if (document.querySelector('div[style*="left: -9999px"]')) {
					document.body.removeChild(document.querySelector('div[style*="left: -9999px"]'));
				}
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

	// 同样修改保存方法
	private async generateAndSave() {
		try {
			// 与复制方法同样的处理，仅修改最后部分
			const container = await this.createRenderContainer(
				this.noteData,
				this.currentSettings
			);
			
			document.body.appendChild(container);
			
			try {
				// 设置固定宽度
				container.style.width = '800px';
				
				// 添加额外包装器以确保正确捕获
				const outerWrapper = document.createElement('div');
				outerWrapper.style.position = 'absolute';
				outerWrapper.style.left = '-9999px';
				outerWrapper.style.top = '0';
				outerWrapper.style.width = '800px';
				outerWrapper.style.padding = '0';
				outerWrapper.style.margin = '0';
				outerWrapper.style.background = 'transparent';
				outerWrapper.appendChild(container.cloneNode(true));
				document.body.appendChild(outerWrapper);
				
				// 等待内容完全渲染
				await new Promise(resolve => setTimeout(resolve, 100));
				
				// 获取实际高度并设置固定高度
				const wrapper = outerWrapper.querySelector('.note-to-card-wrapper') as HTMLElement;
				const actualHeight = wrapper.scrollHeight + 40; // 添加额外空间
				outerWrapper.firstChild.setAttribute('style', `
					width: 800px;
					height: ${actualHeight}px;
					background: ${this.currentSettings.backgroundColor};
					font-family: ${this.currentSettings.fontFamily.replace(/"/g, '\'')};
					border-radius: 16px;
					overflow: visible;
					position: relative;
					box-sizing: border-box;
				`);
				
				// 等待所有图片加载
				const images = outerWrapper.querySelectorAll('img');
				if (images.length > 0) {
					await Promise.all(Array.from(images).map(img => {
						if (img.complete) return Promise.resolve();
						return new Promise(resolve => {
							img.onload = resolve;
							img.onerror = resolve;
						});
					}));
				}
				
				// 使用 dom-to-image 生成图片
				const blob = await domtoimage.toBlob(outerWrapper.firstChild as HTMLElement, {
					quality: 0.95,
					bgcolor: 'transparent',
					style: {
						'font-size': this.currentSettings.fontSize,
						'padding': this.currentSettings.padding,
						'background': this.currentSettings.backgroundColor,
						'border-radius': '16px',
						'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.08)'
					}
				});

				// 保存文件
				const timestamp = this.getTimestamp();
				const filename = `notecard-${timestamp}.png`;
				const arrayBuffer = await blob.arrayBuffer();

				const filePath = await this.app.vault.createBinary(
					filename,
					arrayBuffer
				);

				new Notice(`图片已保存至 ${filePath.path}`);
			} finally {
				// 清理 DOM
				document.body.removeChild(container);
				if (document.querySelector('div[style*="left: -9999px"]')) {
					document.body.removeChild(document.querySelector('div[style*="left: -9999px"]'));
				}
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
