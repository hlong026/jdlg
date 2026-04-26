// pages/settings/settings.ts
const SETTINGS_DARK_MODE_STORAGE_KEY = 'settings_dark_mode'
const API_BASE_URL = 'https://api.jiadilingguang.com'
const USER_IDENTITY_OPTIONS = ['业主', '设计师', '施工队', '企业']

Page({
  data: {
    darkMode: false,
    cacheSize: '0MB',
    version: '1.0.0',
    identityOptions: USER_IDENTITY_OPTIONS,
    identityType: '',
    identityTypeIndex: 0,
    identitySaving: false,
  },

  onLoad() {
    this.initThemeSetting()
    this.initCacheSize()
    this.loadProfileIdentity()
  },

  onShow() {
    this.loadProfileIdentity()
  },

  initThemeSetting() {
    try {
      const savedDarkMode = wx.getStorageSync(SETTINGS_DARK_MODE_STORAGE_KEY)
      this.setData({ darkMode: savedDarkMode === true })
    } catch (e) {
      console.error('初始化主题设置失败:', e)
    }
  },

  loadProfileIdentity() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ identityType: '', identityTypeIndex: 0 })
      return
    }
    wx.request({
      url: `${API_BASE_URL}/api/v1/miniprogram/profile`,
      method: 'GET',
      header: { token },
      success: (res: any) => {
        const body = res.data || {}
        if (res.statusCode !== 200 || body.code !== 0) {
          return
        }
        const identityType = String((body.data || {}).identity_type || '')
        const index = USER_IDENTITY_OPTIONS.indexOf(identityType)
        this.setData({
          identityType,
          identityTypeIndex: index >= 0 ? index : 0,
        })
      },
    })
  },

  onIdentityPickerChange(e: any) {
    const index = Number(e.detail.value || 0)
    const identityType = USER_IDENTITY_OPTIONS[index]
    if (!identityType || this.data.identitySaving) {
      return
    }
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ identitySaving: true })
    wx.request({
      url: `${API_BASE_URL}/api/v1/miniprogram/profile/identity`,
      method: 'PUT',
      data: { identity_type: identityType },
      header: { 'Content-Type': 'application/json', token },
      success: (res: any) => {
        const body = res.data || {}
        if (res.statusCode === 200 && body.code === 0) {
          const userInfo = wx.getStorageSync('userInfo') || {}
          wx.setStorageSync('userInfo', { ...userInfo, identity_type: identityType })
          this.setData({ identityType, identityTypeIndex: index })
          wx.showToast({ title: '身份已更新', icon: 'success' })
          return
        }
        wx.showToast({ title: body.msg || '保存失败', icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ identitySaving: false })
      },
    })
  },

  initCacheSize() {
    try {
      wx.getStorageInfo({
        success: (res) => {
          const sizeKB = Number(res?.currentSize || 0)
          const sizeMB = (sizeKB / 1024).toFixed(2)
          this.setData({
            cacheSize: `${sizeMB}MB`,
          })
        },
        fail: (e) => {
          console.error('获取缓存大小失败:', e)
        },
      })
    } catch (e) {
      console.error('获取缓存大小失败:', e)
    }
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/myInformationmodification/myInformationmodification?source=settings&section=profile',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        })
      },
    })
  },

  goToPasswordSecurity() {
    wx.navigateTo({
      url: '/pages/myInformationmodification/myInformationmodification?source=settings&section=profile',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        })
      },
    })
  },

  goToPasswordRecovery() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const username = String(userInfo.username || '')
    const query = username ? `?username=${encodeURIComponent(username)}` : ''
    wx.navigateTo({
      url: `/pages/passwordrecovery/passwordrecovery${query}`,
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        })
      },
    })
  },

  onToggleDarkMode(e: any) {
    const value = e.detail.value
    this.setData({ darkMode: value })
    wx.setStorageSync(SETTINGS_DARK_MODE_STORAGE_KEY, value)
    wx.showToast({
      title: value ? '深色模式已开启' : '深色模式已关闭',
      icon: 'none',
    })
  },

  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理临时缓存吗？系统会保留登录状态、账号资料和主题设置。',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token')
          const userInfo = wx.getStorageSync('userInfo')
          const darkMode = wx.getStorageSync(SETTINGS_DARK_MODE_STORAGE_KEY)

          wx.clearStorage({
            success: () => {
              if (token) {
                wx.setStorageSync('token', token)
              }
              if (userInfo) {
                wx.setStorageSync('userInfo', userInfo)
              }
              if (darkMode !== '') {
                wx.setStorageSync(SETTINGS_DARK_MODE_STORAGE_KEY, darkMode)
              }

              wx.showToast({
                title: '缓存已清理',
                icon: 'none',
              })

              this.initCacheSize()
            },
          })
        }
      },
    })
  },

  onViewPrivacy() {
    wx.navigateTo({
      url: '/pages/privacy/privacy?from=settings',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        })
      },
    })
  },

  onViewAbout() {
    wx.showModal({
      title: '关于甲第灵光',
      content:
        '甲第灵光（福建）科技有限公司，专注于设计智能方案与AI创意工具，为设计师和业主提供高效、专业的设计体验。',
      showCancel: false,
    })
  },

  onShareAppMessage() {
    return {
      title: '账号设置',
      path: '/pages/settings/settings',
    }
  },
})
