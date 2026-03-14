const app = getApp();

Page({
  data: {
    isLogin: false,
    userInfo: null,
    showLoginPopup: false,
    favoriteCount: 0,
    uploadCount: 0,
  },

  onShow() {
    this.syncUserState();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3, // 对应你 list 里的索引，skins 是第 3 个，所以是 2
      });
    }
  },

  // 1. 同步登录状态并获取数据
  // 在你的数据处理函数中（例如 fetchUserInfo 或 syncUserState）
  syncUserState() {
    const userInfo = app.globalData.userInfo;
    if (!userInfo) return;

    // 获取北京时间当前日期 (YYYY-MM-DD)
    const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];

    // 核心逻辑：比对数据库里的最后操作日期
    const hasCheckedIn =
      userInfo.actionLimit && userInfo.actionLimit.lastActionDate === todayStr;

    this.setData({
      userInfo: userInfo,
      isLogin: !!app.globalData.isLogin,
      hasCheckedIn: !!hasCheckedIn, // 根据日期对比结果控制变量
      favoriteCount: this.data.favoriteCount, // 保持其他数据
    });
  },

  // 2. 从云端实时获取统计数据
  async getUserCloudData() {
    const db = wx.cloud.database();
    try {
      // 获取收藏总数
      const favRes = await db.collection("user_favorites").count();
      // 获取上传总数 (recommend_points 集合中需包含 _openid 字段)
      const uploadRes = await db
        .collection("recommend_points")
        .where({
          _openid: "{openid}",
        })
        .count();

      this.setData({
        favoriteCount: favRes.total,
        uploadCount: uploadRes.total,
      });
    } catch (err) {
      console.error("Failed to fetch cloud stats", err);
    }
  },

  // 3. 登录拦截与 TabBar 联动
  handleLoginClick() {
    this.setData({ showLoginPopup: true });
    if (this.getTabBar()) this.getTabBar().setTabBarHidden(true);
  },

  async handleLoginClick() {
    // 1. 视觉反馈：显示加载中，更有终端校验感
    this.setData({ pageLoading: true });

    try {
      // 2. 调用云函数 check 模式
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: { action: "check" },
      });

      if (res.result.success && res.result.registered) {
        // --- 情况 A：老特工，直接进入 ---
        wx.showToast({ title: "登陆成功", icon: "success" });

        // 更新全局和本地状态
        app.globalData.isLogin = true;
        app.globalData.userInfo = res.result.data;
        wx.setStorageSync("userInfo", res.result.data);

        this.syncUserState(); // 刷新页面样式
      } else {
        // --- 情况 B：新特工，弹出注册窗口 ---
        this.setData({ showLoginPopup: true });
        if (this.getTabBar()) this.getTabBar().setTabBarHidden(true);
      }
    } catch (err) {
      wx.showToast({ title: "啊哦出错了", icon: "none" });
    } finally {
      this.setData({ pageLoading: false });
    }
  },

  onLoginClose() {
    this.setData({ showLoginPopup: false });
    if (this.getTabBar()) this.getTabBar().setTabBarHidden(false);
  },

  // 4. 注册成功回调
  async onRegister(e) {
    const { nickname, avatarUrl } = e.detail;
    wx.showLoading({ title: "档案激活中...", mask: true });

    try {
      // 先上传头像
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `user_avatars/${Date.now()}.png`,
        filePath: avatarUrl,
      });

      // 调云函数注册
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: {
          action: "register",
          userInfo: { nickname, avatarUrl: uploadRes.fileID },
        },
      });

      if (res.result.success) {
        app.globalData.isLogin = true;
        app.globalData.userInfo = res.result.data;
        wx.setStorageSync("userInfo", res.result.data);

        this.onLoginClose();
        this.syncUserState();
      }
    } catch (err) {
      wx.showToast({ title: "激活失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  openDonate() {
    const app = getApp();

    // 1. 拦截未登录用户
    if (!app.globalData.isLogin) {
      this.setData({ showLoginPopup: true });
      return;
    }

    // 2. 已登录，执行打赏逻辑
    wx.showActionSheet({
      itemList: ["查看赞赏码", "观看视频支持(广告)"],
      itemColor: "#ff4655",
      success: (res) => {
        if (res.tapIndex === 0) {
          // 展示赞赏码预览
          wx.previewImage({
            urls: ["你的赞赏码云存储链接"],
            current: "你的赞赏码云存储链接",
          });
        } else if (res.tapIndex === 1) {
          // 触发激励视频广告逻辑
          this.showRewardVideoAd();
        }
      },
    });
  },

  // 个人中心页的跳转方法
  navToSkinCombo() {
    wx.reLaunch({
      // 传入 own=1 标识
      url: "/pages/skins/index?own=1",
    });
  },

  // 跳转到我的准星收藏
  navToMyCrosshair() {
    wx.navigateTo({
      // 🚩 路径拼接规则：/分包root/页面path
      // 传入 isFav=1 或 own=1 供目标页面判断是否只显示收藏
      url: "/packageTools/pages/crosshair/list?isFav=1",
    });
  },

  async handleCheckIn() {
    if (!this.data.isLogin) {
      this.setData({ showLoginPopup: true });
      return;
    }
    if (this.data.hasCheckedIn) return;

    // 瓦式加载提示
    wx.showLoading({ title: "签到中...", mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: { action: "checkIn" },
      });

      if (res.result.success) {
        this.setData({
          hasCheckedIn: true,
          "userInfo.points": res.result.newPoints,
        });
        // 这里的提示也可以做得更硬核一点
        wx.showToast({ title: "签到成功", icon: "success" });
      } else {
        wx.showToast({ title: res.result.msg || "补给失败", icon: "none" });
      }
    } catch (err) {
      wx.showToast({ title: "啊哦出错了", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async handleCheckIn() {
    if (!this.data.isLogin) {
      this.setData({ showLoginPopup: true });
      return;
    }

    // 如果视图上已经是签到状态，直接拦截
    if (this.data.hasCheckedIn) return;

    // 瓦式加载提示
    wx.showLoading({ title: "同步辐射能...", mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: { action: "checkIn" },
      });

      if (res.result.success) {
        const newPoints = res.result.newPoints;

        // 1. 获取北京时间当前日期字符串 (用于更新本地状态)
        const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
        const todayStr = now.toISOString().split("T")[0];

        // 2. 更新当前页面视图 (立刻看到数字跳动和按钮变灰)
        this.setData({
          hasCheckedIn: true,
          "userInfo.points": newPoints,
        });

        // 3. 同步更新全局变量 (防止切换 Tab 后数据回退)
        if (app.globalData.userInfo) {
          app.globalData.userInfo.points = newPoints;
          // 必须同步更新 actionLimit 对象，否则 syncUserState 会判断失效
          if (!app.globalData.userInfo.actionLimit) {
            app.globalData.userInfo.actionLimit = {};
          }
          app.globalData.userInfo.actionLimit.lastActionDate = todayStr;
        }

        // 4. 同步更新本地持久化缓存
        wx.setStorageSync("userInfo", app.globalData.userInfo);

        // 瓦式硬核提示
        wx.showToast({
          title: "辐射能 +3 已入库",
          icon: "success",
          duration: 2000,
        });
      } else {
        wx.showToast({ title: res.result.msg || "补给链路中断", icon: "none" });
      }
    } catch (err) {
      console.error("签到故障:", err);
      wx.showToast({ title: "终端连接失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // 5. 注销档案
  handleLogout() {
    wx.showModal({
      title: "注销确认",
      content: "确定注销当前特工档案吗？",
      confirmColor: "#ff4655",
      success: (res) => {
        if (res.confirm) {
          app.globalData.isLogin = false;
          app.globalData.userInfo = null;
          wx.clearStorageSync();
          this.setData({
            favoriteCount: 0,
            uploadCount: 0,
          });
          this.syncUserState();
        }
      },
    });
  },

  handleLogout() {
    wx.showModal({
      title: "注销确认",
      content: "确定注销当前特工档案吗？",
      confirmText: "确认注销",
      cancelText: "返回",
      confirmColor: "#ff4655", // 保持你的瓦红主题色
      success: (res) => {
        if (res.confirm) {
          // 1. 清除全局状态
          app.globalData.isLogin = false;
          app.globalData.userInfo = null;

          // 2. 清除缓存
          wx.clearStorageSync();

          // 3. 🚩 关键：重置当前页面的 Data 状态，让视图强制刷新
          this.setData(
            {
              isLogin: false,
              userInfo: null,
              favoriteCount: 0,
              uploadCount: 0,
              hasCheckedIn: false,
            },
            () => {
              // 4. 执行状态同步逻辑（可选，如果有其他联动逻辑）
              this.syncUserState();

              wx.showToast({
                title: "连接已断开",
                icon: "none",
              });
            },
          );
        }
      },
    });
  },
});
