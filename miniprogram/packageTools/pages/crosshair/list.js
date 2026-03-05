const crosshairData = require("./crosshairs_new.js");
import { toggleFavoriteStatus } from "../../../utils/fav.js";

Page({
  data: {
    crosshairList: [],
    pageLoading: true,
  },

  onLoad: function () {
    this.initData();
  },

  /**
   * 初始化：合并静态数据与云端收藏状态
   */
  async initData() {
    this.setData({ pageLoading: true });
    const db = wx.cloud.database();

    try {
      // 1. 获取云端该用户的所有准星收藏 (type: 'crosshair')
      const favRes = await db
        .collection("user_favorites")
        .where({
          type: "crosshair",
        })
        .get();

      // 拿到所有已收藏的 targetId 数组
      const myFavIds = favRes.data.map((f) => f.targetId);

      // 2. 将静态数据映射并加上 isFavorite 状态
      const mergedList = crosshairData.map((item) => {
        // 如果你的静态数据没写 id，可以用 item.name 兜底，但建议写 id
        const uniqueId = item.id || item.name;
        return {
          ...item,
          _id: uniqueId, // 统一设置一个 ID 给视图绑定使用
          isFavorite: myFavIds.includes(uniqueId),
        };
      });

      this.setData({
        crosshairList: mergedList,
        pageLoading: false,
      });
    } catch (e) {
      console.error("数据合并失败", e);
      // 如果云端请求失败，至少显示静态内容
      this.setData({
        crosshairList: crosshairData,
        pageLoading: false,
      });
    }
  },

  /**
   * 收藏切换逻辑
   */
  async toggleFavorite(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.crosshairList;
    const index = list.findIndex((item) => item._id === id);

    if (index === -1) return;

    const oldStatus = list[index].isFavorite;

    // 1. 乐观更新
    this.setData({
      [`crosshairList[${index}].isFavorite`]: !oldStatus,
    });

    try {
      // 2. 调用通用工具
      const res = await toggleFavoriteStatus(id, "crosshair");

      wx.showToast({
        title: res.isFavorite ? "收藏成功" : "已移除收藏",
        icon: "none",
      });
    } catch (err) {
      // 失败回滚
      this.setData({ [`crosshairList[${index}].isFavorite`]: oldStatus });
      wx.showToast({ title: "操作失败", icon: "none" });
    }
  },

  /**
   * 复制代码逻辑 (保持你原有的即可)
   */
  copyCode: function (e) {
    const { code, name } = e.currentTarget.dataset;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: `「${name}」代码已复制`, icon: "none" });
      },
    });
  },
});
