const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    news: null,
    loading: true,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.fetchNewsDetail(id);
    }
  },

  async fetchNewsDetail(id) {
    try {
      const res = await db.collection("valorant_news").doc(id).get();
      let data = res.data;

      // 🚩 时间格式化处理：因为你的数据是 {$date: 1770076800000}
      const pubDate = new Date(data.publishTime.$date || data.publishTime);
      data.publishDateStr = `${pubDate.getFullYear()}-${pubDate.getMonth() + 1}-${pubDate.getDate()}`;

      // 🚩 预处理 content（如果还没抓到，可以先给个默认样式）
      if (data.content) {
        // 简单的图片自适应处理
        data.content = data.content.replace(
          /<img/g,
          '<img style="max-width:100%;height:auto;display:block;margin:10px 0;"',
        );
      }

      this.setData({
        news: data,
        loading: false,
      });

      // 设置标题
      wx.setNavigationBarTitle({ title: "特工情报" });
    } catch (err) {
      console.error("获取详情失败", err);
      wx.showToast({ title: "情报已被拦截", icon: "none" });
    }
  },

  // 转发
  onShareAppMessage() {
    return {
      title: this.data.news.title,
      path: `/pages/valo_news/detail?id=${this.data.news._id}`,
    };
  },
});
