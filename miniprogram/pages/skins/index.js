const db = wx.cloud.database();
import { AGENTS_CONFIG } from "../../config/agents_merged";
import { availableTags } from "../../config/tags";

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

    filterAgent: { displayName: "", uuid: "" },
    filterTag: "全部",
  },

  async onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2, // 对应你 list 里的索引，skins 是第 3 个，所以是 2
      });
      await this.refreshPresets();
      this.setData({ loading: false });
    }

    // this.fetchPresets();
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

  // index.js (我的方案列表页)

  async fetchPresets(isLoadMore = false) {
    // return;
    // 1. 状态拦截：如果没数据了且是加载更多，直接返回
    if (isLoadMore && !this.data.hasMore) return;

    const db = wx.cloud.database();
    const { page, pageSize, presets, filterAgent, filterTag } = this.data;
    // wx.showLoading({ title: "加载中...", mask: true });
    this.setData({ pageLoading: true }); // 开始加载
    try {
      // --- 步骤 1: 构建筛选条件并查询方案列表 ---
      let whereClause = {};
      if (filterAgent && filterAgent.uuid)
        whereClause["agent.uuid"] = filterAgent.uuid;
      if (filterTag && filterTag !== "全部") whereClause.tags = filterTag;

      const res = await db
        .collection("user_presets")
        .where(whereClause)
        .orderBy("createTime", "desc")
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      const rawData = res.data;
      if (rawData.length === 0) {
        this.setData({ presets: isLoadMore ? presets : [], hasMore: false });
        return;
      }

      // --- 步骤 2: 核心修复 - 只查询【当前用户】的收藏记录 ---
      const ids = rawData.map((i) => i._id);
      const favRes = await db
        .collection("user_favorites")
        .where({
          presetId: db.command.in(ids),
          // 关键：明确限制 openid。在小程序端，'{openid}' 会被自动替换为当前用户 ID
          // 同时请确保 user_favorites 的数据库权限设置为“仅创建者可读写”
          _openid: "{openid}",
        })
        .get();

      // 提取出当前用户真正收藏过的方案 ID 数组
      const favIds = favRes.data.map((f) => f.presetId);

      // --- 步骤 3: 批量获取图片的临时 HTTPS 链接 (解决显示失败) ---
      const cloudPaths = [];
      rawData.forEach((item) => {
        if (item.snapshot && item.snapshot.startsWith("cloud://")) {
          cloudPaths.push(item.snapshot);
        }
        const iconPath = `cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/${item.agent.uuid}.png`;
        cloudPaths.push(iconPath);
      });

      let tempFiles = [];
      if (cloudPaths.length > 0) {
        const uniquePaths = [...new Set(cloudPaths)];
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: uniquePaths,
        });
        tempFiles = tempRes.fileList;
      }

      // --- 步骤 4: 内存合并数据 ---
      const newData = rawData.map((item) => {
        const currentIconPath = `cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/${item.agent.uuid}.png`;

        const foundSnap = tempFiles.find((f) => f.fileID === item.snapshot);
        const foundIcon = tempFiles.find((f) => f.fileID === currentIconPath);

        return {
          ...item,
          // 只有在当前用户的 favIds 数组里存在的，才标记为已收藏
          isFavorite: favIds.includes(item._id),
          snapshot: foundSnap ? foundSnap.tempFileURL : item.snapshot,
          localAvatar: foundIcon ? foundIcon.tempFileURL : currentIconPath,
          dateStr: item.createTime ? this.formatDate(item.createTime) : "刚刚",
        };
      });

      // --- 步骤 5: 更新渲染 ---
      this.setData({
        presets: isLoadMore ? [...presets, ...newData] : newData,
        page: page + 1,
        hasMore: rawData.length === pageSize,
      });
    } catch (err) {
      console.error("fetchPresets 失败:", err);
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      // wx.hideLoading();
      this.setData({ pageLoading: false }); // 开始加载
      wx.stopPullDownRefresh();
    }
  },

  // index.js

  async fetchPresets(isLoadMore = false) {
    // 1. 状态拦截
    if (isLoadMore && !this.data.hasMore) return;

    const db = wx.cloud.database();
    const _ = db.command;
    const { page, pageSize, presets, filterAgent, filterTag, isFavoriteOnly } =
      this.data;

    // wx.showLoading({ title: "加载中...", mask: true });
    this.setData({ pageLoading: true }); // 开始加载
    try {
      // --- 步骤 1: 构建筛选基础条件 ---
      let whereClause = {};

      // A. 处理特工筛选
      if (filterAgent && filterAgent.uuid) {
        whereClause["agent.uuid"] = filterAgent.uuid;
      }

      // B. 处理标签筛选
      if (filterTag && filterTag !== "全部") {
        whereClause.tags = filterTag;
      }

      // --- 步骤 2: 处理“只看收藏”逻辑 ---
      // 在方案二下，必须先从收藏库拿到我收藏过的所有 ID
      const myFavRes = await db
        .collection("user_favorites")
        .where({ _openid: "{openid}" })
        .field({ presetId: true })
        .get();

      const allMyFavIds = myFavRes.data.map((f) => f.presetId);

      if (isFavoriteOnly) {
        // 如果用户开启了“只看收藏”，但收藏库是空的，直接返回空列表
        if (allMyFavIds.length === 0) {
          this.setData({ presets: [], hasMore: false });
          // wx.hideLoading();
          this.setData({ pageLoading: false }); // 开始加载
          return;
        }
        // 这里的逻辑是：在已有的筛选基础上，增加 ID 必须在收藏列表中的限制
        whereClause._id = _.in(allMyFavIds);
      }

      // --- 步骤 3: 查询方案主表 ---
      const res = await db
        .collection("user_presets")
        .where(whereClause)
        .orderBy("createTime", "desc")
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      const rawData = res.data;
      if (rawData.length === 0) {
        this.setData({
          presets: isLoadMore ? presets : [],
          hasMore: false,
        });
        return;
      }

      // --- 步骤 4: 批量获取图片的临时 HTTPS 链接 ---
      const cloudPaths = [];
      rawData.forEach((item) => {
        if (item.snapshot && item.snapshot.startsWith("cloud://")) {
          cloudPaths.push(item.snapshot);
        }
        const iconPath = `cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/${item.agent.uuid}.png`;
        cloudPaths.push(iconPath);
      });

      let tempFiles = [];
      if (cloudPaths.length > 0) {
        const uniquePaths = [...new Set(cloudPaths)];
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: uniquePaths,
        });
        tempFiles = tempRes.fileList;
      }

      // --- 步骤 5: 内存合并数据 (包含收藏状态匹配) ---
      const newData = rawData.map((item) => {
        const currentIconPath = `cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/${item.agent.uuid}.png`;
        const foundSnap = tempFiles.find((f) => f.fileID === item.snapshot);
        const foundIcon = tempFiles.find((f) => f.fileID === currentIconPath);

        return {
          ...item,
          // 关键：即使没开“只看收藏”，我们也要标记出哪些是已收藏的，以便星星变色
          isFavorite: allMyFavIds.includes(item._id),
          snapshot: foundSnap ? foundSnap.tempFileURL : item.snapshot,
          localAvatar: foundIcon ? foundIcon.tempFileURL : currentIconPath,
          dateStr: item.createTime ? this.formatDate(item.createTime) : "刚刚",
        };
      });

      // --- 步骤 6: 更新视图 ---
      this.setData({
        presets: isLoadMore ? [...presets, ...newData] : newData,
        page: page + 1,
        hasMore: rawData.length === pageSize,
      });
    } catch (err) {
      console.error("fetchPresets 失败:", err);
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      // wx.hideLoading();
      this.setData({ pageLoading: false }); // 开始加载
      wx.stopPullDownRefresh();
    }
  },

  // index.js

  async fetchPresets(isLoadMore = false) {
    // 1. 状态拦截：如果没数据了且是加载更多，直接返回
    if (isLoadMore && !this.data.hasMore) return;

    const db = wx.cloud.database();
    const _ = db.command;
    // 从 data 中解构筛选状态
    const { page, pageSize, presets, filterAgent, filterTag, isFavoriteOnly } =
      this.data;
    this.setData({ pageLoading: true }); // 开始加载
    // wx.showLoading({ title: "加载中...", mask: true });

    try {
      // --- 步骤 1: 获取当前用户【所有的】收藏 ID (不分页) ---
      // 这一步必须做，因为即使在全量模式下，我们也需要用它来点亮星星
      const favRes = await db
        .collection("user_favorites")
        .where({ _openid: "{openid}" })
        .limit(1000) // 假设普通用户收藏不会超过1000个
        .field({ presetId: true })
        .get();

      const allMyFavIds = favRes.data.map((f) => f.presetId);

      // --- 步骤 2: 构建主表查询的 where 条件 ---
      let whereClause = {};

      // A. 特工过滤
      if (filterAgent && filterAgent.uuid) {
        whereClause["agent.uuid"] = filterAgent.uuid;
      }

      // B. 标签过滤
      if (filterTag && filterTag !== "全部") {
        whereClause.tags = filterTag;
      }

      // C. 收藏模式过滤
      if (isFavoriteOnly) {
        // 如果开启了只看收藏但没数据，直接提前返回
        if (allMyFavIds.length === 0) {
          this.setData({ presets: [], hasMore: false });
          // wx.hideLoading();
          this.setData({ pageLoading: false }); // 开始加载
          return;
        }
        // 核心修复：将主表的查询范围限制在我的收藏 ID 列表内
        // 这样主表的 skip(page * pageSize) 才能在正确的集合里生效
        whereClause._id = _.in(allMyFavIds);
      }

      // --- 步骤 3: 查询方案主表 (这里是分页发生的地方) ---
      const res = await db
        .collection("user_presets")
        .where(whereClause)
        .orderBy("createTime", "desc")
        .skip(page * pageSize) // 这里的 page 已经在 onLoad 或下拉刷新时重置为 0
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

      // --- 步骤 5: 批量获取图片的临时链接 (CDN 优化) ---
      const cloudPaths = [];
      rawData.forEach((item) => {
        if (item.snapshot?.startsWith("cloud://"))
          cloudPaths.push(item.snapshot);
        const iconPath = `cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/${item.agent.uuid}.png`;
        cloudPaths.push(iconPath);
      });

      let tempFiles = [];
      if (cloudPaths.length > 0) {
        const uniquePaths = [...new Set(cloudPaths)];
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: uniquePaths,
        });
        tempFiles = tempRes.fileList;
      }

      // --- 步骤 6: 内存合并数据并渲染 ---
      const newData = rawData.map((item) => {
        const currentIconPath = `cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/${item.agent.uuid}.png`;
        const foundSnap = tempFiles.find((f) => f.fileID === item.snapshot);
        const foundIcon = tempFiles.find((f) => f.fileID === currentIconPath);

        return {
          ...item,
          isFavorite: allMyFavIds.includes(item._id), // 匹配收藏状态
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
      // wx.hideLoading();
      this.setData({ pageLoading: false }); // 开始加载
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
        // currentTab: defaultTab,
        // popupTabs: isHero ? this.data.heroTabs : this.data.weaponTabs,
      });
    } else {
      list = this.data.availableTags;
    }
    this.hideTabBar();
    this.setData({
      popupType: type,
      popupList: list,
      showPopup: true,
    });
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
    wx.navigateTo({
      url: `/packageWallpaper/pages/wallpaper/wallpaper`,
    });
  },

  onImageError(e) {
    console.log("完整 item 数据:", e);
    console.error("图片加载失败，路径:", e.currentTarget.dataset.path);
  },

  // index.js (我的方案列表页)

  async toggleFavorite(e) {
    const presetId = e.currentTarget.dataset.id;
    const presets = this.data.presets;
    const index = presets.findIndex((p) => p._id === presetId);
    if (index === -1) return;

    const isAlreadyFavorited = presets[index].isFavorite || false;
    const db = wx.cloud.database();
    const _ = db.command;

    // 1. 乐观更新 UI
    this.setData({
      [`presets[${index}].isFavorite`]: !isAlreadyFavorited,
    });

    try {
      if (!isAlreadyFavorited) {
        // --- 执行【收藏】动作 ---
        await db.collection("user_favorites").add({
          data: {
            presetId: presetId,
            createTime: db.serverDate(),
          },
        });
        wx.showToast({ title: "已收藏", icon: "none" });
      } else {
        // --- 执行【取消收藏】动作 ---
        // 注意：这里需要根据 presetId 和自己的 openid 来删除
        await db
          .collection("user_favorites")
          .where({
            presetId: presetId,
          })
          .remove();
        wx.showToast({ title: "已取消", icon: "none" });
      }
    } catch (err) {
      console.error("收藏操作失败:", err);
      // 回滚 UI
      this.setData({
        [`presets[${index}].isFavorite`]: isAlreadyFavorited,
      });
      wx.showToast({ title: "操作失败", icon: "none" });
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
