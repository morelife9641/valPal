// index.js
const weaponsData = require("../../assets/weapons_stats.js");

Page({
  data: {
    categories: [
      "全部",
      "佩枪",
      "冲锋枪",
      "突击步枪",
      "狙击步枪",
      "重武器",
      "霰弹枪",
    ],
    activeTab: 0,
    expandedId: null,
    rawData: [], // 存储原始处理后的数据
    groupedList: [], // 存储分组后的渲染数据
  },

  onLoad() {
    // 预处理数据
    const processed = weaponsData.map((item) => ({
      ...item,
      fireRatePercent: (parseFloat(item.firing_speed) / 16) * 100,
      moveSpeedPercent: (parseFloat(item.moving_speed) / 6) * 100,
      cliWidth: (parseInt(item.cli_size) / 100) * 100,
      priceText: item.price === "免费" ? "免费" : "¤ " + item.price,
    }));

    this.setData({ rawData: processed });
    this.updateDisplayList();
  },

  // 核心逻辑：过滤 + 分组
  updateDisplayList() {
    const { activeTab, categories, rawData } = this.data;
    const targetCategory = categories[activeTab];

    // 1. 过滤
    let filtered =
      targetCategory === "全部"
        ? rawData
        : rawData.filter((w) => w.type_name === targetCategory);

    // 2. 按 type_name 分组
    const grouped = filtered.reduce((acc, item) => {
      let group = acc.find((g) => g.typeName === item.type_name);
      if (!group) {
        group = { typeName: item.type_name, weapons: [] };
        acc.push(group);
      }
      group.weapons.push(item);
      return acc;
    }, []);

    this.setData({ groupedList: grouped });
  },

  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index, expandedId: null });
    this.updateDisplayList();
  },

  toggleExpand(e) {
    const ename = e.currentTarget.dataset.ename;
    this.setData({ expandedId: this.data.expandedId === ename ? null : ename });
  },
});
