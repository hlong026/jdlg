"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// pages/aicost/aicost.ts
const enterpriseWechat_1 = require("../../utils/enterpriseWechat");
const BASE_NORMAL_UNIT_PRICE = 2400;
const DISCOUNT_RATE = 0.7;
function toPositiveNumber(value) {
    const num = Number(String(value || '').trim());
    return Number.isFinite(num) && num > 0 ? num : 0;
}
function formatWan(amount) {
    return `${(amount / 10000).toFixed(1)}万`;
}
function getRoofFactor(roofType) {
    if (roofType === '平屋顶') {
        return 1;
    }
    if (roofType === '坡屋顶') {
        return 1.05;
    }
    return 1.08;
}
function getBasementFactor(basementType) {
    if (basementType === '无地下室') {
        return 1;
    }
    if (basementType === '半地下室') {
        return 1.12;
    }
    return 1.22;
}
function getDecorationFactor(decorationStyle) {
    if (decorationStyle === '简装') {
        return 1;
    }
    if (decorationStyle === '标准装修') {
        return 1.08;
    }
    return 1.16;
}
function getFacadeFactor(facadeStyle) {
    if (facadeStyle === '涂料外墙') {
        return 1;
    }
    if (facadeStyle === '真石漆') {
        return 1.08;
    }
    if (facadeStyle === '石材外墙') {
        return 1.14;
    }
    return 1.16;
}
function getHeightFactor(floorHeight) {
    if (floorHeight > 3.6) {
        return 1.08;
    }
    if (floorHeight > 3.3) {
        return 1.04;
    }
    return 1;
}
function buildCostBreakdown(total) {
    const items = [
        { name: '基础工程', ratio: 0.12, note: '土方、基础、垫层、防潮等基础施工' },
        { name: '主体结构', ratio: 0.34, note: '梁板柱、楼梯、砌体等主体工程' },
        { name: '屋面与外立面', ratio: 0.18, note: '屋顶、防水、外墙装饰及门窗基础项' },
        { name: '室内装修', ratio: 0.22, note: '墙地顶基础装修、厨卫基础配置' },
        { name: '安装及配套', ratio: 0.14, note: '水电、排水、弱电及基础配套工程' },
    ];
    return items.map((item) => ({
        ...item,
        amount: formatWan(total * item.ratio),
    }));
}
function estimateTotalCost(buildingArea, floorHeight, roofType, basementType, decorationStyle, facadeStyle) {
    const normalTotal = Math.round(buildingArea *
        BASE_NORMAL_UNIT_PRICE *
        getHeightFactor(floorHeight) *
        getRoofFactor(roofType) *
        getBasementFactor(basementType) *
        getDecorationFactor(decorationStyle) *
        getFacadeFactor(facadeStyle));
    const estimatedTotal = Math.round(normalTotal * DISCOUNT_RATE);
    return {
        normalTotal,
        estimatedTotal,
        estimatedUnit: Math.round(estimatedTotal / buildingArea),
        breakdown: buildCostBreakdown(estimatedTotal),
    };
}
Page({
    data: {
        province: '',
        city: '',
        buildingArea: '',
        floorHeight: '',
        roofType: '坡屋顶',
        basementType: '无地下室',
        decorationStyle: '标准装修',
        facadeStyle: '真石漆',
        roofOptions: ['平屋顶', '坡屋顶', '组合屋顶'],
        basementOptions: ['无地下室', '半地下室', '全地下室'],
        decorationOptions: ['简装', '标准装修', '品质装修'],
        facadeOptions: ['涂料外墙', '真石漆', '石材外墙', '铝板/金属外立面'],
        discountRate: 0.7,
        hasEstimate: false,
        showCostDetails: false,
        normalTotalCost: '',
        estimatedTotalCost: '',
        estimatedUnitCost: '',
        costBreakdown: [],
    },
    onLoad() {
    },
    onShareAppMessage() {
        return {
            title: '造价生成 · 快速估算建房价格',
            path: '/pages/aicost/aicost',
        };
    },
    onProvinceInput(e) {
        this.setData({ province: e.detail.value });
    },
    onCityInput(e) {
        this.setData({ city: e.detail.value });
    },
    onBuildingAreaInput(e) {
        this.setData({ buildingArea: e.detail.value });
    },
    onFloorHeightInput(e) {
        this.setData({ floorHeight: e.detail.value });
    },
    onSelectOption(e) {
        const field = String(e.currentTarget.dataset.field || '');
        const optionsKey = String(e.currentTarget.dataset.options || '');
        const options = this.data[optionsKey] || [];
        if (!field || !options.length) {
            return;
        }
        wx.showActionSheet({
            itemList: options,
            success: (res) => {
                this.setData({
                    [field]: options[res.tapIndex],
                });
            },
        });
    },
    onEstimateCost() {
        const buildingArea = toPositiveNumber(this.data.buildingArea);
        const floorHeight = toPositiveNumber(this.data.floorHeight);
        if (!String(this.data.province || '').trim()) {
            wx.showToast({ title: '请填写省份', icon: 'none' });
            return;
        }
        if (!String(this.data.city || '').trim()) {
            wx.showToast({ title: '请填写城市', icon: 'none' });
            return;
        }
        if (!buildingArea) {
            wx.showToast({ title: '请填写建筑面积', icon: 'none' });
            return;
        }
        if (!floorHeight) {
            wx.showToast({ title: '请填写楼层高度', icon: 'none' });
            return;
        }
        const result = estimateTotalCost(buildingArea, floorHeight, this.data.roofType, this.data.basementType, this.data.decorationStyle, this.data.facadeStyle);
        this.setData({
            hasEstimate: true,
            showCostDetails: false,
            normalTotalCost: formatWan(result.normalTotal),
            estimatedTotalCost: formatWan(result.estimatedTotal),
            estimatedUnitCost: `${result.estimatedUnit}元/㎡`,
            costBreakdown: result.breakdown,
        });
    },
    onViewCostDetails() {
        this.setData({
            showCostDetails: !this.data.showCostDetails,
        });
    },
    async onContactService() {
        const opened = await (0, enterpriseWechat_1.tryOpenCustomerServiceDirect)();
        if (opened) {
            return;
        }
        const preset = encodeURIComponent('我已完成造价生成测算，想咨询建房造价和方案落地服务。');
        wx.navigateTo({
            url: `/pages/chat/chat?mode=chat&source=aicost&title=造价咨询&preset=${preset}`,
            fail: () => {
                wx.showToast({
                    title: '联系客服入口打开失败',
                    icon: 'none',
                });
            },
        });
    },
});
