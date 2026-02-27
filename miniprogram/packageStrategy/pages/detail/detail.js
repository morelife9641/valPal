const mapsData = require("../../../config/maps_data.js");

Page({
  data: {
    detail: {},
    mapBaseIcon: "",
    // 每一个涉及 swiper 的字段都需要一个独立的 index 记录
    standIndex: 0,
    aimIndex: 0,
    enemyIndex: 0,
    resultIndex: 0,
    isPreview: false,
    standIndex: 0,
    aimIndex: 0,
    enemyIndex: 0,
    resultIndex: 0,
  },

  onLoad(options) {
    if (options.mode === "preview") {
      // 入口 A：从添加页面点击“预览”进入
      this.loadPreviewData();
    } else if (options.id) {
      // 入口 B：从列表点击进入
      this.fetchDbDetail(options.id);
    }
  },

  // 加载预览数据（从 App 全局变量读取）
  loadPreviewData() {
    const app = getApp();
    const previewData = app.globalData.tempPreviewData;

    if (!previewData) {
      wx.showModal({
        title: "提示",
        content: "预览数据已失效",
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }

    this.setData(
      {
        detail: previewData,
        isPreview: true,
      },
      () => {
        this.initMapIcon(previewData.mapId);
      },
    );

    wx.setNavigationBarTitle({ title: "战术预演 (预览)" });
  },

  onSwiperChange: function (e) {
    console.log(e);

    // 获取当前滑动的组件对应的字段名（如 standIndex）
    const field = e.currentTarget.dataset.field;
    // 获取当前 Swiper 所在的索引
    const current = e.detail.current;

    // 动态设置 data
    this.setData({
      [field]: current,
    });

    // 可选：添加震动反馈，提升战术交互感
    // wx.vibrateShort({ type: 'light' });
  },
  onSwiperChange: function (e) {
    // 1. 从 dataset 中提取我们要修改的字段名 (如 standIndex)
    const field = e.currentTarget.dataset.field;
    // 2. 获取当前 Swiper 的真实索引
    const current = e.detail.current;

    // 3. 动态更新
    this.setData({
      [field]: current,
    });

    // 4. 触感反馈（模拟战术终端操作感）
    // wx.vibrateShort({ type: 'light' });
  },

  // 从数据库获取真实数据
  async fetchDbDetail(id) {
    wx.showLoading({ title: "同步战术档案..." });
    const db = wx.cloud.database();
    try {
      const res = await db.collection("points").doc(id).get();
      this.setData(
        {
          detail: res.data,
          isPreview: false,
        },
        () => {
          this.initMapIcon(res.data.mapId);
        },
      );
    } catch (err) {
      wx.showToast({ title: "档案已销毁", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // 根据 mapId 匹配底图
  initMapIcon(mapId) {
    const maps = Array.isArray(mapsData) ? mapsData : mapsData.maps || [];
    const mapObj = maps.find((m) => m.uuid === mapId);
    if (mapObj) {
      this.setData({ mapBaseIcon: mapObj.displayIcon });
    }
  },

  // 通用 Swiper 切换处理
  onSwiperChange(e) {
    const { field } = e.currentTarget.dataset; // 对应 standIndex, enemyIndex 等
    this.setData({
      [field]: e.detail.current,
    });
  },

  // 图片全屏预览
  previewImage(e) {
    const { src, list } = e.currentTarget.dataset;
    wx.previewImage({
      current: src,
      urls: list.map((item) => item.url),
    });
  },
});
