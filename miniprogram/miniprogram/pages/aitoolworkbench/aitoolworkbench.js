"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parameter_1 = require("../../utils/parameter");
const deviceFingerprint_1 = require("../../utils/deviceFingerprint");
const aiError_1 = require("../../utils/aiError");
const aiTools_1 = require("../../utils/aiTools");
const aiToolApi_1 = require("../../utils/aiToolApi");
const aiToolPresentation_1 = require("../../utils/aiToolPresentation");
const API_BASE_URL = 'https://api.jiadilingguang.com';
const DEFAULT_SERVICE_TYPE = 'normal';
const DEFAULT_SERVICE = 'normal_style_change';
const DEFAULT_QUALITY = 'uhd';
const DEFAULT_CANVAS = '16:9';
const DEFAULT_DRAW_SINGLE_COST = 0;
const DEFAULT_DRAW_MULTI_COST = 0;
function normalizeUploadedImageUrl(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return '';
    }
    return text;
}
function extractFileName(filePath, fallback) {
    const normalizedPath = String(filePath || '').trim();
    if (!normalizedPath) {
        return fallback;
    }
    const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] || fallback;
}
function buildOrderedImageUrls(originalImageUrl, referenceImageUrl) {
    return [originalImageUrl, referenceImageUrl].map((item) => normalizeUploadedImageUrl(item)).filter(Boolean);
}
Page({
    data: {
        tool: null,
        categoryLabel: '',
        useMinimalPresentation: false,
        selectedReferenceId: '',
        selectedStyleId: '',
        promptText: '',
        uploadedOriginalImageUrl: '',
        uploadedOriginalImageName: '',
        uploadedReferenceImageUrl: '',
        uploadedReferenceImageName: '',
        useCustomReference: false,
        uploadingOriginal: false,
        uploadingReference: false,
        generating: false,
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
    async onLoad(options) {
        const id = String(options.id || '');
        if (!id) {
            wx.showToast({
                title: '工具信息不存在',
                icon: 'none',
            });
            return;
        }
        this.setData({ loadingTool: true });
        try {
            const tool = await (0, aiToolApi_1.fetchAIToolDetail)(id);
            this.setData({
                tool,
                categoryLabel: (0, aiTools_1.getCategoryLabel)(tool.category),
                useMinimalPresentation: (0, aiToolPresentation_1.shouldUseMinimalAIToolPresentation)(tool),
                selectedReferenceId: tool.presetReferences[0]?.id || '',
                selectedStyleId: tool.stylePresets[0]?.id || '',
            }, () => {
                this.loadAIPricing();
                this.loadStoneBalance();
            });
        }
        catch (error) {
            wx.showToast({
                title: error?.message || '工具信息不存在',
                icon: 'none',
            });
        }
        finally {
            this.setData({ loadingTool: false });
        }
    },
    onShow() {
        this.loadStoneBalance();
    },
    getToken() {
        return String(wx.getStorageSync('token') || '').trim();
    },
    ensureToken() {
        const token = this.getToken();
        if (token) {
            return token;
        }
        wx.showModal({
            title: '提示',
            content: '请先登录后再使用 AI 生图工具',
            confirmText: '去登录',
            success: (res) => {
                if (res.confirm) {
                    wx.navigateTo({ url: '/pages/login/login' });
                }
            },
        });
        return '';
    },
    buildBottomTipText(options) {
        const pricingLoaded = typeof options?.pricingLoaded === 'boolean' ? options.pricingLoaded : this.data.pricingLoaded;
        const currentUnitCost = typeof options?.currentUnitCost === 'number' ? options.currentUnitCost : Number(this.data.currentUnitCost || 0);
        const currentCost = typeof options?.currentCost === 'number' ? options.currentCost : Number(this.data.currentCost || 0);
        const balanceLoaded = typeof options?.balanceLoaded === 'boolean' ? options.balanceLoaded : this.data.balanceLoaded;
        const stoneBalance = typeof options?.stoneBalance === 'number' ? options.stoneBalance : Number(this.data.stoneBalance || 0);
        if (!pricingLoaded || currentUnitCost <= 0) {
            return '正在加载计费信息…';
        }
        if (balanceLoaded) {
            return `本次预计消耗 ${currentCost} 灵石，当前余额 ${stoneBalance} 灵石，生成数量默认 1 张。`;
        }
        return `本次预计消耗 ${currentCost} 灵石，生成数量默认 1 张。`;
    },
    getCurrentScene() {
        const customReferenceUrl = normalizeUploadedImageUrl(this.data.uploadedReferenceImageUrl);
        const selectedReference = this.data.useCustomReference ? undefined : this.getSelectedReference();
        const presetReferenceUrl = normalizeUploadedImageUrl(selectedReference?.imageUrl || '');
        const effectiveReferenceUrl = this.data.useCustomReference ? customReferenceUrl : presetReferenceUrl;
        return effectiveReferenceUrl ? 'ai_draw_multi' : 'ai_draw_single';
    },
    syncCurrentCost(callback) {
        const nextScene = this.getCurrentScene();
        const nextUnitCost = nextScene === 'ai_draw_multi' ? Number(this.data.drawMultiCost || 0) : Number(this.data.drawSingleCost || 0);
        const nextCost = nextUnitCost;
        this.setData({
            currentScene: nextScene,
            currentUnitCost: nextUnitCost,
            currentCost: nextCost,
            bottomTipText: this.buildBottomTipText({
                currentUnitCost: nextUnitCost,
                currentCost: nextCost,
            }),
        }, callback);
    },
    async loadAIPricing() {
        try {
            const res = await new Promise((resolve, reject) => {
                wx.request({
                    url: `${API_BASE_URL}/api/v1/miniprogram/ai/pricing?scenes=ai_draw_single,ai_draw_multi`,
                    method: 'GET',
                    success: (requestRes) => {
                        if (requestRes.statusCode === 200 && requestRes.data) {
                            const data = requestRes.data;
                            if (data.code === 0) {
                                resolve(data.data || {});
                            }
                            else {
                                reject(new Error(data.msg || '获取 AI 计费失败'));
                            }
                        }
                        else {
                            reject(new Error(`请求失败: ${requestRes.statusCode}`));
                        }
                    },
                    fail: reject,
                });
            });
            const prices = res?.prices || {};
            const nextSingleCost = Number(prices.ai_draw_single);
            const nextMultiCost = Number(prices.ai_draw_multi);
            this.setData({
                drawSingleCost: Number.isFinite(nextSingleCost) && nextSingleCost > 0 ? nextSingleCost : DEFAULT_DRAW_SINGLE_COST,
                drawMultiCost: Number.isFinite(nextMultiCost) && nextMultiCost > 0 ? nextMultiCost : DEFAULT_DRAW_MULTI_COST,
                pricingLoaded: Number.isFinite(nextSingleCost) && nextSingleCost > 0 && Number.isFinite(nextMultiCost) && nextMultiCost > 0,
            }, () => this.syncCurrentCost());
        }
        catch (_error) {
            this.setData({
                pricingLoaded: false,
            }, () => this.syncCurrentCost());
        }
    },
    async requestStoneBalance(token) {
        const res = await new Promise((resolve, reject) => {
            wx.request({
                url: `${API_BASE_URL}/api/v1/miniprogram/user/stones`,
                method: 'GET',
                header: {
                    token,
                    'Content-Type': 'application/json',
                },
                success: (requestRes) => {
                    if (requestRes.statusCode === 200 && requestRes.data) {
                        const data = requestRes.data;
                        if (data.code === 0) {
                            resolve(data.data || {});
                        }
                        else {
                            reject(new Error(data.msg || '获取余额失败'));
                        }
                    }
                    else {
                        reject(new Error(`请求失败: ${requestRes.statusCode}`));
                    }
                },
                fail: reject,
            });
        });
        return Number(res?.stones || 0);
    },
    async loadStoneBalance() {
        const token = this.getToken();
        if (!token) {
            this.setData({
                stoneBalance: 0,
                balanceLoaded: false,
                bottomTipText: this.buildBottomTipText({
                    stoneBalance: 0,
                    balanceLoaded: false,
                }),
            });
            return;
        }
        try {
            const stones = await this.requestStoneBalance(token);
            this.setData({
                stoneBalance: stones,
                balanceLoaded: true,
                bottomTipText: this.buildBottomTipText({
                    stoneBalance: stones,
                    balanceLoaded: true,
                }),
            });
        }
        catch (_error) {
            this.setData({
                balanceLoaded: false,
                bottomTipText: this.buildBottomTipText({
                    balanceLoaded: false,
                }),
            });
        }
    },
    async uploadImageFile(tempFilePath, token) {
        const apiPath = '/api/v1/miniprogram/ai/upload-reference-image';
        const deviceID = (0, deviceFingerprint_1.getCachedDeviceFingerprint)() || '';
        const params = (0, parameter_1.generateRequestParams)(token, '{}', apiPath, deviceID);
        const headers = (0, parameter_1.paramsToHeaders)(params);
        return new Promise((resolve, reject) => {
            wx.uploadFile({
                url: `${API_BASE_URL}${apiPath}`,
                filePath: tempFilePath,
                name: 'file',
                header: headers,
                success: (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`上传失败: ${res.statusCode}`));
                        return;
                    }
                    try {
                        const data = JSON.parse(res.data);
                        if (data.code === 0 && data.data && data.data.url) {
                            resolve(String(data.data.url));
                        }
                        else {
                            reject(new Error(data.msg || '上传失败'));
                        }
                    }
                    catch (_error) {
                        reject(new Error('解析响应失败'));
                    }
                },
                fail: reject,
            });
        });
    },
    chooseAndUploadImage(target) {
        const token = this.ensureToken();
        if (!token) {
            return;
        }
        const loadingTitle = target === 'original' ? '上传原图中...' : '上传参考图中...';
        const stateKey = target === 'original' ? 'uploadingOriginal' : 'uploadingReference';
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['camera', 'album'],
            success: async (res) => {
                const tempFiles = (res.tempFiles || []);
                const tempFilePath = String(tempFiles[0]?.tempFilePath || '');
                if (!tempFilePath) {
                    return;
                }
                this.setData({ [stateKey]: true });
                wx.showLoading({ title: loadingTitle, mask: true });
                try {
                    const uploadedUrl = await this.uploadImageFile(tempFilePath, token);
                    const uploadedName = extractFileName(tempFilePath, target === 'original' ? '原图.jpg' : '参考图.jpg');
                    if (target === 'original') {
                        this.setData({
                            uploadedOriginalImageUrl: uploadedUrl,
                            uploadedOriginalImageName: uploadedName,
                        }, () => this.syncCurrentCost());
                    }
                    else {
                        this.setData({
                            useCustomReference: true,
                            selectedReferenceId: '',
                            uploadedReferenceImageUrl: uploadedUrl,
                            uploadedReferenceImageName: uploadedName,
                        }, () => this.syncCurrentCost());
                    }
                    wx.showToast({
                        title: '上传成功',
                        icon: 'success',
                    });
                }
                catch (error) {
                    wx.showToast({
                        title: error?.message || '上传失败',
                        icon: 'none',
                    });
                }
                finally {
                    wx.hideLoading();
                    this.setData({ [stateKey]: false });
                }
            },
            fail: (err) => {
                const message = String(err?.errMsg || '');
                if (message.indexOf('cancel') >= 0) {
                    return;
                }
                wx.showToast({
                    title: '选择图片失败',
                    icon: 'none',
                });
            },
        });
    },
    onSelectPresetReference(e) {
        const id = String(e.currentTarget.dataset.id || '');
        if (!id) {
            return;
        }
        this.setData({
            selectedReferenceId: id,
            useCustomReference: false,
            uploadedReferenceImageUrl: '',
            uploadedReferenceImageName: '',
        }, () => this.syncCurrentCost());
    },
    onSelectStyle(e) {
        const id = String(e.currentTarget.dataset.id || '');
        if (!id) {
            return;
        }
        this.setData({
            selectedStyleId: id,
        });
    },
    onPromptInput(e) {
        this.setData({
            promptText: String(e.detail.value || ''),
        });
    },
    onUploadOriginal() {
        this.chooseAndUploadImage('original');
    },
    onUploadCustomReference() {
        this.chooseAndUploadImage('reference');
    },
    onOriginalCardTap() {
        if (normalizeUploadedImageUrl(this.data.uploadedOriginalImageUrl)) {
            this.previewImageByUrl(this.data.uploadedOriginalImageUrl);
            return;
        }
        this.onUploadOriginal();
    },
    onCustomReferenceCardTap() {
        if (normalizeUploadedImageUrl(this.data.uploadedReferenceImageUrl)) {
            this.previewImageByUrl(this.data.uploadedReferenceImageUrl);
            return;
        }
        this.onUploadCustomReference();
    },
    onDeleteOriginal() {
        this.setData({
            uploadedOriginalImageUrl: '',
            uploadedOriginalImageName: '',
        });
    },
    onDeleteReference() {
        this.setData({
            uploadedReferenceImageUrl: '',
            uploadedReferenceImageName: '',
            useCustomReference: false,
            selectedReferenceId: this.data.tool?.presetReferences[0]?.id || '',
        }, () => this.syncCurrentCost());
    },
    onPreviewUploadedImage(e) {
        const scope = e.currentTarget.dataset.scope || 'original';
        const imageUrl = scope === 'reference' ? this.data.uploadedReferenceImageUrl : this.data.uploadedOriginalImageUrl;
        this.previewImageByUrl(imageUrl);
    },
    previewImageByUrl(imageUrl) {
        const safeUrl = normalizeUploadedImageUrl(imageUrl);
        if (!safeUrl) {
            return;
        }
        wx.previewImage({
            current: safeUrl,
            urls: [safeUrl],
            fail: () => {
                wx.showToast({
                    title: '预览失败',
                    icon: 'none',
                });
            },
        });
    },
    getSelectedReference() {
        const tool = this.data.tool;
        if (!tool) {
            return undefined;
        }
        return tool.presetReferences.find((item) => item.id === this.data.selectedReferenceId);
    },
    getSelectedStyle() {
        const tool = this.data.tool;
        if (!tool) {
            return undefined;
        }
        return tool.stylePresets.find((item) => item.id === this.data.selectedStyleId);
    },
    async onStartCreate() {
        const tool = this.data.tool;
        if (!tool || this.data.generating) {
            return;
        }
        const originalImageUrl = normalizeUploadedImageUrl(this.data.uploadedOriginalImageUrl);
        if (!originalImageUrl) {
            wx.showToast({
                title: '请先上传原图',
                icon: 'none',
            });
            return;
        }
        const token = this.ensureToken();
        if (!token) {
            return;
        }
        const selectedReference = this.data.useCustomReference ? undefined : this.getSelectedReference();
        const selectedStyle = this.getSelectedStyle();
        const customReferenceUrl = normalizeUploadedImageUrl(this.data.uploadedReferenceImageUrl);
        const presetReferenceUrl = normalizeUploadedImageUrl(selectedReference?.imageUrl || '');
        const effectiveReferenceUrl = this.data.useCustomReference ? customReferenceUrl : presetReferenceUrl;
        if (this.data.useCustomReference && !customReferenceUrl) {
            wx.showToast({
                title: '请先上传参考图',
                icon: 'none',
            });
            return;
        }
        if (!this.data.useCustomReference && !selectedReference) {
            wx.showToast({
                title: '请选择参考图',
                icon: 'none',
            });
            return;
        }
        if (!this.data.pricingLoaded || this.data.currentUnitCost <= 0 || this.data.currentCost <= 0) {
            wx.showToast({
                title: '计费信息加载中，请稍后再试',
                icon: 'none',
            });
            this.loadAIPricing();
            return;
        }
        try {
            const stones = await this.requestStoneBalance(token);
            this.setData({
                stoneBalance: stones,
                balanceLoaded: true,
            }, () => this.syncCurrentCost());
            if (stones < this.data.currentCost) {
                wx.showModal({
                    title: '余额不足',
                    content: `当前余额：${stones}灵石，需要：${this.data.currentCost}灵石`,
                    confirmText: '去充值',
                    success: (res) => {
                        if (res.confirm) {
                            wx.navigateTo({ url: '/pages/topupcenter/topupcenter' });
                        }
                    },
                });
                return;
            }
        }
        catch (_error) {
            wx.showToast({
                title: '检查余额失败',
                icon: 'none',
            });
            return;
        }
        const orderedImageUrls = buildOrderedImageUrls(originalImageUrl, effectiveReferenceUrl);
        const scene = orderedImageUrls.length > 1 ? 'ai_draw_multi' : 'ai_draw_single';
        const promptText = String(this.data.promptText || '').trim();
        const payload = {
            service_type: DEFAULT_SERVICE_TYPE,
            service: DEFAULT_SERVICE,
            quality: DEFAULT_QUALITY,
            canvas: DEFAULT_CANVAS,
            generate_count: 1,
            tool_id: Number(tool.id),
            user_prompt: promptText,
            reference_selection_type: this.data.useCustomReference ? 'custom_upload' : 'preset',
            reference_preset_id: selectedReference?.id || '',
            style_preset_id: selectedStyle?.id || '',
            original_image_url: originalImageUrl,
            original_image_urls: [originalImageUrl],
            ordered_image_urls: orderedImageUrls,
        };
        if (selectedStyle?.name) {
            payload.style = selectedStyle.name;
        }
        if (orderedImageUrls[0]) {
            payload.image_url = orderedImageUrls[0];
            payload.images = orderedImageUrls;
        }
        if (effectiveReferenceUrl) {
            payload.reference_image_url = effectiveReferenceUrl;
            payload.reference_image_urls = [effectiveReferenceUrl];
        }
        const requestBody = { scene, payload };
        const apiPath = '/api/v1/miniprogram/ai/draw';
        const deviceID = (0, deviceFingerprint_1.getCachedDeviceFingerprint)() || '';
        const params = (0, parameter_1.generateRequestParams)(token, requestBody, apiPath, deviceID);
        const headers = (0, parameter_1.paramsToHeaders)(params);
        this.setData({ generating: true });
        wx.showLoading({ title: '创作中...', mask: true });
        try {
            const res = await new Promise((resolve, reject) => {
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
                            const data = requestRes.data;
                            if (data.code === 0) {
                                resolve(data.data);
                            }
                            else {
                                reject(new Error(data.msg || '生成失败'));
                            }
                        }
                        else {
                            reject(new Error(`请求失败: ${requestRes.statusCode}`));
                        }
                    },
                    fail: reject,
                });
            });
            if (!res?.task_no) {
                throw new Error('生成失败');
            }
            const taskNo = encodeURIComponent(String(res.task_no));
            const safePrompt = encodeURIComponent(promptText || tool.name);
            const safeToolId = encodeURIComponent(tool.id);
            wx.navigateTo({
                url: `/pages/generatedetails/generatedetails?task_no=${taskNo}&prompt=${safePrompt}&tool_id=${safeToolId}${effectiveReferenceUrl ? `&reference_image_url=${encodeURIComponent(effectiveReferenceUrl)}` : ''}`,
                success: (navRes) => {
                    navRes.eventChannel.emit('taskData', {
                        id: 0,
                        task_no: res.task_no,
                        scene,
                        status: 'pending',
                        requested_count: 1,
                        generated_count: 0,
                        stones_used: this.data.currentCost,
                        result: {},
                        error_message: '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        task_type: 'ai_draw',
                        prompt: promptText || tool.name,
                        user_prompt: promptText || tool.name,
                        reference_image_url: effectiveReferenceUrl,
                        reference_image_urls: effectiveReferenceUrl ? [effectiveReferenceUrl] : [],
                        original_image_urls: [originalImageUrl],
                        ordered_image_urls: orderedImageUrls,
                        tool_id: tool.id,
                        tool_name: tool.name,
                    });
                },
                fail: () => {
                    wx.showToast({
                        title: '页面跳转失败',
                        icon: 'none',
                    });
                },
            });
        }
        catch (error) {
            wx.showToast({
                title: (0, aiError_1.sanitizeAIGenerationErrorMessage)(error?.message || '生成失败'),
                icon: 'none',
                duration: 2000,
            });
        }
        finally {
            wx.hideLoading();
            this.setData({ generating: false });
            this.loadStoneBalance();
        }
    },
    onShareAppMessage() {
        const tool = this.data.tool;
        return {
            title: tool ? `${tool.name} · 开始使用` : 'AI生图工具',
            path: tool ? `/pages/aitoolworkbench/aitoolworkbench?id=${tool.id}` : '/pages/aitools/aitools',
        };
    },
});
