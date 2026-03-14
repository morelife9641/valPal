const db = wx.cloud.database();
import { AGENTS_CONFIG } from "../../config/agents_merged";
import { availableTags } from "../../config/tags";
import { toggleFavoriteStatus } from "../../utils/fav";
const app = getApp();

Page({
  data: {
    pageLoading: false,
    presets: [],
    page: 0,
    pageSize: 10,
    hasMore: true,
    loading: true, // 初始设为 true，显示骨架屏
    agentList: AGENTS_CONFIG, // 这里存放从全局或者数据库拿到的所有英雄
    availableTags: availableTags,
    showPopup: false,
    popupType: "", // 'hero' 或 'tag'
    popupList: [],
    isFavoriteOnly: false,
    filterAgent: { displayName: "", uuid: "" },
    filterTag: "全部",
    fromUserCenter: false,
    showLoginPopup: false,
    pendingId: null, // 记录想收藏的预设 ID
    pendingEditor: false, // 记录是否想去编辑器
  },

  async onShow() {
    // 1. 同步 TabBar (保持原有)
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }

    // 2. 获取参数
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage.options || {};

    // 3. 逻辑判断
    if (options.own === "1") {
      // 只要标识存在，强制进入“只看收藏”状态
      if (!this.data.isFavoriteOnly) {
        this.toggleFavoriteFilter();
        this.hideTabBar();
        this.setData({
          fromUserCenter: true,
          isFavoriteOnly: true,
          page: 0,
          presets: [],
        });
      } else {
        // 如果已经是收藏状态，手动触发一次刷新即可
        this.refreshPresets();
      }

      // 🚩 重要：用完即焚，防止页面隐藏再显示时重复触发
      currentPage.options.own = null;
    } else {
      // 正常进入页面，执行普通刷新
      await this.refreshPresets();
    }

    this.setData({ loading: false });
  },

  navBackToUser() {
    this.setData({ fromUserCenter: false, isFavoriteOnly: false }); // 重置标识
    wx.switchTab({
      url: "/pages/tools/index", // 替换成你真实的个人中心路径
    });
    this.showTabBar();
  },

  navBackToUser() {
    // 🚩 1. 先触发动画效果
    this.setData({ isExiting: true });

    // 🚩 2. 延迟执行跳转，给动画留出 200-300ms 时间
    setTimeout(() => {
      this.setData({
        fromUserCenter: false,
        isFavoriteOnly: false,
        isExiting: false, // 重置状态供下次使用
      });

      wx.switchTab({
        url: "/pages/tools/index",
        success: () => {
          // 确保在目标页显示 TabBar
          this.showTabBar();
        },
      });
    }, 250);
  },

  onPullDownRefresh() {
    this.setData({ page: 0, hasMore: true }, () => {
      this.fetchPresets(false); // 传入 false 表示重置数据
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchPresets(true); // 传入 true 表示追加数据
    }
  },

  refreshPresets() {
    this.setData(
      {
        page: 0,
        presets: [],
        hasMore: true,
      },
      () => {
        // 状态重置完成后，再发起请求
        this.fetchPresets(false);
      },
    );
  },

  togglePopup() {
    this.setData({
      showPopup: false,
    });
    // 如果之前隐藏了 TabBar，记得在这里恢复
    if (typeof wx.showTabBar === "function") {
      wx.showTabBar({ animation: true });
    }
  },

  async fetchPresets(isLoadMore = false) {
    // 1. 状态拦截：如果没数据了且是加载更多，直接返回
    if (isLoadMore && !this.data.hasMore) return;

    const db = wx.cloud.database();
    const _ = db.command;
    const { page, pageSize, presets, filterAgent, filterTag, isFavoriteOnly } =
      this.data;

    // --- 核心改动：换回原生 Loading ---
    wx.showLoading({
      title: isLoadMore ? "正在加载更多..." : "正在加载...",
      mask: true,
    });

    try {
      // --- 步骤 1: 获取当前用户收藏 ID ---
      const favRes = await db
        .collection("user_favorites")
        .where({ _openid: "{openid}" })
        .limit(1000)
        .field({ presetId: true })
        .get();

      const allMyFavIds = favRes.data.map((f) => f.presetId);

      // --- 步骤 2: 构建查询条件 ---
      let whereClause = {};
      if (filterAgent && filterAgent.uuid) {
        whereClause["agent.uuid"] = filterAgent.uuid;
      }
      if (filterTag && filterTag !== "全部") {
        whereClause.tags = filterTag;
      }
      if (isFavoriteOnly) {
        if (allMyFavIds.length === 0) {
          this.setData({ presets: [], hasMore: false });
          return; // 这里会直接跳到 finally 执行 hideLoading
        }
        whereClause._id = _.in(allMyFavIds);
      }

      // --- 步骤 3: 分页查询 ---
      const res = await db
        .collection("user_presets")
        .where(whereClause)
        .orderBy("createTime", "desc")
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      const rawData = res.data;

      // --- 步骤 4: 处理空数据 ---
      if (rawData.length === 0) {
        this.setData({
          presets: isLoadMore ? presets : [],
          hasMore: false,
        });
        return;
      }

      // --- 步骤 5: 批量获取 CDN 临时链接 ---
      const cloudPaths = [];
      const baseIconUrl =
        "cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/";

      rawData.forEach((item) => {
        if (item.snapshot?.startsWith("cloud://"))
          cloudPaths.push(item.snapshot);
        cloudPaths.push(`${baseIconUrl}${item.agent.uuid}.png`);
      });

      let tempFiles = [];
      if (cloudPaths.length > 0) {
        const uniquePaths = [...new Set(cloudPaths)];
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: uniquePaths,
        });
        tempFiles = tempRes.fileList;
      }

      // --- 步骤 6: 数据合并 ---
      const newData = rawData.map((item) => {
        const currentIconPath = `${baseIconUrl}${item.agent.uuid}.png`;
        const foundSnap = tempFiles.find((f) => f.fileID === item.snapshot);
        const foundIcon = tempFiles.find((f) => f.fileID === currentIconPath);

        return {
          ...item,
          isFavorite: allMyFavIds.includes(item._id),
          snapshot: foundSnap ? foundSnap.tempFileURL : item.snapshot,
          localAvatar: foundIcon ? foundIcon.tempFileURL : currentIconPath,
          dateStr: item.createTime ? this.formatDate(item.createTime) : "刚刚",
        };
      });

      this.setData({
        presets: isLoadMore ? [...presets, ...newData] : newData,
        page: page + 1,
        hasMore: rawData.length === pageSize,
      });
    } catch (err) {
      console.error("fetchPresets Error:", err);
      wx.showToast({ title: "同步失败", icon: "none" });
    } finally {
      // --- 核心改动：统一关闭 Loading ---
      wx.hideLoading();
      wx.stopPullDownRefresh();
    }
  },

  async fetchPresets(isLoadMore = false) {
    // 1. 状态拦截：如果没数据了且是加载更多，直接返回
    if (isLoadMore && !this.data.hasMore) return;

    const db = wx.cloud.database();
    const _ = db.command;
    const { page, pageSize, presets, filterAgent, filterTag, isFavoriteOnly } =
      this.data;

    // --- 交互：换回原生 Loading ---
    wx.showLoading({
      title: isLoadMore ? "正在加载更多..." : "正在加载...",
      mask: true,
    });

    try {
      // --- 步骤 1: 获取当前用户收藏 ID (适配通用 fav.js) ---
      const favRes = await db
        .collection("user_favorites")
        .where({
          // _openid: "{openid}",
          type: "preset", // 🚩 核心修改：只取“预设”类型的收藏
        })
        .limit(1000)
        .field({ targetId: true }) // 🚩 核心修改：对应 fav.js 存入的字段名
        .get();
      console.log("当前数据库里的收藏记录:", favRes.data);

      // 提取出当前业务的所有收藏 ID
      const allMyFavIds = favRes.data.map((f) => f.targetId);
      console.log("解析出的收藏ID列表:", allMyFavIds);
      // --- 步骤 2: 构建查询条件 ---
      let whereClause = {};
      if (filterAgent && filterAgent.uuid) {
        whereClause["agent.uuid"] = filterAgent.uuid;
      }
      if (filterTag && filterTag !== "全部") {
        whereClause.tags = filterTag;
      }
      if (isFavoriteOnly) {
        if (allMyFavIds.length === 0) {
          this.setData({ presets: [], hasMore: false });
          return;
        }
        // 这里的 _id 对应 user_presets 表里的主键
        whereClause._id = _.in(allMyFavIds);
      }

      // --- 步骤 3: 分页查询主表 ---
      const res = await db
        .collection("user_presets")
        .where(whereClause)
        .orderBy("createTime", "desc")
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      const rawData = res.data;

      // --- 步骤 4: 处理空数据情况 ---
      if (rawData.length === 0) {
        this.setData({
          presets: isLoadMore ? presets : [],
          hasMore: false,
        });
        return;
      }

      // --- 步骤 5: 批量获取 CDN 临时链接 (保持原有优化逻辑) ---
      const cloudPaths = [];
      const baseIconUrl =
        "cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/";

      rawData.forEach((item) => {
        if (item.snapshot?.startsWith("cloud://"))
          cloudPaths.push(item.snapshot);
        cloudPaths.push(`${baseIconUrl}${item.agent.uuid}.png`);
      });

      let tempFiles = [];
      if (cloudPaths.length > 0) {
        const uniquePaths = [...new Set(cloudPaths)];
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: uniquePaths,
        });
        tempFiles = tempRes.fileList;
      }

      // --- 步骤 6: 数据合并并点亮星星 ---
      const newData = rawData.map((item) => {
        const currentIconPath = `${baseIconUrl}${item.agent.uuid}.png`;
        const foundSnap = tempFiles.find((f) => f.fileID === item.snapshot);
        const foundIcon = tempFiles.find((f) => f.fileID === currentIconPath);

        return {
          ...item,
          // 🚩 核心修改：利用 targetId 列表匹配当前 item 的 _id
          isFavorite: allMyFavIds.includes(item._id),
          snapshot: foundSnap ? foundSnap.tempFileURL : item.snapshot,
          localAvatar: foundIcon ? foundIcon.tempFileURL : currentIconPath,
          dateStr: item.createTime ? this.formatDate(item.createTime) : "刚刚",
        };
      });

      this.setData({
        presets: isLoadMore ? [...presets, ...newData] : newData,
        page: page + 1,
        hasMore: rawData.length === pageSize,
      });
    } catch (err) {
      console.error("fetchPresets Error:", err);
      wx.showToast({ title: "同步失败", icon: "none" });
    } finally {
      wx.hideLoading();
      wx.stopPullDownRefresh();
    }
  },

  // 下拉加载更多
  loadMore() {
    this.fetchPresets(true);
  },

  // 时间格式化工具
  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
  },

  openFilter(e) {
    const type = e.currentTarget.dataset.type;
    let list = [];

    if (type === "hero") {
      this.setData({
        showPopup: true,
        popupType: type,
      });
    } else {
      // 处理 Tag 逻辑
      list = this.data.availableTags || [
        "枪械练习",
        "身法练习",
        "战术模拟",
        "皮肤展示",
        "上分教学",
      ];
      this.setData({
        popupType: type,
        popupList: list,
        showPopup: true,
        // 可以在这里重置一下 Tag 弹窗内部的滚动位置
      });
    }

    this.hideTabBar();
  },

  onTagSelect(e) {
    const tag = e.currentTarget.dataset.tag;

    // 震动反馈
    // wx.vibrateShort({ type: "light" });

    this.setData(
      {
        filterTag: tag,
        showPopup: false,
        page: 0,
        presets: [],
      },
      () => {
        this.showTabBar();
        this.fetchPresets(false);
      },
    );
  },

  // 3. 统一关闭逻辑 (Mask点击)
  togglePopup() {
    this.setData({ showPopup: false });
    this.showTabBar();
  },

  hideTabBar() {
    // 获取自定义 tabBar 组件实例
    const tabBar = this.getTabBar();

    if (tabBar) {
      tabBar.setTabBarHidden(true); // 隐藏 tabBar
    }
  },
  showTabBar() {
    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false); // 显示 tabBar
    }
  },

  togglePopup() {
    this.setData({ showPopup: false });
    const tabBar = this.getTabBar();

    if (tabBar) {
      tabBar.setTabBarHidden(false); // 显示 tabBar
    }
    // wx.showTabBar({ animation: true });
  },
  // 清除特工筛选
  clearAgentFilter() {
    this.setData(
      {
        filterAgent: { displayName: "", uuid: "" },
        page: 0,
        presets: [],
      },
      () => this.fetchPresets(false),
    );
  },

  // 清除标签筛选
  clearTagFilter() {
    this.setData(
      {
        filterTag: "全部",
        page: 0,
        presets: [],
      },
      () => this.fetchPresets(false),
    );
  },
  onFilterSelect(e) {
    // return;
    // e.detail.item 是从组件 triggerEvent 传出来的特工对象
    const agent = e.detail.item;

    this.setData(
      {
        // 如果选的是“全部”，组件传回的可能是 null，所以加个兜底
        filterAgent: agent || { displayName: "ALL", uuid: "" },
        showPopup: false,
        page: 0, // 过滤时必须重置页码
        presets: [], // 清空当前列表，准备装载新数据
      },
      () => {
        // 恢复 TabBar
        // wx.showTabBar({ animation: true });
        // 重新拉取数据库数据
        this.fetchPresets(false);
      },
    );
  },

  toggleFavoriteFilter() {
    if (this.data.fromUserCenter) {
      return;
    }
    const newStatus = !this.data.isFavoriteOnly;

    this.setData(
      {
        isFavoriteOnly: newStatus,
        page: 0,
        presets: [],
      },
      () => {
        // 重新发起 fetchPresets
        // 你的 fetchPresets 内部应该已经写了根据 isFavoriteOnly 过滤的逻辑
        this.fetchPresets(false);
      },
    );
  },

  goToEditor() {
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingEditor: true,
      });
      return;
    }
    wx.navigateTo({
      url: `/packageWallpaper/pages/wallpaper/wallpaper`,
    });
  },

  // 1. 触发入口
  goToEditor() {
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingEditor: true,
      });
      return;
    }
    // 🚩 打开分流弹窗
    this.setData({ showEditorSwitch: true });
  },

  // 2. 关闭弹窗
  closeEditorSwitch() {
    this.setData({ showEditorSwitch: false });
  },

  // 3. 执行具体跳转
  navToEditor(e) {
    const { type } = e.currentTarget.dataset;
    this.closeEditorSwitch();

    if (type === "crosshair") {
      wx.navigateTo({
        url: `/packageWallpaper/pages/wallpaper/wallpaper?mode=crosshair`,
      });
    } else {
      wx.navigateTo({
        url: `/packageWallpaper/pages/wallpaper/wallpaper?mode=agent`,
      });
    }
  },

  navToEditor(e) {
    const { type } = e.currentTarget.dataset;
    this.closeEditorSwitch();

    // 🚩 路径规则：/分包root/页面path
    let targetUrl = "";

    if (type === "crosshair") {
      // 准星壁纸跳转到 wallpaper 编辑页
      targetUrl = "/packageWallpaper/pages/wallpaper/wallpaper?mode=crosshair";
    } else {
      // 特工壁纸跳转到你指定的 display 页面
      targetUrl = "/packageWallpaper/pages/display/display?mode=agent";
    }

    wx.navigateTo({
      url: targetUrl,
      fail: (err) => {
        console.error("跳转失败，请检查路径:", err);
        wx.showToast({ title: "系统链路异常", icon: "none" });
      },
    });
  },

  prevent() {
    // 仅仅为了拦截滑动事件，防止穿透到背景列表
    return;
  },

  onImageError(e) {
    console.log("完整 item 数据:", e);
    console.error("图片加载失败，路径:", e.currentTarget.dataset.path);
  },

  // index.js (我的方案列表页)

  async toggleFavorite(e) {
    const presetId = e.currentTarget.dataset.id;
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingId: presetId, // 暂存预设 ID
      });
      return;
    }
    // 已登录，直接执行
    await this.executeFavorite(presetId);
  },

  onLoginClose() {
    this.setData({ showLoginPopup: false });
  },

  async executeFavorite(presetId) {
    const presets = this.data.presets;
    const index = presets.findIndex((p) => p._id === presetId);
    if (index === -1) return;

    const oldStatus = presets[index].isFavorite;

    // 乐观更新 UI
    this.setData({
      [`presets[${index}].isFavorite`]: !oldStatus,
    });

    try {
      const res = await toggleFavoriteStatus(presetId, "preset");

      // 根据返回结果微调同步
      if (res.isFavorite !== !oldStatus) {
        this.setData({
          [`presets[${index}].isFavorite`]: res.isFavorite,
        });
      }

      wx.showToast({
        title: res.isFavorite ? "收藏成功" : "已取消收藏",
        icon: "none",
      });
    } catch (err) {
      console.error("收藏失败:", err);
      this.setData({
        [`presets[${index}].isFavorite`]: oldStatus,
      });
      wx.showToast({ title: "操作失败", icon: "none" });
    }
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
        // Step 3: 更新状态
        const serverUserInfo = res.result.data;
        app.globalData.isLogin = true;
        app.globalData.userInfo = serverUserInfo;
        wx.setStorageSync("userInfo", serverUserInfo);

        this.setData({ showLoginPopup: false });

        // Step 4: 意图恢复
        if (this.data.pendingEditor) {
          // 恢复去编辑器
          this.setData({ pendingEditor: false });
          this.goToEditor(); // 此时已登录，会直接跳走
        } else if (this.data.pendingId) {
          // 恢复收藏操作
          const id = this.data.pendingId;
          this.setData({ pendingId: null });
          await this.executeFavorite(id);
        } else {
          // 纯手动登录，刷新页面收藏状态
          if (this.initData) await this.initData();
        }

        wx.showToast({ title: "档案激活成功", icon: "success" });
      }
    } catch (err) {
      console.error("激活失败:", err);
      wx.showToast({ title: "激活失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // index.js
  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageWallpaper/pages/preview/preview?presetId=${id}`,
    });
  },
});
