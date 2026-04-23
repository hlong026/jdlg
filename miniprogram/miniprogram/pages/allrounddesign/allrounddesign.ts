import { generateRequestParams, paramsToHeaders } from '../../utils/parameter';
import { getCachedDeviceFingerprint } from '../../utils/deviceFingerprint';
import { sanitizeAIGenerationErrorMessage } from '../../utils/aiError';

const API_BASE_URL = 'https://api.jiadilingguang.com';
const ALLROUND_API_PATH = '/api/v1/miniprogram/ai/allround-design';
const CREATIVE_API_PATH = '/api/v1/miniprogram/ai/parent-child-design';
const TASK_STATUS_API_PATH = '/api/v1/miniprogram/ai/task/status';
const UPLOAD_API_PATH = '/api/v1/miniprogram/ai/upload-reference-image';

function getTaskStatusPollDelay(attempt: number): number {
  if (attempt < 2) {
    return 3000;
  }
  if (attempt < 6) {
    return 4000;
  }
  return 5000;
}

function getModuleMeta(activeTab: string) {
  switch (activeTab) {
    case 'poster':
      return {
        title: '海报设计',
        desc: '适合活动预告、品牌表达和设计说明页的快速生成。',
        badge: '视觉表达',
        hint: '至少填写主题或文案，并选择一个主风格，就可以提交生成任务。',
        buttonText: 'AI 提交海报任务',
      };
    case 'cultural':
      return {
        title: '文创设计',
        desc: '适合文创周边、衍生品和展陈配套的概念设计。',
        badge: '产品创意',
        hint: '先明确产品类型和设计要求，再选择风格，会更容易得到稳定结果。',
        buttonText: 'AI 提交文创任务',
      };
    case 'creative':
      return {
        title: '创意玩偶',
        desc: '原亲子工坊能力已并入综合设计，用统一工作台完成玩偶创意生成。',
        badge: '能力合并',
        hint: '创意玩偶沿用原亲子工坊的生成链路，生成结果会直接展示在当前页面。',
        buttonText: 'AI 生成玩偶',
      };
    case 'style':
    default:
      return {
        title: '风格转换',
        desc: '上传原图后快速切换目标风格，适合立面、空间和概念图表达。',
        badge: '方案提效',
        hint: '完成原图上传和目标风格选择后，即可提交转换任务。',
        buttonText: 'AI 提交转换任务',
      };
  }
}

function parseCreativeResultUrl(result: any): string {
  if (!result) {
    return '';
  }

  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      return parsed.url || parsed.url_raw || result;
    } catch (_error) {
      return result;
    }
  }

  return result.url || result.url_raw || '';
}

