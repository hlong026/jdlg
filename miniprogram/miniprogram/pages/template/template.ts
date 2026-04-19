// pages/template/template.ts

import { resolveAssetPath } from '../../utils/asset';

export {};

const API_BASE_URL = 'https://api.jiadilingguang.com';

type MainTabValue = string;

type TemplateListItem = {
  id: number;
  image: string;
  displayTitle: string;
  displaySubtitle: string;
  tags: string[];
  targetType: 'template' | 'inspiration';
  localDemo?: boolean;
  cardKey: string;
};

type MainTabItem = {
  label: string;
  value: MainTabValue;
};

type SubTabItem = {
  label: string;
  value: string;
  parent?: string;
  keywords?: string[];
};

type TemplateApiListItem = {
  id?: number | string;
  name?: string;
  category?: string;
  sub_tab?: string;
  main_tab?: string;
  description?: string;
  thumbnail?: string;
  preview_url?: string;
};

type InspirationApiListItem = {
  id?: number | string;
  title?: string;
  description?: string;
  cover_image?: string;
  images?: string[];
  tags?: string[];
  scene?: string;
  style?: string;
  topic?: string;
};

type ApiListResponseData<T> = {
  list?: T[];
  total?: number;
};

type IndexTapEvent = {
  currentTarget: {
    dataset: {
      index?: number | string;
    };
  };
};

type InputEvent = {
  detail: {
    value?: string;
  };
};

type CardTapEvent = {
  currentTarget: {
    dataset: {
      id?: number | string;
      targetType?: string;
      localDemo?: boolean | string;
    };
  };
};

const AI_TOOLS_MAIN_TAB: MainTabItem = { label: 'AI生图工具', value: 'ai_tools' };

const TEMPLATE_MAIN_TABS: MainTabItem[] = [
  { label: '场景', value: 'scene' },
  { label: '风格', value: 'style' },
  { label: '灵感', value: 'inspiration' },
  AI_TOOLS_MAIN_TAB,
];

const TEMPLATE_SUB_TAB_MAP: Record<MainTabValue, SubTabItem[]> = {
  scene: [
    { label: '乡墅外观', value: 'villa_exterior', parent: 'scene', keywords: ['乡墅', '别墅', '外观', '外立面', '门头', '立面'] },
    { label: '室内空间', value: 'interior_space', parent: 'scene', keywords: ['室内', '空间', '客厅', '卧室', '餐厅', '书房', '茶室', '门厅', '玄关'] },
    { label: '花园庭院', value: 'garden_courtyard', parent: 'scene', keywords: ['花园', '庭院', '景观', '院子', '露台', '庭景'] },
    { label: '改造翻新', value: 'renovation', parent: 'scene', keywords: ['改造', '翻新', '更新', '焕新', '旧房', '旧改'] },
    { label: '商业空间', value: 'commercial_space', parent: 'scene', keywords: ['商业', '民宿', '酒店', '餐饮', '咖啡', '展厅', '办公', '会所', '店铺'] },
    { label: '设计辅助', value: 'design_assist', parent: 'scene', keywords: ['设计辅助', '辅助', '分析', '方案', '提示词', '草图', '布局', '概念'] },
  ],
  style: [
    { label: '新闽派', value: 'new_minnan', parent: 'style', keywords: ['新闽派', '闽南', '闽式', '红砖'] },
    { label: '新中式', value: 'new_chinese', parent: 'style', keywords: ['新中式', '中式', '东方'] },
    { label: '现代风格', value: 'modern', parent: 'style', keywords: ['现代', '极简', '奶油', '侘寂', '原木', '简约'] },
    { label: '经典欧式', value: 'classic_european', parent: 'style', keywords: ['欧式', '法式', '复古', '古典'] },
    { label: '地域特色', value: 'regional', parent: 'style', keywords: ['地域', '在地', '地方', '本土', '民俗', '文化特色'] },
  ],
  inspiration: [
    { label: '乡建趋势', value: 'rural_trend', parent: 'inspiration', keywords: ['乡建', '趋势', '乡村振兴', '乡村建设'] },
    { label: '生活方式', value: 'lifestyle', parent: 'inspiration', keywords: ['生活方式', '适老', '养老', '长者', '老年', '无障碍', '儿童', '亲子', '成长', '陪伴', '家庭互动'] },
    { label: '地域文化', value: 'regional_culture', parent: 'inspiration', keywords: ['地域文化', '文化', '非遗', '在地'] },
    { label: '功能创新', value: 'function_innovation', parent: 'inspiration', keywords: ['功能创新', '创新', '收纳', '模块', '多功能'] },
    { label: '案例精选', value: 'selected_cases', parent: 'inspiration', keywords: ['案例', '精选', '合集', '样板', '实景'] },
  ],
};

