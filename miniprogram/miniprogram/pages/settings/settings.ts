// pages/settings/settings.ts
const SETTINGS_DARK_MODE_STORAGE_KEY = 'settings_dark_mode'

Page({
  data: {
    darkMode: false,
    cacheSize: '0MB',
    version: '1.0.0',
    phoneDisplay: '未绑定',
    passwordDisplay: '未设置',
  },

  onLoad() {
    this.initThemeSetting()
    this.initCacheSize()
    this.initAccountSummary()
  },

  onShow() {
    this.initAccountSummary()
  },

  initThemeSetting() {
    try {
      const savedDarkMode = wx.getStorageSync(SETTINGS_DARK_MODE_STORAGE_KEY)
      this.setData({ darkMode: savedDarkMode === true })
    } catch (e) {
      console.error('初始化主题设置失败:', e)
    }
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

  initAccountSummary() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {}
      const phone = String(userInfo.phone || '')
      const hasPassword = userInfo.hasPassword === true
      const phoneDisplay = phone && phone.length >= 7
        ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
        : '未绑定'
      this.setData({
        phoneDisplay,
        passwordDisplay: hasPassword ? '已设置' : '未设置',
      })
    } catch (e) {
      console.error('初始化账号安全摘要失败:', e)
    }
  },

  goToPhoneBinding() {
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
