"use strict";
// app.ts
const TABBAR_IMAGE_PATHS = [
    '/assets/tabbar/未选中态@2x.png',
    '/assets/tabbar/首页导航栏@2x.png',
    '/assets/tabbar/模板广场导航栏@2x.png',
    '/assets/tabbar/设计师导航栏@2x.png',
    '/assets/tabbar/我的导航栏@2x.png'
];
App({
    globalData: {},
    onLaunch(options) {
        // 展示本地存储能力
        const logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);
        // 扫码进入：scene 为邀请码；从分享链接进入：query.invite_code。登录时会读取并完成绑定
        const scene = options?.scene;
        const query = options?.query || {};
        if (scene != null && scene !== '') {
            wx.setStorageSync('pending_invite_code', String(scene));
        }
        else if (query.invite_code) {
            wx.setStorageSync('pending_invite_code', query.invite_code);
        }
        TABBAR_IMAGE_PATHS.forEach((src) => {
            wx.getImageInfo({
                src,
                fail: () => { }
            });
        });
    },
});
