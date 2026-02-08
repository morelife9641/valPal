// packageWallpaper/pages/preview/preview.js
const db = wx.cloud.database();

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
    const { snapshot, _id: presetId } = this.data.preset;

    if (!snapshot) {
      wx.showToast({ title: "方案图片不存在", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在保存图片...", mask: true });

    // 1. 下载图片获取临时路径
    wx.downloadFile({
      url: snapshot,
      success: (res) => {
        if (res.statusCode === 200) {
          // 2. 保存到相册
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showModal({
                title: "保存成功",
                content: "预览图已保存至相册，即将前往配置页",
                showCancel: false,
                confirmText: "确定",
                success: () => {
                  // 3. 确认后跳转
                  wx.reLaunch({
                    url: `/packageWallpaper/pages/wallpaper/wallpaper?presetId=${presetId}`,
                  });
                },
              });
            },
            fail: (err) => {
              wx.hideLoading();
              // 如果用户拒绝了权限，引导去开启
              if (err.errMsg.includes("auth deny")) {
                wx.showModal({
                  title: "提示",
                  content: "需要保存图片权限，请在设置中开启",
                  success: (res) => {
                    if (res.confirm) wx.openSetting();
                  },
                });
              } else {
                wx.showToast({ title: "保存失败", icon: "none" });
              }
            },
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "下载失败", icon: "none" });
      },
    });
  },

  applyPreset() {
    const presetId = this.data.preset._id;
    const snapshotUrl = this.data.preset.snapshot;
    console.log(snapshotUrl);

    if (!snapshotUrl) {
      wx.showToast({ title: "未找到预览图", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在保存方案...", mask: true });

    // 1. 因为 snapshot 是云端或网络路径，需要先下载
    wx.downloadFile({
      url: snapshotUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          // 2. 保存到相册 (参考你提供的 saveImageToPhotosAlbum 逻辑)
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({ title: "已存至相册", icon: "success" });

              // 3. 延迟一会再跳转，让用户看清“已存至相册”的提示
              setTimeout(() => {
                wx.reLaunch({
                  url: `/packageWallpaper/pages/wallpaper/wallpaper?presetId=${presetId}`,
                });
              }, 1000);
            },
            fail: (err) => {
              console.error("保存失败", err);
              // 处理用户拒绝权限的情况
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
        }
      },
      fail: (err) => {
        console.error("下载预览图失败", err);
        wx.hideLoading();
        wx.showToast({ title: "图片下载失败", icon: "none" });
      },
    });
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

  goBack() {
    wx.navigateBack();
  },
});
