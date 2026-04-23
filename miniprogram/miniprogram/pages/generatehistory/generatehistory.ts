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
  referencePreviewUrls?: string[];
  referenceOverflowCount?: number;
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
    // 批量管理模式
    isEditMode: false as boolean,
    selectedIds: [] as string[],
    selectedMap: {} as Record<string, boolean>,
    selectAll: false as boolean,
    // 左滑相关
    touchStartX: 0 as number,
    touchStartY: 0 as number,
    swipedItemId: '' as string,
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
        referencePreviewUrls: referenceImages.slice(0, 3),
        referenceOverflowCount: Math.max(referenceImages.length - 3, 0),
        excel_url: excelUrl,
      };
    });
  },

  formatTime(timeStr: string): string {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (date.getFullYear() === now.getFullYear()) {
      return `${month}-${day} ${hours}:${minutes}`;
    }

    return `${year}-${month}-${day} ${hours}:${minutes}`;
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

  /** 切换编辑模式 */
  onToggleEditMode() {
    const isEditMode = !this.data.isEditMode;
    this.setData({
      isEditMode,
      selectedIds: [],
      selectedMap: {},
      selectAll: false,
      swipedItemId: '',
    });
  },

  /** 左滑手势 - 开始 */
  onTouchStart(e: any) {
    const id = e.currentTarget.dataset.id as string;
    // 如果当前有打开的滑动项且不是当前项，先关闭
    if (this.data.swipedItemId && this.data.swipedItemId !== id) {
      this.setData({ swipedItemId: '' });
    }
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    });
  },

  /** 左滑手势 - 移动 */
  onTouchMove(e: any) {
    if (this.data.isEditMode) return;
    const deltaX = e.touches[0].clientX - this.data.touchStartX;
    const deltaY = Math.abs(e.touches[0].clientY - this.data.touchStartY);
    // 纵向滑动不处理
    if (deltaY > Math.abs(deltaX)) return;
    // 向左滑超过阈值才打开
    if (deltaX < -60) {
      const id = e.currentTarget.dataset.id as string;
      if (this.data.swipedItemId !== id) {
        this.setData({ swipedItemId: id });
      }
    }
  },

  /** 左滑手势 - 结束 */
  onTouchEnd(e: any) {
    const deltaX = (e.changedTouches[0].clientX || 0) - this.data.touchStartX;
    // 向右滑时关闭
    if (deltaX > 60 && this.data.swipedItemId) {
      this.setData({ swipedItemId: '' });
    }
  },

  /** 点击列表项 */
  onItemClick(e: any) {
    // 如果有左滑打开的项，先关闭
    if (this.data.swipedItemId) {
      this.setData({ swipedItemId: '' });
      return;
    }
    // 编辑模式下点击切换选中
    if (this.data.isEditMode) {
      const id = e.currentTarget.dataset.id as string;
      if (id) this.toggleSelect(id);
      return;
    }
    // 正常模式跳转详情
    this.goToDetail(e);
  },

  /** 切换单项选中 */
  toggleSelect(id: string) {
    const selectedIds = [...this.data.selectedIds];
    const idx = selectedIds.indexOf(id);
    if (idx > -1) {
      selectedIds.splice(idx, 1);
    } else {
      selectedIds.push(id);
    }
    this.applySelectionState(selectedIds);
  },

  /** 复选框点击 */
  onToggleSelect(e: any) {
    const id = e.currentTarget.dataset.id as string;
    if (id) this.toggleSelect(id);
  },

  /** 全选/取消全选 */
  onToggleSelectAll() {
    const selectAll = !this.data.selectAll;
    const selectedIds = selectAll ? this.data.list.map(item => item.task_no) : [];
    this.applySelectionState(selectedIds);
  },

  applySelectionState(selectedIds: string[]) {
    const selectedMap = selectedIds.reduce((acc, taskNo) => {
      acc[taskNo] = true;
      return acc;
    }, {} as Record<string, boolean>);

    this.setData({
      selectedIds,
      selectedMap,
      selectAll: selectedIds.length === this.data.list.length && this.data.list.length > 0,
    });
  },

  /** 删除单条记录（左滑触发，二次确认） */
  onDelete(e: any) {
    const item = e.currentTarget.dataset.item as TaskItem;
    if (!item || !item.task_no) return;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      confirmText: '删除',
      confirmColor: '#c4543a',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        this.doDeleteByTaskNo(item.task_no).then(() => {
          this.setData({
            list: this.data.list.filter((t) => t.task_no !== item.task_no),
            total: Math.max(0, (this.data.total || 0) - 1),
            swipedItemId: '',
          });
          wx.showToast({ title: '已删除', icon: 'success' });
        }).catch(() => {
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  },

  /** 批量删除 */
  onBatchDelete() {
    const { selectedIds } = this.data;
    if (!selectedIds.length) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedIds.length} 条记录吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#c4543a',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        let failCount = 0;
        for (const taskNo of selectedIds) {
          try {
            await this.doDeleteByTaskNo(taskNo);
          } catch {
            failCount++;
          }
        }
        wx.hideLoading();
        if (failCount > 0) {
          wx.showToast({ title: `${failCount} 条删除失败`, icon: 'none' });
        } else {
          wx.showToast({ title: '已删除', icon: 'success' });
        }
        // 重新加载列表
        this.setData({
          isEditMode: false,
          selectedIds: [],
          selectedMap: {},
          selectAll: false,
          page: 1,
          hasMore: true,
        });
        this.loadHistory();
      }
    });
  },

  /** 按 task_no 删除（通用方法） */
  async doDeleteByTaskNo(taskNo: string): Promise<void> {
    const token = wx.getStorageSync('token');
    if (!token) {
      throw new Error('未登录');
    }
    const apiPath = `/api/v1/miniprogram/user/tasks/${taskNo}`;
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

    if (!res || res.code !== 0) {
      throw new Error((res && res.msg) || '删除失败');
    }
  },

  onShareAppMessage() {
    return {
      title: '甲第灵光 · 生成历史',
      path: '/pages/generatehistory/generatehistory',
    };
  },
});