Page({
  data: {
    tabs: [
      { label: '风格转换', value: 'style', shortDesc: '立面与空间' },
      { label: '海报设计', value: 'poster', shortDesc: '宣传与发布' },
      { label: '文创设计', value: 'cultural', shortDesc: '周边与衍生' },
      { label: '创意玩偶', value: 'creative', shortDesc: '亲子工坊并入' },
    ],
    activeTab: 'style',
    activeModuleTitle: '',
    activeModuleDesc: '',
    activeModuleBadge: '',
    activeModuleHint: '',
    generateButtonText: '',

    originalImage: '',
    targetStyle: '',
    styleOptions: [
      { label: '现代简约', value: 'modern' },
      { label: '新中式', value: 'chinese' },
      { label: '新闽派', value: 'min' },
      { label: '传统古建', value: 'traditional' },
      { label: '海派', value: 'shanghai' },
      { label: '田园风', value: 'countryside' },
      { label: '卡通风格', value: 'cartoon' },
      { label: '水彩风格', value: 'watercolor' },
      { label: '油画风格', value: 'oil' },
      { label: '素描风格', value: 'sketch' },
    ],

    posterTheme: '',
    posterText: '',
    posterStyle: '',
    posterStyleOptions: [
      { label: '简约商务', value: 'business' },
      { label: '时尚潮流', value: 'fashion' },
      { label: '文艺清新', value: 'literary' },
      { label: '科技感', value: 'tech' },
      { label: '复古风格', value: 'vintage' },
      { label: '插画风格', value: 'illustration' },
      { label: '手绘风格', value: 'handdrawn' },
      { label: '极简风格', value: 'minimalist' },
    ],
    posterReferenceImages: [] as string[],

    productType: '',
    productRequirements: '',
    culturalStyle: '',
    culturalStyleOptions: [
      { label: '国潮风格', value: 'guochao' },
      { label: '简约现代', value: 'modern' },
      { label: '传统元素', value: 'traditional' },
      { label: '创意插画', value: 'illustration' },
      { label: '几何图案', value: 'geometric' },
      { label: '文字设计', value: 'typography' },
      { label: '抽象艺术', value: 'abstract' },
      { label: '自然元素', value: 'nature' },
    ],
    culturalReferenceImages: [] as string[],

    creativePrototype: 'landmark',
    creativeMood: 'cute',
    creativeTheme: '',
    creativeRequirements: '',
    creativeReferenceImages: [] as string[],
    creativePrototypeOptions: [
      { label: '城市地标', value: 'landmark' },
      { label: '普通住宅', value: 'residence' },
      { label: '公共建筑', value: 'building' },
    ],
    creativeMoodOptions: [
      { label: '可爱', value: 'cute' },
      { label: '酷炫', value: 'cool' },
      { label: '复古', value: 'retro' },
      { label: '科幻', value: 'scifi' },
    ],

    generatedImages: [] as string[],
    allStepsCompleted: false,
    submitting: false,
    taskNotice: '',
  },

  onLoad() {
    this.syncActiveModuleState();
  },

  onShareAppMessage() {
    return {
      title: '综合设计',
      path: '/pages/allrounddesign/allrounddesign',
    };
  },

  syncActiveModuleState() {
    const meta = getModuleMeta(this.data.activeTab);
    this.setData({
      activeModuleTitle: meta.title,
      activeModuleDesc: meta.desc,
      activeModuleBadge: meta.badge,
      activeModuleHint: meta.hint,
      generateButtonText: meta.buttonText,
    });
    this.updateGenerateState();
  },

  updateGenerateState() {
    let ready = false;

    if (this.data.activeTab === 'style') {
      ready = !!(this.data.originalImage && this.data.targetStyle);
    } else if (this.data.activeTab === 'poster') {
      ready = !!((this.data.posterTheme || this.data.posterText) && this.data.posterStyle);
    } else if (this.data.activeTab === 'cultural') {
      ready = !!((this.data.productType || this.data.productRequirements) && this.data.culturalStyle);
    } else if (this.data.activeTab === 'creative') {
      ready = !!(this.data.creativeTheme || this.data.creativeRequirements);
    }

    this.setData({
      allStepsCompleted: ready,
    });
  },

  onTabSwitch(e: any) {
    const value = String(e.currentTarget.dataset.value || '');
    if (!value || value === this.data.activeTab) {
      return;
    }

    this.setData(
      {
        activeTab: value,
        taskNotice: value === 'creative' ? this.data.taskNotice : '',
      },
      () => {
        this.syncActiveModuleState();
      },
    );
  },

  onUploadOriginalImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const imagePath = res.tempFiles[0].tempFilePath;
        this.setData(
          {
            originalImage: imagePath,
          },
          () => {
            this.updateGenerateState();
          },
        );
      },
      fail: (error) => {
        console.error('选择图片失败', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
        });
      },
    });
  },

  onDeleteOriginalImage() {
    this.setData(
      {
        originalImage: '',
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onSelectTargetStyle(e: any) {
    this.setData(
      {
        targetStyle: e.currentTarget.dataset.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onPosterThemeInput(e: any) {
    this.setData(
      {
        posterTheme: e.detail.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onPosterTextInput(e: any) {
    this.setData(
      {
        posterText: e.detail.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onSelectPosterStyle(e: any) {
    this.setData(
      {
        posterStyle: e.currentTarget.dataset.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onUploadPosterReference() {
    this.selectReferenceImages('posterReferenceImages');
  },

  onDeletePosterReferenceImage(e: any) {
    this.removeReferenceImage('posterReferenceImages', e.currentTarget.dataset.index);
  },

  onProductTypeInput(e: any) {
    this.setData(
      {
        productType: e.detail.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onProductRequirementsInput(e: any) {
    this.setData(
      {
        productRequirements: e.detail.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onSelectCulturalStyle(e: any) {
    this.setData(
      {
        culturalStyle: e.currentTarget.dataset.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onUploadCulturalReference() {
    this.selectReferenceImages('culturalReferenceImages');
  },

  onDeleteCulturalReferenceImage(e: any) {
    this.removeReferenceImage('culturalReferenceImages', e.currentTarget.dataset.index);
  },

  onSelectCreativePrototype(e: any) {
    this.setData({
      creativePrototype: e.currentTarget.dataset.value,
    });
  },

  onSelectCreativeMood(e: any) {
    this.setData({
      creativeMood: e.currentTarget.dataset.value,
    });
  },

  onCreativeThemeInput(e: any) {
    this.setData(
      {
        creativeTheme: e.detail.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onCreativeRequirementsInput(e: any) {
    this.setData(
      {
        creativeRequirements: e.detail.value,
      },
      () => {
        this.updateGenerateState();
      },
    );
  },

  onUploadCreativeReference() {
    this.selectReferenceImages('creativeReferenceImages');
  },

  onDeleteCreativeReferenceImage(e: any) {
    this.removeReferenceImage('creativeReferenceImages', e.currentTarget.dataset.index);
  },

  selectReferenceImages(targetField: string) {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const currentImages = (((this.data as any)[targetField] || []) as string[]).slice();
        const nextImages = [...currentImages, ...res.tempFiles.map((file) => file.tempFilePath)].slice(0, 9);
        const nextData: any = {};
        nextData[targetField] = nextImages;
        this.setData(nextData, () => {
          this.updateGenerateState();
        });
      },
      fail: (error) => {
        console.error('选择图片失败', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
        });
      },
    });
  },

  removeReferenceImage(targetField: string, index: number) {
    const currentImages = ((((this.data as any)[targetField] || []) as string[]).slice());
    currentImages.splice(Number(index), 1);
    const nextData: any = {};
    nextData[targetField] = currentImages;
    this.setData(nextData, () => {
      this.updateGenerateState();
    });
  },

  async onGenerateDesign() {
    if (this.data.submitting) {
      return;
    }

    if (!this.data.allStepsCompleted) {
      wx.showToast({
        title: '请先完成当前模块必填项',
        icon: 'none',
      });
      return;
    }

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      });
      return;
    }

    this.setData({
      submitting: true,
    });

    wx.showLoading({
      title: this.data.activeTab === 'creative' ? '正在生成创意玩偶...' : '正在提交设计任务...',
    });

    try {
      if (this.data.activeTab === 'creative') {
        await this.submitCreativeDesign(token);
        return;
      }

      await this.submitAllroundDesign(token);
      wx.hideLoading();
      this.setData({
        submitting: false,
        taskNotice: '任务已提交，可前往生成历史查看进度。',
      });
      wx.showToast({
        title: '任务已提交',
        icon: 'success',
      });
    } catch (error: any) {
      wx.hideLoading();
      this.setData({
        submitting: false,
      });
      console.error('综合设计生成失败', error);
      wx.showToast({
        title: sanitizeAIGenerationErrorMessage(error.message || '提交失败'),
        icon: 'none',
      });
    }
  },

  async submitAllroundDesign(token: string) {
    let requestData: any = {};

    if (this.data.activeTab === 'style') {
      const originalImageUrl = this.data.originalImage.startsWith('http://') || this.data.originalImage.startsWith('https://')
        ? this.data.originalImage
        : (await this.uploadImageToOSS(this.data.originalImage, token)) || '';

      requestData = {
        design_type: 'style_transform',
        original_image: originalImageUrl,
        target_style: this.data.targetStyle,
      };
    } else if (this.data.activeTab === 'poster') {
      requestData = {
        design_type: 'poster',
        theme: this.data.posterTheme,
        text: this.data.posterText,
        style: this.data.posterStyle,
        reference_images: await this.uploadReferenceList(this.data.posterReferenceImages, token),
      };
    } else if (this.data.activeTab === 'cultural') {
      requestData = {
        design_type: 'cultural',
        product_type: this.data.productType,
        requirements: this.data.productRequirements,
        style: this.data.culturalStyle,
        reference_images: await this.uploadReferenceList(this.data.culturalReferenceImages, token),
      };
    }

    const deviceID = getCachedDeviceFingerprint() || '';
    const params = generateRequestParams(token, requestData, ALLROUND_API_PATH, deviceID);
    const headers = paramsToHeaders(params);

    await new Promise<any>((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}${ALLROUND_API_PATH}`,
        method: 'POST',
        header: {
          ...headers,
          'Content-Type': 'application/json',
        },
        data: requestData,
        success: (res) => {
          const data = res.data as any;
          if (res.statusCode === 200 && data && data.code === 0) {
            resolve(data.data);
            return;
          }
          reject(new Error((data && data.msg) || '提交失败'));
        },
        fail: reject,
      });
    });
  },

  async submitCreativeDesign(token: string) {
    const requestData = {
      design_type: 'doll',
      prototype: this.data.creativePrototype,
      style: this.data.creativeMood,
      theme: this.data.creativeTheme,
      requirements: this.data.creativeRequirements,
      reference_images: await this.uploadReferenceList(this.data.creativeReferenceImages, token),
    };

    const deviceID = getCachedDeviceFingerprint() || '';
    const params = generateRequestParams(token, requestData, CREATIVE_API_PATH, deviceID);
    const headers = paramsToHeaders(params);

    const response = await new Promise<any>((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}${CREATIVE_API_PATH}`,
        method: 'POST',
        header: {
          ...headers,
          'Content-Type': 'application/json',
        },
        data: requestData,
        success: (res) => {
          const data = res.data as any;
          if (res.statusCode === 200 && data && data.code === 0) {
            resolve(data.data);
            return;
          }
          reject(new Error((data && data.msg) || '提交失败'));
        },
        fail: reject,
      });
    });

    const taskNo = response && response.task_no;
    if (!taskNo) {
      throw new Error('未获取到任务编号');
    }

    this.setData({
      taskNotice: '创意玩偶生成中，请稍候查看结果。',
    });
    this.pollCreativeTaskStatus(taskNo);
  },

  async pollCreativeTaskStatus(taskNo: string) {
    const token = wx.getStorageSync('token') || '';
    let attempt = 0;
    const maxAttempts = 30;

    const poll = async () => {
      if (attempt >= maxAttempts) {
        wx.hideLoading();
        this.setData({
          submitting: false,
          taskNotice: '生成超时，请稍后到生成历史查看结果。',
        });
        wx.showToast({
          title: '生成超时',
          icon: 'none',
        });
        return;
      }

      try {
        const requestData = {
          task_no: taskNo,
          task_type: 'ai_draw',
        };
        const deviceID = getCachedDeviceFingerprint() || '';
        const params = generateRequestParams(token, requestData, TASK_STATUS_API_PATH, deviceID);
        const headers = paramsToHeaders(params);

        const response = await new Promise<any>((resolve, reject) => {
          wx.request({
            url: `${API_BASE_URL}${TASK_STATUS_API_PATH}`,
            method: 'POST',
            header: {
              token: headers.token,
              'token-signature': headers['token-signature'],
              sin: headers.sin,
              'md5-signature': headers['md5-signature'],
              pass: headers.pass,
              tm: headers.tm,
              'Content-Type': 'application/json',
            },
            data: requestData,
            success: (res) => {
              const data = res.data as any;
              if (res.statusCode === 200 && data && data.code === 0) {
                resolve(data.data);
                return;
              }
              reject(new Error((data && data.msg) || '查询失败'));
            },
            fail: reject,
          });
        });

        if (response.status === 'success' && response.result) {
          const resultUrl = parseCreativeResultUrl(response.result);
          wx.hideLoading();

          if (!resultUrl) {
            this.setData({
              submitting: false,
              taskNotice: '生成完成，但暂未取得结果图。',
            });
            wx.showToast({
              title: '未取得结果图',
              icon: 'none',
            });
            return;
          }

          this.setData({
            submitting: false,
            generatedImages: [resultUrl, ...this.data.generatedImages],
            taskNotice: '创意玩偶已生成，可继续保存或再次生成。',
          });
          wx.showToast({
            title: '生成成功',
            icon: 'success',
          });
          return;
        }

        if (response.status === 'failed') {
          const message = sanitizeAIGenerationErrorMessage(response.error_message || response.error || '生成失败');
          wx.hideLoading();
          this.setData({
            submitting: false,
            taskNotice: message,
          });
          wx.showToast({
            title: message,
            icon: 'none',
          });
          return;
        }
      } catch (_error) {
        // Keep polling on transient task-status errors.
      }

      const delay = getTaskStatusPollDelay(attempt);
      attempt += 1;
      setTimeout(poll, delay);
    };

    poll();
  },

  async uploadReferenceList(images: string[], token: string): Promise<string[]> {
    const urls: string[] = [];
    for (const imagePath of images || []) {
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        urls.push(imagePath);
        continue;
      }

      const url = await this.uploadImageToOSS(imagePath, token);
      if (url) {
        urls.push(url);
      }
    }
    return urls;
  },

  async uploadImageToOSS(imagePath: string, token: string): Promise<string | null> {
    try {
      const deviceID = getCachedDeviceFingerprint() || '';
      const params = generateRequestParams(token, '{}', UPLOAD_API_PATH, deviceID);
      const headers = paramsToHeaders(params);

      return await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${API_BASE_URL}${UPLOAD_API_PATH}`,
          filePath: imagePath,
          name: 'file',
          header: headers,
          success: (res) => {
            try {
              const data = JSON.parse(res.data) as any;
              if (data.code === 0 && data.data && data.data.url) {
                resolve(data.data.url);
                return;
              }
              reject(new Error(data.msg || '上传失败'));
            } catch (_error) {
              reject(new Error('解析上传响应失败'));
            }
          },
          fail: reject,
        });
      }) as string;
    } catch (error) {
      console.error('上传图片失败', error);
      return null;
    }
  },

  onPreviewGeneratedImage(e: any) {
    const index = Number(e.currentTarget.dataset.index || 0);
    const current = this.data.generatedImages[index];
    if (!current) {
      return;
    }

    wx.previewImage({
      current,
      urls: this.data.generatedImages,
    });
  },

  onSaveImage(e: any) {
    const imageUrl = this.data.generatedImages[Number(e.currentTarget.dataset.index || 0)];
    if (!imageUrl) {
      return;
    }

    wx.showModal({
      title: '下载保存需验证',
      content: '生成结果默认仅支持查看，下载保存需先添加企业微信并留下电话号码。',
      showCancel: false,
    });
  },

  onShareImage() {
    wx.showToast({
      title: '分享功能待实现',
      icon: 'none',
    });
  },

  onOpenGenerateHistory() {
    wx.navigateTo({
      url: '/pages/generatehistory/generatehistory',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  onOpenLegacyWorkshop() {
    wx.navigateTo({
      url: '/pages/Parentchildcreativity/Parentchildcreativity',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },
});
