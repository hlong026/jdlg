"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parameter_1 = require("../../utils/parameter");
const deviceFingerprint_1 = require("../../utils/deviceFingerprint");
const API_BASE_URL = 'https://api.jiadilingguang.com';
const DEFAULT_MAIN_TABS = [
    { label: '场景', value: 'scene' },
    { label: '风格', value: 'style' },
    { label: '灵感', value: 'inspiration' },
];
const DEFAULT_SUB_TABS = [
    { label: '乡墅外观', value: 'villa_exterior', parent: 'scene' },
    { label: '室内空间', value: 'interior_space', parent: 'scene' },
    { label: '花园庭院', value: 'garden_courtyard', parent: 'scene' },
    { label: '改造翻新', value: 'renovation', parent: 'scene' },
    { label: '商业空间', value: 'commercial_space', parent: 'scene' },
    { label: '设计辅助', value: 'design_assist', parent: 'scene' },
    { label: '新闽派', value: 'new_minnan', parent: 'style' },
    { label: '新中式', value: 'new_chinese', parent: 'style' },
    { label: '现代风格', value: 'modern', parent: 'style' },
    { label: '经典欧式', value: 'classic_european', parent: 'style' },
    { label: '地域特色', value: 'regional', parent: 'style' },
    { label: '乡建趋势', value: 'rural_trend', parent: 'inspiration' },
    { label: '生活方式', value: 'lifestyle', parent: 'inspiration' },
    { label: '地域文化', value: 'regional_culture', parent: 'inspiration' },
    { label: '功能创新', value: 'function_innovation', parent: 'inspiration' },
    { label: '案例精选', value: 'selected_cases', parent: 'inspiration' },
];
function normalizeMainTabs(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item) => ({
        label: String(item?.label || '').trim(),
        value: String(item?.value || '').trim(),
    }))
        .filter((item) => item.label && item.value);
}
function normalizeSubTabs(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item) => ({
        label: String(item?.label || '').trim(),
        value: String(item?.value || '').trim(),
        parent: String(item?.parent || '').trim(),
    }))
        .filter((item) => item.label && item.value && item.parent);
}
function getSubTabsByParent(subTabs, parent) {
    const currentParent = String(parent || '').trim();
    if (!currentParent) {
        return [];
    }
    return subTabs.filter((item) => item.parent === currentParent);
}
function normalizeThirdTabs(raw, subTabs) {
    const subValues = new Set(subTabs.map((item) => item.value));
    return (Array.isArray(raw) ? raw : [])
        .map((item) => ({
        label: String(item?.label || '').trim(),
        value: String(item?.value || '').trim(),
        parent: String(item?.parent || '').trim(),
    }))
        .filter((item) => item.label && item.value && item.parent && subValues.has(item.parent));
}
Page({
    data: {
        token: '',
        deviceId: '',
        saving: false,
        uploading: false,
        mainTabs: [],
        subTabs: [],
        allSubTabs: [],
        thirdTabs: [],
        allThirdTabs: [],
        mainTabIndex: -1,
        subTabIndex: -1,
        thirdTabIndex: -1,
        imageUrls: [],
        coverIndex: 0,
        form: {
            name: '',
            description: '',
            mainTab: '',
            subTab: '',
            thirdTab: '',
            publishScope: 'homepage_only',
            isFree: true,
            price: 0,
        },
    },
    async onLoad() {
        await this.initDeviceId();
        this.initToken();
        await this.loadTabConfig();
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
    initToken() {
        const token = String(wx.getStorageSync('token') || '').trim();
        this.setData({ token });
        if (!token) {
            wx.showToast({
                title: '请先登录',
                icon: 'none',
            });
        }
    },
    getAuthHeaders(apiPath, body = {}) {
        const token = this.data.token;
        if (!token) {
            return null;
        }
        const params = (0, parameter_1.generateRequestParams)(token, body, apiPath, this.data.deviceId);
        return {
            ...(0, parameter_1.paramsToHeaders)(params),
            'Content-Type': 'application/json',
        };
    },
    async loadTabConfig() {
        try {
            const result = await new Promise((resolve, reject) => {
                wx.request({
                    url: `${API_BASE_URL}/api/v1/miniprogram/templates/tab-config`,
                    method: 'GET',
                    success: (res) => {
                        const body = (res.data || {});
                        if (res.statusCode === 200 && body.code === 0) {
                            resolve(body.data || {});
                            return;
                        }
                        reject(new Error(body.msg || '加载分类失败'));
                    },
                    fail: reject,
                });
            });
            const mainTabs = normalizeMainTabs(result?.main_tabs);
            if (!mainTabs.length) {
                this.setData({
                    mainTabs: [],
                    allSubTabs: [],
                    allThirdTabs: [],
                    subTabs: [],
                    thirdTabs: [],
                    mainTabIndex: -1,
                    subTabIndex: -1,
                    thirdTabIndex: -1,
                    'form.mainTab': '',
                    'form.subTab': '',
                    'form.thirdTab': '',
                });
                return;
            }
            const allSubTabs = normalizeSubTabs(result?.sub_tabs);
            const allThirdTabs = normalizeThirdTabs(result?.third_tabs, allSubTabs);
            const firstMain = mainTabs[0];
            const subTabs = getSubTabsByParent(allSubTabs, firstMain?.value || '');
            const firstSub = subTabs[0];
            const thirdTabs = getSubTabsByParent(allThirdTabs, firstSub?.value || '');
            const firstThird = thirdTabs[0];
            this.setData({
                mainTabs,
                allSubTabs,
                allThirdTabs,
                subTabs,
                thirdTabs,
                mainTabIndex: firstMain ? 0 : -1,
                subTabIndex: firstSub ? 0 : -1,
                thirdTabIndex: firstThird ? 0 : -1,
                'form.mainTab': firstMain?.value || '',
                'form.subTab': firstSub?.value || '',
                'form.thirdTab': firstThird?.value || '',
            });
        }
        catch (error) {
            console.error('加载分类失败:', error);
            this.setData({
                mainTabs: [],
                allSubTabs: [],
                allThirdTabs: [],
                subTabs: [],
                thirdTabs: [],
                mainTabIndex: -1,
                subTabIndex: -1,
                thirdTabIndex: -1,
                'form.mainTab': '',
                'form.subTab': '',
                'form.thirdTab': '',
            });
            wx.showToast({
                title: '分类配置加载失败',
                icon: 'none',
            });
        }
    },
    onNameInput(e) {
        this.setData({
            'form.name': String(e.detail.value || ''),
        });
    },
    onDescriptionInput(e) {
        this.setData({
            'form.description': String(e.detail.value || ''),
        });
    },
    onMainTabChange(e) {
        const index = Number(e.detail.value);
        const mainTabs = this.data.mainTabs || [];
        const nextMainTab = mainTabs[index];
        if (!nextMainTab) {
            return;
        }
        const subTabs = getSubTabsByParent(this.data.allSubTabs || [], nextMainTab.value);
        const firstSub = subTabs[0];
        const thirdTabs = getSubTabsByParent(this.data.allThirdTabs || [], firstSub?.value || '');
        const firstThird = thirdTabs[0];
        this.setData({
            mainTabIndex: index,
            subTabs,
            thirdTabs,
            subTabIndex: firstSub ? 0 : -1,
            thirdTabIndex: firstThird ? 0 : -1,
            'form.mainTab': nextMainTab.value,
            'form.subTab': firstSub?.value || '',
            'form.thirdTab': firstThird?.value || '',
        });
    },
    onSubTabChange(e) {
        const index = Number(e.detail.value);
        const subTabs = this.data.subTabs || [];
        const nextSubTab = subTabs[index];
        if (!nextSubTab) {
            return;
        }
        const thirdTabs = getSubTabsByParent(this.data.allThirdTabs || [], nextSubTab.value);
        const firstThird = thirdTabs[0];
        this.setData({
            subTabIndex: index,
            thirdTabs,
            thirdTabIndex: firstThird ? 0 : -1,
            'form.subTab': nextSubTab.value,
            'form.thirdTab': firstThird?.value || '',
        });
    },
    onThirdTabChange(e) {
        const index = Number(e.detail.value);
        const thirdTabs = this.data.thirdTabs || [];
        const nextThirdTab = thirdTabs[index];
        if (!nextThirdTab) {
            return;
        }
        this.setData({
            thirdTabIndex: index,
            'form.thirdTab': nextThirdTab.value,
        });
    },
    onScopeTap(e) {
        const value = String(e.currentTarget.dataset.value || 'homepage_only');
        this.setData({
            'form.publishScope': value === 'square' ? 'square' : 'homepage_only',
        });
    },
    onFreeSwitchChange(e) {
        const checked = e.detail.value === true;
        this.setData({
            'form.isFree': checked,
            'form.price': checked ? 0 : (Number(this.data.form.price) > 0 ? Number(this.data.form.price) : 1),
        });
    },
    onPriceInput(e) {
        const price = Number(e.detail.value || 0);
        this.setData({
            'form.price': Number.isFinite(price) ? price : 0,
        });
    },
    async chooseImages() {
        if (this.data.uploading) {
            return;
        }
        const remain = 9 - (this.data.imageUrls || []).length;
        if (remain <= 0) {
            wx.showToast({
                title: '最多上传9张作品图',
                icon: 'none',
            });
            return;
        }
        try {
            const result = await new Promise((resolve, reject) => {
                wx.chooseMedia({
                    count: remain,
                    mediaType: ['image'],
                    sourceType: ['album', 'camera'],
                    success: resolve,
                    fail: reject,
                });
            });
            const files = result.tempFiles || [];
            if (!files.length) {
                return;
            }
            this.setData({ uploading: true });
            wx.showLoading({ title: '上传作品图中...', mask: true });
            const uploaded = [];
            for (const file of files) {
                const filePath = String(file.tempFilePath || '').trim();
                if (!filePath) {
                    continue;
                }
                const imageUrl = await this.uploadImage(filePath);
                if (imageUrl) {
                    uploaded.push(imageUrl);
                }
            }
            this.setData({
                imageUrls: (this.data.imageUrls || []).concat(uploaded),
            });
        }
        catch (error) {
            console.error('上传作品图失败:', error);
            wx.showToast({
                title: '上传失败',
                icon: 'none',
            });
        }
        finally {
            this.setData({ uploading: false });
            wx.hideLoading();
        }
    },
    uploadImage(filePath) {
        const token = this.data.token;
        if (!token) {
            return Promise.reject(new Error('请先登录'));
        }
        const apiPath = '/api/v1/miniprogram/ai/upload-reference-image';
        const params = (0, parameter_1.generateRequestParams)(token, '{}', apiPath, this.data.deviceId);
        const headers = (0, parameter_1.paramsToHeaders)(params);
        return new Promise((resolve, reject) => {
            wx.uploadFile({
                url: `${API_BASE_URL}${apiPath}`,
                filePath,
                name: 'file',
                header: headers,
                success: (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`上传失败: ${res.statusCode}`));
                        return;
                    }
                    try {
                        const body = JSON.parse(res.data);
                        if (body.code === 0 && body.data?.url) {
                            resolve(String(body.data.url));
                            return;
                        }
                        reject(new Error(body.msg || '上传失败'));
                    }
                    catch (error) {
                        reject(new Error('上传响应解析失败'));
                    }
                },
                fail: reject,
            });
        });
    },
    onPreviewImage(e) {
        const url = String(e.currentTarget.dataset.url || '').trim();
        if (!url) {
            return;
        }
        wx.previewImage({
            current: url,
            urls: this.data.imageUrls || [url],
            showmenu: false,
        });
    },
    onSetCover(e) {
        const index = Number(e.currentTarget.dataset.index);
        if (Number.isNaN(index) || index < 0 || index >= (this.data.imageUrls || []).length) {
            return;
        }
        this.setData({
            coverIndex: index,
        });
    },
    onRemoveImage(e) {
        const index = Number(e.currentTarget.dataset.index);
        const imageUrls = [...(this.data.imageUrls || [])];
        if (Number.isNaN(index) || index < 0 || index >= imageUrls.length) {
            return;
        }
        imageUrls.splice(index, 1);
        let coverIndex = Number(this.data.coverIndex || 0);
        if (!imageUrls.length) {
            coverIndex = 0;
        }
        else if (coverIndex > index) {
            coverIndex -= 1;
        }
        else if (coverIndex >= imageUrls.length) {
            coverIndex = imageUrls.length - 1;
        }
        this.setData({
            imageUrls,
            coverIndex,
        });
    },
    async onSubmit() {
        if (this.data.saving || this.data.uploading) {
            return;
        }
        const form = this.data.form;
        const name = String(form.name || '').trim();
        const description = String(form.description || '').trim();
        const imageUrls = this.data.imageUrls || [];
        if (!name) {
            wx.showToast({
                title: '请输入作品标题',
                icon: 'none',
            });
            return;
        }
        if (!imageUrls.length) {
            wx.showToast({
                title: '请先上传作品图',
                icon: 'none',
            });
            return;
        }
        if (!String(form.mainTab || '').trim()) {
            wx.showToast({
                title: '请选择一级分类',
                icon: 'none',
            });
            return;
        }
        if ((this.data.subTabs || []).length > 0 && !String(form.subTab || '').trim()) {
            wx.showToast({
                title: '请选择二级分类',
                icon: 'none',
            });
            return;
        }
        if ((this.data.thirdTabs || []).length > 0 && !String(form.thirdTab || '').trim()) {
            wx.showToast({
                title: '请选择三级分类',
                icon: 'none',
            });
            return;
        }
        const coverUrl = imageUrls[Number(this.data.coverIndex || 0)] || imageUrls[0] || '';
        const price = form.isFree ? 0 : Math.max(1, Number(form.price || 0));
        const mappedCategory = String(form.thirdTab || form.subTab || form.mainTab || 'designer_portfolio').trim() || 'designer_portfolio';
        const apiPath = '/api/v1/miniprogram/user/designer-works';
        const body = {
            name,
            description,
            category: mappedCategory,
            main_tab: String(form.mainTab || '').trim(),
            sub_tab: String(form.subTab || '').trim(),
            third_tab: String(form.thirdTab || '').trim(),
            image_urls: imageUrls,
            cover_url: coverUrl,
            publish_scope: String(form.publishScope || 'homepage_only'),
            is_free: !!form.isFree,
            price,
        };
        const headers = this.getAuthHeaders(apiPath, body);
        if (!headers) {
            wx.showToast({
                title: '请先登录',
                icon: 'none',
            });
            return;
        }
        this.setData({ saving: true });
        wx.showLoading({ title: '提交中...', mask: true });
        try {
            const data = await new Promise((resolve, reject) => {
                wx.request({
                    url: `${API_BASE_URL}${apiPath}`,
                    method: 'POST',
                    header: headers,
                    data: body,
                    success: (res) => {
                        const response = (res.data || {});
                        if (res.statusCode === 200 && response.code === 0) {
                            resolve(response.data || {});
                            return;
                        }
                        reject(new Error(response.msg || '提交失败'));
                    },
                    fail: reject,
                });
            });
            console.log('作品提交成功:', data);
            wx.showModal({
                title: '提交成功',
                content: '作品已提交审核，审核通过后会按你选择的范围展示。',
                showCancel: false,
                success: () => {
                    wx.navigateBack();
                },
            });
        }
        catch (error) {
            wx.showToast({
                title: error?.message || '提交失败',
                icon: 'none',
            });
        }
        finally {
            this.setData({ saving: false });
            wx.hideLoading();
        }
    },
});
