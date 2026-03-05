const mapsData = require("../../../config/maps_data.js");

Page({
  data: {
    detail: {},
    mapBaseIcon: "",
    // 每一个涉及 swiper 的字段都需要一个独立的 index 记录
    standIndex: 0,
    aimIndex: 0,
    enemyIndex: 0,
    resultIndex: 0,
    isPreview: false,
    standIndex: 0,
    aimIndex: 0,
    enemyIndex: 0,
    resultIndex: 0,
    userAction: "",
  },

  onLoad(options) {
    if (options.mode === "preview") {
      // 入口 A：预览模式，通常不需要查点赞状态
      this.loadPreviewData();
    } else if (options.id) {
      // 入口 B：从列表点击进入
      this.fetchDbDetail(options.id);
      // 🚩 新增：查询当前用户对该条数据的评价记录
      this.fetchUserAction(options.id);
    }
  },

  // 查询用户历史操作记录
  fetchUserAction(pointId) {
    const db = wx.cloud.database();
    db.collection("user_actions")
      .where({
        point_id: pointId,
        // 云数据库会自动过滤 _openid，只查询当前用户自己的记录
      })
      .get()
      .then((res) => {
        if (res.data.length > 0) {
          // 这里的 action_type 是你存入的 'up' 或 'down'
          this.setData({
            userAction: res.data[0].action_type,
          });
        }
      })
      .catch((err) => {
        console.error("查询用户评价状态失败:", err);
      });
  },

  // 加载预览数据（从 App 全局变量读取）
  loadPreviewData() {
    const app = getApp();
    const previewData = app.globalData.tempPreviewData;

    if (!previewData) {
      wx.showModal({
        title: "提示",
        content: "预览数据已失效",
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }

    this.setData(
      {
        detail: previewData,
        isPreview: true,
      },
      () => {
        this.initMapIcon(previewData.mapId);
      },
    );

    wx.setNavigationBarTitle({ title: "战术预演 (预览)" });
  },

  onSwiperChange: function (e) {
    console.log(e);

    // 获取当前滑动的组件对应的字段名（如 standIndex）
    const field = e.currentTarget.dataset.field;
    // 获取当前 Swiper 所在的索引
    const current = e.detail.current;

    // 动态设置 data
    this.setData({
      [field]: current,
    });

    // 可选：添加震动反馈，提升战术交互感
    // wx.vibrateShort({ type: 'light' });
  },
  onSwiperChange: function (e) {
    // 1. 从 dataset 中提取我们要修改的字段名 (如 standIndex)
    const field = e.currentTarget.dataset.field;
    // 2. 获取当前 Swiper 的真实索引
    const current = e.detail.current;

    // 3. 动态更新
    this.setData({
      [field]: current,
    });

    // 4. 触感反馈（模拟战术终端操作感）
    // wx.vibrateShort({ type: 'light' });
  },

  async fetchDbDetail(id) {
    wx.showLoading({ title: "同步战术档案..." });
    const db = wx.cloud.database();
    try {
      const res = await db.collection("points").doc(id).get();
      let detailData = res.data;

      // 🚩 1. 安全初始化：确保 stats 字段存在，防止 handleAssess 运算出错
      if (!detailData.stats) {
        detailData.stats = { up: 0, down: 0, hot: 0, view: 0 };
      }

      this.setData(
        {
          detail: detailData,
          isPreview: false,
        },
        () => {
          this.initMapIcon(detailData.mapId);
        },
      );

      // 🚩 2. 获取档案后，紧接着查询当前用户的点赞/踩状态
      this.fetchUserAction(id);
    } catch (err) {
      console.error("获取详情失败", err);
      wx.showToast({ title: "档案已销毁", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async handleAssess(e) {
    if (this.data.isSyncing) return;

    const { type } = e.currentTarget.dataset;
    const { userAction, detail } = this.data;
    const pointId = detail._id;

    // wx.vibrateShort({ type: "medium" });

    // 1. 本地逻辑处理 (为了让 UI 秒变)
    let newAction = userAction === type ? "" : type;

    // 更新本地 UI 状态
    this.updateLocalUI(type, userAction, newAction);

    // 2. 云端逻辑处理 (真正的校验)
    this.setData({ isSyncing: true });

    try {
      const db = wx.cloud.database();
      const _ = db.command;

      // --- 核心步骤：调用云函数或直接操作 ---
      // 建议：如果你想绝对安全，这里用云函数。
      // 如果是前端直接操作，如下：

      if (newAction === "") {
        // 路径：取消点赞/踩 -> 删除行为记录，给点位减分
        await db
          .collection("user_actions")
          .where({
            point_id: pointId,
            _openid: "{openid}", // 自动匹配当前用户
          })
          .remove();

        await db
          .collection("points")
          .doc(pointId)
          .update({
            data: { [`stats.${userAction}`]: _.inc(-1) },
          });
      } else if (userAction === "") {
        // 路径：首次点赞/踩 -> 新增行为记录，给点位加分
        await db.collection("user_actions").add({
          data: {
            point_id: pointId,
            action_type: newAction,
            createTime: db.serverDate(),
          },
        });

        await db
          .collection("points")
          .doc(pointId)
          .update({
            data: { [`stats.${newAction}`]: _.inc(1) },
          });
      } else {
        // 路径：从赞切换到踩 (或反向) -> 更新行为记录，点位一减一加
        await db
          .collection("user_actions")
          .where({
            point_id: pointId,
          })
          .update({
            data: { action_type: newAction },
          });

        await db
          .collection("points")
          .doc(pointId)
          .update({
            data: {
              [`stats.${userAction}`]: _.inc(-1),
              [`stats.${newAction}`]: _.inc(1),
            },
          });
      }

      // 更新本地缓存 Storage (作为双重保险)
      const records = wx.getStorageSync("assess_records") || {};
      if (newAction) records[pointId] = newAction;
      else delete records[pointId];
      wx.setStorageSync("assess_records", records);
    } catch (err) {
      console.error("同步失败", err);
      // 这里可以加一个回滚 UI 的逻辑
    } finally {
      this.setData({ isSyncing: false });
    }
  },

  async handleAssess(e) {
    // 1. 状态锁：防止连续点击导致云函数并发冲突
    if (this.data.isSyncing) return;

    const { type } = e.currentTarget.dataset; // 当前点击的类型：'up' 或 'down'
    const { userAction, detail } = this.data;
    const pointId = detail._id;

    // 2. 交互反馈：震动触感反馈
    // wx.vibrateShort({ type: "medium" });

    // 3. 计算新状态逻辑（互斥切换）
    // 如果点的是已选中的，则取消(空)；否则设为新类型
    let newAction = userAction === type ? "" : type;

    // 4. 立即更新本地 UI (无需等待网络，保证瞬时响应)
    this.updateLocalUI(type, userAction, newAction);

    // 5. 开启同步锁
    this.setData({ isSyncing: true });

    try {
      // 🚩 核心：调用云函数执行原子操作
      // 云函数会处理：user_actions 的增删改 + points 统计的增减
      const res = await wx.cloud.callFunction({
        name: "assess_point",
        data: {
          pointId: pointId,
          oldAction: userAction,
          newAction: newAction,
        },
      });

      console.log("战术同步成功:", res);

      // 6. 更新本地持久化缓存（防止重复请求，双重保险）
      const records = wx.getStorageSync("assess_records") || {};
      if (newAction) {
        records[pointId] = newAction;
      } else {
        delete records[pointId];
      }
      wx.setStorageSync("assess_records", records);
    } catch (err) {
      console.error("战术同步失败:", err);

      // 🚩 异常回滚：如果云端同步失败，将 UI 回滚到操作前的状态
      wx.showToast({ title: "同步失败，正在回滚", icon: "none" });
      this.updateLocalUI(type, newAction, userAction);
    } finally {
      this.setData({ isSyncing: false });
    }
  },

  updateLocalUI(clickedType, oldAction, newAction) {
    const { detail } = this.data;
    const stats = detail.stats || { up: 0, down: 0 };

    let upCount = stats.up || 0;
    let downCount = stats.down || 0;

    // 逻辑：先减去旧的操作
    if (oldAction === "up") upCount = Math.max(0, upCount - 1);
    if (oldAction === "down") downCount = Math.max(0, downCount - 1);

    // 逻辑：加上新的操作
    if (newAction === "up") upCount += 1;
    if (newAction === "down") downCount += 1;

    this.setData({
      userAction: newAction,
      "detail.stats.up": upCount,
      "detail.stats.down": downCount,
    });
  },

  // 根据 mapId 匹配底图
  initMapIcon(mapId) {
    const maps = Array.isArray(mapsData) ? mapsData : mapsData.maps || [];
    const mapObj = maps.find((m) => m.uuid === mapId);
    if (mapObj) {
      this.setData({ mapBaseIcon: mapObj.displayIcon });
    }
  },

  // 通用 Swiper 切换处理
  onSwiperChange(e) {
    const { field } = e.currentTarget.dataset; // 对应 standIndex, enemyIndex 等
    this.setData({
      [field]: e.detail.current,
    });
  },

  // 图片全屏预览
  previewImage(e) {
    const { src, list } = e.currentTarget.dataset;
    wx.previewImage({
      current: src,
      urls: list.map((item) => item.url),
    });
  },
});
