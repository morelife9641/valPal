// packageTools/pages/pro-settings/list.js
const proDataFile = require("./pro_data.js");

Page({
  data: {
    groupedList: [],
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: "选手设置" });
    this.groupDataByTeam(proDataFile);
  },

  groupDataByTeam: function (data) {
    const groups = {};
    data.forEach((item) => {
      if (!groups[item.team]) {
        groups[item.team] = [];
      }
      groups[item.team].push(item);
    });

    // 转换为数组格式方便 wx:for 嵌套循环
    const groupedList = Object.keys(groups).map((teamName) => {
      return {
        teamName: teamName,
        members: groups[teamName],
      };
    });

    this.setData({ groupedList });
  },

  navToDetail: function (e) {
    console.log(e);

    const name = e.currentTarget.dataset.item.name; // 获取点击选手的名字

    wx.navigateTo({
      // 这里的路径必须在 app.json 中注册过
      url: `/packageTools/pages/pro-settings/detail?name=${name}`,
      fail: (err) => {
        console.error("跳转失败", err);
      },
    });
  },
});
