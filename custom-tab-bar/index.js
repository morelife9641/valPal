Component({
  data: {
    selected: 0,
    color: "#ffffff",
    selectedColor: "#ff4655",
    list: [
      {
        pagePath: "/pages/strategy/index",
        text: "攻略",
        iconPath: "../assets/index.png",
        selectedIconPath: "../assets/index_active.png",
      },
      {
        pagePath: "/pages/news/index",
        text: "资讯",
        iconPath: "../assets/news.png",
        selectedIconPath: "../assets/news_active.png",
      },
      {
        pagePath: "/pages/skins/index",
        text: "皮肤",
        iconPath: "../assets/skin.png",
        selectedIconPath: "../assets/skin_active.png",
      },
      {
        pagePath: "/pages/tools/index",
        text: "工具",
        iconPath: "../assets/pinpoint.png",
        selectedIconPath: "../assets/pinpoint_active.png",
      },
    ],
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      // 执行跳转
      console.log(url);

      wx.switchTab({ url });
      // 注意：这里不需要在这里 setData 改变 selected，
      // 应该在各个页面的 onShow 里去触发改变，否则会出现点击后状态跳回的情况
    },
  },
});
