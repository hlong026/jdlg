// pages/login/login.ts
import {
  generateDeviceFingerprint,
  getCachedDeviceFingerprint,
  cacheDeviceFingerprint
} from '../../utils/deviceFingerprint';

// API基础地址
const API_BASE_URL = 'https://api.jiadilingguang.com'; // 根据实际情况修改
const LOGIN_PRIVACY_AGREEMENT_STORAGE_KEY = 'login_privacy_agreement';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loginType: 'wechat', // 'wechat' / 'phone' / 'password'
    username: '',
    password: '',
    phone: '',
    phoneCode: '',
    loading: false,
    phoneCodeSending: false,
    phoneCodeCountdown: 0,
    inviteCode: '', // 邀请码（从分享链接或上一页传入，注册时填写可得双方奖励）
    agreedPrivacy: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options: any) {
    // 检查是否已登录
    const token = wx.getStorageSync('token');
    const agreedPrivacy = wx.getStorageSync(LOGIN_PRIVACY_AGREEMENT_STORAGE_KEY) === true;
    const username = options.username || '';
    if (token) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/index/index',
        fail: () => {
          wx.reLaunch({
            url: '/pages/index/index',
          })
        }
      });
      return;
    }

    // 邀请码：优先从本页参数，否则从全局缓存（分享进入首页后跳转登录时带过来）
    const inviteCode = options.invite_code || wx.getStorageSync('pending_invite_code') || '';
    if (inviteCode) {
      wx.removeStorageSync('pending_invite_code');
    }
    if (options.type === 'password') {
      this.setData({
        loginType: 'password',
        username: username || this.data.username,
        inviteCode: inviteCode || this.data.inviteCode,
        agreedPrivacy,
      });
    } else {
      this.setData({
        username: username || this.data.username,
        inviteCode: inviteCode || this.data.inviteCode,
        agreedPrivacy,
      });
    }
  },

  /**
   * 切换登录方式
   */
  switchLoginType(e: any) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      loginType: type,
      username: '',
      password: '',
      phone: '',
      phoneCode: '',
    });
  },

  onPhoneInput(e: any) {
    this.setData({
      phone: String(e.detail.value || '').replace(/[^\d]/g, '').slice(0, 11),
    });
  },

  onPhoneCodeInput(e: any) {
    this.setData({
      phoneCode: String(e.detail.value || '').replace(/[^\d]/g, '').slice(0, 6),
    });
  },

  async persistLoginResult(loginResult: any) {
    const token = loginResult?.token;
    if (!token) {
      throw new Error('登录结果缺少 token');
    }
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', {
      id: loginResult.id,
      username: loginResult.username,
      token: loginResult.token,
      ...loginResult,
    });

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1000,
    });

    this.setData({ loading: false });
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index',
        fail: () => {
          wx.reLaunch({
            url: '/pages/index/index',
          })
        }
      });
    }, 1000);
  },

  /**
   * 用户名输入
   */
  onUsernameInput(e: any) {
    this.setData({
      username: e.detail.value,
    });
  },

  /**
   * 密码输入
   */
  onPasswordInput(e: any) {
    this.setData({
      password: e.detail.value,
    });
  },

  goToPasswordRecovery() {
    const username = String(this.data.username || '').trim();
    const query = username ? `?username=${encodeURIComponent(username)}` : '';
    wx.navigateTo({
      url: `/pages/passwordrecovery/passwordrecovery${query}`,
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  toggleAgreement() {
    const nextValue = !this.data.agreedPrivacy;
    this.setData({
      agreedPrivacy: nextValue,
    });
    wx.setStorageSync(LOGIN_PRIVACY_AGREEMENT_STORAGE_KEY, nextValue);
  },

  openPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy/privacy?from=login',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  ensureAgreementAccepted() {
    if (this.data.agreedPrivacy) {
      return true;
    }
    wx.showToast({
      title: '请先阅读并同意隐私政策',
      icon: 'none',
      duration: 2500,
    });
    return false;
  },

  async ensureDeviceId() {
    let deviceID = getCachedDeviceFingerprint();
    if (!deviceID) {
      try {
        deviceID = await generateDeviceFingerprint();
        if (deviceID) {
          cacheDeviceFingerprint(deviceID);
        }
      } catch (error) {
        console.error('生成设备指纹异常:', error);
      }
    }
    return deviceID || '';
  },

  /**
   * 微信登录
   */
  async handleWechatLogin() {
    if (this.data.loading) {
      return;
    }
    if (!this.ensureAgreementAccepted()) {
      return;
    }

    this.setData({ loading: true });

    try {
      // 1. 获取设备指纹（优先使用缓存的）
      let deviceID = await this.ensureDeviceId();
      if (!deviceID) {
        deviceID = 'temp_' + Date.now();
      }

      // 2. 获取微信登录code
      const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      if (!loginRes.code) {
        wx.showToast({
          title: '获取登录code失败',
          icon: 'none',
        });
        this.setData({ loading: false });
        return;
      }

      // 3. 调用后端登录API（携带邀请码时，新用户注册双方各得50灵石）
      const inviteCode = this.data.inviteCode || '';
      const loginResult = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/api/v1/miniprogram/login`,
          method: 'POST',
          data: {
            code: loginRes.code,
            device_id: deviceID,
            invite_code: inviteCode || undefined,
          },
          header: {
            'Content-Type': 'application/json',
          },
          success: (res) => {
            const data = res.data as any;
            if (res.statusCode === 200 && data.code === 0) {
              resolve(data.data || {});
            } else {
              reject(new Error(data.msg || '登录失败'));
            }
          },
          fail: (err) => {
            reject(err);
          },
        });
      });

      await this.persistLoginResult(loginResult);
    } catch (error: any) {
      console.error('登录失败:', error);

      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
        duration: 2000,
      });
      this.setData({ loading: false });
    } finally {
      // 无论成功/失败/异常，都关闭登录中模态框，避免一直旋转
      this.setData({ loading: false });
    }
  },

  /**
   * 账号密码登录
   */
  async handlePasswordLogin() {
    if (this.data.loading || !this.data.username || !this.data.password) {
      return;
    }
    if (!this.ensureAgreementAccepted()) {
      return;
    }

    this.setData({ loading: true });

    try {
      const deviceID = await this.ensureDeviceId();
      if (!deviceID) {
        throw new Error('获取设备信息失败，请稍后重试');
      }

      // 调用后端账号密码登录API
      const loginResult = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/api/v1/miniprogram/login/password`,
          method: 'POST',
          data: {
            username: this.data.username,
            password: this.data.password,
            device_id: deviceID,
          },
          header: {
            'Content-Type': 'application/json',
          },
          success: (res) => {
            const data = res.data as any;
            if (res.statusCode === 200 && data) {
              if (data.code === 0) {
                resolve(data.data);
                return;
              }
              reject(new Error(data.msg || '登录失败'));
              return;
            }
            reject(new Error(`登录请求失败: ${res.statusCode}`));
          },
          fail: (err) => {
            reject(err);
          },
        });
      });

      await this.persistLoginResult(loginResult);
    } catch (error: any) {
      console.error('登录失败:', error);
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
        duration: 2000,
      });
      this.setData({ loading: false });
    }
  },

  async handlePhoneLogin(e: any) {
    if (this.data.loading) {
      return;
    }
    if (!this.ensureAgreementAccepted()) {
      return;
    }

    const phone = String(this.data.phone || '').trim();
    const phoneCode = String(this.data.phoneCode || '').trim();
    if (phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (phoneCode.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      let deviceID = await this.ensureDeviceId();
      if (!deviceID) {
        deviceID = 'temp_' + Date.now();
      }
      const loginResult = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/api/v1/miniprogram/login/phone`,
          method: 'POST',
          data: {
            phone,
            code: phoneCode,
            device_id: deviceID,
            invite_code: this.data.inviteCode || undefined,
          },
          header: {
            'Content-Type': 'application/json',
          },
          success: (res) => {
            const data = res.data as any;
            if (res.statusCode === 200 && data.code === 0) {
              resolve(data.data || {});
              return;
            }
            reject(new Error(data.msg || '手机号登录失败'));
          },
          fail: reject,
        });
      });

      await this.persistLoginResult(loginResult);
    } catch (error: any) {
      wx.showToast({
        title: error?.message || '手机号登录失败',
        icon: 'none',
        duration: 2200,
      });
      this.setData({ loading: false });
    }
  },

  async sendPhoneCode() {
    if (this.data.phoneCodeSending || this.data.loading || this.data.phoneCodeCountdown > 0) {
      return;
    }
    if (!this.ensureAgreementAccepted()) {
      return;
    }
    const phone = String(this.data.phone || '').trim();
    if (phone.length !== 11) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }

    this.setData({ phoneCodeSending: true });
    try {
      const responseData = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/api/v1/miniprogram/login/phone/send-code`,
          method: 'POST',
          data: { phone },
          header: {
            'Content-Type': 'application/json',
          },
          success: (res) => {
            const data = res.data as any;
            if (res.statusCode === 200 && data.code === 0) {
              resolve(data);
              return;
            }
            reject(new Error(data.msg || '发送验证码失败'));
          },
          fail: reject,
        });
      });

      const mockCode = String(responseData?.data?.mock_code || '');
      if (mockCode) {
        this.setData({ phoneCode: mockCode });
      }
      wx.showToast({
        title: mockCode ? `测试验证码 ${mockCode}` : '验证码已发送',
        icon: 'success',
      });
      this.startPhoneCodeCountdown(60);
    } catch (error: any) {
      wx.showToast({
        title: error?.message || '发送验证码失败',
        icon: 'none',
      });
    } finally {
      this.setData({ phoneCodeSending: false });
    }
  },

  startPhoneCodeCountdown(seconds: number) {
    this.setData({ phoneCodeCountdown: seconds });
    const timer = setInterval(() => {
      const nextValue = Number(this.data.phoneCodeCountdown || 0) - 1;
      if (nextValue <= 0) {
        clearInterval(timer);
        this.setData({ phoneCodeCountdown: 0 });
        return;
      }
      this.setData({ phoneCodeCountdown: nextValue });
    }, 1000);
  },


  onShareAppMessage() {
    return {
      title: '甲第灵光 · 登录',
      path: '/pages/login/login',
    };
  },
});
