import { configInfos } from "../../config/vct_pro_full_stats"; // 导入你的数据

Page({
  data: {
    fullList: configInfos,
    displayList: configInfos,
    selectedPlayer: null,
  },

  onSearch(e) {
    const val = e.detail.value.toLowerCase();
    const filtered = this.data.fullList.filter(
      (item) =>
        item.name.toLowerCase().includes(val) ||
        item.team.toLowerCase().includes(val),
    );
    this.setData({ displayList: filtered });
  },

  showDetail(e) {
    this.setData({ selectedPlayer: e.currentTarget.dataset.player });
  },

  closeDetail() {
    this.setData({ selectedPlayer: null });
  },

  copyCode(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.code,
      success: () => wx.showToast({ title: "代码已复制" }),
    });
  },

  stopBubble() {}, // 阻止冒泡
});
