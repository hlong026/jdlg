import { generateRequestParams, paramsToHeaders } from '../../utils/parameter'
import { getCachedDeviceFingerprint } from '../../utils/deviceFingerprint'
import { sanitizeAIGenerationErrorMessage } from '../../utils/aiError'
import { AIToolItem, AIToolStylePreset, getCategoryLabel } from '../../utils/aiTools'
import { fetchAIToolDetail } from '../../utils/aiToolApi'
import { shouldUseMinimalAIToolPresentation } from '../../utils/aiToolPresentation'

const API_BASE_URL = 'https://api.jiadilingguang.com'
const DEFAULT_SERVICE_TYPE = 'normal'
const DEFAULT_SERVICE = 'normal_style_change'
const DEFAULT_QUALITY = 'uhd'
const DEFAULT_CANVAS = '1:1'
const DEFAULT_GENERATE_COUNT = 1
const DEFAULT_DRAW_SINGLE_COST = 0
const DEFAULT_DRAW_MULTI_COST = 0
const MAX_REFERENCE_IMAGE_COUNT = 5

type PageOptions = {
  id?: string
}

type PresetTapEvent = {
  currentTarget: {
    dataset: {
      id?: string
    }
  }
}

type InputEvent = {
  detail: {
    value?: string
  }
}

type SlotTapEvent = {
  currentTarget: {
    dataset: {
      slotIndex?: number | string
      addSlot?: number | string
      imageUrl?: string
    }
  }
}

type WorkbenchImageSlot = {
  slotIndex: number
  chipLabel: string
  roleLabel: string
  imageUrl: string
  isOriginal: boolean
  required: boolean
  isAddSlot: boolean
}

function normalizeUploadedImageUrl(value: any): string {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  if (!text.startsWith('http://') && !text.startsWith('https://')) {
    return ''
  }
  return text
}

function extractFileName(filePath: string, fallback: string): string {
  const normalizedPath = String(filePath || '').trim()
  if (!normalizedPath) {
    return fallback
  }
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] || fallback
}

function normalizeReferenceImageUrls(values: any[]): string[] {
  return (Array.isArray(values) ? values : [])
    .map((item) => normalizeUploadedImageUrl(item))
    .filter((item, index, list) => !!item && list.indexOf(item) === index)
    .slice(0, MAX_REFERENCE_IMAGE_COUNT)
}

function buildOrderedImageUrls(originalImageUrl: string, referenceImageUrls: any[]): string[] {
  return [normalizeUploadedImageUrl(originalImageUrl), ...normalizeReferenceImageUrls(referenceImageUrls)].filter(Boolean)
}

function buildWorkbenchImageSlots(originalImageUrl: string, referenceImageUrls: any[]): WorkbenchImageSlot[] {
  const safeOriginalImageUrl = normalizeUploadedImageUrl(originalImageUrl)
  const safeReferenceImageUrls = normalizeReferenceImageUrls(referenceImageUrls)
  const slots: WorkbenchImageSlot[] = [
    {
      slotIndex: 0,
      chipLabel: '图1',
      roleLabel: '原图',
      imageUrl: safeOriginalImageUrl,
      isOriginal: true,
      required: true,
      isAddSlot: false,
    },
  ]

  if (safeReferenceImageUrls.length === 0) {
    slots.push({
      slotIndex: 1,
      chipLabel: '图2',
      roleLabel: '参考图1',
      imageUrl: '',
      isOriginal: false,
      required: false,
      isAddSlot: false,
    })
  } else {
    safeReferenceImageUrls.forEach((imageUrl, index) => {
      slots.push({
        slotIndex: index + 1,
        chipLabel: `图${index + 2}`,
        roleLabel: `参考图${index + 1}`,
        imageUrl,
        isOriginal: false,
        required: false,
        isAddSlot: false,
      })
    })
  }

  if (safeReferenceImageUrls.length < MAX_REFERENCE_IMAGE_COUNT) {
    slots.push({
      slotIndex: Math.min(safeReferenceImageUrls.length + 1, MAX_REFERENCE_IMAGE_COUNT),
      chipLabel: '',
      roleLabel: '',
      imageUrl: '',
      isOriginal: false,
      required: false,
      isAddSlot: true,
    })
  }

  return slots
}

