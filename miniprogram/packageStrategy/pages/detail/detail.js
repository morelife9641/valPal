const db = wx.cloud.database();

Page({
  data: {
    detail: {},
    current: 0, // 当前显示的图片索引
    steps: [
      { title: "站位", sub: "POSITION" },
      { title: "瞄准", sub: "AIMING" },
      { title: "结果", sub: "EFFECT" },
    ],
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.fetchDetail(id);
    }
  },

  fetchDetail(id) {
    wx.showLoading({ title: "提取档案..." });
    db.collection("points")
      .doc(id)
      .get()
      .then((res) => {
        // 将三张图存入一个数组方便 Swiper 渲染
        const data = res.data;
        data.images = [data.standImg, data.aimImg, data.resultImg].filter(
          (i) => i,
        ); // 过滤掉可能的空图

        this.setData({
          detail: data,
        });
        wx.hideLoading();
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: "档案已销毁", icon: "none" });
      });
  },

  // 滑动或点击切换时的索引监听
  onSwiperChange(e) {
    this.setData({
      current: e.detail.current,
    });
  },

  // 点击上方导航直接跳转索引
  switchStep(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      current: index,
    });
  },

  // 全屏预览
  previewImage() {
    const { images } = this.data.detail;
    const { current } = this.data;
    wx.previewImage({
      current: images[current],
      urls: images,
    });
  },
});
