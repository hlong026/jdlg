// pages/generatehistory/generatehistory.ts
import { generateRequestParams, paramsToHeaders } from '../../utils/parameter';

// API基础地址
const API_BASE_URL = 'https://api.jiadilingguang.com';

interface TaskItem {
  id: number;
  task_no: string;
  scene: string;
  status: string;
  stones_used: number;
  result: any;
  error_message: string;
  created_at: string;
  updated_at: string;
  sceneText?: string;
  createdAtText?: string;
  imageUrl?: string;
  prompt?: string;
  reference_image_url?: string;
  reference_image_urls?: string[];
  original_image_urls?: string[];
  ordered_image_urls?: string[];
  user_prompt?: string;
  task_type?: 'ai_draw' | 'ai_video' | 'ai_chat' | 'ai_cost_doc';
  excel_url?: string;
  tool_id?: number;
  tool_name?: string;
}

interface AITool {
  id: number;
  code: string;
  name: string;
  category: string;
  short_description: string;
}

Page({
  data: {
    list: [] as TaskItem[],
    loading: false,
    loadingMore: false,
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    availableTools: [] as AITool[],
    selectedToolId: '',
    hasAITools: false,
  },

  onLoad() {
    this.loadAITools();
    this.loadHistory();
  },

  onShow() {
    // 每次显示页面时刷新列表（可能有新的生成记录）
  },

  async loadAITools() {
    try {
      const token = wx.getStorageSync('token');
      if (!token) {
        return;
      }
      const apiPath = '/api/v1/miniprogram/ai-tools';
      const params = generateRequestParams(token, '', apiPath);
      const headers = paramsToHeaders(params);

      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}${apiPath}`,
          method: 'GET',
          header: headers,
          success: (r) => resolve(r.data),
          fail: reject
        });
      });

      if (res && res.code === 0 && Array.isArray(res.data)) {
        const tools = res.data as AITool[];
        this.setData({
          availableTools: tools,
          hasAITools: tools.length > 0,
        });
      }
    } catch (err) {
      console.error('加载 AI 工具列表失败:', err);
    }
  },

  onFilterByTool(e: any) {
    const toolId = e.currentTarget.dataset.id as string;
    this.setData({
      selectedToolId: toolId,
      page: 1,
      hasMore: true,
    });
    this.loadHistory();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadHistory().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  goToGenerate() {
    wx.navigateTo({
      url: '/pages/aigenerate/aigenerate'
    });
  },

  async getAuthHeaders() {
    const token = wx.getStorageSync('token');
    if (!token) {
      throw new Error('未登录');
    }

    const requestBody = '';
    const apiPath = '/api/v1/miniprogram/user/tasks';
    const params = generateRequestParams(token, requestBody, apiPath);
    return paramsToHeaders(params);
  },

  async loadHistory(): Promise<void> {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const headers = await this.getAuthHeaders();
      const { page, pageSize, selectedToolId } = this.data;

      let url = `${API_BASE_URL}/api/v1/miniprogram/user/tasks?page=${page}&page_size=${pageSize}`;
      if (selectedToolId) {
        url += `&tool_id=${selectedToolId}`;
      }

      return new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          header: headers,
          success: (res: any) => {
            if (res.data.code === 0) {
              const tasks = res.data.data.tasks || [];
              const total = res.data.data.total || 0;
              const formattedTasks = this.formatTasks(tasks);

              this.setData({
                list: page === 1 ? formattedTasks : [...this.data.list, ...formattedTasks],
                total,
                hasMore: tasks.length >= pageSize,
              });
              resolve();
            } else {
              wx.showToast({ title: res.data.msg || '加载失败', icon: 'none' });
              reject(new Error(res.data.msg));
            }
          },
          fail: (err) => {
            console.error('加载历史失败:', err);
            wx.showToast({ title: '网络错误', icon: 'none' });
            reject(err);
          },
          complete: () => {
            this.setData({ loading: false });
          }
        });
      });
    } catch (error) {
      console.error('加载历史失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;

    this.setData({
      loadingMore: true,
      page: this.data.page + 1
    });

    try {
      const headers = await this.getAuthHeaders();
      const { page, pageSize, selectedToolId } = this.data;

      let url = `${API_BASE_URL}/api/v1/miniprogram/user/tasks?page=${page}&page_size=${pageSize}`;
      if (selectedToolId) {
        url += `&tool_id=${selectedToolId}`;
      }

      wx.request({
        url,
        method: 'GET',
        header: headers,
        success: (res: any) => {
          if (res.data.code === 0) {
            const tasks = res.data.data.tasks || [];
            const formattedTasks = this.formatTasks(tasks);

            this.setData({
              list: [...this.data.list, ...formattedTasks],
              hasMore: tasks.length >= pageSize,
            });
          }
        },
        complete: () => {
          this.setData({ loadingMore: false });
        }
      });
    } catch (error) {
      console.error('加载更多失败:', error);
      this.setData({ loadingMore: false });
    }
  },

  formatTasks(tasks: any[]): TaskItem[] {
    const sceneMap: Record<string, string> = {
      'ai_draw_single': 'AI绘画',
      'ai_draw_multi': 'AI绘画',
      'ai_chat_single': 'AI对话（单轮）',
      'ai_chat_multi': 'AI对话（多轮）',
      'ai_video': 'AI生成视频',
      'ai_cost_doc': 'AI造价(文档)',
    };

    return tasks.map(task => {
      const result = task.result || {};
      const imageCandidates = [
        result.url,
        result.image_url,
        ...(Array.isArray(result.images) ? result.images : []),
        ...(Array.isArray(result.image_urls) ? result.image_urls : []),
        ...(Array.isArray(result.urls) ? result.urls : []),
      ];
      const imageUrl = imageCandidates.find((item) => typeof item === 'string' && item.trim()) || '';
      const excelUrl = (task.result && task.result.excel_url) ? task.result.excel_url : '';

      let prompt = '';
      if (task.user_prompt) {
        prompt = task.user_prompt;
      } else if (task.prompt) {
        prompt = task.prompt;
      } else {
        try {
          if (task.request_payload) {
            const payload = typeof task.request_payload === 'string'
              ? JSON.parse(task.request_payload)
              : task.request_payload;
            prompt = payload.prompt || '';
          }
        } catch (e) {
          // ignore
        }
      }

      const resultImageCount = imageCandidates.filter((item, index, array) => {
        const value = typeof item === 'string' ? item.trim() : '';
        return !!value && array.findIndex((inner) => String(inner || '').trim() === value) === index;
      }).length;
      const referenceImages = [
        ...(Array.isArray(task.reference_image_urls) ? task.reference_image_urls : []),
        task.reference_image_url,
      ].filter((item, index, array) => {
        const value = typeof item === 'string' ? item.trim() : '';
        return !!value && array.findIndex((inner) => String(inner || '').trim() === value) === index;
      }) as string[];

      return {
        ...task,
        sceneText: (task.scene === 'ai_draw_single' || task.scene === 'ai_draw_multi')
          ? (resultImageCount > 1 ? `AI绘画（${resultImageCount}张）` : 'AI绘画')
          : (sceneMap[task.scene] || task.scene),
        createdAtText: this.formatTime(task.created_at),
        imageUrl,
        prompt,
        reference_image_url: referenceImages[0] || '',
        reference_image_urls: referenceImages,
        excel_url: excelUrl,
      };
    });
  },

  formatTime(timeStr: string): string {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 小于1分钟
    if (diff < 60000) {
      return '刚刚';
    }
    // 小于1小时
    if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    }
    // 小于24小时
    if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    }
    // 小于7天
    if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前';
    }

    // 格式化日期
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  },

  /** 复制 Excel 下载链接（ai_cost_doc 任务） */
  onCopyExcelLink(e: any) {
    const item = e.currentTarget.dataset.item as TaskItem;
    const url = item && item.excel_url;
    if (!url) {
      wx.showToast({ title: '暂无下载链接', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({ title: '已复制，请在浏览器中打开下载', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  goToDetail(e: any) {
    const item = e.currentTarget.dataset.item as TaskItem;
    const isMakeSameTask = Array.isArray(item?.original_image_urls)
      && item.original_image_urls.some((image) => typeof image === 'string' && image.trim() !== '');
    const sourceQuery = isMakeSameTask ? '&source=make_same' : '';
    wx.navigateTo({
      url: `/pages/generatedetails/generatedetails?task_no=${item.task_no}${sourceQuery}`,
      success: (res) => {
        res.eventChannel.emit('taskData', item);
      }
    });
  },

  /** 删除单条记录（二次确认） */
  onDelete(e: any) {
    const item = e.currentTarget.dataset.item as TaskItem;
    if (!item || !item.task_no) return;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      confirmText: '删除',
      confirmColor: '#e34c4c',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        this.doDelete(item);
      }
    });
  },

  async doDelete(item: TaskItem) {
    wx.showLoading({ title: '删除中...' });
    try {
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      const apiPath = `/api/v1/miniprogram/user/tasks/${item.task_no}`;
      const params = generateRequestParams(token, '', apiPath);
      const headers = paramsToHeaders(params);

      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}${apiPath}`,
          method: 'DELETE',
          header: headers,
          success: (r) => resolve(r.data),
          fail: reject
        });
      });

      if (res && res.code === 0) {
        this.setData({
          list: this.data.list.filter((t) => t.task_no !== item.task_no),
          total: Math.max(0, (this.data.total || 0) - 1)
        });
        wx.showToast({ title: '已删除', icon: 'success' });
      } else {
        wx.showToast({ title: (res && res.msg) || '删除失败', icon: 'none' });
      }
    } catch (err) {
      console.error('删除失败:', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  onShareAppMessage() {
    return {
      title: '甲第灵光 · 生成历史',
      path: '/pages/generatehistory/generatehistory',
    };
  },
});
