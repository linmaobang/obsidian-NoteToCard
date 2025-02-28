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
	includeTitle: boolean;        // 包含文件名作为标题
	imageWidth: number;           // 图片宽度
	showAuthor: boolean;          // 显示作者信息
	authorName: string;           // 作者名
	extraText: string;            // 额外文案
	authorAvatar: string;         // 头像路径
	textAlignment: string;        // 对齐方式
	authorPosition: 'top' | 'bottom'; // 作者信息位置
	includeFooter: boolean;       // 是否包含底部区域
	imageEnhance: boolean;        // 新增图片增强开关
	gradientStart: string;        // 渐变起始色
	gradientEnd: string;          // 渐变结束色
	gradientAngle: number;        // 渐变角度
	layoutStyle: string;          // 添加布局样式设置
	useCustomBackground: boolean;  // 新增：是否使用自定义背景（渐变色）
	width: number; // 添加宽度设置
}

const DEFAULT_SETTINGS: NoteToCardSettings = {
	backgroundColor: '#ffffff',
	fontFamily: '"LXGW WenKai", "FZShuSong-Z01", "Songti SC", SimSun, serif',
	fontSize: '16px',
	padding: '20px',
	watermarkText: '',
	watermarkOpacity: 0.1,
	exportPath: '',
	exportQuality: 0.95,
	lastUsedGradient: '#ffffff',
	includeTitle: true,
	imageWidth: 750,
	showAuthor: false,
	authorName: '',
	extraText: '',
	authorAvatar: '',
	textAlignment: 'left',
	authorPosition: 'bottom',
	includeFooter: false,
	imageEnhance: false, // 默认关闭图片增强
	gradientStart: '#ffffff',
	gradientEnd: '#ffffff',
	gradientAngle: 120,
	layoutStyle: 'default', // 默认布局
	useCustomBackground: false,  // 默认不使用自定义背景
	width: 750, // 修改为默认宽度 750
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

		// 添加左侧栏图标
		this.addRibbonIcon(
			'image-file', // 使用 Obsidian 内置的图标
			'NoteToCard', 
			(evt: MouseEvent) => {
				// 获取当前活动的 markdown 视图
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView) {
					new NoteToCardModal(
						this.app,
						this,
						activeView.editor,
						activeView
					).open();
				} else {
					new Notice('请在笔记编辑界面使用此功能');
				}
			}
		);

		// 保留命令面板的转换命令
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
	private currentScale: number = 1;
	private minScale: number = 0.5;
	private maxScale: number = 2;
	
	// 修改预设渐变色数组
	private static readonly PRESET_GRADIENTS = [
		{ name: '清新白', value: 'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)' },
		{ name: '暖阳', value: 'linear-gradient(120deg, #f6d365 0%,rgb(192, 107, 83) 100%)' },
		{ name: '薄荷', value: 'linear-gradient(120deg,rgb(157, 234, 185) 0%, #8fd3f4 100%)' },
		{ name: '晚霞', value: 'linear-gradient(120deg, #a18cd1 0%, #fbc2eb 100%)' },
		{ name: '静谧蓝', value: 'linear-gradient(120deg, #89f7fe 0%, #66a6ff 100%)' },
		{ name: '清新薄荷绿', value: 'linear-gradient(120deg, #e0f2f1 0%, #b2dfdb 100%)' },
		{ name: '梦幻薰衣草紫', value: 'linear-gradient(120deg, #e1bee7 0%, #9c27b0 100%)' },
		{ name: '活力橙黄', value: 'linear-gradient(120deg, #ffab40 0%, #ffeb3b 100%)' },
		{ name: '深邃海洋蓝', value: 'linear-gradient(120deg, #81d4fa 0%, #03a9f4 100%)' },
		{ name: '浪漫樱花粉', value: 'linear-gradient(120deg, #f8bbd0 0%, #e91e63 100%)' },
		{ name: '金属科技银', value: 'linear-gradient(120deg, #eeeeee 0%, #bdbdbd 100%)' },
		{ name: '柔和暖咖', value: 'linear-gradient(120deg, #f4e1d2 0%, #b8860b 100%)' }
	];

	// 修改预设字体数组，添加更多备选字体
	private static readonly PRESET_FONTS = [
		{ 
			name: '系统默认', 
			value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
		},
		{ 
			name: '思源宋体', 
			value: '"Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", SimSun, serif'
		},
		{ 
			name: '思源黑体', 
			value: '"Source Han Sans SC", "Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
		},
		{ 
			name: '霞鹜文楷', 
			value: '"LXGW WenKai", "FZShuSong-Z01", "Songti SC", SimSun, serif'
		},
		{ 
			name: '仓耳今楷', 
			value: '"CangErJinKai", "LXGW WenKai", "FZShuSong-Z01", "Songti SC", SimSun, serif'
		},
		{ 
			name: '方正书宋', 
			value: '"FZShuSong-Z01", "Source Han Serif SC", "Songti SC", SimSun, serif'
		}
	];

	// 更新布局预设
	private static readonly LAYOUT_STYLES = [
		{ name: '默认布局', value: 'default' },
		{ name: '竖排标题', value: 'vertical-title' },
		{ name: '信纸样式', value: 'letter-style' },
		{ name: 'GitHub风格', value: 'github-style' },
		{ name: '杂志版', value: 'magazine' }
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
		this.modalEl.style.width = '90vw';
		this.modalEl.style.maxWidth = '1200px';
		this.modalEl.style.height = '80vh';
		
		const modalContainer = contentEl.createDiv({cls: 'note-to-card-modal-container'});
		
		// 左侧设置面板
		const settingsPanel = modalContainer.createDiv('note-to-card-settings-panel');
		const settingsContent = settingsPanel.createDiv('note-to-card-settings-content');
		await this.createExportSettings(settingsContent);
		
		// 右侧预览区域
		const previewSection = modalContainer.createDiv('note-to-card-preview-section');
		previewSection.createEl('h3', { text: '预览' });
		this.previewContainer = previewSection.createDiv('note-to-card-preview');
		
		// 创建预览包装器
		const previewWrapper = this.previewContainer.createDiv('note-to-card-preview-wrapper');
		
		// 创建悬浮按钮容器
		const buttonContainer = modalContainer.createDiv('note-to-card-button-container');
		
		// 创建按钮
		const copyButton = buttonContainer.createEl('button', {
			text: '复制到剪贴板'
		});
		copyButton.addEventListener('click', () => this.generateAndCopy());
		
		const saveButton = buttonContainer.createEl('button', {
			text: '保存图片',
			cls: 'mod-cta'
		});
		saveButton.addEventListener('click', () => this.generateAndSave());
		
		// 添加缩放控制按钮
		const zoomControls = previewSection.createDiv('note-to-card-zoom-controls');
		
		const zoomOutBtn = zoomControls.createEl('button', {
			cls: 'note-to-card-zoom-btn',
			attr: {'aria-label': '缩小'}
		});
		zoomOutBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>`;
		
		const zoomResetBtn = zoomControls.createEl('button', {
			cls: 'note-to-card-zoom-btn',
			attr: {'aria-label': '重置缩放'}
		});
		zoomResetBtn.innerHTML = '100%';
		
		const zoomInBtn = zoomControls.createEl('button', {
			cls: 'note-to-card-zoom-btn',
			attr: {'aria-label': '放大'}
		});
		zoomInBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
		
		// 添加事件监听
		zoomOutBtn.addEventListener('click', () => this.zoom('out'));
		zoomResetBtn.addEventListener('click', () => this.zoom('reset'));
		zoomInBtn.addEventListener('click', () => this.zoom('in'));
		
		// 添加滚轮缩放事件
		this.previewContainer.addEventListener('wheel', (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				this.zoom(e.deltaY < 0 ? 'in' : 'out');
			}
		});
		
		// 初始化当前设置
		this.currentSettings = {
			...DEFAULT_SETTINGS,
			...this.plugin.settings,
			layoutStyle: this.plugin.settings.layoutStyle || 'default'
		};

		await this.updatePreview();
	}

	private async createExportSettings(container: HTMLElement) {
		// 样式设置区域
		const styleSection = container.createDiv('note-to-card-settings-section');
		styleSection.createEl('h4', {text: '样式设置'});

		// 渐变色设置
		const gradientEditor = styleSection.createDiv('note-to-card-gradient-editor');
		
		// 渐变预览条
		const gradientBar = gradientEditor.createDiv('note-to-card-gradient-bar');
		
		// 颜色选择器容器
		const colorStopsContainer = gradientEditor.createDiv('note-to-card-color-stops');
		
		// 起始色选择器
		const startColorPicker = colorStopsContainer.createDiv('note-to-card-color-stop start');
		startColorPicker.style.background = this.currentSettings.gradientStart;
		const startColorInput = startColorPicker.createEl('input', {
			type: 'color',
			value: this.currentSettings.gradientStart
		});
		
		// 结束色选择器
		const endColorPicker = colorStopsContainer.createDiv('note-to-card-color-stop end');
		endColorPicker.style.background = this.currentSettings.gradientEnd;
		const endColorInput = endColorPicker.createEl('input', {
			type: 'color',
			value: this.currentSettings.gradientEnd
		});

		// 角度控制滑块容器
		const angleContainer = gradientEditor.createDiv('note-to-card-angle-container');
		const angleSlider = angleContainer.createEl('input', {
			type: 'range',
			cls: 'note-to-card-angle-slider',
			attr: {
				min: '0',
				max: '360',
				value: this.currentSettings.gradientAngle.toString()
			}
		});

		// 更新渐变效果的函数
		const updateGradient = () => {
			const gradient = `linear-gradient(${this.currentSettings.gradientAngle}deg, ${this.currentSettings.gradientStart} 0%, ${this.currentSettings.gradientEnd} 100%)`;
			gradientBar.style.background = gradient;
			if (this.currentSettings.useCustomBackground) {
				this.currentSettings.backgroundColor = gradient;
			}
			
			startColorPicker.style.background = this.currentSettings.gradientStart;
			endColorPicker.style.background = this.currentSettings.gradientEnd;
		};

		// 监听颜色变化
		startColorInput.addEventListener('input', async (e) => {
			this.currentSettings.gradientStart = (e.target as HTMLInputElement).value;
			this.currentSettings.useCustomBackground = true;
			updateGradient();
			await this.updatePreview();
		});

		endColorInput.addEventListener('input', async (e) => {
			this.currentSettings.gradientEnd = (e.target as HTMLInputElement).value;
			this.currentSettings.useCustomBackground = true;
			updateGradient();
			await this.updatePreview();
		});

		// 监听角度变化
		angleSlider.addEventListener('input', async (e) => {
			this.currentSettings.gradientAngle = parseInt((e.target as HTMLInputElement).value);
			this.currentSettings.useCustomBackground = true;
			updateGradient();
			await this.updatePreview();
		});

		// 初始化渐变效果
		updateGradient();

		// 布局设置
		new Setting(styleSection)
			.setName('布局样式')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'default': '默认布局',
					'vertical-title': '竖排标题',
					'letter-style': '信纸样式',
					'github-style': 'GitHub风格',
					'magazine': '杂志版'
				})
				.setValue(this.currentSettings.layoutStyle)
				.onChange(async (value) => {
					this.currentSettings.layoutStyle = value;
					this.currentSettings.useCustomBackground = false; // 切换布局时重置背景设置
					await this.updatePreview();
				}));

		// 字体设置
		new Setting(styleSection)
			.setName('字体')
			.addDropdown(dropdown => dropdown
				.addOptions(Object.fromEntries(
					NoteToCardModal.PRESET_FONTS.map(font => [font.value, font.name])
				))
				.setValue('"LXGW WenKai", "FZShuSong-Z01", "Songti SC", SimSun, serif')
				.onChange(async (value) => {
					this.currentSettings.fontFamily = value;
					await this.updatePreview();
				}));

		// 字体大小设置
		new Setting(styleSection)
			.setName('字体大小')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'14px': '小',
					'16px': '中',
					'18px': '大',
					'20px': '特大'
				})
				.setValue(this.currentSettings.fontSize)
				.onChange(async (value) => {
					this.currentSettings.fontSize = value;
					await this.updatePreview();
				}));

		// 文本对齐方式
		new Setting(styleSection)
			.setName('文本对齐')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'left': '左对齐',
					'center': '居中',
					'right': '右对齐',
					'justify': '两端对齐'
				})
				.setValue(this.currentSettings.textAlignment)
				.onChange(async (value) => {
					this.currentSettings.textAlignment = value;
					await this.updatePreview();
				}));

		// 水印设置区域
		const watermarkSection = container.createDiv('note-to-card-settings-section');
		watermarkSection.createEl('h4', {text: '水印设置'});

		// 水印开关
		new Setting(watermarkSection)
			.setName('启用水印')
			.setDesc('在图片上添加水印文字')
			.addToggle(toggle => toggle
				.setValue(!!this.currentSettings.watermarkText)
				.onChange(async (value) => {
					if (!value) {
						this.currentSettings.watermarkText = '';
						// 移除水印相关设置
						watermarkSection.querySelectorAll('.watermark-setting').forEach(el => el.remove());
					} else {
						// 添加水印设置项
						this.addWatermarkSettings(watermarkSection);
					}
					await this.updatePreview();
				}));

		// 如果已启用水印，显示水印设置
		if (this.currentSettings.watermarkText) {
			this.addWatermarkSettings(watermarkSection);
		}

		// 作者信息设置区域
		const authorSection = container.createDiv('note-to-card-settings-section');
		authorSection.createEl('h4', {text: '作者信息'});

		// 作者名称输入
		new Setting(authorSection)
			.setName('作者名称')
			.setDesc('输入作者名称以启用作者信息')
			.addText(text => text
				.setPlaceholder('请输入作者名称')
				.setValue(this.currentSettings.authorName)
				.onChange(async (value) => {
					this.currentSettings.authorName = value;
					this.currentSettings.showAuthor = !!value;
					
					// 检查是否已经存在作者设置项
					const existingSettings = authorSection.querySelectorAll('.author-setting');
					if (value && existingSettings.length === 0) {
						// 只在没有设置项且有作者名时添加设置
						this.addAuthorSettings(authorSection);
					} else if (!value) {
						// 当作者名为空时移除所有作者设置
						existingSettings.forEach(el => el.remove());
					}
					
					await this.updatePreview();
				}));

		// 如果已有作者名，显示其他作者相关设置
		if (this.currentSettings.authorName) {
			this.addAuthorSettings(authorSection);
		}

		// 添加图片增强设置
		const imageSection = container.createDiv('note-to-card-settings-section');
		imageSection.createEl('h4', {text: '图片设置'});

		new Setting(imageSection)
			.setName('图片增强')
			.setDesc('提高图片清晰度和对比度')
			.addToggle(toggle => toggle
				.setValue(this.currentSettings.imageEnhance)
				.onChange(async (value) => {
					this.currentSettings.imageEnhance = value;
					await this.updatePreview();
				}));

		// 添加宽度设置
		new Setting(styleSection)
			.setName('卡片宽度')
			.setDesc('调整卡片的宽度（像素）')
			.addSlider(slider => slider
				.setLimits(600, 1080, 10)
				.setValue(this.currentSettings.width)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.currentSettings.width = value;
					await this.updatePreview();
				}));
	}

	// 添加水印设置的辅助方法
	private addWatermarkSettings(container: HTMLElement) {
		// 水印文字设置
		new Setting(container)
			.setClass('watermark-setting')
			.setName('水印文字')
			.addText(text => text
				.setPlaceholder('请输入水印文字')
				.setValue(this.currentSettings.watermarkText || '水印文字')
				.onChange(async (value) => {
					this.currentSettings.watermarkText = value;
					await this.updatePreview();
				}));

		// 水印透明度设置
		new Setting(container)
			.setClass('watermark-setting')
			.setName('水印透明度')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.currentSettings.watermarkOpacity)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.currentSettings.watermarkOpacity = value;
					await this.updatePreview();
				}));
	}

	// 添加作者设置的辅助方法
	private addAuthorSettings(container: HTMLElement) {
		// 作者头像设置
		new Setting(container)
			.setClass('author-setting')
			.setName('作者头像')
			.setDesc('选择一张图片作为头像')
			.addButton(button => button
				.setButtonText(this.currentSettings.authorAvatar ? '更换头像' : '选择头像')
				.onClick(async () => {
					const fileInput = document.createElement('input');
					fileInput.type = 'file';
					fileInput.accept = 'image/*';
					fileInput.onchange = async () => {
						const file = fileInput.files?.[0];
						if (file) {
							const reader = new FileReader();
							reader.onload = async (e) => {
								this.currentSettings.authorAvatar = e.target?.result as string;
								await this.updatePreview();
							};
							reader.readAsDataURL(file);
						}
					};
					fileInput.click();
				}));

		// 作者信息位置设置
		new Setting(container)
			.setClass('author-setting')
			.setName('显示位置')
			.setDesc('选择作者信息显示的位置')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'top': '顶部',
					'bottom': '底部'
				})
				.setValue(this.currentSettings.authorPosition)
				.onChange(async (value: 'top' | 'bottom') => {
					this.currentSettings.authorPosition = value;
					await this.updatePreview();
				}));

		// 额外信息设置
		new Setting(container)
			.setClass('author-setting')
			.setName('额外信息')
			.setDesc('添加个人网站、社交媒体等信息')
			.addText(text => text
				.setPlaceholder('如：个人网站、社交媒体等')
				.setValue(this.currentSettings.extraText)
				.onChange(async (value) => {
					this.currentSettings.extraText = value;
					await this.updatePreview();
				}));
	}

	private async createRenderContainer(noteData: NoteData, settings: NoteToCardSettings) {
		const container = document.createElement('div');
		container.className = 'note-to-card-container';
		container.setAttribute('data-layout', settings.layoutStyle);
		
		// 设置字体相关的CSS变量
		container.style.setProperty('--custom-font-family', settings.fontFamily);
		container.style.setProperty('--custom-font-size', settings.fontSize);
		container.style.setProperty('--custom-text-align', settings.textAlignment);

		// 处理背景色
		if (settings.useCustomBackground) {
			// 如果使用自定义背景（渐变色），应用到所有布局
			container.style.background = settings.backgroundColor;
		} else {
			// 否则使用布局默认背景色
			switch (settings.layoutStyle) {
				case 'letter-style':
					container.style.backgroundColor = '#f7f2e9';
					break;
				case 'magazine':
					container.style.backgroundColor = '#ffffff';
					break;
				default:
					container.style.backgroundColor = '#ffffff';
			}
		}

		// 根据不同布局应用不同的渲染逻辑
		switch (settings.layoutStyle) {
			case 'vertical-title':
				await this.renderVerticalTitleLayout(container, noteData, settings);
				break;
			case 'magazine':
				await this.renderMagazineLayout(container, noteData, settings);
				break;
			default:
				await this.renderDefaultLayout(container, noteData, settings);
		}

		// 添加水印（所有布局通用）
		if (settings.watermarkText) {
			const watermark = container.createDiv('note-to-card-watermark');
			watermark.textContent = settings.watermarkText;
			watermark.style.opacity = settings.watermarkOpacity.toString();
		}

		return container;
	}

	private async renderVerticalTitleLayout(container: HTMLElement, noteData: NoteData, settings: NoteToCardSettings) {
		// 竖版标题布局特殊处理
		const titleSection = container.createDiv('note-to-card-title-section');
		const title = titleSection.createDiv('note-to-card-title');
		title.textContent = noteData.title;

		// 添加作者信息（如果位置是顶部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'top') {
			this.createAuthorSection(container, settings);
		}

		// 添加正文内容
		const content = container.createDiv('note-to-card-content');
		await MarkdownRenderer.renderMarkdown(
			noteData.content,
			content,
			noteData.path,
			this.plugin
		);

		// 添加作者信息（如果位置是底部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'bottom') {
			this.createAuthorSection(container, settings);
		}
	}

	private async renderMagazineLayout(container: HTMLElement, noteData: NoteData, settings: NoteToCardSettings) {
		// 添加标题
		if (settings.includeTitle) {
			const title = container.createDiv('note-to-card-title');
			title.textContent = noteData.title;
		}

		// 添加作者信息（如果位置是顶部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'top') {
			this.createAuthorSection(container, settings);
		}

		// 添加正文内容
		const content = container.createDiv('note-to-card-content');
		await MarkdownRenderer.renderMarkdown(
			noteData.content,
			content,
			noteData.path,
			this.plugin
		);

		// 添加作者信息（如果位置是底部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'bottom') {
			this.createAuthorSection(container, settings);
		}
	}

	private async renderDefaultLayout(container: HTMLElement, noteData: NoteData, settings: NoteToCardSettings) {
		// 添加标题
		if (settings.includeTitle) {
			const title = container.createDiv('note-to-card-title');
			title.textContent = noteData.title;
		}

		// 添加作者信息（如果位置是顶部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'top') {
			this.createAuthorSection(container, settings);
		}

		// 添加正文内容
		const content = container.createDiv('note-to-card-content');
		await MarkdownRenderer.renderMarkdown(
			noteData.content,
			content,
			noteData.path,
			this.plugin
		);

		// 添加作者信息（如果位置是底部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'bottom') {
			this.createAuthorSection(container, settings);
		}
	}

	// 恢复作者信息创建方法
	private createAuthorSection(container: HTMLElement, settings: NoteToCardSettings) {
		const authorSection = container.createDiv('note-to-card-author');
		
		if (settings.authorAvatar) {
			const avatarContainer = authorSection.createDiv('note-to-card-avatar-container');
			const avatar = avatarContainer.createEl('img', {
				cls: 'note-to-card-avatar',
				attr: { src: settings.authorAvatar }
			});
		}

		const authorInfo = authorSection.createDiv('note-to-card-author-info');
		const name = authorInfo.createDiv('note-to-card-author-name');
		name.textContent = settings.authorName;
		
		if (settings.extraText) {
			const extra = authorInfo.createDiv('note-to-card-author-extra');
			extra.textContent = settings.extraText;
		}
	}

	private async updatePreview() {
		if (!this.previewContainer) return;

		const container = await this.createRenderContainer(
			this.noteData,
			this.currentSettings
		);

		// 应用宽度设置
		container.style.setProperty('--card-width', `${this.currentSettings.width}px`);
		container.style.maxWidth = '100%';

		// 获取或创建预览包装器
		let previewWrapper = this.previewContainer.querySelector('.note-to-card-preview-wrapper') as HTMLElement;
		if (!previewWrapper) {
			previewWrapper = this.previewContainer.createDiv('note-to-card-preview-wrapper');
		}

		// 保存当前的缩放比例
		const currentScale = previewWrapper.style.transform 
			? parseFloat(previewWrapper.style.transform.replace('scale(', '').replace(')', '')) 
			: this.currentScale;

		// 清空并添加新内容
		previewWrapper.empty();
		previewWrapper.appendChild(container);

		// 计算初始缩放（仅在第一次加载时）
		if (!previewWrapper.style.transform) {
			const previewRect = this.previewContainer.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			
			const padding = 40;
			const scaleX = (previewRect.width - padding * 2) / containerRect.width;
			const scaleY = (previewRect.height - padding * 2) / containerRect.height;
			this.currentScale = Math.min(1, Math.min(scaleX, scaleY));
		} else {
			this.currentScale = currentScale;
		}
		
		previewWrapper.style.transform = `scale(${this.currentScale})`;
		previewWrapper.style.transformOrigin = 'center top';
	}

	private async generateAndCopy() {
		try {
			const container = await this.createRenderContainer(
				this.noteData,
				this.currentSettings
			);
			
			document.body.appendChild(container);
			
			try {
				container.style.width = '800px';
				
				await this.waitForImages(container);
				
				const blob = await this.generateImage(container);

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

	// 同样修改保存方法
	private async generateAndSave() {
		try {
			const container = await this.createRenderContainer(
				this.noteData,
				this.currentSettings
			);
			
			document.body.appendChild(container);
			
			try {
				container.style.width = '800px';
				
				await this.waitForImages(container);
				
				const blob = await this.generateImage(container);

				const timestamp = this.getTimestamp();
				const filename = `notecard-${timestamp}.png`;
				const arrayBuffer = await blob.arrayBuffer();

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

	// 添加缩放方法
	private zoom(action: 'in' | 'out' | 'reset') {
		const step = 0.1;
		
		switch (action) {
			case 'in':
				this.currentScale = Math.min(this.maxScale, this.currentScale + step);
				break;
			case 'out':
				this.currentScale = Math.max(this.minScale, this.currentScale - step);
				break;
			case 'reset':
				this.currentScale = 1;
				break;
		}
		
		// 更新缩放显示
		const zoomResetBtn = this.contentEl.querySelector('.note-to-card-zoom-btn:nth-child(2)');
		if (zoomResetBtn) {
			zoomResetBtn.innerHTML = `${Math.round(this.currentScale * 100)}%`;
		}
		
		// 应用缩放
		const previewWrapper = this.previewContainer.querySelector('.note-to-card-preview-wrapper');
		if (previewWrapper) {
			(previewWrapper as HTMLElement).style.transform = `scale(${this.currentScale})`;
			(previewWrapper as HTMLElement).style.transformOrigin = 'center top';
		}
	}

	// 添加等待图片加载的辅助方法
	private async waitForImages(container: HTMLElement): Promise<void> {
		const images = container.querySelectorAll('img');
		if (images.length > 0) {
			await Promise.all(Array.from(images).map(img => {
				if (img.complete) return Promise.resolve();
				return new Promise(resolve => {
					img.onload = resolve;
					img.onerror = resolve;
				});
			}));
		}
	}

	// 修改生成图片的方法
	private async generateImage(container: HTMLElement) {
		const style = {
			'width': '800px',
			'margin': '0 auto',
			'font-size': this.currentSettings.fontSize,
			'background': this.currentSettings.backgroundColor,
			'text-align': this.currentSettings.textAlignment,
			'overflow': 'hidden',
			'box-sizing': 'border-box',
			'word-wrap': 'break-word',
			'border-radius': '16px',
			'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.08)'
		};

		// 如果开启了图片增强
		if (this.currentSettings.imageEnhance) {
			// 增强图片质量
			container.querySelectorAll('img').forEach(img => {
				// 保存原始尺寸
				const originalWidth = img.width;
				const originalHeight = img.height;
				
				// 将图片尺寸放大 1.5 倍以提高清晰度
				img.width = originalWidth * 1.5;
				img.height = originalHeight * 1.5;
				
				// 添加图片增强效果
				img.style.filter = 'contrast(1.1) saturate(1.05) brightness(1.05)';
				
				// 添加锐化效果
				img.style.imageRendering = 'crisp-edges';
				
				// 确保图片不会失真
				img.style.objectFit = 'contain';
				img.style.objectPosition = 'center';
				
				// 添加微弱的阴影以提升层次感
				img.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
			});
		}

		// 使用更高的质量设置生成图片
		return await domtoimage.toBlob(container, {
			bgcolor: 'transparent',
			style: style,
			quality: 1.0, // 使用最高质量
		});
	}

	// 添加计算渐变的方法
	private calculateGradient(value: number): { gradient: string } {
		// 定义渐变色配置
		const gradients = [
			{ colors: ['#fdfbfb', '#ebedee'], name: '清新白' },
			{ colors: ['#f6d365', 'rgb(192, 107, 83)'], name: '暖阳' },
			{ colors: ['rgb(157, 234, 185)', '#8fd3f4'], name: '薄荷' },
			{ colors: ['#e0f2f1', '#b2dfdb'], name: '清新薄荷绿' },
			{ colors: ['#e1bee7', '#9c27b0'], name: '梦幻薰衣草紫' },
			{ colors: ['#ffab40', '#ffeb3b'], name: '活力橙黄' },
			{ colors: ['#81d4fa', '#03a9f4'], name: '深邃海洋蓝' },
			{ colors: ['#f8bbd0', '#e91e63'], name: '浪漫樱花粉' },
			{ colors: ['#eeeeee', '#bdbdbd'], name: '金属科技银' },
			{ colors: ['#f4e1d2', '#b8860b'], name: '柔和暖咖' }
		];

		// 根据滑块值选择渐变色对
		const index = Math.floor((value / 100) * (gradients.length - 1));
		const nextIndex = Math.min(index + 1, gradients.length - 1);
		const progress = (value / 100) * (gradients.length - 1) - index;

		// 计算当前颜色
		const currentColors = gradients[index].colors;
		const nextColors = gradients[nextIndex].colors;

		// 插值计算渐变色
		const startColor = this.interpolateColor(currentColors[0], nextColors[0], progress);
		const endColor = this.interpolateColor(currentColors[1], nextColors[1], progress);

		return {
			gradient: `linear-gradient(120deg, ${startColor} 0%, ${endColor} 100%)`
		};
	}

	// 添加颜色插值计算方法
	private interpolateColor(color1: string, color2: string, progress: number): string {
		// 将颜色转换为RGB
		const rgb1 = this.parseColor(color1);
		const rgb2 = this.parseColor(color2);

		// 计算插值
		const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * progress);
		const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * progress);
		const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * progress);

		return `rgb(${r}, ${g}, ${b})`;
	}

	// 添加颜色解析方法
	private parseColor(color: string): {r: number, g: number, b: number} {
		if (color.startsWith('rgb')) {
			const matches = color.match(/\d+/g);
			if (matches) {
				return {
					r: parseInt(matches[0]),
					g: parseInt(matches[1]),
					b: parseInt(matches[2])
				};
			}
		}
		// 如果是十六进制颜色
		const hex = color.replace('#', '');
		return {
			r: parseInt(hex.substr(0, 2), 16),
			g: parseInt(hex.substr(2, 2), 16),
			b: parseInt(hex.substr(4, 2), 16)
		};
	}

	// 添加信纸布局的渲染方法
	private async renderLetterStyleLayout(container: HTMLElement, noteData: NoteData, settings: NoteToCardSettings) {
		// 添加标题
		if (settings.includeTitle) {
			const title = container.createDiv('note-to-card-title');
			title.textContent = noteData.title;
		}

		// 添加作者信息（如果位置是顶部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'top') {
			this.createAuthorSection(container, settings);
		}

		// 添加正文内容
		const content = container.createDiv('note-to-card-content');
		await MarkdownRenderer.renderMarkdown(
			noteData.content,
			content,
			noteData.path,
			this.plugin
		);

		// 添加作者信息（如果位置是底部）
		if (settings.showAuthor && settings.authorName && settings.authorPosition === 'bottom') {
			this.createAuthorSection(container, settings);
		}
	}
}
