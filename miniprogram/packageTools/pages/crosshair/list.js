const crosshairData = require("./crosshairs_new.js");
import { toggleFavoriteStatus } from "../../../utils/fav.js";
const app = getApp();

Page({
  data: {
    crosshairList: [],
    pageLoading: true,
    showLoginPopup: false,
    pendingId: null, // 🚩 新增：记录待操作的 ID
  },

  async onLoad() {
    this.initData();
    await this.checkUserAuth(); // 🚩 核心：同步登录态
  },

  async checkUserAuth() {
    // 如果全局已经有了，就不调云函数了
    if (app.globalData.isLogin) return;

    try {
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: { action: "check" },
      });

      if (res.result.success && res.result.registered) {
        // 数据库里有此特工，静默登录
        app.globalData.isLogin = true;
        app.globalData.userInfo = res.result.data;
        wx.setStorageSync("userInfo", res.result.data);
        // console.log("特工档案已自动同步");
      }
    } catch (e) {
      console.error("档案同步失败", e);
    }
  },

  onLoginClose() {
    this.setData({ showLoginPopup: false });
  },

  async onRegister(e) {
    const { nickname, avatarUrl } = e.detail;

    // 基础校验
    if (!nickname || !avatarUrl) {
      wx.showToast({ title: "信息不完整", icon: "none" });
      return;
    }

    wx.showLoading({ title: "档案激活中...", mask: true });

    try {
      // Step 1: 上传头像到云存储
      const cloudPath = `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl,
      });

      // Step 2: 调用 manageUser 云函数进行注册
      const res = await wx.cloud.callFunction({
        name: "manageUser",
        data: {
          action: "register",
          userInfo: {
            nickname: nickname,
            avatarUrl: uploadRes.fileID,
          },
        },
      });

      if (res.result && res.result.success) {
        // Step 3: 更新全局状态与本地缓存
        const serverUserInfo = res.result.data;
        app.globalData.isLogin = true;
        app.globalData.userInfo = serverUserInfo;
        wx.setStorageSync("userInfo", serverUserInfo);

        // Step 4: UI 反馈与关闭弹窗
        this.setData({ showLoginPopup: false });
        if (this.data.pendingId) {
          // 这里的 id 就是刚才存下的那个
          const id = this.data.pendingId;

          // 直接调用你封装好的收藏方法
          await this.executeFavorite(id);

          // 执行完记得清空，防止下次登录莫名其妙又触发
          this.setData({ pendingId: null });
        } else {
          // 如果不是因为点击收藏触发的登录（比如用户主动点登录），就只刷新列表
          if (this.initData) await this.initData();
        }

        // Step 5: 关键 - 注册成功后重新加载数据
        // 这样可以获取到该用户在云端已有的收藏状态
        if (this.initData) {
          await this.initData();
        }

        wx.showToast({ title: "档案已激活", icon: "success" });
      } else {
        throw new Error(res.result.msg || "注册失败");
      }
    } catch (err) {
      console.error("注册流程故障:", err);
      wx.showToast({ title: "激活失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
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
      console.log("当前数据库返回的收藏列表:", favRes.data); // 🚩 看看这里到底是不是空的
      // 拿到所有已收藏的 targetId 数组
      const myFavIds = favRes.data.map((f) => f.targetId);
      console.log("解析出的 ID 数组:", myFavIds);
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

  // 把原本 toggleFavorite 里的核心逻辑抽出来
  async executeFavorite(id) {
    const list = this.data.crosshairList;
    const index = list.findIndex((item) => item._id === id);
    if (index === -1) return;

    const oldStatus = list[index].isFavorite;

    // 1. 乐观更新
    this.setData({ [`crosshairList[${index}].isFavorite`]: !oldStatus });

    try {
      // 2. 调用工具类
      await toggleFavoriteStatus(id, "crosshair");
    } catch (err) {
      // 失败回滚
      this.setData({ [`crosshairList[${index}].isFavorite`]: oldStatus });
      wx.showToast({ title: "操作失败", icon: "none" });
    }
  },

  async toggleFavorite(e) {
    // 1. 身份校验拦截
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingId: e.currentTarget.dataset.id, // 🚩 存到 data 里
      });
      console.log(this.data.showLoginPopup);

      wx.showToast({ title: "请先注册档案", icon: "none" });
      return;
    }

    const id = e.currentTarget.dataset.id;
    const list = this.data.crosshairList;
    const index = list.findIndex((item) => item._id === id);

    if (index === -1) return;

    const oldStatus = list[index].isFavorite;

    // 2. 乐观更新 UI
    this.setData({
      [`crosshairList[${index}].isFavorite`]: !oldStatus,
    });

    try {
      // 3. 调用通用工具执行数据库操作
      const res = await toggleFavoriteStatus(id, "crosshair");

      wx.showToast({
        title: res.isFavorite ? "收藏成功" : "已移除收藏",
        icon: "none",
      });
    } catch (err) {
      // 失败回滚状态
      this.setData({ [`crosshairList[${index}].isFavorite`]: oldStatus });
      console.error("收藏操作失败:", err);
      wx.showToast({ title: "同步失败，请重试", icon: "none" });
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