function resolveReferenceSelectionType(selectedReferencePresetId: string, referenceImageUrls: string[]): 'none' | 'preset' | 'custom_upload' {
  if (String(selectedReferencePresetId || '').trim()) {
    return 'preset'
  }
  if (normalizeReferenceImageUrls(referenceImageUrls).length > 0) {
    return 'custom_upload'
  }
  return 'none'
}

function normalizeToolId(value: any): number | string {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue
  }
  return String(value || '').trim()
}

let lastPreviewTapAt = 0
let lastPreviewTapIndex = -1

Page({
  data: {
    tool: null as AIToolItem | null,
    categoryLabel: '',
    useMinimalPresentation: false,
    selectedStyleId: '',
    selectedReferencePresetId: '',
    promptText: '',
    uploadedOriginalImageUrl: '',
    uploadedOriginalImageName: '',
    uploadedReferenceImageUrls: [] as string[],
    uploadingOriginal: false,
    uploadingReference: false,
    workbenchImageSlots: buildWorkbenchImageSlots('', []),
    generating: false,
    qualityOptions: [
      { label: '2K', value: 'hd', desc: '适合展示' },
      { label: '4K', value: 'uhd', desc: '适合打印' },
    ],
    selectedQuality: DEFAULT_QUALITY,
    canvasOptions: [
      { size: '16:9', value: '16:9', desc: '横版' },
      { size: '1:1', value: '1:1', desc: '默认' },
      { size: '9:16', value: '9:16', desc: '竖版' },
    ],
    selectedCanvas: DEFAULT_CANVAS,
    generateCountOptions: [1, 2, 3],
    selectedGenerateCount: DEFAULT_GENERATE_COUNT,
    drawSingleCost: DEFAULT_DRAW_SINGLE_COST,
    drawMultiCost: DEFAULT_DRAW_MULTI_COST,
    currentScene: 'ai_draw_single',
    currentUnitCost: DEFAULT_DRAW_SINGLE_COST,
    currentCost: DEFAULT_DRAW_SINGLE_COST,
    pricingLoaded: false,
    stoneBalance: 0,
    balanceLoaded: false,
    bottomTipText: '正在加载计费信息…',
    loadingTool: false,
  },

  async onLoad(options: PageOptions) {
    const id = String(options.id || '')
    if (!id) {
      wx.showToast({
        title: '工具信息不存在',
        icon: 'none',
      })
      return
    }
    this.setData({ loadingTool: true })
    try {
      const tool = await fetchAIToolDetail(id)
      this.setData({
        tool,
        categoryLabel: getCategoryLabel(tool.category),
        useMinimalPresentation: shouldUseMinimalAIToolPresentation(tool),
        selectedStyleId: tool.stylePresets[0]?.id || '',
        workbenchImageSlots: buildWorkbenchImageSlots('', []),
      }, () => {
        this.loadAIPricing()
        this.loadStoneBalance()
      })
    } catch (error: any) {
      wx.showToast({
        title: error?.message || '工具信息不存在',
        icon: 'none',
      })
    } finally {
      this.setData({ loadingTool: false })
    }
  },

  onShow() {
    this.loadStoneBalance()
  },

  getToken(): string {
    return String(wx.getStorageSync('token') || '').trim()
  },

  ensureToken(): string {
    const token = this.getToken()
    if (token) {
      return token
    }
    wx.showModal({
      title: '提示',
      content: '请先登录后再使用 AI 生图工具',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/login/login' })
        }
      },
    })
    return ''
  },

  buildBottomTipText(options?: {
    pricingLoaded?: boolean
    currentUnitCost?: number
    currentCost?: number
    balanceLoaded?: boolean
    stoneBalance?: number
    selectedGenerateCount?: number
  }) {
    const pricingLoaded = typeof options?.pricingLoaded === 'boolean' ? options.pricingLoaded : this.data.pricingLoaded
    const currentUnitCost = typeof options?.currentUnitCost === 'number' ? options.currentUnitCost : Number(this.data.currentUnitCost || 0)
    const currentCost = typeof options?.currentCost === 'number' ? options.currentCost : Number(this.data.currentCost || 0)
    const balanceLoaded = typeof options?.balanceLoaded === 'boolean' ? options.balanceLoaded : this.data.balanceLoaded
    const stoneBalance = typeof options?.stoneBalance === 'number' ? options?.stoneBalance : Number(this.data.stoneBalance || 0)
    const selectedGenerateCount = typeof options?.selectedGenerateCount === 'number' ? options.selectedGenerateCount : this.getCurrentGenerateCount()

    if (!pricingLoaded || currentUnitCost <= 0) {
      return '正在加载计费信息…'
    }
    if (balanceLoaded) {
      return `本次预计生成 ${selectedGenerateCount} 张，预计消耗 ${currentCost} 灵石，当前余额 ${stoneBalance} 灵石。`
    }
    return `本次预计生成 ${selectedGenerateCount} 张，预计消耗 ${currentCost} 灵石。`
  },

  getReferenceImageUrls(): string[] {
    return normalizeReferenceImageUrls(this.data.uploadedReferenceImageUrls || [])
  },

  getOrderedImageUrls(): string[] {
    return buildOrderedImageUrls(this.data.uploadedOriginalImageUrl, this.getReferenceImageUrls())
  },

  applyWorkbenchImageState(nextValues: {
    uploadedOriginalImageUrl?: string
    uploadedOriginalImageName?: string
    uploadedReferenceImageUrls?: string[]
    selectedReferencePresetId?: string
    [key: string]: any
  }, callback?: () => void) {
    const nextOriginalImageUrl = normalizeUploadedImageUrl(
      Object.prototype.hasOwnProperty.call(nextValues, 'uploadedOriginalImageUrl')
        ? nextValues.uploadedOriginalImageUrl
        : this.data.uploadedOriginalImageUrl,
    )
    const nextReferenceImageUrls = normalizeReferenceImageUrls(
      Object.prototype.hasOwnProperty.call(nextValues, 'uploadedReferenceImageUrls')
        ? (nextValues.uploadedReferenceImageUrls || [])
        : this.data.uploadedReferenceImageUrls,
    )
    let nextSelectedReferencePresetId = String(
      Object.prototype.hasOwnProperty.call(nextValues, 'selectedReferencePresetId')
        ? (nextValues.selectedReferencePresetId || '')
        : (this.data.selectedReferencePresetId || ''),
    ).trim()
    if (nextSelectedReferencePresetId) {
      const selectedPreset = this.data.tool?.presetReferences.find((item) => item.id === nextSelectedReferencePresetId)
      const selectedPresetUrl = normalizeUploadedImageUrl(selectedPreset?.imageUrl || '')
      if (!selectedPresetUrl || !nextReferenceImageUrls.includes(selectedPresetUrl)) {
        nextSelectedReferencePresetId = ''
      }
    }

    this.setData({
      ...nextValues,
      uploadedOriginalImageUrl: nextOriginalImageUrl,
      uploadedReferenceImageUrls: nextReferenceImageUrls,
      selectedReferencePresetId: nextSelectedReferencePresetId,
      workbenchImageSlots: buildWorkbenchImageSlots(nextOriginalImageUrl, nextReferenceImageUrls),
    }, () => {
      this.syncCurrentCost(callback)
    })
  },

  getCurrentScene(): 'ai_draw_single' | 'ai_draw_multi' {
    return this.getReferenceImageUrls().length > 0 ? 'ai_draw_multi' : 'ai_draw_single'
  },

  getCurrentGenerateCount(): number {
    const currentValue = Number(this.data.selectedGenerateCount || DEFAULT_GENERATE_COUNT)
    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      return DEFAULT_GENERATE_COUNT
    }
    return Math.min(3, Math.max(1, Math.floor(currentValue)))
  },

  syncCurrentCost(callback?: () => void) {
    const nextScene = this.getCurrentScene()
    const nextGenerateCount = this.getCurrentGenerateCount()
    const nextUnitCost = nextScene === 'ai_draw_multi' ? Number(this.data.drawMultiCost || 0) : Number(this.data.drawSingleCost || 0)
    const nextCost = nextUnitCost * nextGenerateCount
    this.setData({
      currentScene: nextScene,
      selectedGenerateCount: nextGenerateCount,
      currentUnitCost: nextUnitCost,
      currentCost: nextCost,
      bottomTipText: this.buildBottomTipText({
        currentUnitCost: nextUnitCost,
        currentCost: nextCost,
        selectedGenerateCount: nextGenerateCount,
      }),
    }, callback)
  },

  async loadAIPricing() {
    try {
      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/api/v1/miniprogram/ai/pricing?scenes=ai_draw_single,ai_draw_multi`,
          method: 'GET',
          success: (requestRes) => {
            if (requestRes.statusCode === 200 && requestRes.data) {
              const data = requestRes.data as any
              if (data.code === 0) {
                resolve(data.data || {})
              } else {
                reject(new Error(data.msg || '获取 AI 计费失败'))
              }
            } else {
              reject(new Error(`请求失败: ${requestRes.statusCode}`))
            }
          },
          fail: reject,
        })
      })

      const prices = res?.prices || {}
      const nextSingleCost = Number(prices.ai_draw_single)
      const nextMultiCost = Number(prices.ai_draw_multi)
      this.setData({
        drawSingleCost: Number.isFinite(nextSingleCost) && nextSingleCost > 0 ? nextSingleCost : DEFAULT_DRAW_SINGLE_COST,
        drawMultiCost: Number.isFinite(nextMultiCost) && nextMultiCost > 0 ? nextMultiCost : DEFAULT_DRAW_MULTI_COST,
        pricingLoaded: Number.isFinite(nextSingleCost) && nextSingleCost > 0 && Number.isFinite(nextMultiCost) && nextMultiCost > 0,
      }, () => this.syncCurrentCost())
    } catch (_error) {
      this.setData({
        pricingLoaded: false,
      }, () => this.syncCurrentCost())
    }
  },

  async requestStoneBalance(token: string): Promise<number> {
    const res = await new Promise<any>((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}/api/v1/miniprogram/user/stones`,
        method: 'GET',
        header: {
          token,
          'Content-Type': 'application/json',
        },
        success: (requestRes) => {
          if (requestRes.statusCode === 200 && requestRes.data) {
            const data = requestRes.data as any
            if (data.code === 0) {
              resolve(data.data || {})
            } else {
              reject(new Error(data.msg || '获取余额失败'))
            }
          } else {
            reject(new Error(`请求失败: ${requestRes.statusCode}`))
          }
        },
        fail: reject,
      })
    })
    return Number(res?.stones || 0)
  },

  async loadStoneBalance() {
    const token = this.getToken()
    if (!token) {
      this.setData({
        stoneBalance: 0,
        balanceLoaded: false,
        bottomTipText: this.buildBottomTipText({
          stoneBalance: 0,
          balanceLoaded: false,
        }),
      })
      return
    }

    try {
      const stones = await this.requestStoneBalance(token)
      this.setData({
        stoneBalance: stones,
        balanceLoaded: true,
        bottomTipText: this.buildBottomTipText({
          stoneBalance: stones,
          balanceLoaded: true,
          selectedGenerateCount: this.getCurrentGenerateCount(),
        }),
      })
    } catch (_error) {
      this.setData({
        balanceLoaded: false,
        bottomTipText: this.buildBottomTipText({
          balanceLoaded: false,
        }),
      })
    }
  },

  async uploadImageFile(tempFilePath: string, token: string): Promise<string> {
    const apiPath = '/api/v1/miniprogram/ai/upload-reference-image'
    const deviceID = getCachedDeviceFingerprint() || ''
    const params = generateRequestParams(token, '{}', apiPath, deviceID)
    const headers = paramsToHeaders(params)

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${API_BASE_URL}${apiPath}`,
        filePath: tempFilePath,
        name: 'file',
        header: headers,
        success: (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`上传失败: ${res.statusCode}`))
            return
          }
          try {
            const data = JSON.parse(res.data) as any
            if (data.code === 0 && data.data && data.data.url) {
              resolve(String(data.data.url))
            } else {
              reject(new Error(data.msg || '上传失败'))
            }
          } catch (_error) {
            reject(new Error('解析响应失败'))
          }
        },
        fail: reject,
      })
    })
  },

  chooseAndUploadImageSlot(slotIndex: number) {
    const token = this.ensureToken()
    if (!token) {
      return
    }

    if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > MAX_REFERENCE_IMAGE_COUNT) {
      return
    }

    const isOriginalSlot = slotIndex === 0
    const currentReferenceImageUrls = this.getReferenceImageUrls()
    if (!isOriginalSlot) {
      const currentSlotUrl = currentReferenceImageUrls[slotIndex - 1] || ''
      const nextAvailableSlotIndex = currentReferenceImageUrls.length + 1
      if (!currentSlotUrl && slotIndex > nextAvailableSlotIndex) {
        wx.showToast({
          title: '请先按顺序补齐前面的参考图',
          icon: 'none',
        })
        return
      }
    }

    const loadingTitle = isOriginalSlot ? '上传原图中...' : '上传参考图中...'
    const stateKey = isOriginalSlot ? 'uploadingOriginal' : 'uploadingReference'

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        const tempFiles = (res.tempFiles || []) as Array<{ tempFilePath: string }>
        const tempFilePath = String(tempFiles[0]?.tempFilePath || '')
        if (!tempFilePath) {
          return
        }

        this.setData({ [stateKey]: true } as any)
        wx.showLoading({ title: loadingTitle, mask: true })

        try {
          const uploadedUrl = await this.uploadImageFile(tempFilePath, token)
          const uploadedName = extractFileName(tempFilePath, isOriginalSlot ? '原图.jpg' : '参考图.jpg')
          if (isOriginalSlot) {
            this.applyWorkbenchImageState({
              uploadedOriginalImageUrl: uploadedUrl,
              uploadedOriginalImageName: uploadedName,
            })
          } else {
            const nextReferenceImageUrls = [...currentReferenceImageUrls]
            nextReferenceImageUrls[slotIndex - 1] = uploadedUrl
            this.applyWorkbenchImageState({
              uploadedReferenceImageUrls: nextReferenceImageUrls,
            })
          }
          wx.showToast({
            title: '上传成功',
            icon: 'success',
          })
        } catch (error: any) {
          wx.showToast({
            title: error?.message || '上传失败',
            icon: 'none',
          })
        } finally {
          wx.hideLoading()
          this.setData({ [stateKey]: false } as any)
        }
      },
      fail: (err) => {
        const message = String(err?.errMsg || '')
        if (message.indexOf('cancel') >= 0) {
          return
        }
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
        })
      },
    })
  },

  onSelectPresetReference(e: PresetTapEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    const tool = this.data.tool
    if (!id || !tool) {
      return
    }
    const targetReference = tool.presetReferences.find((item) => item.id === id)
    const targetReferenceUrl = normalizeUploadedImageUrl(targetReference?.imageUrl || '')
    if (!targetReferenceUrl) {
      wx.showToast({
        title: '当前预设参考图不可用',
        icon: 'none',
      })
      return
    }

    const currentReferenceImageUrls = this.getReferenceImageUrls()
    const existingIndex = currentReferenceImageUrls.indexOf(targetReferenceUrl)
    if (existingIndex >= 0) {
      this.setData({
        selectedReferencePresetId: id,
      })
      this.openImagePreview(existingIndex + 1)
      return
    }
    if (currentReferenceImageUrls.length >= MAX_REFERENCE_IMAGE_COUNT) {
      wx.showToast({
        title: `最多添加 ${MAX_REFERENCE_IMAGE_COUNT} 张参考图`,
        icon: 'none',
      })
      return
    }

    this.applyWorkbenchImageState({
      uploadedReferenceImageUrls: [...currentReferenceImageUrls, targetReferenceUrl],
      selectedReferencePresetId: id,
    })
  },

  onSelectStyle(e: PresetTapEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) {
      return
    }
    this.setData({
      selectedStyleId: id,
    })
  },

  onSelectQuality(e: any) {
    const value = String(e.currentTarget.dataset.value || '')
    if (!value || value === this.data.selectedQuality) {
      return
    }
    this.setData({
      selectedQuality: value,
    })
  },

  onSelectCanvas(e: any) {
    const value = String(e.currentTarget.dataset.value || '')
    if (!value || value === this.data.selectedCanvas) {
      return
    }
    this.setData({
      selectedCanvas: value,
    })
  },

  onSelectGenerateCount(e: any) {
    const value = Number(e.currentTarget.dataset.count)
    if (!Number.isFinite(value) || value <= 0) {
      return
    }
    const nextGenerateCount = Math.min(3, Math.max(1, Math.floor(value)))
    if (nextGenerateCount === this.data.selectedGenerateCount) {
      return
    }
    this.setData({
      selectedGenerateCount: nextGenerateCount,
    }, () => this.syncCurrentCost())
  },

  onPromptInput(e: InputEvent) {
    this.setData({
      promptText: String(e.detail.value || ''),
    })
  },

  onImageSlotTap(e: SlotTapEvent) {
    const slotIndex = Number(e.currentTarget.dataset.slotIndex)
    const imageUrl = normalizeUploadedImageUrl(e.currentTarget.dataset.imageUrl || '')
    if (!Number.isFinite(slotIndex) || slotIndex < 0) {
      return
    }

    if (imageUrl) {
      const now = Date.now()
      if (lastPreviewTapIndex === slotIndex && now - lastPreviewTapAt <= 320) {
        lastPreviewTapAt = 0
        lastPreviewTapIndex = -1
        this.openImagePreview(slotIndex)
        return
      }
      lastPreviewTapAt = now
      lastPreviewTapIndex = slotIndex
      return
    }

    this.chooseAndUploadImageSlot(slotIndex)
  },

  onReuploadImageSlot(e: SlotTapEvent) {
    const slotIndex = Number(e.currentTarget.dataset.slotIndex)
    if (!Number.isFinite(slotIndex) || slotIndex < 0) {
      return
    }
    this.chooseAndUploadImageSlot(slotIndex)
  },

  onDeleteImageSlot(e: SlotTapEvent) {
    const slotIndex = Number(e.currentTarget.dataset.slotIndex)
    if (!Number.isFinite(slotIndex) || slotIndex < 0) {
      return
    }

    if (slotIndex === 0) {
      this.applyWorkbenchImageState({
        uploadedOriginalImageUrl: '',
        uploadedOriginalImageName: '',
      })
      return
    }

    const nextReferenceImageUrls = [...this.getReferenceImageUrls()]
    nextReferenceImageUrls.splice(slotIndex - 1, 1)
    this.applyWorkbenchImageState({
      uploadedReferenceImageUrls: nextReferenceImageUrls,
    })
  },

  openImagePreview(slotIndex: number) {
    const orderedImageUrls = this.getOrderedImageUrls()
    if (!orderedImageUrls.length) {
      return
    }

    const hasOriginalImage = !!normalizeUploadedImageUrl(this.data.uploadedOriginalImageUrl)
    let currentIndex = slotIndex
    if (!hasOriginalImage && slotIndex > 0) {
      currentIndex = slotIndex - 1
    }
    if (currentIndex < 0 || currentIndex >= orderedImageUrls.length) {
      currentIndex = 0
    }

    wx.previewImage({
      current: orderedImageUrls[currentIndex],
      urls: orderedImageUrls,
      fail: () => {
        wx.showToast({
          title: '预览失败',
          icon: 'none',
        })
      },
    })
  },

  getSelectedStyle(): AIToolStylePreset | undefined {
    const tool = this.data.tool
    if (!tool) {
      return undefined
    }
    return tool.stylePresets.find((item) => item.id === this.data.selectedStyleId)
  },

  async onStartCreate() {
    const tool = this.data.tool
    if (!tool || this.data.generating) {
      return
    }

    const originalImageUrl = normalizeUploadedImageUrl(this.data.uploadedOriginalImageUrl)
    if (!originalImageUrl) {
      wx.showToast({
        title: '请先上传原图',
        icon: 'none',
      })
      return
    }

    const token = this.ensureToken()
    if (!token) {
      return
    }

    const selectedStyle = this.getSelectedStyle()
    const referenceImageUrls = this.getReferenceImageUrls()
    const orderedImageUrls = buildOrderedImageUrls(originalImageUrl, referenceImageUrls)
    const generateCount = this.getCurrentGenerateCount()
    const selectedReferencePresetId = String(this.data.selectedReferencePresetId || '').trim()
    const referenceSelectionType = resolveReferenceSelectionType(selectedReferencePresetId, referenceImageUrls)

    if (!this.data.pricingLoaded || this.data.currentUnitCost <= 0 || this.data.currentCost <= 0) {
      wx.showToast({
        title: '计费信息加载中，请稍后再试',
        icon: 'none',
      })
      this.loadAIPricing()
      return
    }

    try {
      const stones = await this.requestStoneBalance(token)
      this.setData({
        stoneBalance: stones,
        balanceLoaded: true,
      }, () => this.syncCurrentCost())
      if (stones < this.data.currentCost) {
        wx.showModal({
          title: '余额不足',
          content: `当前余额：${stones}灵石，需要：${this.data.currentCost}灵石`,
          confirmText: '去充值',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/topupcenter/topupcenter' })
            }
          },
        })
        return
      }
    } catch (_error) {
      wx.showToast({
        title: '检查余额失败',
        icon: 'none',
      })
      return
    }

    const scene = referenceImageUrls.length > 0 ? 'ai_draw_multi' : 'ai_draw_single'
    const promptText = String(this.data.promptText || '').trim()
    const payload: Record<string, any> = {
      service_type: DEFAULT_SERVICE_TYPE,
      service: DEFAULT_SERVICE,
      quality: this.data.selectedQuality,
      canvas: this.data.selectedCanvas,
      generate_count: generateCount,
      tool_id: normalizeToolId(tool.id),
      user_prompt: promptText,
      reference_selection_type: referenceSelectionType,
      reference_preset_id: selectedReferencePresetId,
      style_preset_id: selectedStyle?.id || '',
      original_image_url: originalImageUrl,
      original_image_urls: [originalImageUrl],
      ordered_image_urls: orderedImageUrls,
    }

    if (selectedStyle?.name) {
      payload.style = selectedStyle.name
    }
    if (orderedImageUrls[0]) {
      payload.image_url = orderedImageUrls[0]
      payload.images = orderedImageUrls
    }
    if (referenceImageUrls.length > 0) {
      payload.reference_image_url = referenceImageUrls[0]
      payload.reference_image_urls = referenceImageUrls
    }

    const requestBody = { scene, payload }
    const apiPath = '/api/v1/miniprogram/ai/draw'
    const deviceID = getCachedDeviceFingerprint() || ''
    const params = generateRequestParams(token, requestBody, apiPath, deviceID)
    const headers = paramsToHeaders(params)

    this.setData({ generating: true })
    wx.showLoading({ title: '创作中...', mask: true })

    try {
      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}${apiPath}`,
          method: 'POST',
          header: {
            ...headers,
            'Content-Type': 'application/json',
          },
          data: requestBody,
          success: (requestRes) => {
            if (requestRes.statusCode === 200 && requestRes.data) {
              const data = requestRes.data as any
              if (data.code === 0) {
                resolve(data.data)
              } else {
                reject(new Error(data.msg || '生成失败'))
              }
            } else {
              reject(new Error(`请求失败: ${requestRes.statusCode}`))
            }
          },
          fail: reject,
        })
      })

      if (!res?.task_no) {
        throw new Error('生成失败')
      }

      const taskNo = encodeURIComponent(String(res.task_no))
      const safePrompt = encodeURIComponent(promptText || tool.name)
      const safeToolId = encodeURIComponent(tool.id)
      wx.navigateTo({
        url: `/pages/generatedetails/generatedetails?task_no=${taskNo}&prompt=${safePrompt}&tool_id=${safeToolId}${referenceImageUrls[0] ? `&reference_image_url=${encodeURIComponent(referenceImageUrls[0])}` : ''}`,
        success: (navRes) => {
          navRes.eventChannel.emit('taskData', {
            id: 0,
            task_no: res.task_no,
            scene,
            status: 'pending',
            requested_count: generateCount,
            generated_count: 0,
            stones_used: this.data.currentCost,
            result: {},
            error_message: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            task_type: 'ai_draw',
            prompt: promptText || tool.name,
            user_prompt: promptText || tool.name,
            reference_image_url: referenceImageUrls[0] || '',
            reference_image_urls: referenceImageUrls,
            original_image_urls: [originalImageUrl],
            ordered_image_urls: orderedImageUrls,
            quality: this.data.selectedQuality,
            canvas: this.data.selectedCanvas,
            tool_id: tool.id,
            tool_name: tool.name,
          })
        },
        fail: () => {
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none',
          })
        },
      })
    } catch (error: any) {
      wx.showToast({
        title: sanitizeAIGenerationErrorMessage(error?.message || '生成失败'),
        icon: 'none',
        duration: 2000,
      })
    } finally {
      wx.hideLoading()
      this.setData({ generating: false })
      this.loadStoneBalance()
    }
  },

  onShareAppMessage() {
    const tool = this.data.tool
    return {
      title: tool ? `${tool.name} · 开始使用` : 'AI生图工具',
      path: tool ? `/pages/aitoolworkbench/aitoolworkbench?id=${tool.id}` : '/pages/aitools/aitools',
    }
  },
})
