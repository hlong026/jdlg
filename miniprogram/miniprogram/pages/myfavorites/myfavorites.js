"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asset_1 = require("../../utils/asset");
const parameter_1 = require("../../utils/parameter");
const deviceFingerprint_1 = require("../../utils/deviceFingerprint");
const API_BASE_URL = 'https://api.jiadilingguang.com';
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
function buildFavoriteSearchText(item) {
    return [
        item?.title,
        item?.author,
        ...(Array.isArray(item?.tags) ? item.tags : []),
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}
Page({
    data: {
        loading: true,
        token: '',
        deviceId: '',
        pageReady: false,
        allItems: [],
        items: [],
        emptyText: '暂时还没有收藏模板',
        defaultImage: (0, asset_1.resolveAssetPath)('/assets/images/home.jpg'),
        searchInputValue: '',
        searchKeyword: '',
        page: 1,
        pageSize: 20,
        total: 0,
        hasMore: true,
        loadingMore: false,
        removingId: 0,
    },
    async onLoad() {
        this.initToken();
        await this.initDeviceId();
        this.setData({ pageReady: true });
        this.loadFavorites({ reset: true });
    },
    onShow() {
        this.initToken();
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
    getToken() {
        return String(wx.getStorageSync('token') || '').trim();
    },
    initToken() {
        this.setData({
            token: this.getToken(),
        });
    },
    async initDeviceId() {
        let deviceId = (0, deviceFingerprint_1.getCachedDeviceFingerprint)();
        if (!deviceId) {
            try {
                deviceId = await (0, deviceFingerprint_1.generateDeviceFingerprint)();
                if (deviceId) {
                    (0, deviceFingerprint_1.cacheDeviceFingerprint)(deviceId);
                }
            }
            catch (error) {
                console.error('获取设备ID失败:', error);
            }
        }
        this.setData({ deviceId: deviceId || '' });
    },
    getAuthHeaders(apiPath, body = {}) {
        const token = this.data.token || this.getToken();
        if (!token) {
            return null;
        }
        if (token !== this.data.token) {
            this.setData({ token });
        }
        const params = (0, parameter_1.generateRequestParams)(token, body, apiPath, this.data.deviceId);
        return {
            ...(0, parameter_1.paramsToHeaders)(params),
            'Content-Type': 'application/json',
        };
    },
    mapFavoriteItem(data) {
        const title = String(data.name || data.title || '未命名模板');
        const creatorInfo = (data.creator_info || {});
        const author = String(creatorInfo.name || creatorInfo.nickname || creatorInfo.username || data.creator || '官方模板');
        const tags = [data.main_tab, data.sub_tab, data.category]
            .map((item) => String(item || '').trim())
            .filter((item, index, arr) => item && arr.indexOf(item) === index)
            .slice(0, 3);
        return {
            id: Number(data.id || 0),
            title,
            author,
            image: normalizeImageUrl(String(data.thumbnail || data.preview_url || ''), this.data.defaultImage),
            tags,
            likeText: `${Number(data.like_count || 0)} 收藏`,
            useText: `${Number(data.download_count || 0)} 使用`,
            priceText: Number(data.price || 0) > 0 ? `${Number(data.price || 0)} 灵石` : '免费',
        };
    },
    applySearchFilter(keyword) {
        const normalizedKeyword = String(keyword ?? this.data.searchKeyword ?? '').trim().toLowerCase();
        const allItems = Array.isArray(this.data.allItems) ? this.data.allItems : [];
        const items = normalizedKeyword
            ? allItems.filter((item) => buildFavoriteSearchText(item).includes(normalizedKeyword))
            : allItems;
        this.setData({
            searchKeyword: normalizedKeyword,
            items,
            emptyText: normalizedKeyword
                ? `没有找到与“${String(keyword ?? this.data.searchKeyword ?? '').trim()}”相关的收藏模板`
                : '暂时还没有收藏模板',
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
    async loadFavoriteItemsByLikedIds() {
        const apiPath = '/api/v1/miniprogram/templates/liked-ids';
        const headers = this.getAuthHeaders(apiPath, {});
        if (!headers) {
            throw new Error('登录态已失效，请重新登录');
        }
        const ids = await new Promise((resolve, reject) => {
            wx.request({
                url: `${API_BASE_URL}${apiPath}`,
                method: 'GET',
                header: headers,
                success: (res) => {
                    const body = (res.data || {});
                    if (res.statusCode === 200 && body.code === 0) {
                        const rawIds = body.data?.ids;
                        resolve(Array.isArray(rawIds) ? rawIds.map((item) => Number(item || 0)).filter((item) => item > 0) : []);
                        return;
                    }
                    reject(new Error(body.msg || `请求失败: ${res.statusCode}`));
                },
                fail: reject,
            });
        });
        if (!ids.length) {
            return [];
        }
        const detailList = await Promise.all(ids.map((id) => this.loadTemplateDetail(id)));
        return detailList.filter(Boolean);
    },
    async loadTemplateDetail(id) {
        try {
            const data = await new Promise((resolve, reject) => {
                wx.request({
                    url: `${API_BASE_URL}/api/v1/miniprogram/templates/${id}`,
                    method: 'GET',
                    success: (res) => {
                        const body = (res.data || {});
                        if (res.statusCode === 200 && body.code === 0) {
                            resolve(body.data || {});
                            return;
                        }
                        reject(new Error(body.msg || `请求失败: ${res.statusCode}`));
                    },
                    fail: reject,
                });
            });
            const item = this.mapFavoriteItem({
                ...data,
                id: Number(data.id || id),
            });
            return item.id > 0 ? item : null;
        }
        catch (error) {
            console.warn('加载收藏模板详情失败:', id, error);
            return null;
        }
    },
    async loadFavorites(options = {}) {
        const token = this.data.token || this.getToken();
        const reset = options.reset !== false;
        const page = options.page || (reset ? 1 : Number(this.data.page || 1));
        const pageSize = Number(this.data.pageSize || 20);
        if (!token) {
            this.setData({
                loading: false,
                loadingMore: false,
                allItems: [],
                items: [],
                page: 1,
                total: 0,
                hasMore: false,
                emptyText: '登录后查看我的收藏',
            });
            return;
        }
        this.setData(reset ? { loading: true, hasMore: true } : { loadingMore: true });
        try {
            let items = [];
            let total = 0;
            let hasMore = false;
            try {
                const apiPath = '/api/v1/miniprogram/templates/favorites';
                const headers = this.getAuthHeaders(apiPath, {});
                if (!headers) {
                    throw new Error('登录态已失效，请重新登录');
                }
                const response = await new Promise((resolve, reject) => {
                    wx.request({
                        url: `${API_BASE_URL}${apiPath}?page=${page}&page_size=${pageSize}`,
                        method: 'GET',
                        header: headers,
                        success: (res) => {
                            const body = (res.data || {});
                            if (res.statusCode === 200 && body.code === 0) {
                                resolve(body.data || {});
                                return;
                            }
                            reject(new Error(body.msg || `请求失败: ${res.statusCode}`));
                        },
                        fail: reject,
                    });
                });
                const list = Array.isArray(response.list) ? response.list : [];
                items = list.map((data) => this.mapFavoriteItem(data)).filter((item) => item.id > 0);
                total = Number(response.total || 0);
                hasMore = page * pageSize < total;
            }
            catch (favoriteError) {
                console.warn('收藏聚合接口加载失败，回退到详情逐条加载:', favoriteError);
                items = await this.loadFavoriteItemsByLikedIds();
                total = items.length;
                hasMore = false;
            }
            const mergedItems = reset ? items : [...(Array.isArray(this.data.allItems) ? this.data.allItems : []), ...items];
            if (!items.length) {
                this.setData({
                    loading: false,
                    loadingMore: false,
                    allItems: reset ? [] : mergedItems,
                    page,
                    total,
                    hasMore: false,
                    emptyText: this.data.searchKeyword ? `没有找到与“${this.data.searchKeyword}”相关的收藏模板` : '暂时还没有收藏模板',
                }, () => this.applySearchFilter(this.data.searchInputValue || this.data.searchKeyword));
                return;
            }
            this.setData({
                loading: false,
                loadingMore: false,
                allItems: mergedItems,
                page,
                total,
                hasMore,
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
        const id = Number(e.currentTarget.dataset.id || 0);
        if (!id || this.data.removingId) {
            return;
        }
        const token = this.data.token || this.getToken();
        if (!token) {
            wx.showToast({
                title: '请先登录',
                icon: 'none',
            });
            return;
        }
        try {
            const apiPath = `/api/v1/miniprogram/templates/${id}/like`;
            const requestBody = {};
            const headers = this.getAuthHeaders(apiPath, requestBody);
            if (!headers) {
                throw new Error('登录态已失效，请重新登录');
            }
            this.setData({ removingId: id });
            await new Promise((resolve, reject) => {
                wx.request({
                    url: `${API_BASE_URL}${apiPath}`,
                    method: 'POST',
                    header: headers,
                    data: requestBody,
                    success: (res) => {
                        const body = (res.data || {});
                        if (res.statusCode === 200 && body.code === 0) {
                            resolve();
                            return;
                        }
                        reject(new Error(body.msg || `请求失败: ${res.statusCode}`));
                    },
                    fail: reject,
                });
            });
            const allItems = (Array.isArray(this.data.allItems) ? this.data.allItems : []).filter((item) => item.id !== id);
            this.setData({
                allItems,
                total: Math.max(0, Number(this.data.total || 0) - 1),
                removingId: 0,
            }, () => this.applySearchFilter(this.data.searchInputValue || this.data.searchKeyword));
            wx.showToast({
                title: '已取消收藏',
                icon: 'none',
            });
        }
        catch (error) {
            this.setData({ removingId: 0 });
            wx.showToast({
                title: error?.message || '取消收藏失败',
                icon: 'none',
            });
        }
    },
    onTemplateTap(e) {
        const id = Number(e.currentTarget.dataset.id || 0);
        if (!id) {
            return;
        }
        wx.navigateTo({
            url: `/pages/templatesquaredetails/templatesquaredetails?id=${id}`,
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