function normalizeMainTabs(list: any): MainTabItem[] {
  const normalized = (Array.isArray(list) ? list : [])
    .map((item) => ({
      label: String(item?.label || '').trim(),
      value: String(item?.value || '').trim(),
    }))
    .filter((item) => item.label && item.value);

  const result = normalized.length ? normalized : TEMPLATE_MAIN_TABS.slice();
  const hasAIToolsTab = result.some((item) => item.value === AI_TOOLS_MAIN_TAB.value);

  if (!hasAIToolsTab) {
    const inspirationIndex = result.findIndex((item) => item.value === 'inspiration');
    if (inspirationIndex >= 0) {
      result.splice(inspirationIndex + 1, 0, AI_TOOLS_MAIN_TAB);
    } else {
      result.push(AI_TOOLS_MAIN_TAB);
    }
  }

  return result;
}

function normalizeSubTabs(list: any, mainTabs: MainTabItem[]): SubTabItem[] {
  const mainValues = new Set(mainTabs.map((item) => item.value));
  const normalized = (Array.isArray(list) ? list : [])
    .map((item) => ({
      label: String(item?.label || '').trim(),
      value: String(item?.value || '').trim(),
      parent: String(item?.parent || '').trim(),
    }))
    .filter((item) => item.label && item.value && item.parent && mainValues.has(item.parent));
  if (normalized.length) {
    return normalized;
  }
  return Object.values(TEMPLATE_SUB_TAB_MAP).flat();
}

function truncate(str: string, maxLen: number): string {
  if (!str || typeof str !== 'string') return '';
  const cleanText = str.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= maxLen) return cleanText;

  return `${cleanText.slice(0, maxLen)}...`;
}

function inferStyleTag(name: string, fallback: string): string {
  if (name.includes('闽')) return '新闽派';
  if (name.includes('欧')) return '欧式';
  if (name.includes('中式')) return '新中式';
  if (name.includes('现代')) return '现代';
  return fallback;
}

function cleanDescription(description: string): string {
  return String(description || '')
    .replace(/提示词[:：][\s\S]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeImageUrl(url: string): string {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) {
    return resolveAssetPath('/assets/images/home.jpg');
  }
  if (/^https?:\/\//i.test(cleanUrl)) {
    return cleanUrl;
  }
  if (cleanUrl.startsWith('//')) {
    return `https:${cleanUrl}`;
  }
  if (cleanUrl.startsWith('/')) {
    return `${API_BASE_URL}${cleanUrl}`;
  }
  return `${API_BASE_URL}/${cleanUrl}`;
}

function requestListApi<T>(path: string, data?: Record<string, unknown>): Promise<ApiListResponseData<T> | null> {
  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: 'GET',
      data,
      success: (res) => {
        const response = (res.data || {}) as { code?: number; data?: ApiListResponseData<T> };
        if (res.statusCode !== 200 || !res.data || response.code !== 0) {
          resolve(null);
          return;
        }
        resolve(response.data || {});
      },
      fail: () => {
        resolve(null);
      },
    });
  });
}

