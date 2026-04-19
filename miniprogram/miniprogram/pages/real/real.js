"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// pages/real/real.ts
const parameter_1 = require("../../utils/parameter");
const deviceFingerprint_1 = require("../../utils/deviceFingerprint");
const API_BASE_URL = 'https://api.jiadilingguang.com';
// 个人认证身份选项
const DESIGNER_IDENTITY_OPTIONS = ['设计师', '施工队', '其他'];
// 企业认证身份选项
const ENTERPRISE_IDENTITY_OPTIONS = ['企业主', '企业经办人', '其他'];
Page({
    data: {
        tab: 'designer',
        // 个人
        realName: '',
        idCardNo: '',
        identityTypeIndex: 0,
        identityOptions: DESIGNER_IDENTITY_OPTIONS,
        // 企业
        companyName: '',
        creditCode: '',
        legalPerson: '',
        enterpriseIdentityIndex: 0,
        enterpriseIdentityOptions: ENTERPRISE_IDENTITY_OPTIONS,
        // 其他证件（选填）
        extraDocsRemark: '',
        // 状态
        status: '',
        applicationId: 0,
        pendingOrderId: 0,
        pendingOrderNo: '',
        pendingOrderStatus: '',
        pendingAmountFen: 0,
        pendingAmountText: '',
        stage: '',
        stageSystem: '',
        stageAdmin: '',
        canContinuePay: false,
        canWithdraw: false,
        loading: false,
        feeHint: '个人认证收费 2 元，企业认证收费 5 元。提交时将调起微信支付，完成支付后进入管理员审核。',
    },
    onLoad(options) {
        const tab = (options && options.tab === 'enterprise') ? 'enterprise' : 'designer';
        const identityType = options && options.identityType ? String(options.identityType) : '';
        const identityTypeIndex = tab === 'designer' ? Math.max(DESIGNER_IDENTITY_OPTIONS.indexOf(identityType), 0) : 0;
        this.setData({
            tab,
            identityOptions: tab === 'designer' ? DESIGNER_IDENTITY_OPTIONS : ENTERPRISE_IDENTITY_OPTIONS,
            identityTypeIndex,
        });
        this.loadStatus();
    },
    onShow() {
        this.loadStatus();
    },
    switchTab(e) {
        const t = e.currentTarget.dataset.tab;
        this.setData({
            tab: t,
            identityOptions: t === 'designer' ? DESIGNER_IDENTITY_OPTIONS : ENTERPRISE_IDENTITY_OPTIONS,
        });
    },
    onRealNameInput(e) {
        this.setData({ realName: (e.detail && e.detail.value) || '' });
    },
    onIdCardNoInput(e) {
        this.setData({ idCardNo: (e.detail && e.detail.value) || '' });
    },
    onIdentityPickerChange(e) {
        this.setData({ identityTypeIndex: Number(e.detail.value) || 0 });
    },
    onCompanyNameInput(e) {
        this.setData({ companyName: (e.detail && e.detail.value) || '' });
    },
    onCreditCodeInput(e) {
        this.setData({ creditCode: (e.detail && e.detail.value) || '' });
    },
    onLegalPersonInput(e) {
        this.setData({ legalPerson: (e.detail && e.detail.value) || '' });
    },
    onEnterpriseIdentityPickerChange(e) {
        this.setData({ enterpriseIdentityIndex: Number(e.detail.value) || 0 });
    },
    onExtraDocsInput(e) {
        this.setData({ extraDocsRemark: (e.detail && e.detail.value) || '' });
    },
    loadStatus() {
        const token = wx.getStorageSync('token');
        if (!token)
            return;
        const deviceID = (0, deviceFingerprint_1.getCachedDeviceFingerprint)() || '';
        const apiPath = '/api/v1/miniprogram/certification/status';
        const params = (0, parameter_1.generateRequestParams)(token, {}, apiPath, deviceID);
        const headers = (0, parameter_1.paramsToHeaders)(params);
        wx.request({
            url: `${API_BASE_URL}${apiPath}`,
            method: 'GET',
            header: headers,
            success: (res) => {
                const d = res.data;
                if (res.statusCode === 200 && d && d.code === 0 && d.data) {
                    const pendingAmountFen = Number(d.data.pending_amount_fen || 0);
                    this.setData({
                        status: d.data.status || '',
                        applicationId: d.data.application_id || 0,
                        pendingOrderId: Number(d.data.pending_order_id || 0),
                        pendingOrderNo: d.data.pending_order_no || '',
                        pendingOrderStatus: d.data.pending_order_status || '',
                        pendingAmountFen,
                        pendingAmountText: pendingAmountFen > 0 ? (pendingAmountFen / 100).toFixed(2) : '',
                        stage: d.data.stage || '',
                        stageSystem: d.data.stage_system || '',
                        stageAdmin: d.data.stage_admin || '',
                        canContinuePay: !!d.data.can_continue_pay,
                        canWithdraw: !!d.data.can_withdraw,
                    });
                }
            },
        });
    },
    requestCertificationPayment(payment) {
        wx.requestPayment({
            timeStamp: payment.timeStamp,
            nonceStr: payment.nonceStr,
            package: payment.package,
            signType: payment.signType || 'RSA',
            paySign: payment.paySign,
            success: () => {
                this.setData({ loading: false });
                wx.showToast({ title: '支付成功，请等待审核', icon: 'success' });
                this.loadStatus();
            },
            fail: (err) => {
                this.setData({ loading: false });
                this.loadStatus();
                if (err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
                    return;
                }
                wx.showToast({ title: err.errMsg || '支付失败', icon: 'none' });
            },
        });
    },
    continuePay() {
        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }
        const { applicationId, pendingOrderId, pendingOrderNo, canContinuePay, loading } = this.data;
        if (loading) {
            return;
        }
        if (!canContinuePay && !applicationId && !pendingOrderId && !pendingOrderNo) {
            wx.showToast({ title: '暂无待支付认证订单', icon: 'none' });
            return;
        }
        this.setData({ loading: true });
        wx.login({
            success: (loginRes) => {
                const code = loginRes.code || '';
                const apiPath = '/api/v1/miniprogram/certification/continue-pay';
                const body = {
                    code,
                };
                if (pendingOrderId > 0) {
                    body.order_id = pendingOrderId;
                }
                else if (pendingOrderNo) {
                    body.order_no = pendingOrderNo;
                }
                else if (applicationId > 0) {
                    body.application_id = applicationId;
                }
                const params = (0, parameter_1.generateRequestParams)(token, body, apiPath, (0, deviceFingerprint_1.getCachedDeviceFingerprint)() || '');
                const headers = (0, parameter_1.paramsToHeaders)(params);
                headers['Content-Type'] = 'application/json';
                wx.request({
                    url: `${API_BASE_URL}${apiPath}`,
                    method: 'POST',
                    data: body,
                    header: headers,
                    success: (res) => {
                        const d = res.data;
                        if (res.statusCode !== 200 || !d || d.code !== 0 || !d.data?.payment) {
                            this.setData({ loading: false });
                            wx.showToast({ title: (d && d.msg) || '继续支付失败', icon: 'none' });
                            return;
                        }
                        const amountFen = Number(d.data.amount_fen || this.data.pendingAmountFen || 0);
                        this.setData({
                            applicationId: Number(d.data.application_id || applicationId || 0),
                            pendingOrderId: Number(d.data.order_id || pendingOrderId || 0),
                            pendingOrderNo: d.data.order_no || pendingOrderNo || '',
                            pendingAmountFen: amountFen,
                            pendingAmountText: amountFen > 0 ? (amountFen / 100).toFixed(2) : this.data.pendingAmountText,
                            canContinuePay: true,
                        });
                        this.requestCertificationPayment(d.data.payment);
                    },
                    fail: () => {
                        this.setData({ loading: false });
                        wx.showToast({ title: '网络错误', icon: 'none' });
                    },
                });
            },
            fail: () => {
                this.setData({ loading: false });
                wx.showToast({ title: '获取登录态失败', icon: 'none' });
            },
        });
    },
    submit() {
        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }
        if (this.data.status === 'pending_payment' && this.data.canContinuePay) {
            this.continuePay();
            return;
        }
        const { tab, realName, idCardNo, identityTypeIndex, identityOptions, companyName, creditCode, legalPerson, enterpriseIdentityIndex, enterpriseIdentityOptions, extraDocsRemark } = this.data;
        if (!realName || !idCardNo) {
            wx.showToast({ title: '请填写姓名和身份证号', icon: 'none' });
            return;
        }
        if (tab === 'enterprise' && (!companyName || !creditCode || !legalPerson)) {
            wx.showToast({ title: '请填写企业名称、统一社会信用代码、法人姓名', icon: 'none' });
            return;
        }
        const identityType = tab === 'designer' ? identityOptions[identityTypeIndex] : enterpriseIdentityOptions[enterpriseIdentityIndex];
        this.setData({ loading: true });
        wx.login({
            success: (loginRes) => {
                const code = loginRes.code || '';
                const body = {
                    code,
                    type: tab,
                    real_name: realName.trim(),
                    id_card_no: idCardNo.trim(),
                    identity_type: identityType,
                    extra_docs_remark: (extraDocsRemark || '').trim(),
                };
                if (tab === 'enterprise') {
                    body.company_name = companyName.trim();
                    body.credit_code = creditCode.trim();
                    body.legal_person = legalPerson.trim();
                }
                const apiPath = '/api/v1/miniprogram/certification/apply';
                const params = (0, parameter_1.generateRequestParams)(token, body, apiPath, (0, deviceFingerprint_1.getCachedDeviceFingerprint)() || '');
                const headers = (0, parameter_1.paramsToHeaders)(params);
                headers['Content-Type'] = 'application/json';
                wx.request({
                    url: `${API_BASE_URL}${apiPath}`,
                    method: 'POST',
                    data: body,
                    header: headers,
                    success: (res) => {
                        this.setData({ loading: false });
                        const d = res.data;
                        if (res.statusCode !== 200 || !d) {
                            wx.showToast({ title: (d && d.msg) || '提交失败', icon: 'none' });
                            return;
                        }
                        if (d.code !== 0) {
                            wx.showToast({ title: d.msg || '提交失败', icon: 'none' });
                            return;
                        }
                        const data = d.data || {};
                        if (data.need_payment && data.payment) {
                            const amountFen = Number(data.amount_fen || 0);
                            this.setData({
                                applicationId: Number(data.application_id || 0),
                                pendingOrderId: Number(data.order_id || 0),
                                pendingOrderNo: data.order_no || '',
                                pendingOrderStatus: 'pending',
                                pendingAmountFen: amountFen,
                                pendingAmountText: amountFen > 0 ? (amountFen / 100).toFixed(2) : '',
                                canContinuePay: true,
                            });
                            this.requestCertificationPayment(data.payment);
                        }
                        else {
                            wx.showToast({ title: d.msg || '已提交', icon: 'success' });
                            this.loadStatus();
                        }
                    },
                    fail: () => {
                        this.setData({ loading: false });
                        wx.showToast({ title: '网络错误', icon: 'none' });
                    },
                });
            },
            fail: () => {
                this.setData({ loading: false });
                wx.showToast({ title: '获取登录态失败', icon: 'none' });
            },
        });
    },
    onShareAppMessage() {
        return {
            title: '甲第灵光 · 身份认证',
            path: '/pages/Identityauthen/Identityauthen',
        };
    },
});
