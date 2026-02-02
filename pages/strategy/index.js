// 假设你已经将 maps_data.json 改名为 maps_data.js 并导出了 module.exports
const mapsData = require("../../assets/maps_data.js");

Page({
  data: {
    maps: [],
    loading: true,
  },

  onLoad() {
    this.initMapData();
  },

  /**
   * 初始化地图数据
   */
  initMapData() {
    try {
      // 过滤掉没有 splash 或 displayIcon 的无效地图数据（如测试地图）
      const validMaps = mapsData.filter(
        (item) => item.splash && item.displayIcon,
      );

      const processedMaps = validMaps.map((item) => {
        return {
          uuid: item.uuid,
          displayName: item.displayName,
          // splash 作为列表大图背景
          splash: item.splash,
          // displayIcon 是 2D 平面图，传给详情页 Canvas 使用
          displayIcon: item.displayIcon,
          // 提取坐标信息（如果有的话，通常在描述或坐标字段）
          coordinates: item.coordinates || "未知坐标",
        };
      });

      this.setData({
        maps: processedMaps,
        loading: false,
      });
    } catch (error) {
      console.error("地图数据解析失败:", error);
      this.setData({ loading: false });
    }
  },

  /**
   * 点击地图卡片跳转至详情页
   */
  goToDetail(e) {
    console.log(e);

    const { uuid, name, icon } = e.currentTarget.dataset;

    // 将地图的 uuid、名称和平面图 URL 通过 URL 参数传递
    // 注意：URL 里的参数需要 encodeURIComponent，防止图片地址中的特殊字符导致解析错误
    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?uuid=${uuid}&name=${name}&icon=${icon}`,
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: "瓦罗兰特全地图点位教学",
      path: "/pages/strategy/index",
      imageUrl: "/assets/images/share_cover.png", // 替换为你的分享封面图
    };
  },
});
