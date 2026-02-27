const mapsData = require("../../../config/maps_data.js");

Page({
  data: {
    allList: [], // 原始总列表
    filteredList: [], // 筛选后的列表
    maps: [{ uuid: "all", displayName: "全部地图" }],
    mapIndex: 0,
    sideFilter: "all", // all, atk, def
  },

  onLoad() {
    // 合并地图配置
    const rawMaps = Array.isArray(mapsData) ? mapsData : mapsData.maps || [];
    this.setData({ maps: [...this.data.maps, ...rawMaps] });
  },

  onShow() {
    this.loadPointList();
  },

  loadPointList() {
    const db = wx.cloud.database();
    db.collection("points")
      .where({ status: 1 })
      .orderBy("createTime", "desc")
      .get()
      .then((res) => {
        const list = res.data.map((item) => {
          const mapConfig = this.data.maps.find((m) => m.uuid === item.mapId);
          return {
            ...item,
            mapThumb: mapConfig ? mapConfig.listViewIconTall : "",
            dateDisplay: item.createTime
              ? `${item.createTime.getMonth() + 1}/${item.createTime.getDate()}`
              : "--",
          };
        });
        this.setData({ allList: list }, () => this.applyFilter());
      });
  },

  // 切换地图筛选
  onMapFilterChange(e) {
    this.setData({ mapIndex: e.detail.value }, () => this.applyFilter());
  },

  // 切换阵营筛选
  toggleSideFilter() {
    const modes = ["all", "atk", "def"];
    let next = modes[(modes.indexOf(this.data.sideFilter) + 1) % 3];
    this.setData({ sideFilter: next }, () => this.applyFilter());
  },

  // 执行筛选算法
  applyFilter() {
    const { allList, maps, mapIndex, sideFilter } = this.data;
    const selectedMap = maps[mapIndex];

    const filtered = allList.filter((item) => {
      const mapMatch =
        selectedMap.uuid === "all" || item.mapId === selectedMap.uuid;
      const sideMatch = sideFilter === "all" || item.side === sideFilter;
      return mapMatch && sideMatch;
    });

    this.setData({ filteredList: filtered });
  },

  goToAdd() {
    wx.navigateTo({ url: "../add-point/add-point" });
  },
  goToDetail(e) {
    console.log(e);

    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?id=${e.currentTarget.dataset.id}`,
    });
  },
});
