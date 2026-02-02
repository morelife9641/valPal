Page({
  data: {
    crosshairList: [], // 这里导入你的 JSON 数据
  },
  onLoad: function () {
    // 实际开发中可以从本地文件或你的 PVE 服务器接口读取
    const data = require("../../assets/crosshairs.js");
    this.setData({ crosshairList: data });
  },
  copyCode: function (e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({
      data: code,
      success: function () {
        wx.showToast({ title: "代码已复制", icon: "success" });
      },
    });
  },
});
