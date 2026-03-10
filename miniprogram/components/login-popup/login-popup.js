Component({
  properties: {
    show: { type: Boolean, value: false },
  },
  data: {
    defaultAvatar: "../../assets/default_icon.png",
    tempAvatarUrl: "",
  },
  methods: {
    onClose() {
      this.triggerEvent("close");
    },

    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;

      // 重点：这里不要 setData，否则页面会瞬间加载那张糊图

      wx.cropImage({
        src: avatarUrl,
        cropSize: [1000, 1000],
        success: (res) => {
          // 只有成功拿到 1000x1000 的图后才更新预览
          this.setData({
            tempAvatarUrl: res.tempFilePath,
          });
        },
        fail: () => {
          // 如果失败或取消，保持现状或提示
        },
      });
    },
    onConfirm(e) {
      const { nickname } = e.detail.value;
      const avatarUrl = this.data.tempAvatarUrl;

      if (!nickname || !avatarUrl) {
        wx.showToast({ title: "请完整填写特工档案", icon: "none" });
        return;
      }

      // 传回给页面，由页面去调用云函数存入 users 集合
      this.triggerEvent("register", { nickname, avatarUrl });
    },
    stop() {}, // 阻止冒泡
  },
});
