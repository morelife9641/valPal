// packageTools/pages/pro-settings/detail.js
const proDataFile = require("./pro_data.js"); // 直接读同级 JS

Page({
  data: {
    proInfo: null,
    mainSettings: [],
  },

  onLoad: function (options) {
    console.log(options);

    const name = options.name; // 拿到从列表页传过来的 name

    // 在本地数据中匹配选手
    const detail = proDataFile.find((item) => item.name === name);

    if (detail) {
      // 整理要在网格显示的重点数据
      const keys = [
        "DPI",
        "Sensitivity",
        "eDPI",
        "Hz",
        "Resolution",
        "Aspect Ratio",
      ];
      const mainSettings = keys.map((k) => ({
        key: k,
        value: detail.technical_settings[k] || "N/A",
      }));

      this.setData({
        proInfo: detail,
        mainSettings: mainSettings,
      });

      wx.setNavigationBarTitle({ title: `${detail.name} // 档案` });
    }
  },

  copyCrosshairCode: function () {
    const code = this.data.proInfo.technical_settings.Code;
    wx.setClipboardData({
      data: code,
      success: () => wx.vibrateShort(),
    });
  },
});
