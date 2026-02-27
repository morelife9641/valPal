Component({
  properties: {
    show: { type: Boolean, value: false },
  },
  data: {
    defaultAvatar: "../../assets/先锋.png",
    tempAvatarUrl: "",
  },
  methods: {
    onClose() {
      this.triggerEvent("close");
    },
    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      this.setData({ tempAvatarUrl: avatarUrl });
    },
    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;

      // 1. 弹出微信自带的裁剪框，强制 1:1 比例
      wx.cropImage({
        src: avatarUrl,
        cropSize: [1000, 1000],
        success: (res) => {
          // res.tempFilePath 就是裁剪后高清的图片路径
          this.setData({
            tempAvatarUrl: res.tempFilePath,
          });

          // 2. 检查一下现在的文件大小（可选调试）
          wx.getFileInfo({
            filePath: res.tempFilePath,
            success: (file) => {
              console.log("高清处理后的文件大小(Byte):", file.size);
              // 正常的 600px 图片通常在 50KB - 150KB 之间
            },
          });
        },
        fail: (err) => {
          // 如果用户取消裁剪，还是回退到默认
          this.setData({ tempAvatarUrl: avatarUrl });
        },
      });
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
