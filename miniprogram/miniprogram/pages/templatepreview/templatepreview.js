"use strict";
// pages/templatepreview/templatepreview.ts
function base64Decode(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    if (str.length % 4 === 1) {
        throw new Error('Invalid base64 string');
    }
    let output = '';
    let bc = 0;
    let bs;
    let buffer;
    let idx = 0;
    while ((buffer = str.charCodeAt(idx++))) {
        const charIndex = chars.indexOf(String.fromCharCode(buffer));
        if (~charIndex) {
            bs = bc % 4 ? bs * 64 + charIndex : charIndex;
            if (bc++ % 4) {
                output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
            }
        }
    }
    try {
        return decodeURIComponent(escape(output));
    }
    catch {
        return output;
    }
}
Page({
    data: {
        title: '',
        description: '',
        imageUrl: '',
        userName: '',
        userAvatar: '',
        createdAt: '',
        readOnly: false,
    },
    onLoad(options) {
        const payload = options && options.data;
        const readOnly = options && (options.readonly === '1' || options.readonly === 'true');
        this.setData({
            readOnly,
        });
        if (payload) {
            try {
                const jsonStr = base64Decode(decodeURIComponent(payload));
                const data = JSON.parse(jsonStr);
                this.setData({
                    title: data.title || '',
                    description: data.description || '',
                    imageUrl: data.imageUrl || '',
                    userName: data.userName || '',
                    userAvatar: data.userAvatar || '',
                    createdAt: data.createdAt || '',
                });
            }
            catch (e) {
                console.error('预览数据解析失败:', e);
            }
        }
    },
    onBack() {
        wx.navigateBack({ delta: 1 });
    },
    onConfirm() {
        if (this.data.readOnly) {
            wx.navigateBack({ delta: 1 });
            return;
        }
        const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel();
        if (eventChannel) {
            eventChannel.emit('previewConfirm');
        }
        wx.navigateBack({ delta: 1 });
    },
    onPreviewImage() {
        const url = this.data.imageUrl;
        if (!url)
            return;
        wx.previewImage({
            urls: [url],
            current: url,
            showmenu: false,
        });
    },
    onShareAppMessage() {
        return {
            title: this.data.title || '甲第灵光 · 模板预览',
            path: '/pages/template/template',
        };
    },
});
