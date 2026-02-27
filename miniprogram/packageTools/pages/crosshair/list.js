// 使用相对路径引入同级目录下的 js
const crosshairData = require("./crosshairs.js");

Page({
  data: {
    crosshairList: [],
    pageLoading: true,
  },

  onLoad: function () {
    // 瓦罗兰特风格：模拟一个微小的加载感
    this.setData({ pageLoading: true });

    try {
      // 如果数据很大，建议放在这里处理
      this.setData({
        crosshairList: crosshairData,
        pageLoading: false,
      });
    } catch (e) {
      console.error("数据加载失败", e);
      this.setData({ pageLoading: false });
    }
  },

  copyCode: function (e) {
    console.log(e);

    const code = e.currentTarget.dataset.code;
    const name = e.currentTarget.dataset.name;

    wx.setClipboardData({
      data: code,
      success: () => {
        // 震动反馈增加硬核感
        // wx.vibrateShort();
        wx.showToast({
          title: `${name} 准星已复制`,
          icon: "none",
        });
      },
    });
  },

  copyCode: function (e) {
    // 调试用：查看当前点击携带的全部数据
    console.log("点击事件详情:", e.currentTarget.dataset);

    const { code, name } = e.currentTarget.dataset;

    if (!code) {
      wx.showToast({ title: "准星代码缺失", icon: "none" });
      return;
    }

    wx.setClipboardData({
      data: code,
      success: () => {
        // 增加触感反馈
        // wx.vibrateShort({ type: "light" });

        wx.showToast({
          title: `「${name}」代码已复制`,
          icon: "none",
        });
      },
      fail: () => {
        wx.showToast({ title: "复制失败", icon: "none" });
      },
    });
  },
});
