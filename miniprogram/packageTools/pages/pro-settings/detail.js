// packageTools/pages/pro-settings/detail.js
const proDataFile = require("./pro_data_updated.js"); // 直接读同级 JS
// const logoMap = {
//   "Titan Esports Club": "TEC",
//   "EDward Gaming": "EDG",
//   "Bilibili Gaming": "BLG",
//   "FunPlus Phoenix": "FPX",
//   "Trace Esports": "TE",
//   "JDG Esports": "JDG",
//   "Nova Esports": "NOVA",
//   "All Gamers": "AG",
//   TYLOO: "TYL",
//   "Wolves Esports": "WOL",
//   "Dragon Ranger Gaming": "DRG",
// };
Page({
  data: {
    proInfo: null,
    mainSettings: [],
  },

  onLoad: function (options) {
    const name = options.name;
    const detail = proDataFile.find((item) => item.name === name);

    if (detail) {
      // 1. 处理核心设置 (代码略...)
      const keys = [
        "DPI",
        "Sensitivity",
        "eDPI",
        "Hz",
        "Resolution",
        "Aspect Ratio",
      ];
      const mainSettings = keys.map((k) => {
        const labels = {
          DPI: "鼠标 DPI",
          Sensitivity: "游戏灵敏度",
          eDPI: "实际灵敏度",
          Hz: "轮询率",
          Resolution: "分辨率",
          "Aspect Ratio": "宽高比",
        };
        return {
          key: labels[k] || k,
          value: detail.technical_settings[k] || "N/A",
        };
      });

      // 2. 映射队徽
      const logoMap = {
        "Titan Esports Club": "TEC",
        "EDward Gaming": "EDG",
        "Bilibili Gaming": "BLG",
        "FunPlus Phoenix": "FPX",
        "Trace Esports": "TE",
        "JD Gaming": "JDG",
        "Nova Esports": "NOVA",
        "All Gamers": "AG",
        TYLOO: "TYL",
        "XLG Esports": "XLG",
        "Wolves Esports": "WOL",
        "Dragon Ranger Gaming": "DRG",
      };

      // 🚩 修正这里：从 detail 里面取 team
      const teamFullName = detail.team;
      const teamShortName = logoMap[teamFullName] || "UNKNOWN";

      console.log("匹配到的队名全称:", teamFullName);
      console.log("转换后的缩写:", teamShortName);

      this.setData({
        proInfo: detail,
        teamLogo: teamShortName, // 转小写以匹配文件名，如 ag.png
        mainSettings: mainSettings,
      });

      wx.setNavigationBarTitle({ title: `${detail.name} 选手设置` });
    }
  },

  goBack: function () {
    wx.navigateBack({
      // delta: 1,
    });
  },

  copyCrosshairCode: function () {
    const code = this.data.proInfo.technical_settings.Code;
    wx.setClipboardData({
      data: code,
      success: () => wx.vibrateShort(),
    });
  },
});
