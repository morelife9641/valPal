const mapsData = require("../../../config/maps_data.js");
import { AGENTS_CONFIG } from "../../../config/agents_merged.js";

Page({
  data: {
    isEditing: false, // 默认是“查看模式”，防止滑动地图时误触
    mapName: "",
    heroName: "",
    formData: {
      title: "",
      side: "atk",
      mapId: "",
      pointType: "A", // 默认选中A区
      markPoints: [],
      standImg: [], // [{url: '', memo: ''}]
      enemyImg: [], // 修正后的变量名
      desc: "",
    },
  },

  onLoad() {
    // 1. 获取原始数据
    const rawMaps = Array.isArray(mapsData) ? mapsData : mapsData.maps || [];
    const agents = Array.isArray(AGENTS_CONFIG)
      ? AGENTS_CONFIG
      : AGENTS_CONFIG.agents || [];

    // 2. 定义目标地图白名单 (只要这些 key 对应的 displayName)
    const targetMaps = {
      幽邃地窟: "abyss",
      霓虹町: "split",
      微风岛屿: "breeze",
      深海明珠: "pearl",
      隐世修所: "haven",
      源工重镇: "bind",
      盐海矿镇: "corrode",
    };
    const allowedNames = Object.keys(targetMaps);

    // 3. 过滤地图：只保留白名单内的地图，并提取必要字段
    const filteredMaps = rawMaps
      .filter((m) => allowedNames.includes(m.displayName))
      .map((m) => ({
        uuid: m.uuid,
        displayName: m.displayName,
        displayIcon: m.displayIcon, // 绘图/预览底图
        listViewIconTall: m.listViewIconTall, // 备用
      }));

    // 4. 初始化默认选中状态
    let mapIndex = -1;
    let defaultMap = null;
    let currentMapIcon = "";

    if (filteredMaps.length > 0) {
      mapIndex = 0;
      defaultMap = filteredMaps[0];
      currentMapIcon = defaultMap.displayIcon;
    }

    // 5. 统一同步数据
    this.setData({
      maps: filteredMaps,
      allAgents: agents,

      // 地图选择器状态
      mapIndex: mapIndex,
      mapName: defaultMap ? defaultMap.displayName : "",
      currentMapIcon: currentMapIcon,

      // 初始化提交给后端的表单数据结构
      "formData.mapId": defaultMap ? defaultMap.uuid : "",
      "formData.side": "atk",
      "formData.markPoints": [],
      "formData.standImg": [],
      "formData.aimImg": [],
      "formData.enemyImg": [],
      "formData.resultImg": [],
      "formData.title": "",
      "formData.desc": "",
    });

    console.log("添加页初始化完成，默认地图:", this.data.mapName);
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  toggleEditMode() {
    const newStatus = !this.data.isEditing;
    this.setData({
      isEditing: newStatus,
    });

    // 增加交互反馈：震动一下
    // wx.vibrateShort({ type: "medium" });

    // 提示用户当前状态
    wx.showToast({
      title: newStatus ? "已进入战术部署模式" : "已进入地图查看模式",
      icon: "none",
      duration: 1000,
    });
  },

  clearMarks() {
    if (this.data.formData.markPoints.length === 0) return;

    wx.showModal({
      title: "重置确认",
      content: "是否清空当前所有地图标点？",
      confirmColor: "#ff4655", // 使用瓦罗兰特红
      success: (res) => {
        if (res.confirm) {
          this.setData({
            "formData.markPoints": [],
          });
          // wx.vibrateShort({ type: "heavy" });
        }
      },
    });
  },

  onPointSelect(e) {
    const point = e.currentTarget.dataset.point;
    this.setData({
      "formData.pointType": point,
    });
    // 增加震动反馈
    // wx.vibrateShort({ type: 'light' });
  },

  // 1. 切换阵营
  onSideSelect(e) {
    const { side } = e.currentTarget.dataset;

    // 获取当前已有的点位
    const updatedPoints = this.data.formData.markPoints.map((point) => {
      return { ...point, side: side }; // 把所有点的阵营都更新为当前选中的
    });

    this.setData({
      "formData.side": side,
      "formData.markPoints": updatedPoints,
    });

    // wx.vibrateShort({ type: 'light' });
  },

  onMapChange(e) {
    const idx = e.detail.value;
    const selected = this.data.maps[idx];
    this.setData(
      {
        mapIndex: idx,
        mapName: selected.displayName,
        "formData.mapId": selected.uuid,
        currentMapIcon: selected.displayIcon, // 核心：用于绘图
      },
      () => {
        // 选完地图立即初始化 Canvas 并画底图
        this.initMapCanvas();
      },
    );
  },

  onMapChange(e) {
    const idx = e.detail.value;
    const selected = this.data.maps[idx];

    // 1. 清空旧标点（可选）：换地图通常意味着之前的标点失效了
    // 2. 更新底图路径
    this.setData({
      mapIndex: idx,
      mapName: selected.displayName,
      "formData.mapId": selected.uuid,
      currentMapIcon: selected.displayIcon, // 这张图会自动通过 WXML 的 <image> 显示出来
      "formData.markPoints": [], // 建议换地图时清空点位，防止点位飘在空处
    });

    // 这里的 this.initMapCanvas(); 直接删掉
  },

  // 点击点位删除
  removeMark(e) {
    const { index } = e.currentTarget.dataset;
    let list = this.data.formData.markPoints;
    list.splice(index, 1);
    this.setData({
      "formData.markPoints": list,
    });
  },

  // 清空所有点
  clearMarks() {
    this.setData({ "formData.markPoints": [] });
  },

  // 初始化 Canvas 节点
  initMapCanvas() {
    const query = wx.createSelectorQuery();
    query
      .select("#mapCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");
        const dpr = wx.getSystemInfoSync().pixelRatio;

        // 处理高分屏模糊
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.canvasObj = canvas; // 存入实例供后续使用
        this.ctx = ctx;
        this.canvasSize = { w: res[0].width, h: res[0].height };

        this.drawMapLayer(); // 画底图
      });
  },

  navToPreview() {
    const { formData, mapName, currentMapIcon } = this.data;
    const app = getApp();

    // 1. 基础校验（可选）：至少有个标题或者标点
    if (!formData.title && formData.markPoints.length === 0) {
      return wx.showToast({ title: "添加点内容再预览吧", icon: "none" });
    }

    // 2. 构造完整的临时数据结构
    // 务必带上 currentMapIcon，否则详情页不知道底图是哪张
    app.globalData.tempPreviewData = {
      ...formData,
      mapName: mapName,
      mapIcon: currentMapIcon,
      createTimeDisplay: "PREVIEW / 预览中",
    };

    // 3. 跳转到分包详情页，传入 mode=preview 标识
    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?mode=preview`,
    });
  },

  drawMapLayer() {
    const query = wx.createSelectorQuery();
    query
      .select("#mapCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");

        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制地图
        const img = canvas.createImage();
        img.src = this.data.currentMapIcon; // 你的 displayIcon 链接
        img.onload = () => {
          // 1. 画地图
          ctx.drawImage(img, 0, 0, res[0].width, res[0].height);

          // 2. 紧接着画标点
          if (this.data.formData.markPos) {
            const { x, y } = this.data.formData.markPos;
            const color =
              this.data.formData.side === "def" ? "#00eeff" : "#ff4655";

            ctx.beginPath();
            ctx.arc(x * res[0].width, y * res[0].height, 8, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        };
      });
  },

  handleMapTouchEnd(e) {
    // 核心优化：如果不是编辑模式，直接退出，不执行计算
    if (!this.data.isEditing) return;

    if (e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const pageX = touch.pageX;
    const pageY = touch.pageY;

    const query = wx.createSelectorQuery();
    query
      .select(".map-touch-view")
      .boundingClientRect((rect) => {
        if (!rect) return;

        const relX = (pageX - rect.left) / rect.width;
        const relY = (pageY - rect.top) / rect.height;

        if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
          const newPoint = {
            x: relX,
            y: relY,
            side: this.data.formData.side || "atk",
          };

          this.setData({
            "formData.markPoints": [...this.data.formData.markPoints, newPoint],
          });

          // wx.vibrateShort({ type: "light" });
        }
      })
      .exec();
  },

  handleMapTouchEnd(e) {
    if (!this.data.isEditing) return;
    if (e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const { pageX, pageY } = touch;

    const query = wx.createSelectorQuery();
    // 关键：同时查询 view(当前缩放状态) 和 area(固定容器)
    query.select(".map-touch-view").boundingClientRect();
    query.select(".map-area").boundingClientRect();

    query.exec((res) => {
      const viewRect = res[0];
      const areaRect = res[1];
      if (!viewRect || !areaRect) return;

      // 1. 计算点击位置相对于【当前缩放后的图片】的比例
      let relX = (pageX - viewRect.left) / viewRect.width;
      let relY = (pageY - viewRect.top) / viewRect.height;

      // 2. 边界判定：必须在图片范围内
      // 这里的 0 到 1 是相对于图片内容的逻辑坐标
      if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
        // 3. 核心限制：必须在【容器区域】内部点击才生效
        // 防止用户点到容器外（如果图片溢出的话）
        const isInArea =
          pageX >= areaRect.left &&
          pageX <= areaRect.right &&
          pageY >= areaRect.top &&
          pageY <= areaRect.bottom;

        if (isInArea) {
          const newPoint = {
            x: relX,
            y: relY,
            side: this.data.formData.side || "atk",
          };

          this.setData({
            "formData.markPoints": [...this.data.formData.markPoints, newPoint],
          });

          // wx.vibrateShort({ type: "light" });
        }
      }
    });
  },

  // 刷新画布（底图 + 点）
  refreshCanvas() {
    // 简单的做法是重新调用 drawMapLayer，里面会顺便调 drawPointer
    this.drawMapLayer();
  },

  // 绘制那个“战术点”
  drawPointer() {
    const { x, y } = this.data.formData.markPos;
    const realX = x * this.canvasSize.w;
    const realY = y * this.canvasSize.h;

    // 阵营颜色
    const color = this.data.formData.side === "def" ? "#00eeff" : "#ff4655";

    this.ctx.save();
    // 1. 画外圈光晕
    this.ctx.beginPath();
    this.ctx.arc(realX, realY, 12, 0, Math.PI * 2);
    this.ctx.fillStyle = color + "33"; // 20% 透明度
    this.ctx.fill();

    // 2. 画实体圆点
    this.ctx.beginPath();
    this.ctx.arc(realX, realY, 6, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = "#fff";
    this.ctx.lineWidth = 2;
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  },

  // 图片上传
  uploadImg(e) {
    const { type } = e.currentTarget.dataset;
    const currentList = this.data.formData[type];

    wx.chooseMedia({
      count: 5 - currentList.length,
      mediaType: ["image"],
      success: (res) => {
        const newItems = res.tempFiles.map((file) => ({
          url: file.tempFilePath,
          memo: "",
        }));
        this.setData({
          [`formData.${type}`]: [...currentList, ...newItems],
        });
      },
    });
  },
  previewStandImg(e) {
    const imgUrl = e.currentTarget?.dataset.src || this.data.formData.standImg;
    wx.previewImage({
      current: imgUrl,
      urls: [imgUrl],
      // 预览时长按菜单（唯一编辑入口）
      longPressActions: {
        itemList: ["编辑图片", "保存到相册"], // 仅保留预览内操作
        success: (res) => {
          if (res.tapIndex === 0) {
            // 点击“编辑图片” → 触发编辑逻辑
            this.editStandImg(imgUrl);
          } else if (res.tapIndex === 1) {
            // 点击“保存到相册”
            this.saveImgToAlbum(imgUrl);
          }
        },
        fail: (err) => {
          console.error("长按菜单触发失败：", err);
        },
      },
    });
  },
  onMemoInput(e) {
    const { type, index } = e.currentTarget.dataset;
    const value = e.detail.value;
    const list = this.data.formData[type];
    list[index].memo = value;
    this.setData({ [`formData.${type}`]: list });
  },

  // 删除图片逻辑
  deleteImg(e) {
    const { type, index } = e.currentTarget.dataset;
    const list = this.data.formData[type];
    list.splice(index, 1);
    this.setData({ [`formData.${type}`]: list });
  },

  // 预览图片逻辑
  previewImg(e) {
    const { src, list } = e.currentTarget.dataset;
    wx.previewImage({
      current: src,
      urls: list.map((item) => item.url), // 提取出 url 字符串数组
    });
  },

  onAnonymousChange(e) {
    this.setData({
      "formData.isAnonymous": e.detail.value,
    });
  },

  async submitForm() {
    const { formData, mapName } = this.data;
    const userInfo = wx.getStorageSync("userInfo") || {};
    const isAnonymous = formData.isAnonymous || false;
    // 1. 基础校验
    if (!formData.title)
      return wx.showToast({ title: "请输入方案标题", icon: "none" });
    if (!formData.mapId)
      return wx.showToast({ title: "请选择地图", icon: "none" });

    if (!formData.pointType) {
      wx.showToast({ title: "请选择区域", icon: "none" });
      return;
    }
    if (formData.standImg.length === 0)
      // return wx.showToast({ title: "请上传至少一张站位图", icon: "none" });

      wx.showLoading({ title: "数据同步中...", mask: true });

    try {
      const imgFields = ["standImg", "aimImg", "enemyImg", "resultImg"];
      const finalFormData = { ...formData };

      for (const field of imgFields) {
        const imgList = formData[field];
        if (!imgList || imgList.length === 0) continue;

        const uploadPromises = imgList.map(async (item, index) => {
          if (
            item.url.startsWith("http://tmp") ||
            item.url.startsWith("wxfile://")
          ) {
            const cloudPath = `valorant/points/${Date.now()}_${field}_${index}.jpg`;
            const cloudUrl = await this.uploadFilePromise(cloudPath, item.url);
            return { ...item, url: cloudUrl };
          }
          return item;
        });
        finalFormData[field] = await Promise.all(uploadPromises);
      }

      const submitData = {
        ...finalFormData,
        mapName: mapName,
        createTime: new Date(),
        updateTime: new Date(),
        status: 1,
        _keywords: [formData.title, mapName].join(","),
        creator: {
          nickname: isAnonymous ? "匿名特工" : userInfo.nickname || "未知特工",
          avatar: isAnonymous
            ? "/images/default-avatar.png"
            : userInfo.avatarUrl || "", // 匿名则用默认头像
          _id: userInfo._id || "", // 方便后续点击头像跳转个人主页
          isAnonymous: isAnonymous,
        },
        stats: {
          up: 0, // 赞同 (实战有效)
          down: 0, // 质疑 (实战存疑)
          hot: 0, // 综合热度分数 (用于算法排序)
          view: 0, // 浏览量
        },
      };

      const db = wx.cloud.database();
      await db.collection("points").add({ data: submitData });

      wx.hideLoading();

      // --- 核心优化部分：交互弹窗 ---
      wx.showModal({
        title: "部署成功",
        content: "该战术方案已同步至云端数据库。",
        cancelText: "返回列表",
        cancelColor: "#ece8e1",
        confirmText: "继续添加",
        confirmColor: "#ff4655",
        success: (res) => {
          // 无论选哪个，都先通知列表页刷新
          const eventChannel = this.getOpenerEventChannel();
          if (eventChannel && eventChannel.emit) {
            eventChannel.emit("refreshList");
          }

          if (res.confirm) {
            // 路径 A：清空当前页面表单，准备下一次添加
            this.resetForm();
            // 滚动回顶部
            wx.pageScrollTo({ scrollTop: 0, duration: 300 });
          } else if (res.cancel) {
            // 路径 B：返回上级列表
            wx.navigateBack();
          }
        },
      });
    } catch (err) {
      console.error("同步失败：", err);
      wx.hideLoading();
      wx.showModal({
        title: "部署失败",
        content: "网络环境不稳定，请检查重试",
        showCancel: false,
      });
    }
  },

  /**
   * 配合方法：重置表单数据
   */
  resetForm() {
    // 建议保留 mapId, mapName, side 等高频复用项，只清空标题和图片，方便连续上传同一张图的点位
    this.setData({
      "formData.title": "",
      "formData.markPoints": [],
      "formData.standImg": [],
      "formData.aimImg": [],
      "formData.enemyImg": [],
      "formData.resultImg": [],
      "formData.desc": "",
    });
    wx.showToast({ title: "表单已重置", icon: "success" });
  },

  // 辅助方法：封装上传 Promise
  uploadFilePromise(cloudPath, filePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => resolve(res.fileID),
        fail: (err) => reject(err),
      });
    });
  },
});
