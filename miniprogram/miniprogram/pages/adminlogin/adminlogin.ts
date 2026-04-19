const ADMIN_LOGIN_URL = 'http://162.14.210.252:5173/login';

Page({
  data: {
    loginUrl: ADMIN_LOGIN_URL,
    supportsDirectWebview: /^https:\/\//i.test(ADMIN_LOGIN_URL),
  },

  copyLoginUrl() {
    wx.setClipboardData({
      data: this.data.loginUrl,
      success: () => {
        wx.showToast({
          title: '登录地址已复制',
          icon: 'success',
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none',
        });
      },
    });
  },

  showOpenTip() {
    wx.showModal({
      title: '打开说明',
      content: this.data.supportsDirectWebview
        ? '当前地址已经满足小程序网页打开条件，可直接在当前页登录。'
        : '当前管理员登录地址是 HTTP，小程序无法直接内嵌打开。请先复制地址，再粘贴到系统浏览器中登录。若后续改成 HTTPS 域名，我可以再帮你改成页内直接登录。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onShareAppMessage() {
    return {
      title: '管理员登录',
      path: '/pages/adminlogin/adminlogin',
    };
  },
});
