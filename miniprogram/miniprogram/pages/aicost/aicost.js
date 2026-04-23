const { generateRequestParams, paramsToHeaders } = require('../../utils/parameter');
const { getCachedDeviceFingerprint } = require('../../utils/deviceFingerprint');

const API_BASE_URL = 'https://api.jiadilingguang.com';

Page({
  data: {
    city: '',
    houseWidth: '',
    houseDepth: '',
    courtyardDeduct: '0',
    terraceDeduct: '0',
    structureType: '砖混结构',
    roofType: '坡屋顶',
    basement: '无',
    areaBuild: '',
    floors: '',
    areaGarden: '',
    submittingDoc: false,
    docTaskNo: '',
    structureOptions: ['砖混结构', '框架结构', '钢结构', '木结构'],
    roofOptions: ['坡屋顶', '平屋顶', '斜屋顶'],
    basementOptions: ['无', '一层', '二层'],
  },

  onLoad() {},

  onCityInput(e) {
    this.setData({
      city: e.detail.value,
    });
  },

  onHouseWidthInput(e) {
    this.setData({
      houseWidth: e.detail.value,
    });
  },

  onHouseDepthInput(e) {
    this.setData({
      houseDepth: e.detail.value,
    });
  },

  onCourtyardDeductInput(e) {
    this.setData({
      courtyardDeduct: e.detail.value,
    });
  },

  onTerraceDeductInput(e) {
    this.setData({
      terraceDeduct: e.detail.value,
    });
  },

  onSelectStructure() {
    const options = this.data.structureOptions;
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          structureType: options[res.tapIndex],
        });
      },
    });
  },

  onSelectRoof() {
    const options = this.data.roofOptions;
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          roofType: options[res.tapIndex],
        });
      },
    });
  },

  onSelectBasement() {
    const options = this.data.basementOptions;
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          basement: options[res.tapIndex],
        });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '造价生成',
      path: '/pages/aicost/aicost',
    };
  },

  onAreaBuildInput(e) {
    this.setData({
      areaBuild: e.detail.value,
    });
  },

  onFloorsInput(e) {
    this.setData({
      floors: e.detail.value,
    });
  },

  onAreaGardenInput(e) {
    this.setData({
      areaGarden: e.detail.value,
    });
  },

  onOpenGenerateHistory() {
    wx.navigateTo({
      url: '/pages/generatehistory/generatehistory',
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
        });
      },
    });
  },

  async onSubmitDoc() {
    const areaBuild = parseFloat(this.data.areaBuild);
    const floors = parseInt(this.data.floors, 10);

    if (!this.data.areaBuild || isNaN(areaBuild) || areaBuild <= 0) {
      wx.showToast({
        title: '请填写占地面积',
        icon: 'none',
      });
      return;
    }

    if (!this.data.floors || isNaN(floors) || floors < 1) {
      wx.showToast({
        title: '请填写层数',
        icon: 'none',
      });
      return;
    }

    const width = parseFloat(this.data.houseWidth || '0') || 0;
    const depth = parseFloat(this.data.houseDepth || '0') || 0;
    const areaGarden = parseFloat(this.data.areaGarden || '0') || 0;
    const areaCourtyard = parseFloat(this.data.courtyardDeduct || '0') || 0;
    const areaBalcony = parseFloat(this.data.terraceDeduct || '0') || 0;

    this.setData({
      submittingDoc: true,
      docTaskNo: '',
    });

    try {
      const token = wx.getStorageSync('token') || '';
      const deviceID = getCachedDeviceFingerprint() || '';
      const apiPath = '/api/v1/miniprogram/ai/cost/doc';
      const requestData = {
        city: this.data.city || '',
        width,
        depth,
        area_build: areaBuild,
        floors,
        area_garden: areaGarden,
        area_courtyard: areaCourtyard,
        area_balcony: areaBalcony,
        structure_type: this.data.structureType || '砖混结构',
        roof_type: this.data.roofType || '坡屋顶',
        has_basement: this.data.basement || '无',
      };
      const params = generateRequestParams(token, requestData, apiPath, deviceID);
      const headers = paramsToHeaders(params);

      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}${apiPath}`,
          method: 'POST',
          header: {
            ...headers,
            'Content-Type': 'application/json',
          },
          data: requestData,
          success: (res) => {
            const data = res.data;
            if (res.statusCode === 200 && data.code === 0) {
              resolve(data.data);
              return;
            }
            reject(new Error(data.msg || '提交失败'));
          },
          fail: reject,
        });
      });

      this.setData({
        docTaskNo: (result && result.task_no) || '',
      });

      wx.showToast({
        title: '任务已提交',
        icon: 'success',
      });

      wx.showModal({
        title: '提示',
        content: '请到“生成历史”查看进度；完成后可复制 Excel 链接到浏览器中下载。',
        showCancel: false,
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        submittingDoc: false,
      });
    }
  },
});
