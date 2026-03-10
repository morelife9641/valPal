// packageWallpaper/pages/preview/preview.js
const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    preset: null,
    loading: true,
  },

  async onLoad(options) {
    if (!options.presetId) {
      wx.showToast({ title: "参数错误", icon: "none" });
      return;
    }
    this.loadPreset(options.presetId);
  },

  async loadPreset(id) {
    try {
      // 1. 从数据库获取方案数据
      const res = await db.collection("user_presets").doc(id).get();
      const preset = res.data;

      // 2. 如果 snapshot 是云文件 ID，image 组件可以直接显示
      // 但为了确保加载速度，我们也可以在这里显式转一次链接
      this.setData({
        preset: preset,
        loading: false,
      });
    } catch (err) {
      console.error("加载方案失败:", err);
      wx.showToast({ title: "方案已删除或无权限", icon: "none" });
    }
  },

  applyPreset() {
    const presetId = this.data.preset._id;
    const snapshotUrl = this.data.preset.snapshot;
    console.log("即将处理的云路径:", snapshotUrl);

    if (!snapshotUrl) {
      wx.showToast({ title: "未找到预览图", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在保存方案...", mask: true });

    // 关键点：使用 wx.cloud.downloadFile 处理 cloud:// 协议
    wx.cloud.downloadFile({
      fileID: snapshotUrl, // 云文件 ID
      success: (res) => {
        // 云文件下载成功后直接返回 tempFilePath
        const tempFilePath = res.tempFilePath;

        // 保存到相册
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            wx.showToast({ title: "已存至相册", icon: "success" });
          },
          fail: (err) => {
            console.error("保存失败", err);
            if (err.errMsg.includes("auth deny")) {
              wx.showModal({
                title: "授权提示",
                content: "需要开启相册权限才能保存预览图",
                confirmText: "去开启",
                success: (modalRes) => {
                  if (modalRes.confirm) wx.openSetting();
                },
              });
            } else {
              wx.showToast({ title: "保存失败", icon: "none" });
            }
          },
          complete: () => {
            wx.hideLoading();
          },
        });
      },
      fail: (err) => {
        console.error("云文件下载失败", err);
        wx.hideLoading();
        wx.showToast({ title: "图片下载失败", icon: "none" });
      },
    });
  },

  // 核心：应用预设/保存方案
  applyPreset() {
    // 🚩 1. 登录拦截
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingApply: true, // 记录意图
      });
      return;
    }

    // --- 以下是原有的保存逻辑 ---
    const presetId = this.data.preset._id;
    const snapshotUrl = this.data.preset.snapshot;

    if (!snapshotUrl) {
      wx.showToast({ title: "未找到预览图", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在保存方案...", mask: true });

    wx.cloud.downloadFile({
      fileID: snapshotUrl,
      success: (res) => {
        const tempFilePath = res.tempFilePath;
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            wx.showToast({ title: "已存至相册", icon: "success" });
          },
          fail: (err) => {
            if (err.errMsg.includes("auth deny")) {
              wx.showModal({
                title: "授权提示",
                content: "需要开启相册权限才能保存预览图",
                confirmText: "去开启",
                success: (modalRes) => {
                  if (modalRes.confirm) wx.openSetting();
                },
              });
            } else {
              wx.showToast({ title: "保存失败", icon: "none" });
            }
          },
          complete: () => {
            wx.hideLoading();
          },
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: "图片下载失败", icon: "none" });
      },
    });
  },

  async onRegister(e) {
    const { nickname, avatarUrl } = e.detail;
    wx.showLoading({ title: "档案激活中...", mask: true });

    try {
      // Step 1: 上传头像
      const cloudPath = `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl,
      });

      // Step 2: 调云函数注册
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: {
          action: "register",
          userInfo: { nickname, avatarUrl: uploadRes.fileID },
        },
      });

      if (res.result && res.result.success) {
        // Step 3: 同步全局状态
        const serverUserInfo = res.result.data;
        app.globalData.isLogin = true;
        app.globalData.userInfo = serverUserInfo;
        wx.setStorageSync("userInfo", serverUserInfo);

        this.setData({ showLoginPopup: false });

        // Step 4: 意图恢复逻辑
        if (this.data.pendingApply) {
          // 刚才想保存图片
          this.setData({ pendingApply: false });
          this.applyPreset(); // 🚩 重新调用，此时已登录，直接开始下载并保存
        } else if (this.data.pendingId) {
          // 刚才想收藏预设
          const id = this.data.pendingId;
          this.setData({ pendingId: null });
          await this.executeFavorite(id);
        } else if (this.data.pendingEditor) {
          // 刚才想去编辑器
          this.setData({ pendingEditor: false });
          this.goToEditor();
        } else {
          if (this.initData) await this.initData();
        }

        wx.showToast({ title: "特工档案已激活", icon: "success" });
      }
    } catch (err) {
      console.error("激活失败:", err);
      wx.showToast({ title: "激活失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
