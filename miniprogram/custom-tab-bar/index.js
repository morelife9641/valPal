Component({
  data: {
    selected: 0,
    color: "#ffffff",
    hidden: false,
    animated: false,
    isHidden: false, // 新增：控制 tabBar 显示/隐藏（默认显示）
    selectedColor: "#ff4655",
    list: [
      {
        pagePath: "pages/strategy/index",
        text: "首页",
        iconPath: "../assets/index.png",
        selectedIconPath: "../assets/index_active.png",
      },
      {
        pagePath: "pages/news/index",
        text: "赛事",
        iconPath: "../assets/公开比赛.png",
        selectedIconPath: "../assets/公开比赛 (1).png",
      },
      {
        pagePath: "pages/skins/index",
        text: "皮肤",
        iconPath: "../assets/skin.png",
        selectedIconPath: "../assets/skin_active.png",
      },
      {
        pagePath: "pages/tools/index",
        text: "我的",
        iconPath: "../assets/个人 (1).png",
        selectedIconPath: "../assets/个人.png",
      },
    ],
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = "/" + data.path; // 这里手动补一个斜杠      // 执行跳转
      console.log(url);

      wx.switchTab({ url });
      // 注意：这里不需要在这里 setData 改变 selected，
      // 应该在各个页面的 onShow 里去触发改变，否则会出现点击后状态跳回的情况
    },
    setTabBarHidden(hidden, animated = false) {
      this.setData({
        isHidden: hidden,
        animated: animated,
      });
    },
  },
});
