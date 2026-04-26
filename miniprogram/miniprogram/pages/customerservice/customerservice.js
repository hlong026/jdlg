"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parameter_1 = require("../../utils/parameter");
const deviceFingerprint_1 = require("../../utils/deviceFingerprint");
const enterpriseWechat_1 = require("../../utils/enterpriseWechat");
const API_BASE_URL = 'https://api.jiadilingguang.com';
const welcomeActions = [
    { key: 'build', label: '近期准备建房', desc: '整理宅基地和风格需求' },
    { key: 'browse', label: '先看看案例', desc: '进入模板广场参考' },
    { key: 'fuzzy', label: '还没想清楚', desc: '先生成一套参考方案' },
];
const collectActions = [
    { key: 'generate', label: '一键生成方案', desc: '带着当前需求去出图' },
    { key: 'template', label: '看模板广场', desc: '先参考热门乡村别墅' },
    { key: 'human', label: '对接设计老师', desc: '咨询造价、施工或深化' },
];
function buildSessionNo() {
    return `cs_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
function containsHighIntent(text) {
    return /造价|报价|多少钱|预算|施工|落地|图纸|施工图|修改|优化|深化|电话|微信|设计师/.test(text);
}
function buildPromptFromText(text) {
    const cleanText = text.trim();
    if (!cleanText) {
        return '乡村自建房，三层，新闽派外观，适合福建乡村居住，布局实用，外观大气。';
    }
    return cleanText.includes('自建房') || cleanText.includes('建房')
        ? cleanText
        : `${cleanText}，自建房方案，布局实用，外观适合乡村居住。`;
}
Page({
    data: {
        sessionNo: '',
        source: 'home',
        sourceTaskNo: '',
        inputText: '',
        demandText: '',
        intentLevel: 'medium',
        messages: [],
        quickActions: welcomeActions,
        submitting: false,
    },
    onLoad(options) {
        const source = String(options?.source || 'home');
        const sourceTaskNo = String(options?.task_no || '');
        const prompt = options?.prompt ? decodeURIComponent(String(options.prompt)) : '';
        const sessionNo = buildSessionNo();
        const messages = [{
                id: `${Date.now()}_welcome`,
                role: 'ai',
                content: sourceTaskNo
                    ? '你的方案已经生成。我可以继续帮你优化户型、外观和造价思路，也可以为你对接设计老师。'
                    : '你好，我是甲第灵光 AI 建房顾问。我可以用 1 分钟帮你生成户型参考、外观效果图和初步造价思路。请问你近期有自建房或翻建计划吗？',
            }];
        this.setData({
            sessionNo,
            source,
            sourceTaskNo,
            demandText: prompt,
            messages,
            quickActions: sourceTaskNo ? collectActions : welcomeActions,
        });
        this.recordEvent('welcome_shown', { source, source_task_no: sourceTaskNo });
    },
    onInput(e) {
        this.setData({ inputText: e.detail.value });
    },
    onQuickAction(e) {
        const key = String(e.currentTarget.dataset.key || '');
        if (key === 'build') {
            this.pushUserChoice('近期准备建房');
            this.pushAIMessage('太好了，我可以先帮你整理一版专属建房方案。请直接告诉我：建几层、宅基地面宽进深、喜欢什么风格、需要几个房间。');
            this.setData({ intentLevel: 'high', quickActions: collectActions });
            this.recordEvent('intent_classified', { intent_type: 'build', intent_level: 'high' });
            return;
        }
        if (key === 'browse') {
            this.pushUserChoice('先看看案例');
            this.recordEvent('guide_template', { intent_type: 'browse' });
            wx.navigateTo({ url: '/pages/template/template?source=customer_service' });
            return;
        }
        if (key === 'fuzzy') {
            this.pushUserChoice('还没想清楚');
            this.pushAIMessage('很多业主一开始也不确定怎么建。可以先生成一套参考方案，看完布局和外观后再慢慢调整。');
            this.setData({ intentLevel: 'medium', quickActions: collectActions });
            this.recordEvent('intent_classified', { intent_type: 'fuzzy', intent_level: 'medium' });
            return;
        }
        if (key === 'generate') {
            this.goGenerate();
            return;
        }
        if (key === 'template') {
            this.recordEvent('guide_template', { from: 'collect_actions' });
            wx.navigateTo({ url: '/pages/template/template?source=customer_service' });
            return;
        }
        if (key === 'human') {
            this.handoffHuman();
        }
    },
    onSend() {
        const text = String(this.data.inputText || '').trim();
        if (!text) {
            return;
        }
        const nextDemand = [this.data.demandText, text].filter(Boolean).join('；');
        this.pushUserChoice(text);
        this.setData({
            inputText: '',
            demandText: nextDemand,
            intentLevel: containsHighIntent(text) ? 'high' : this.data.intentLevel,
            quickActions: collectActions,
        });
        this.recordEvent('requirement_collected', {
            text,
            intent_level: containsHighIntent(text) ? 'high' : this.data.intentLevel,
        });
        if (containsHighIntent(text)) {
            this.pushAIMessage('这个问题已经涉及造价、施工落地或方案深化。我建议先把你的需求整理成线索，再对接专业设计老师一对一沟通。');
            return;
        }
        this.pushAIMessage('收到。我已经帮你整理了基础需求，现在可以直接生成第一版建房方案；如果还有面宽、进深或风格，也可以继续补充。');
    },
    goGenerate() {
        const prompt = buildPromptFromText(this.data.demandText || this.data.inputText);
        this.recordEvent('generate_click', { prompt });
        wx.navigateTo({
            url: `/pages/aigenerate/aigenerate?source=customer_service&showSceneTabs=1&tab=exterior&prompt=${encodeURIComponent(prompt)}`,
            fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' }),
        });
    },
    async handoffHuman() {
        await this.createLead('handoff_human');
        this.recordEvent('human_handoff_triggered', { source_task_no: this.data.sourceTaskNo });
        const result = await (0, enterpriseWechat_1.openEnterpriseCustomerServiceChat)({
            customerServiceCorpId: enterpriseWechat_1.DEFAULT_CUSTOMER_SERVICE_CORP_ID,
            customerServiceUrl: enterpriseWechat_1.DEFAULT_CUSTOMER_SERVICE_URL,
        });
        if (!result.opened) {
            wx.showToast({ title: '已为你记录需求，可在首页联系服务商继续沟通', icon: 'none' });
        }
    },
    async createLead(reason) {
        const demandSummary = buildPromptFromText(this.data.demandText || this.data.inputText);
        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showToast({ title: '请先登录后留资', icon: 'none' });
            return;
        }
        const apiPath = '/api/v1/miniprogram/customer-service/leads';
        const body = {
            session_no: this.data.sessionNo,
            source: this.data.source,
            source_task_no: this.data.sourceTaskNo,
            demand_summary: demandSummary,
            intent_level: this.data.intentLevel,
            status: 'new',
            remark: reason,
            payload: { reason },
        };
        await this.postCustomerService(apiPath, body);
    },
    async recordEvent(eventType, payload = {}) {
        const token = wx.getStorageSync('token');
        if (!token) {
            return;
        }
        const apiPath = '/api/v1/miniprogram/customer-service/events';
        const body = {
            session_no: this.data.sessionNo,
            event_type: eventType,
            source: this.data.source,
            source_task_no: this.data.sourceTaskNo,
            intent_level: this.data.intentLevel,
            demand_summary: this.data.demandText,
            payload,
        };
        try {
            await this.postCustomerService(apiPath, body);
        }
        catch (error) {
            console.warn('记录智能客服事件失败', error);
        }
    },
    postCustomerService(apiPath, body) {
        return new Promise((resolve, reject) => {
            const token = wx.getStorageSync('token');
            const deviceID = (0, deviceFingerprint_1.getCachedDeviceFingerprint)() || '';
            const params = (0, parameter_1.generateRequestParams)(token, body, apiPath, deviceID);
            wx.request({
                url: `${API_BASE_URL}${apiPath}`,
                method: 'POST',
                header: {
                    ...(0, parameter_1.paramsToHeaders)(params),
                    'Content-Type': 'application/json',
                },
                data: body,
                success: (res) => {
                    const data = res.data || {};
                    if (res.statusCode === 200 && data.code === 0) {
                        resolve(data.data);
                        return;
                    }
                    reject(new Error(data.msg || '智能客服请求失败'));
                },
                fail: reject,
            });
        });
    },
    pushUserChoice(content) {
        this.addMessage('user', content);
    },
    pushAIMessage(content) {
        this.addMessage('ai', content);
    },
    addMessage(role, content) {
        const messages = this.data.messages.concat([{ id: `${Date.now()}_${messagesLength(this.data.messages)}`, role, content }]);
        this.setData({ messages });
    },
});
function messagesLength(messages) {
    return Array.isArray(messages) ? messages.length : 0;
}
