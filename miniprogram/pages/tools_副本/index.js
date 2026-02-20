Page({
  data: {
    crosshairList: [], // 这里导入你的 JSON 数据
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3, // 对应你 list 里的索引，skins 是第 3 个，所以是 2
      });
    }
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
