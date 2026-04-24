"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asset_1 = require("../../utils/asset");
const favoriteApi_1 = require("../../utils/favoriteApi");
const API_BASE_URL = 'https://api.jiadilingguang.com';
const favoriteTabs = [
    { label: '全部', value: '' },
    { label: '模板', value: 'template' },
    { label: 'AI工具', value: 'ai_tool' },
    { label: '设计师', value: 'designer' },
    { label: '灵感', value: 'inspiration' },
];
const typeLabels = {
    template: '模板',
    ai_tool: 'AI工具',
    designer: '设计师',
    inspiration: '灵感',
};
function normalizeImageUrl(url, fallback = '') {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) {
        return fallback;
    }
    if (/^(https?:\/\/|wxfile:\/\/|file:\/\/|data:)/i.test(cleanUrl)) {
        return /^https?:\/\//i.test(cleanUrl) ? (0, asset_1.normalizeCosUrl)(cleanUrl) : cleanUrl;
    }
    if (cleanUrl.startsWith('//')) {
        return (0, asset_1.normalizeCosUrl)(`https:${cleanUrl}`);
    }
    if (cleanUrl.startsWith('/')) {
        return `${API_BASE_URL}${cleanUrl}`;
    }
    return `${API_BASE_URL}/${cleanUrl}`;
}
function normalizeTextList(value) {
    return Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
        : [];
}
function buildFavoriteSearchText(item) {
    return [
        item?.title,
        item?.author,
        item?.typeLabel,
        ...(Array.isArray(item?.tags) ? item.tags : []),
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}
Page({
    data: {
        loading: true,
        pageReady: false,
        favoriteTabs,
        currentType: '',
        allItems: [],
        items: [],
        emptyText: '暂时还没有收藏内容',
        defaultImage: (0, asset_1.resolveAssetPath)('/assets/images/home.jpg'),
        searchInputValue: '',
        searchKeyword: '',
        page: 1,
        pageSize: 20,
        total: 0,
        hasMore: true,
        loadingMore: false,
        removingKey: '',
    },
    onLoad() {
        this.setData({ pageReady: true });
        this.loadFavorites({ reset: true });
    },
    onShow() {
        if (!this.data.pageReady) {
            return;
        }
        this.loadFavorites({ reset: true });
    },
    onPullDownRefresh() {
        this.loadFavorites({ reset: true }).finally(() => {
            wx.stopPullDownRefresh();
        });
    },
    onReachBottom() {
        this.loadNextPage();
    },
    mapFavoriteItem(data) {
        const targetType = String(data.target_type || 'template');
        const targetId = Number(data.target_id || data.id || 0);
        const metaTexts = normalizeTextList(data.meta);
        const typeLabel = String(data.type_label || typeLabels[targetType] || '收藏');
        return {
            id: targetId,
            targetId,
            targetType,
            key: `${targetType}:${targetId}`,
            title: String(data.title || data.name || '未命名收藏'),
            subtitle: String(data.subtitle || data.description || ''),
            author: String(data.author || data.creator || ''),
            image: normalizeImageUrl(String(data.image || data.thumbnail || data.preview_url || ''), this.data.defaultImage),
            tags: normalizeTextList(data.tags),
            metaTexts,
            typeLabel,
            badgeText: String(data.badge_text || typeLabel),
        };
    },
    applySearchFilter(keyword) {
        const rawKeyword = String(keyword ?? this.data.searchKeyword ?? '').trim();
        const normalizedKeyword = rawKeyword.toLowerCase();
        const allItems = Array.isArray(this.data.allItems) ? this.data.allItems : [];
        const items = normalizedKeyword
            ? allItems.filter((item) => buildFavoriteSearchText(item).includes(normalizedKeyword))
            : allItems;
        this.setData({
            searchKeyword: normalizedKeyword,
            items,
            emptyText: normalizedKeyword
                ? `没有找到与“${rawKeyword}”相关的收藏`
                : '暂时还没有收藏内容',
        });
    },
    onSearchInput(e) {
        this.setData({
            searchInputValue: String(e.detail?.value || ''),
        });
    },
    onSearchConfirm() {
        this.applySearchFilter(this.data.searchInputValue);
    },
    onSearchClear() {
        if (!this.data.searchInputValue && !this.data.searchKeyword) {
            return;
        }
        this.setData({
            searchInputValue: '',
        }, () => this.applySearchFilter(''));
    },
    onFavoriteTabTap(e) {
        const type = String(e.currentTarget.dataset.type || '');
        if (type === this.data.currentType) {
            return;
        }
        this.setData({
            currentType: type,
            searchInputValue: '',
            searchKeyword: '',
        }, () => this.loadFavorites({ reset: true }));
    },
    async loadFavorites(options = {}) {
        const reset = options.reset !== false;
        const page = options.page || (reset ? 1 : Number(this.data.page || 1));
        const pageSize = Number(this.data.pageSize || 20);
        this.setData(reset ? { loading: true, hasMore: true } : { loadingMore: true });
        try {
            // fetchFavorites uses /favorites?type=... so the page can filter by category.
            const response = await (0, favoriteApi_1.fetchFavorites)({
                type: this.data.currentType,
                page,
                pageSize,
            });
            const list = Array.isArray(response.list) ? response.list : [];
            const items = list.map((data) => this.mapFavoriteItem(data)).filter((item) => item.id > 0);
            const total = Number(response.total || 0);
            const mergedItems = reset ? items : [...(Array.isArray(this.data.allItems) ? this.data.allItems : []), ...items];
            this.setData({
                loading: false,
                loadingMore: false,
                allItems: mergedItems,
                page,
                total,
                hasMore: page * pageSize < total,
            }, () => this.applySearchFilter(this.data.searchInputValue || this.data.searchKeyword));
        }
        catch (error) {
            this.setData({
                loading: false,
                loadingMore: false,
                allItems: [],
                items: [],
                hasMore: false,
                emptyText: error?.message || '收藏加载失败',
            });
            wx.showToast({
                title: error?.message || '收藏加载失败',
                icon: 'none',
            });
        }
    },
    loadNextPage() {
        if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
            return;
        }
        this.loadFavorites({
            reset: false,
            page: Number(this.data.page || 1) + 1,
        });
    },
    async removeFavorite(e) {
        const targetType = String(e.currentTarget.dataset.targetType || '');
        const targetId = Number(e.currentTarget.dataset.targetId || 0);
        const removingKey = `${targetType}:${targetId}`;
        if (!targetType || !targetId || this.data.removingKey) {
            return;
        }
        try {
            this.setData({ removingKey });
            await (0, favoriteApi_1.removeFavorite)(targetType, targetId);
            const allItems = (Array.isArray(this.data.allItems) ? this.data.allItems : []).filter((item) => item.key !== removingKey);
            this.setData({
                allItems,
                total: Math.max(0, Number(this.data.total || 0) - 1),
                removingKey: '',
            }, () => this.applySearchFilter(this.data.searchInputValue || this.data.searchKeyword));
            wx.showToast({
                title: '已取消收藏',
                icon: 'none',
            });
        }
        catch (error) {
            this.setData({ removingKey: '' });
            wx.showToast({
                title: error?.message || '取消收藏失败',
                icon: 'none',
            });
        }
    },
    onFavoriteCardTap(e) {
        const targetType = String(e.currentTarget.dataset.targetType || '');
        const targetId = Number(e.currentTarget.dataset.targetId || 0);
        if (!targetType || !targetId) {
            return;
        }
        const routeMap = {
            template: `/pages/templatesquaredetails/templatesquaredetails?id=${targetId}`,
            ai_tool: `/pages/aitooldetail/aitooldetail?id=${targetId}`,
            designer: `/pages/designerhome/designerhome?userId=${targetId}`,
            inspiration: `/pages/inspirationdetail/inspirationdetail?id=${targetId}`,
        };
        wx.navigateTo({
            url: routeMap[targetType],
            fail: () => {
                wx.showToast({
                    title: '页面跳转失败',
                    icon: 'none',
                });
            },
        });
    },
    onShareAppMessage() {
        return {
            title: '我的收藏',
            path: '/pages/myfavorites/myfavorites',
        };
    },
});
