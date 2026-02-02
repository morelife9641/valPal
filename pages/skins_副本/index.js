const db = wx.cloud.database();

Page({
  data: {
    skinList: [],
    page: 0,
    pageSize: 20, // 每次拉取20条，保证首屏加载速度
    isFinished: false,
    loading: false,
    categoryOptions: [
      "全部类别",
      "狂徒",
      "幻影",
      "冥驹",
      "小刀",
      "正义",
      "鬼魅",
    ],
    rarityOptions: [
      "全部稀有度",
      "豪华 (Deluxe)",
      "精选 (Select)",
      "尊爵 (Premium)",
      "奢华 (Exclusive)",
      "极致 (Ultra)",
    ],
    sortOptions: ["时间最近", "时间最早", "热度最高", "热度最低"],

    // 当前选择的索引
    categoryIndex: 0,
    rarityIndex: 0,
    sortIndex: 0,

    // 搜索关键词
    searchKeyword: "",
  },

  onLoad() {
    this.loadSkins();
  },

  // 核心：触底加载更多
  onReachBottom() {
    if (!this.data.isFinished && !this.data.loading) {
      this.loadSkins();
    }
  },

  loadSkins() {
    const {
      categoryIndex,
      categoryOptions,
      rarityIndex,
      rarityOptions,
      sortIndex,
      searchKeyword,
      page,
      pageSize,
    } = this.data;

    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });

    let query = db.collection("valorant_skins");

    // --- 1. 动态过滤条件 ---
    let whereCondition = {};

    // 搜索框过滤 (模糊查询名称)
    if (searchKeyword) {
      whereCondition.name_SC = db.RegExp({
        regexp: searchKeyword,
        options: "i",
      });
    }

    // 类别过滤 (weaponName_SC)
    if (categoryIndex > 0) {
      whereCondition.weaponName_SC = categoryOptions[categoryIndex];
    }

    // 稀有度过滤 (使用字段：skinRarityDescription)
    if (rarityIndex > 0) {
      whereCondition.skinRarity = Number(rarityIndex);
    }

    // --- 2. 动态排序条件 ---
    let orderField = "publishTime"; // 默认排序字段
    let orderDir = "desc"; // 默认排序方向

    switch (parseInt(sortIndex)) {
      case 0: // 时间最近
        orderField = "publishTime";
        orderDir = "desc";
        break;
      case 1: // 时间最早
        orderField = "publishTime";
        orderDir = "asc";
        break;
      case 2: // 评分最高
        orderField = "score";
        orderDir = "desc";
        break;
      case 3: // 评分最低
        orderField = "score";
        orderDir = "asc";
        break;
    }

    // --- 3. 执行查询 ---
    query
      .where(whereCondition)
      .orderBy(orderField, orderDir)
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
      .then((res) => {
        const formattedData = res.data.map((item) => {
          item.score = item.score ? Number(item.score).toFixed(2) : "0.00";
          item.displayPrice =
            item.priceInChianMainland > 0
              ? item.priceInChianMainland
              : "不可售";
          return item;
        });

        this.setData({
          skinList:
            page === 0
              ? formattedData
              : [...this.data.skinList, ...formattedData],
          isFinished: res.data.length < pageSize,
          loading: false,
          page: page + 1,
        });
        wx.hideLoading();
      })
      .catch((err) => {
        console.error("加载失败", err);
        wx.hideLoading();
      });
  },

  // 搜索框输入（带简单防抖处理）
  onSearchInput(e) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.setData({
        searchKeyword: e.detail.value,
        page: 0,
        skinList: [],
        isFinished: false,
      });
      this.loadSkins();
    }, 500); // 500ms 后执行搜索
  },

  // 类别切换
  onCategoryChange(e) {
    this.setData({
      categoryIndex: e.detail.value,
      page: 0,
      skinList: [],
      isFinished: false,
    });
    this.loadSkins();
  },

  // 稀有度切换
  onRarityChange(e) {
    console.log(e);

    this.setData({
      rarityIndex: e.detail.value,
      page: 0,
      skinList: [],
      isFinished: false,
    });
    this.loadSkins();
  },

  // 排序切换
  onSortChange(e) {
    this.setData({
      sortIndex: e.detail.value,
      page: 0,
      skinList: [],
      isFinished: false,
    });
    this.loadSkins();
  },
});
