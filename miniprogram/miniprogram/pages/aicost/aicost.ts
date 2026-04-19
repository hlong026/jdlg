// pages/aicost/aicost.ts
import { generateRequestParams, paramsToHeaders } from '../../utils/parameter';
import { getCachedDeviceFingerprint } from '../../utils/deviceFingerprint';

const API_BASE_URL = 'https://api.jiadilingguang.com';

Page({
  /**
   * 页面的初始数据
   */
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
    docTaskNo: '' as string,
    // 下拉选项
    structureOptions: [
      '砖混结构',
      '框架结构',
      '钢结构',
      '木结构'
    ],
    roofOptions: [
      '坡屋顶',
      '平屋顶',
      '斜屋顶'
    ],
    basementOptions: [
      '无',
      '一层',
      '二层'
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    
  },

  /**
   * 城市输入
   */
  onCityInput(e: any) {
    this.setData({
      city: e.detail.value
    })
  },

  /**
   * 房屋面宽输入
   */
  onHouseWidthInput(e: any) {
    this.setData({
      houseWidth: e.detail.value
    })
  },

  /**
   * 房屋进深输入
   */
  onHouseDepthInput(e: any) {
    this.setData({
      houseDepth: e.detail.value
    })
  },

  /**
   * 扣除庭院输入
   */
  onCourtyardDeductInput(e: any) {
    this.setData({
      courtyardDeduct: e.detail.value
    })
  },

  /**
   * 露台扣除输入
   */
  onTerraceDeductInput(e: any) {
    this.setData({
      terraceDeduct: e.detail.value
    })
  },

  /**
   * 选择结构形式
   */
  onSelectStructure() {
    const options = this.data.structureOptions
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          structureType: options[res.tapIndex]
        })
      }
    })
  },

  /**
   * 选择屋顶形式
   */
  onSelectRoof() {
    const options = this.data.roofOptions
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          roofType: options[res.tapIndex]
        })
      }
    })
  },

  /**
   * 选择地下室
   */
  onSelectBasement() {
    const options = this.data.basementOptions
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          basement: options[res.tapIndex]
        })
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '免费计算建房报价',
      path: '/pages/aicost/aicost'
    }
  },

  // --- 根据造价表生成测算表 ---
  onAreaBuildInput(e: any) {
    this.setData({ areaBuild: e.detail.value });
  },
  onFloorsInput(e: any) {
    this.setData({ floors: e.detail.value });
  },
  onAreaGardenInput(e: any) {
    this.setData({ areaGarden: e.detail.value });
  },

  async onSubmitDoc() {
    const areaBuild = parseFloat(this.data.areaBuild);
    const floors = parseInt(this.data.floors, 10);
    if (!this.data.areaBuild || isNaN(areaBuild) || areaBuild <= 0) {
      wx.showToast({ title: '请填写占地（平方米）', icon: 'none' });
      return;
    }
    if (!this.data.floors || isNaN(floors) || floors < 1) {
      wx.showToast({ title: '请填写层数', icon: 'none' });
      return;
    }

    const width = parseFloat(this.data.houseWidth || '0') || 0;
    const depth = parseFloat(this.data.houseDepth || '0') || 0;
    const areaGarden = parseFloat(this.data.areaGarden || '0') || 0;
    const areaCourtyard = parseFloat(this.data.courtyardDeduct || '0') || 0;
    const areaBalcony = parseFloat(this.data.terraceDeduct || '0') || 0;

    this.setData({ submittingDoc: true, docTaskNo: '' });
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
        has_basement: this.data.basement || '无'
      };
      const params = generateRequestParams(token, requestData, apiPath, deviceID);
      const headers = paramsToHeaders(params);

      const res = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}${apiPath}`,
          method: 'POST',
          header: { ...headers, 'Content-Type': 'application/json' },
          data: requestData,
          success: (r) => {
            const data = r.data as any;
            if (r.statusCode === 200 && data.code === 0) {
              resolve(data.data);
            } else {
              reject(new Error(data.msg || '提交失败'));
            }
          },
          fail: reject
        });
      });

      this.setData({ docTaskNo: (res && res.task_no) || '' });
      wx.showToast({
        title: '任务已提交',
        icon: 'success'
      });
      wx.showModal({
        title: '提示',
        content: '请到「生成历史」查看进度；完成后可复制 Excel 链接到浏览器中下载。',
        showCancel: false
      });
    } catch (error: any) {
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submittingDoc: false });
    }
  }
});
