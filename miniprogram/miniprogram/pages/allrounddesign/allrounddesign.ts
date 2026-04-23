// pages/allrounddesign/allrounddesign.ts
import { generateRequestParams, paramsToHeaders } from '../../utils/parameter';
import { getCachedDeviceFingerprint } from '../../utils/deviceFingerprint';
import { sanitizeAIGenerationErrorMessage } from '../../utils/aiError';

// API基础地址
const API_BASE_URL = 'https://api.jiadilingguang.com';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 'style', // style, poster, cultural
    tabs: [
      { label: '风格变换', value: 'style' },
      { label: '海报设计', value: 'poster' },
      { label: '文创设计', value: 'cultural' }
    ],

    // 风格变换相关
    originalImage: '', // 原图
    targetStyle: '', // 目标风格
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
      { label: '素描风格', value: 'sketch' }
    ],

    // 海报设计相关
    posterTheme: '', // 海报主题
    posterText: '', // 海报文字内容
    posterStyle: '', // 海报风格
    posterStyleOptions: [
      { label: '简约商务', value: 'business' },
      { label: '时尚潮流', value: 'fashion' },
      { label: '文艺清新', value: 'literary' },
      { label: '科技感', value: 'tech' },
      { label: '复古风格', value: 'vintage' },
      { label: '插画风格', value: 'illustration' },
      { label: '手绘风格', value: 'handdrawn' },
      { label: '极简风格', value: 'minimalist' }
    ],
    posterReferenceImages: [] as string[], // 海报参考图

    // 文创设计相关
    productType: '', // 产品类型
    productRequirements: '', // 设计要求
    culturalStyle: '', // 文创风格
    culturalStyleOptions: [
      { label: '国潮风格', value: 'guochao' },
      { label: '简约现代', value: 'modern' },
      { label: '传统元素', value: 'traditional' },
      { label: '创意插画', value: 'illustration' },
      { label: '几何图案', value: 'geometric' },
      { label: '文字设计', value: 'typography' },
      { label: '抽象艺术', value: 'abstract' },
      { label: '自然元素', value: 'nature' }
    ],
    culturalReferenceImages: [] as string[], // 文创参考图

    // 步骤完成状态（用于验证必填项）
    stepCompleted: {
      originalImage: false,
      targetStyle: false,
      posterContent: false,
      posterStyle: false,
      posterReference: false,
      productInfo: false,
      culturalStyle: false,
      culturalReference: false
    },

    allStepsCompleted: false // 所有必填步骤是否完成
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {

  },

  /**
   * Tab切换
   */
  onTabSwitch(e: any) {
    const value = e.currentTarget.dataset.value
    this.setData({
      activeTab: value
    })
    this.checkAllStepsCompleted()
  },

  // ========== 风格变换相关 ==========
  /**
   * 上传原图
   */
  onUploadOriginalImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const imagePath = res.tempFiles[0].tempFilePath
        this.setData({
          originalImage: imagePath
        })
        this.checkStepCompleted('originalImage')
      },
      fail: (err) => {
        console.error('选择图片失败', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 删除原图
   */
  onDeleteOriginalImage() {
    this.setData({
      originalImage: ''
    })
    this.checkStepCompleted('originalImage')
  },

  /**
   * 选择目标风格
   */
  onSelectTargetStyle(e: any) {
    const value = e.currentTarget.dataset.value
    this.setData({
      targetStyle: value
    })
    this.checkStepCompleted('targetStyle')
  },

  // ========== 海报设计相关 ==========
  /**
   * 海报主题输入
   */
  onPosterThemeInput(e: any) {
    this.setData({
      posterTheme: e.detail.value
    })
    this.checkStepCompleted('posterContent')
  },

  /**
   * 海报文字输入
   */
  onPosterTextInput(e: any) {
    this.setData({
      posterText: e.detail.value
    })
    this.checkStepCompleted('posterContent')
  },

  /**
   * 选择海报风格
   */
  onSelectPosterStyle(e: any) {
    const value = e.currentTarget.dataset.value
    this.setData({
      posterStyle: value
    })
    this.checkStepCompleted('posterStyle')
  },

  /**
   * 上传海报参考图
   */
  onUploadPosterReference() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath)
        const currentImages = this.data.posterReferenceImages || []
        const newImages = [...currentImages, ...tempFiles].slice(0, 9)
        this.setData({
          posterReferenceImages: newImages
        })
        this.checkStepCompleted('posterReference')
      },
      fail: (err) => {
        console.error('选择图片失败', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 删除海报参考图
   */
  onDeletePosterReferenceImage(e: any) {
    const index = e.currentTarget.dataset.index
    const images = this.data.posterReferenceImages
    images.splice(index, 1)
    this.setData({
      posterReferenceImages: images
    })
    this.checkStepCompleted('posterReference')
  },

  // ========== 文创设计相关 ==========
  /**
   * 产品类型输入
   */
  onProductTypeInput(e: any) {
    this.setData({
      productType: e.detail.value
    })
    this.checkStepCompleted('productInfo')
  },

  /**
   * 设计要求输入
   */
  onProductRequirementsInput(e: any) {
    this.setData({
      productRequirements: e.detail.value
    })
    this.checkStepCompleted('productInfo')
  },

  /**
   * 选择文创风格
   */
  onSelectCulturalStyle(e: any) {
    const value = e.currentTarget.dataset.value
    this.setData({
      culturalStyle: value
    })
    this.checkStepCompleted('culturalStyle')
  },

  /**
   * 上传文创参考图
   */
  onUploadCulturalReference() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath)
        const currentImages = this.data.culturalReferenceImages || []
        const newImages = [...currentImages, ...tempFiles].slice(0, 9)
        this.setData({
          culturalReferenceImages: newImages
        })
        this.checkStepCompleted('culturalReference')
      },
      fail: (err) => {
        console.error('选择图片失败', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 删除文创参考图
   */
  onDeleteCulturalReferenceImage(e: any) {
    const index = e.currentTarget.dataset.index
    const images = this.data.culturalReferenceImages
    images.splice(index, 1)
    this.setData({
      culturalReferenceImages: images
    })
    this.checkStepCompleted('culturalReference')
  },

  /**
   * 检查步骤是否完成
   */
  checkStepCompleted(step: string) {
    let completed = false
    const stepCompleted: any = { ...this.data.stepCompleted }
    const activeTab = this.data.activeTab

    if (activeTab === 'style') {
      // 风格变换
      if (step === 'originalImage') {
        completed = !!this.data.originalImage
      } else if (step === 'targetStyle') {
        completed = !!this.data.targetStyle
      }
    } else if (activeTab === 'poster') {
      // 海报设计
      if (step === 'posterContent') {
        completed = !!(this.data.posterTheme || this.data.posterText)
      } else if (step === 'posterStyle') {
        completed = !!this.data.posterStyle
      } else if (step === 'posterReference') {
        completed = this.data.posterReferenceImages.length > 0
      }
    } else if (activeTab === 'cultural') {
      // 文创设计
      if (step === 'productInfo') {
        completed = !!(this.data.productType || this.data.productRequirements)
      } else if (step === 'culturalStyle') {
        completed = !!this.data.culturalStyle
      } else if (step === 'culturalReference') {
        completed = this.data.culturalReferenceImages.length > 0
      }
    }

    stepCompleted[step] = completed
    this.setData({
      stepCompleted: stepCompleted
    })

    this.checkAllStepsCompleted()
  },

  /**
   * 检查所有步骤是否完成
   */
  checkAllStepsCompleted() {
    const activeTab = this.data.activeTab
    const completed = this.data.stepCompleted
    let allCompleted = false

    if (activeTab === 'style') {
      // 风格变换：至少完成前两步
      allCompleted = completed.originalImage && completed.targetStyle
    } else if (activeTab === 'poster') {
      // 海报设计：至少完成前两步
      allCompleted = completed.posterContent && completed.posterStyle
    } else if (activeTab === 'cultural') {
      // 文创设计：至少完成前两步
      allCompleted = completed.productInfo && completed.culturalStyle
    }

    this.setData({
      allStepsCompleted: allCompleted
    })
  },

  /**
   * AI生成设计
   */
  async onGenerateDesign() {
    if (!this.data.allStepsCompleted) {
      wx.showToast({
        title: '请完成所有必填步骤',
        icon: 'none'
      })
      return
    }

    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '正在生成设计...',
    })

    try {
      const activeTab = this.data.activeTab
      let requestData: any = {}

      if (activeTab === 'style') {
        // 风格变换
        // 上传原图
        let originalImageUrl = ''
        if (this.data.originalImage) {
          if (this.data.originalImage.startsWith('http://') || this.data.originalImage.startsWith('https://')) {
            originalImageUrl = this.data.originalImage
          } else {
            originalImageUrl = await this.uploadImageToOSS(this.data.originalImage, token) || ''
          }
        }

        requestData = {
          design_type: 'style_transform',
          original_image: originalImageUrl,
          target_style: this.data.targetStyle
        }
      } else if (activeTab === 'poster') {
        // 海报设计
        // 上传参考图
        const referenceUrls: string[] = []
        for (const imagePath of this.data.posterReferenceImages) {
          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            referenceUrls.push(imagePath)
          } else {
            const url = await this.uploadImageToOSS(imagePath, token)
            if (url) {
              referenceUrls.push(url)
            }
          }
        }

        requestData = {
          design_type: 'poster',
          theme: this.data.posterTheme,
          text: this.data.posterText,
          style: this.data.posterStyle,
          reference_images: referenceUrls
        }
      } else if (activeTab === 'cultural') {
        // 文创设计
        // 上传参考图
        const referenceUrls: string[] = []
        for (const imagePath of this.data.culturalReferenceImages) {
          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            referenceUrls.push(imagePath)
          } else {
            const url = await this.uploadImageToOSS(imagePath, token)
            if (url) {
              referenceUrls.push(url)
            }
          }
        }

        requestData = {
          design_type: 'cultural',
          product_type: this.data.productType,
          requirements: this.data.productRequirements,
          style: this.data.culturalStyle,
          reference_images: referenceUrls
        }
      }

      // 调用后端API
      const apiPath = '/api/v1/miniprogram/ai/allround-design'

      // 获取设备ID
      const deviceID = getCachedDeviceFingerprint() || '';

      // 生成请求参数
      const params = generateRequestParams(token, requestData, apiPath, deviceID);
      const headers = paramsToHeaders(params);

      await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}${apiPath}`,
          method: 'POST',
          header: {
            ...headers,
            'Content-Type': 'application/json',
          },
          data: requestData,
          success: (res) => {
            if (res.statusCode === 200 && res.data) {
              const data = res.data as any
              if (data.code === 0) {
                resolve(data.data)
              } else {
                reject(new Error(data.msg || '生成失败'))
              }
            } else {
              reject(new Error(`请求失败: ${res.statusCode}`))
            }
          },
          fail: (err) => {
            reject(err)
          },
        })
      })

      wx.hideLoading()

      wx.showToast({
        title: '任务已提交',
        icon: 'success',
        duration: 2000
      })

    } catch (error: any) {
      wx.hideLoading()
      console.error('生成设计失败:', error)
      wx.showToast({
        title: sanitizeAIGenerationErrorMessage(error.message || '生成失败'),
        icon: 'none',
        duration: 2000
      })
    }
  },

  /**
   * 上传图片到OSS
   */
  async uploadImageToOSS(imagePath: string, token: string): Promise<string | null> {
    try {
      const apiPath = '/api/v1/miniprogram/ai/upload-reference-image'

      // 获取设备ID
      const deviceID = getCachedDeviceFingerprint() || '';

      // 生成请求参数（文件上传时使用空对象作为body）
      const params = generateRequestParams(token, '{}', apiPath, deviceID);
      const headers = paramsToHeaders(params);

      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${API_BASE_URL}${apiPath}`,
          filePath: imagePath,
          name: 'file',
          header: headers,
          success: (res) => {
            try {
              const data = JSON.parse(res.data) as any
              if (data.code === 0 && data.data && data.data.url) {
                resolve(data.data.url)
              } else {
                reject(new Error(data.msg || '上传失败'))
              }
            } catch (e) {
              reject(new Error('解析响应失败'))
            }
          },
          fail: (err) => {
            reject(err)
          },
        })
      })
    } catch (error) {
      console.error('上传图片失败:', error)
      return null
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '全能设计',
      path: '/pages/allrounddesign/allrounddesign'
    }
  }
})
