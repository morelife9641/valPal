const db = wx.cloud.database();

Page({
  data: {
    heroInfo: {},
    pointList: [],
    mapId: "",
    mapName: "",
    isLoading: true,
  },

  onLoad(options) {
    // 1. 解构并解码参数
    const { mapId, heroId, mapName, heroName, heroNameEn, bustPortrait } =
      options;
    const portraitUrl = decodeURIComponent(bustPortrait || "");

    // 2. 统一设置页面基础信息
    this.setData({
      heroInfo: {
        heroId: heroId,
        heroName: decodeURIComponent(heroName || ""),
        heroNameEn: heroNameEn || "VALORANT",
        bustPortrait: portraitUrl,
      },
      mapId: mapId,
      mapName: decodeURIComponent(mapName || ""),
    });

    // 3. 初次执行查询
    this.fetchPointList(mapId, heroId);
  },

  /**
   * 核心查询逻辑
   */
  fetchPointList(mapId, heroId) {
    // 兼容手动调用时不传参的情况
    const mid = mapId || this.data.mapId;
    const hid = heroId || this.data.heroInfo.heroId;

    this.setData({ isLoading: true });
    wx.showLoading({ title: "同步档案...", mask: true });

    db.collection("points")
      .where({
        mapId: mid,
        agentId: hid,
      })
      .orderBy("createTime", "desc")
      .get()
      .then((res) => {
        this.setData({
          pointList: res.data,
          isLoading: false,
        });
        wx.hideLoading();
      })
      .catch((err) => {
        console.error("查询失败:", err);
        this.setData({ isLoading: false });
        wx.hideLoading();
      });
  },

  /**
   * 跳转到新增点位：增加事件监听
   */
  goToAddPoint() {
    const { heroInfo, mapId, mapName } = this.data;
    const url = `/packageStrategy/pages/add-point/add-point?mapId=${mapId}&mapName=${encodeURIComponent(mapName)}&heroId=${heroInfo.heroId}&heroName=${encodeURIComponent(heroInfo.heroName)}`;

    wx.navigateTo({
      url,
      events: {
        // --- 关键：监听来自 add-point 页面的 refreshList 信号 ---
        refreshList: () => {
          console.log("检测到新点位上传，正在刷新...");
          this.fetchPointList(); // 触发刷新
        },
      },
    });
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?id=${id}`,
    });
  },
});