function requestTabConfig(parent?: string): Promise<{ main_tabs?: MainTabItem[]; sub_tabs?: SubTabItem[] } | null> {
  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE_URL}/api/v1/miniprogram/templates/tab-config`,
      method: 'GET',
      data: parent ? { parent } : undefined,
      success: (res) => {
        const response = (res.data || {}) as { code?: number; data?: { main_tabs?: MainTabItem[]; sub_tabs?: SubTabItem[] } };
        if (res.statusCode !== 200 || !res.data || response.code !== 0) {
          resolve(null);
          return;
        }
        resolve(response.data || {});
      },
      fail: () => {
        resolve(null);
      },
    });
  });
}

function getSubTabsByMainTab(mainTabValue: MainTabValue, allSubTabs?: SubTabItem[]): SubTabItem[] {
  const currentParent = String(mainTabValue || '').trim();
  if (Array.isArray(allSubTabs) && allSubTabs.length > 0) {
    const matched = allSubTabs.filter((item) => String(item.parent || '').trim() === currentParent);
    if (matched.length) {
      return matched;
    }
  }
  return TEMPLATE_SUB_TAB_MAP[currentParent] || [];
}

function getTemplateFilterText(item: TemplateApiListItem): string {
  return [
    String(item?.name || ''),
    String(item?.category || ''),
    String(item?.sub_tab || ''),
    String(item?.main_tab || ''),
    cleanDescription(String(item?.description || '')),
  ].join(' ').toLowerCase();
}

function getInspirationFilterText(item: InspirationApiListItem): string {
  const tags = Array.isArray(item?.tags) ? item.tags.join(' ') : '';
  return [
    String(item?.title || ''),
    cleanDescription(String(item?.description || '')),
    String(item?.scene || ''),
    String(item?.style || ''),
    String(item?.topic || ''),
    tags,
  ].join(' ').toLowerCase();
}

function matchesMainTabKeywords(text: string, mainTab: MainTabItem): boolean {
  const keywordMap: Record<string, string[]> = {
    scene: ['scene', '场景', '室内', '庭院', '花园', '改造', '商业', '设计辅助'],
    style: ['style', '风格', '闽', '中式', '现代', '欧式', '法式', '地域'],
    inspiration: ['inspiration', '灵感', '趋势', '生活方式', '文化', '创新', '案例'],
  };

  const baseKeywords = keywordMap[String(mainTab.value || '').trim()] || [];
  const dynamicKeywords = [String(mainTab.label || '').trim(), String(mainTab.value || '').trim()].filter(Boolean);
  return [...baseKeywords, ...dynamicKeywords].some((keyword) => text.includes(keyword.toLowerCase()));
}

function matchesSubTabKeywords(text: string, subTab?: SubTabItem): boolean {
  if (!subTab) {
    return true;
  }
  const keywords = (Array.isArray(subTab.keywords) ? subTab.keywords : []).concat([subTab.label, subTab.value]);
  return keywords.some((keyword) => String(keyword || '').trim() && text.includes(String(keyword).toLowerCase()));
}

function isInspirationMainTab(mainTab: MainTabItem | undefined): boolean {
  if (!mainTab) {
    return false;
  }
  const value = String(mainTab.value || '').trim().toLowerCase();
  const label = String(mainTab.label || '').trim();
  return value === 'inspiration' || label === '灵感';
}

function buildSubtitle(item: TemplateApiListItem, currentMainLabel: string, currentSubLabel: string): string {
  const category = String(item?.category || '').trim();
  const subTab = String(item?.sub_tab || '').trim();
  const description = cleanDescription(String(item?.description || ''));
  return truncate(description || subTab || category || `${currentSubLabel}${currentMainLabel}`, 20);
}

function buildTags(item: TemplateApiListItem, currentMainLabel: string, currentSubLabel: string): string[] {
  const name = String(item?.name || '').trim();
  const category = String(item?.category || '').trim();
  const subTab = String(item?.sub_tab || '').trim();
  const styleTag = inferStyleTag(name, '');
  return [currentMainLabel, currentSubLabel, styleTag, category, subTab]
    .map((tag) => truncate(String(tag || '').trim(), 6))
    .filter((tag, index, list) => Boolean(tag) && list.indexOf(tag) === index)
    .slice(0, 3);
}

function buildInspirationSubtitle(item: InspirationApiListItem, currentSubLabel: string): string {
  const scene = String(item?.scene || '').trim();
  const style = String(item?.style || '').trim();
  const description = cleanDescription(String(item?.description || ''));
  return truncate(description || scene || style || currentSubLabel || '灵感内容', 20);
}

function buildInspirationTags(item: InspirationApiListItem, currentSubLabel: string): string[] {
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  return [currentSubLabel, String(item?.scene || ''), String(item?.style || ''), ...tags]
    .map((tag) => truncate(String(tag || '').trim(), 6))
    .filter((tag, index, list) => Boolean(tag) && list.indexOf(tag) === index)
    .slice(0, 4);
}

function buildEmptyTip(mainLabel: string, subLabel = ''): string {
  const suffix = mainLabel === '灵感' ? '暂无灵感内容' : '暂无模板内容';
  return subLabel ? `${subLabel} ${suffix}` : `${mainLabel} ${suffix}`;
}

function buildSearchEmptyTip(mainLabel: string, keyword: string): string {
  return mainLabel === '灵感' ? `未找到与“${keyword}”相关的灵感` : `未找到与“${keyword}”相关的模板`;
}

function buildSummaryText(mainLabel: string, subLabel: string, keyword: string): string {
  if (keyword) {
    return `搜索“${keyword}” · ${subLabel}`;
  }
  return `${mainLabel} · ${subLabel}`;
}

function buildTemplateCard(item: TemplateApiListItem, currentMainLabel: string, currentSubLabel: string, index: number): TemplateListItem {
  const title = String(item?.name || `模板方案 ${index + 1}`);
  const id = Number(item?.id) || index + 1;
  return {
    id,
    image: normalizeImageUrl(String(item?.thumbnail || item?.preview_url || '')),
    displayTitle: truncate(title, 14),
    displaySubtitle: buildSubtitle(item, currentMainLabel, currentSubLabel),
    tags: buildTags(item, currentMainLabel, currentSubLabel),
    targetType: 'template',
    cardKey: `template-${id}-${index}`,
  };
}

function buildInspirationCard(item: InspirationApiListItem, currentSubLabel: string, index: number): TemplateListItem {
  const id = Number(item?.id) || index + 1;
  return {
    id,
    image: normalizeImageUrl(String(item?.cover_image || item?.images?.[0] || '')),
    displayTitle: truncate(String(item?.title || `灵感内容 ${index + 1}`), 14),
    displaySubtitle: buildInspirationSubtitle(item, currentSubLabel),
    tags: buildInspirationTags(item, currentSubLabel),
    targetType: 'inspiration',
    cardKey: `inspiration-${id}-${index}`,
  };
}

function buildLocalFallbackCards(mainLabel: string, subLabel: string, targetType: 'template' | 'inspiration'): TemplateListItem[] {
  return [`${subLabel}参考一`, `${subLabel}参考二`, `${subLabel}精选一`, `${subLabel}精选二`].map((title, index) => ({
    id: -(index + 1),
    image: resolveAssetPath('/assets/images/home.jpg'),
    displayTitle: title,
    displaySubtitle: `${mainLabel}演示卡片`,
    tags: [mainLabel, subLabel, '演示'],
    targetType,
    localDemo: true,
    cardKey: `local-${targetType}-${index}`,
  }));
}

function paginateTemplateItems(items: TemplateApiListItem[], page: number, pageSize: number): TemplateApiListItem[] {
  const start = Math.max(page - 1, 0) * pageSize;
  return items.slice(start, start + pageSize);
}

async function requestTemplateListByMainTab(mainTab: MainTabItem, subTab: SubTabItem | undefined, keyword: string, page: number, pageSize: number): Promise<{ list: TemplateApiListItem[]; hasMore: boolean } | null> {
  if (keyword) {
    const result = await requestListApi<TemplateApiListItem>('/api/v1/miniprogram/templates/search', {
      keyword,
      page,
      page_size: pageSize,
    });
    if (!result) {
      return null;
    }
    const list = (Array.isArray(result.list) ? result.list : []).filter((item: TemplateApiListItem) => {
      const text = getTemplateFilterText(item);
      return matchesMainTabKeywords(text, mainTab) && matchesSubTabKeywords(text, subTab);
    });
    return {
      list,
      hasMore: list.length >= pageSize,
    };
  }

  const preciseResult = await requestListApi<TemplateApiListItem>('/api/v1/miniprogram/templates', {
    main_tab: mainTab.value,
    sub_tab: subTab?.value || undefined,
    page,
    page_size: pageSize,
  });

  const preciseList = Array.isArray(preciseResult?.list) ? preciseResult.list : [];
  if (preciseResult && preciseList.length > 0) {
    return {
      list: preciseList,
      hasMore: Number(preciseResult.total || 0) > page * pageSize || preciseList.length >= pageSize,
    };
  }

  const fallbackResult = await requestListApi<TemplateApiListItem>('/api/v1/miniprogram/templates', {
    page: 1,
    page_size: Math.max(pageSize * 5, 60),
  });
  if (!fallbackResult) {
    return null;
  }
  const filteredList = (Array.isArray(fallbackResult.list) ? fallbackResult.list : []).filter((item: TemplateApiListItem) => {
    const text = getTemplateFilterText(item);
    return matchesMainTabKeywords(text, mainTab) && matchesSubTabKeywords(text, subTab);
  });
  const pagedList = paginateTemplateItems(filteredList, page, pageSize);
  return {
    list: pagedList,
    hasMore: filteredList.length > page * pageSize,
  };
}

async function requestInspirationListBySubTab(keyword: string, page: number, pageSize: number, subTab?: SubTabItem): Promise<{ list: InspirationApiListItem[]; hasMore: boolean } | null> {
  const result = await requestListApi<InspirationApiListItem>('/api/v1/miniprogram/inspirations', {
    keyword,
    page,
    page_size: pageSize,
  });
  if (!result) {
    return null;
  }
  const list = (Array.isArray(result.list) ? result.list : []).filter((item: InspirationApiListItem) => matchesSubTabKeywords(getInspirationFilterText(item), subTab));
  return {
    list,
    hasMore: Number(result.total || 0) > page * pageSize || list.length >= pageSize,
  };
}

function splitWaterfallColumns(cards: TemplateListItem[]) {
  const leftColumnCards: TemplateListItem[] = [];
  const rightColumnCards: TemplateListItem[] = [];
  let leftWeight = 0;
  let rightWeight = 0;

  cards.forEach((item, index) => {
    const weight = 18 + item.displayTitle.length * 1.6 + item.displaySubtitle.length * 0.8 + item.tags.length * 4 + (index % 3) * 8;
    if (leftWeight <= rightWeight) {
      leftColumnCards.push(item);
      leftWeight += weight;

      return;
    }
    rightColumnCards.push(item);
    rightWeight += weight;
  });

  return {
    leftColumnCards,
    rightColumnCards,
  };
}

function getNavLayout() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    const menuRect = typeof wx.getMenuButtonBoundingClientRect === 'function' ? wx.getMenuButtonBoundingClientRect() : null;
    const safeTop = Number(systemInfo.statusBarHeight || systemInfo.safeArea?.top || 0);

    if (menuRect) {
      return {
        navSafeTop: safeTop,
        navBarHeight: Number(menuRect.bottom + menuRect.top - safeTop),
        navContentHeight: Number(menuRect.height),
        navSideWidth: Number(systemInfo.windowWidth - menuRect.left),
      };
    }

    return {
      navSafeTop: 20,
      navBarHeight: 64,
      navContentHeight: 44,
      navSideWidth: 96,
    };
  } catch (error) {
    return {
      navSafeTop: 20,
      navBarHeight: 64,
      navContentHeight: 44,
      navSideWidth: 96,
    };
  }
}

function buildTemplateCacheKey(mainTabValue: string, subTabValue: string, keyword: string) {
  return [String(mainTabValue || '').trim(), String(subTabValue || '').trim(), String(keyword || '').trim().toLowerCase()].join('::');
}

Page({
  templateFirstPageCache: {} as Record<string, { cards: TemplateListItem[]; hasMore: boolean; nextPage: number }>,
  requestSerial: 0,

  data: {
    navSafeTop: 0,
    navBarHeight: 96,
    navContentHeight: 44,
    navSideWidth: 88,
    mainTabs: TEMPLATE_MAIN_TABS,
    allSubTabs: Object.values(TEMPLATE_SUB_TAB_MAP).flat() as SubTabItem[],
    subTabs: getSubTabsByMainTab('scene', Object.values(TEMPLATE_SUB_TAB_MAP).flat()),
    currentMainTabIndex: 0,
    currentSubTabIndex: 0,
    searchInputValue: '',
    searchKeyword: '',
    resultSummaryText: buildSummaryText('场景', '乡墅外观', ''),
    displayCards: [] as TemplateListItem[],
    leftColumnCards: [] as TemplateListItem[],
    rightColumnCards: [] as TemplateListItem[],
    skeletonCards: [0, 1, 2, 3],
    loading: false,
    page: 1,
    pageSize: 12,
    hasMore: true,
    emptyTipText: buildEmptyTip('场景', '乡墅外观'),
  },

  syncTabBar() {
    const tabBar = typeof (this as any).getTabBar === 'function' ? (this as any).getTabBar() : null
    if (tabBar && typeof tabBar.setCurrent === 'function') {
      tabBar.setCurrent(1)
    }
  },

  onLoad() {
    this.setData(getNavLayout());
    this.initializePage();
  },

  onShow() {
    this.syncTabBar()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadTemplates(false);
    }
  },

  onShareAppMessage() {
    return {
      title: '模板广场',
      path: '/pages/template/template',
    };
  },

  getCurrentMainTab(): MainTabItem {
    return this.data.mainTabs[this.data.currentMainTabIndex] || this.data.mainTabs[0];
  },

  getCurrentSubTab(): SubTabItem | undefined {
    return this.data.subTabs[this.data.currentSubTabIndex] || this.data.subTabs[0];
  },

  syncWaterfallCards(cards: TemplateListItem[]) {
    const { leftColumnCards, rightColumnCards } = splitWaterfallColumns(cards);
    this.setData({
      displayCards: cards,
      leftColumnCards,
      rightColumnCards,
    });
  },

  async initializePage() {
    const tabConfig = await requestTabConfig();
    const mainTabs = normalizeMainTabs(tabConfig?.main_tabs);
    const allSubTabs = normalizeSubTabs(tabConfig?.sub_tabs, mainTabs);
    const firstMain = mainTabs[0] || TEMPLATE_MAIN_TABS[0];
    const subTabs = getSubTabsByMainTab(firstMain?.value || 'scene', allSubTabs);
    const firstSub = subTabs[0];
    this.setData({
      mainTabs,
      allSubTabs,
      subTabs,
      currentMainTabIndex: 0,
      currentSubTabIndex: 0,
      resultSummaryText: buildSummaryText(firstMain?.label || '模板广场', firstSub?.label || firstMain?.label || '模板广场', ''),
      emptyTipText: buildEmptyTip(firstMain?.label || '模板广场', firstSub?.label || ''),
    });
    await this.loadTemplates(true);
  },

  async onMainTabTap(e: IndexTapEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const tab = this.data.mainTabs[index];
    if (Number.isNaN(index) || index === this.data.currentMainTabIndex || !tab) {
      return;
    }

    if (tab.value === AI_TOOLS_MAIN_TAB.value) {
      wx.navigateTo({
        url: '/pages/aitools/aitools',
        fail: () => {
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none',
          });
        },
      });
      return;
    }

    const nextSubTabs = getSubTabsByMainTab(tab.value, this.data.allSubTabs || []);
    const nextSubTab = nextSubTabs[0];

    this.setData({
      currentMainTabIndex: index,
      subTabs: nextSubTabs,
      currentSubTabIndex: 0,
      page: 1,
      hasMore: true,
      resultSummaryText: buildSummaryText(tab.label, nextSubTab?.label || tab.label, this.data.searchKeyword),
      emptyTipText: buildEmptyTip(tab.label, nextSubTab?.label || ''),
    });

    this.loadTemplates(true);
  },

  async onSubTabTap(e: IndexTapEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const subTab = this.data.subTabs[index];
    const currentMainTab = this.getCurrentMainTab();
    if (Number.isNaN(index) || index === this.data.currentSubTabIndex || !subTab) {
      return;
    }

    this.setData({
      currentSubTabIndex: index,
      page: 1,
      hasMore: true,
      resultSummaryText: buildSummaryText(currentMainTab.label, subTab.label, this.data.searchKeyword),
      emptyTipText: buildEmptyTip(currentMainTab.label, subTab.label),
    });

    this.loadTemplates(true);
  },

  onSearchInput(e: InputEvent) {
    this.setData({
      searchInputValue: String(e.detail.value || ''),
    });
  },

  onSearchConfirm() {
    const keyword = String(this.data.searchInputValue || '').trim();
    const currentMainTab = this.getCurrentMainTab();
    const currentSubTab = this.getCurrentSubTab();

    this.setData({
      searchKeyword: keyword,
      page: 1,
      hasMore: true,
      resultSummaryText: buildSummaryText(currentMainTab.label, currentSubTab?.label || currentMainTab.label, keyword),
      emptyTipText: keyword ? buildSearchEmptyTip(currentMainTab.label, keyword) : buildEmptyTip(currentMainTab.label, currentSubTab?.label || ''),
    });

    this.loadTemplates(true);
  },

  onSearchClear() {
    const currentMainTab = this.getCurrentMainTab();
    const currentSubTab = this.getCurrentSubTab();
    if (!this.data.searchKeyword && !this.data.searchInputValue) {
      return;
    }

    this.setData({
      searchInputValue: '',
      searchKeyword: '',
      page: 1,
      hasMore: true,
      resultSummaryText: buildSummaryText(currentMainTab.label, currentSubTab?.label || currentMainTab.label, ''),
      emptyTipText: buildEmptyTip(currentMainTab.label, currentSubTab?.label || ''),
    });

    this.loadTemplates(true);
  },

  async loadTemplates(reset: boolean) {
    if (this.data.loading) {
      return;
    }

    const currentMainTab = this.getCurrentMainTab();
    const currentSubTab = this.getCurrentSubTab();
    const currentMainLabel = currentMainTab.label;
    const currentSubLabel = currentSubTab?.label || currentMainLabel;
    const keyword = String(this.data.searchKeyword || '').trim();
    const requestPage = reset ? 1 : this.data.page;
    const currentCacheKey = buildTemplateCacheKey(currentMainTab?.value || '', currentSubTab?.value || '', keyword);
    const requestSerial = ++this.requestSerial;

    if (reset) {
      const cachedEntry = this.templateFirstPageCache[currentCacheKey];
      if (cachedEntry && Array.isArray(cachedEntry.cards) && cachedEntry.cards.length > 0) {
        this.syncWaterfallCards(cachedEntry.cards);
        this.setData({
          loading: false,
          page: cachedEntry.nextPage,
          hasMore: cachedEntry.hasMore,
          resultSummaryText: buildSummaryText(currentMainLabel, currentSubLabel, keyword),
          emptyTipText: keyword ? buildSearchEmptyTip(currentMainLabel, keyword) : buildEmptyTip(currentMainLabel, currentSubLabel),
        });
        return;
      }
    }

    this.setData({
      loading: true,
      resultSummaryText: buildSummaryText(currentMainLabel, currentSubLabel, keyword),
      emptyTipText: keyword ? buildSearchEmptyTip(currentMainLabel, keyword) : buildEmptyTip(currentMainLabel, currentSubLabel),
    });

    let mappedList: TemplateListItem[] = [];
    let nextHasMore = false;

    if (isInspirationMainTab(currentMainTab)) {
      const templateResult = await requestTemplateListByMainTab(currentMainTab, currentSubTab, keyword, requestPage, this.data.pageSize);

      if (templateResult && templateResult.list.length > 0) {
        const filteredList = templateResult.list.filter((item: TemplateApiListItem) => matchesSubTabKeywords(getTemplateFilterText(item), currentSubTab));
        mappedList = filteredList.map((item: TemplateApiListItem, index: number) => buildTemplateCard(item, currentMainLabel, currentSubLabel, index));
        nextHasMore = templateResult.hasMore;
      } else {
        const inspirationResult = await requestInspirationListBySubTab(keyword, requestPage, this.data.pageSize, currentSubTab);
        if (!templateResult && !inspirationResult) {
          const localFallbackCards = buildLocalFallbackCards(currentMainLabel, currentSubLabel, 'template');
          this.syncWaterfallCards(reset ? localFallbackCards : [...this.data.displayCards, ...localFallbackCards]);
          this.setData({
            loading: false,
            hasMore: false,
            resultSummaryText: '模板或灵感接口暂时不可用，当前先展示本地演示数据',
          });
          return;
        }

        if (inspirationResult && inspirationResult.list.length > 0) {
          mappedList = inspirationResult.list.map((item: InspirationApiListItem, index: number) => buildInspirationCard(item, currentSubLabel, index));
          nextHasMore = inspirationResult.hasMore;
        } else {
          mappedList = [];
          nextHasMore = false;
        }
      }
    } else {
      const result = await requestTemplateListByMainTab(currentMainTab, currentSubTab, keyword, requestPage, this.data.pageSize);
      if (!result) {
        const localFallbackCards = buildLocalFallbackCards(currentMainLabel, currentSubLabel, 'template');
        this.syncWaterfallCards(reset ? localFallbackCards : [...this.data.displayCards, ...localFallbackCards]);
        this.setData({
          loading: false,
          hasMore: false,
          resultSummaryText: '模板接口暂时不可用，当前先展示本地演示数据',
        });
        return;
      }

      const filteredList = result.list.filter((item: TemplateApiListItem) => matchesSubTabKeywords(getTemplateFilterText(item), currentSubTab));
      mappedList = filteredList.map((item: TemplateApiListItem, index: number) => buildTemplateCard(item, currentMainLabel, currentSubLabel, index));
      nextHasMore = result.hasMore;
    }

    if (requestSerial !== this.requestSerial) {
      return;
    }

    const nextCards = reset ? mappedList : [...this.data.displayCards, ...mappedList];
    this.syncWaterfallCards(nextCards);

    if (reset) {
      this.templateFirstPageCache[currentCacheKey] = {
        cards: nextCards,
        hasMore: nextHasMore,
        nextPage: requestPage + 1,
      };
    }

    this.setData({
      loading: false,
      page: requestPage + 1,
      hasMore: nextHasMore,
      resultSummaryText: buildSummaryText(currentMainLabel, currentSubLabel, keyword),
      emptyTipText: keyword ? buildSearchEmptyTip(currentMainLabel, keyword) : buildEmptyTip(currentMainLabel, currentSubLabel),
    });
  },

  onCardTap(e: CardTapEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const targetType = String(e.currentTarget.dataset.targetType || 'template');
    const localDemo = e.currentTarget.dataset.localDemo === true || e.currentTarget.dataset.localDemo === 'true';

    if (localDemo) {
      wx.showToast({
        title: '当前为本地演示卡片，请等待模板接口恢复',
        icon: 'none',
      });
      return;
    }

    const detailUrl = targetType === 'inspiration'
      ? `/pages/inspirationdetail/inspirationdetail?id=${id}`
      : `/pages/templatesquaredetails/templatesquaredetails?id=${id}`;

    wx.navigateTo({
      url: detailUrl,
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  onTabSwitch() {},
})