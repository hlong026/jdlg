import { AIToolItem, getCategoryLabel } from '../../utils/aiTools'
import { fetchAIToolDetail } from '../../utils/aiToolApi'
import { shouldUseMinimalAIToolPresentation } from '../../utils/aiToolPresentation'

type PageOptions = {
  id?: string
}

function buildUsageTips(tool: AIToolItem | null | undefined): string[] {
  if (!tool || tool.showUsageTips === false) {
    return []
  }

  const content = String(tool.usageTipsContent || '').trim()
  if (!content) {
    return []
  }

  return content
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

Page({
  data: {
    tool: null as AIToolItem | null,
    categoryLabel: '',
    useMinimalPresentation: false,
    highlights: [] as string[],
    usageTipsTitle: '使用提示',
    loading: false,
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
    this.setData({ loading: true })
    try {
      const tool = await fetchAIToolDetail(id)
      const useMinimalPresentation = shouldUseMinimalAIToolPresentation(tool)
      this.setData({
        tool,
        categoryLabel: getCategoryLabel(tool.category),
        useMinimalPresentation,
        highlights: buildUsageTips(tool),
        usageTipsTitle: String(tool.usageTipsTitle || '使用提示'),
      })
    } catch (error: any) {
      wx.showToast({
        title: error?.message || '工具信息不存在',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onStartUse() {
    const tool = this.data.tool
    if (!tool) {
      return
    }
    wx.navigateTo({
      url: `/pages/aitoolworkbench/aitoolworkbench?id=${tool.id}`,
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        })
      },
    })
  },

  onShareAppMessage() {
    const tool = this.data.tool
    return {
      title: tool ? `${tool.name} · AI生图工具` : 'AI生图工具',
      path: tool ? `/pages/aitooldetail/aitooldetail?id=${tool.id}` : '/pages/aitools/aitools',
    }
  },
})
