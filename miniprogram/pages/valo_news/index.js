const db = wx.cloud.database();
const { formatRelativeTime } = require("../../utils/date");
const CAT_MAP = {
  patch: "版本公告",
  esports: "电竞赛事",
  skin: "皮肤情报",
  news: "官方资讯",
};
Page({
  data: {
    categoryOptions: [
      { key: "all", label: "全部" },
      { key: "esports", label: "电竞" },
      { key: "skin", label: "皮肤" },
      { key: "news", label: "官方" },
      { key: "patch", label: "版本" },
    ],
    currentCat: 0, // 依然记录索引
    categories: ["全部", "电竞", "皮肤", "官方", "版本"],
    currentCat: 0,
    focusList: [],
    newsList: [],
    loading: false,
    page: 0,
  },

  onLoad() {
    const userInfo = wx.getStorageSync("userInfo");
    const adminOpenIds = [
      "o2BJX13TzO96J9w9FfJUqvdqjUdA",
      "o2BJX1_Ro4AEMfTM4TEiC5a6vfrU",
    ];

    if (userInfo && adminOpenIds.includes(userInfo._openid)) {
      this.setData({ isAdmin: true });
    }
    // this.checkAdminStatus();
    this.fetchNews(true);
  },

  // 获取新闻列表
  // pages/valo_news/index.js
  async fetchNews(isRefresh = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // const catName = this.data.categories[this.data.currentCat];
      let query = db.collection("valorant_news");

      const currentOption = this.data.categoryOptions[this.data.currentCat];
      const currentKey = currentOption.key;
      if (currentKey !== "all") {
        query = query.where({
          category: currentKey, // 此时这里传入的就是 "esports"
        });
      }
      const res = await query
        .orderBy("fetchTime", "desc")
        .skip(isRefresh ? 0 : this.data.page * 10)
        .limit(10)
        .get();

      // 1. 基础数据格式化
      const formattedData = res.data.map((item) => {
        const timestamp = item.fetchTime?.$date || item.fetchTime || Date.now();
        const dateObj = new Date(timestamp);
        const M = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const D = dateObj.getDate().toString().padStart(2, "0");

        return {
          ...item,
          displayTime: formatRelativeTime(item.fetchTime),
          categoryLabel: CAT_MAP[item.category] || "特工情报",
          // 🚩 这里直接处理好图片，防止 WXML 里的三元运算太长
          thumb:
            item.thumb ||
            (item.images && item.images[0]) ||
            "../../assets/logos/AG.png",
        };
      });

      // 2. 🚩 重点修复：focusList 的赋值逻辑
      let finalFocusList = this.data.focusList;

      // 只有在第一页或者刷新时，才更新轮播图
      if (isRefresh || this.data.page === 0) {
        const hotItems = formattedData.filter((item) => item.isHot === true);

        if (hotItems.length > 0) {
          finalFocusList = hotItems;
        } else {
          // 如果没有 hot 字段，取当前拉取到的前 5 条作为展示
          finalFocusList = formattedData.slice(0, 5);
        }
      }

      this.setData(
        {
          newsList: isRefresh
            ? formattedData
            : [...this.data.newsList, ...formattedData],
          focusList: finalFocusList, // 更新轮播
          page: isRefresh ? 1 : this.data.page + 1,
          loading: false,
        },
        () => {
          // 🚩 在 setData 回调里打印，确保看到的是更新后的值
          console.log("当前 FocusList 内容:", this.data.focusList);
        },
      );

      if (isRefresh) wx.stopPullDownRefresh();
    } catch (err) {
      console.error("加载情报失败:", err);
      this.setData({ loading: false });
    }
  },

  // 切换分类
  switchCat(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.currentCat) return;

    this.setData(
      {
        currentCat: index,
        newsList: [],
        page: 0,
      },
      () => {
        this.fetchNews(true);
      },
    );
  },

  switchCat(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.currentCat) return;

    // 震动反馈，增加交互的“机械感”
    // wx.vibrateShort({ type: "light" });

    this.setData(
      {
        currentCat: index,
        newsList: [],
        page: 0,
      },
      () => {
        // 这里的 fetchNews 内部会根据当前的 categoryOptions[index].key 去查数据库
        this.fetchNews(true);
      },
    );
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchNews(true);
  },

  /**
   * 跳转至新闻详情页
   */
  navToDetail(e) {
    // 1. 从 wxml 的 data-id 属性中获取唯一标识 _id
    const id = e.currentTarget.dataset.id;

    if (!id) {
      console.error("未获取到新闻 ID");
      return;
    }

    // 2. 执行跳转
    wx.navigateTo({
      // 🚩 路径必须与你创建的详情页路径一致
      url: `/pages/valo_news/detail?id=${id}`,
      success: () => {
        console.log("正在前往特工情报局，ID:", id);
      },
      fail: (err) => {
        console.error(
          "跳转失败，请确认 pages/valo_news/detail 是否在 app.json 中注册",
          err,
        );
        wx.showToast({
          title: "情报传输中断",
          icon: "none",
        });
      },
    });
  },
  // 上拉触底
  onReachBottom() {
    this.fetchNews();
  },

  async checkAdminStatus() {
    try {
      // 1. 获取当前用户的 OpenID
      // 这里可以从全局变量拿，或者直接调云函数
      const { result } = await wx.cloud.callFunction({ name: "getOpenid" });
      const myOpenId = result.openid;

      // 2. 🚩 填写你自己的 OpenID
      // 你可以在云开发控制台查看你自己的记录，把那串字符粘到这里
      const adminOpenIds = [
        "o2BJX13TzO96J9w9FfJUqvdqjUdA",
        "o2BJX1_Ro4AEMfTM4TEiC5a6vfrU",
      ];

      if (adminOpenIds.includes(myOpenId)) {
        this.setData({ isAdmin: true });
      }
    } catch (e) {
      console.error("鉴权失败", e);
    }
  },

  /**
   * 跳转到编辑页面
   */
  navToAdminEditor() {
    wx.navigateTo({
      url: "/pages/valo_news/editor", // 这里去你新建的编辑页
    });
  },

  onAdminEdit(e) {
    const id = e.currentTarget.dataset.id;
    const newsItem = this.data.newsList.find((item) => item._id === id);

    if (!id || !newsItem) return;

    wx.showActionSheet({
      itemList: [
        "编辑详细内容 (Editor)",
        newsItem.isHot ? "取消热门 (isHot: false)" : "设为热门 (isHot: true)",
        "删除该条情报",
      ],
      itemColor: "#ff4655", // 瓦罗兰特红
      success: async (res) => {
        switch (res.tapIndex) {
          case 0:
            // 1. 跳转到你刚才创建的编辑页面
            wx.navigateTo({
              url: `/pages/valo_news/edit?id=${id}`,
            });
            break;

          case 1:
            // 2. 快速切换热门状态
            this.updateNewsField(
              id,
              { isHot: !newsItem.isHot },
              "状态更新中...",
            );
            break;

          case 2:
            // 3. 删除确认
            this.confirmDelete(id);
            break;
        }
      },
    });
  },

  async updateNewsField(id, data, loadingText) {
    wx.showLoading({ title: loadingText });
    try {
      await db.collection("valorant_news").doc(id).update({ data });
      wx.hideLoading();
      this.fetchNews(true); // 刷新列表
    } catch (e) {
      wx.hideLoading();
    }
  },

  // 跳转详情
});
