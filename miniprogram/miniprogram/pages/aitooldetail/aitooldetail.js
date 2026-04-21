"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiTools_1 = require("../../utils/aiTools");
const aiToolApi_1 = require("../../utils/aiToolApi");
const aiToolPresentation_1 = require("../../utils/aiToolPresentation");
function buildUsageTips(tool) {
    if (!tool || tool.showUsageTips === false) {
        return [];
    }
    const content = String(tool.usageTipsContent || '').trim();
    if (!content) {
        return [];
    }
    return content
        .split(/\r?\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
}
Page({
    data: {
        tool: null,
        categoryLabel: '',
        useMinimalPresentation: false,
        highlights: [],
        usageTipsTitle: '使用提示',
        loading: false,
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
        this.setData({ loading: true });
        try {
            const tool = await (0, aiToolApi_1.fetchAIToolDetail)(id);
            const useMinimalPresentation = (0, aiToolPresentation_1.shouldUseMinimalAIToolPresentation)(tool);
            this.setData({
                tool,
                categoryLabel: (0, aiTools_1.getCategoryLabel)(tool.category),
                useMinimalPresentation,
                highlights: buildUsageTips(tool),
                usageTipsTitle: String(tool.usageTipsTitle || '使用提示'),
            });
        }
        catch (error) {
            wx.showToast({
                title: error?.message || '工具信息不存在',
                icon: 'none',
            });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    onStartUse() {
        const tool = this.data.tool;
        if (!tool) {
            return;
        }
        wx.navigateTo({
            url: `/pages/aitoolworkbench/aitoolworkbench?id=${tool.id}`,
            fail: () => {
                wx.showToast({
                    title: '页面跳转失败',
                    icon: 'none',
                });
            },
        });
    },
    onShareAppMessage() {
        const tool = this.data.tool;
        return {
            title: tool ? `${tool.name} · AI生图工具` : 'AI生图工具',
            path: tool ? `/pages/aitooldetail/aitooldetail?id=${tool.id}` : '/pages/aitools/aitools',
        };
    },
});
