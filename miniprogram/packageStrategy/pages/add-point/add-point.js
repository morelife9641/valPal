const mapsData = require("../../../config/maps_data.js");
import { AGENTS_CONFIG } from "../../../config/agents_merged.js";

Page({
  data: {
    mapName: "",
    heroName: "",
    formData: {
      title: "",
      standImg: "",
      aimImg: "",
      resultImg: "",
      desc: "",
    },
  },

  onLoad(options) {
    // 1. 基础数据加载
    const maps = Array.isArray(mapsData) ? mapsData : mapsData.maps || [];
    const agents = Array.isArray(AGENTS_CONFIG)
      ? AGENTS_CONFIG
      : AGENTS_CONFIG.agents || [];

    // 2. 解码 URL 参数 (防止出现 %E5%B9... 这种乱码)
    const mapId = options.mapId;
    const heroId = options.heroId;
    const mapName = decodeURIComponent(options.mapName || "");
    const heroName = decodeURIComponent(options.heroName || "");

    // 3. 关键：计算 Picker 需要的索引 (Index)
    // 如果不计算 index，picker 弹出来时会默认停在第一项，而不是你传回来的那一项
    const mapIndex = maps.findIndex((item) => item.uuid === mapId);
    const agentIndex = agents.findIndex((item) => item.uuid === heroId);

    // 4. 统一 setData
    this.setData({
      maps: maps,
      allAgents: agents,
      mapName: mapName,
      heroName: heroName,
      mapIndex: mapIndex !== -1 ? mapIndex : null,
      agentIndex: agentIndex !== -1 ? agentIndex : null,
      // 同时也同步到 formData 中，确保提交时有值
      "formData.mapId": mapId,
      "formData.agentId": heroId,
      "formData.title": "", // 初始化其他表单项
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  // 2. 选择器逻辑
  onMapChange(e) {
    const idx = e.detail.value;
    const selected = this.data.maps[idx];
    this.setData({
      mapIndex: idx,
      mapName: selected.displayName,
      "formData.mapId": selected.uuid, // 使用数据中的 uuid 作为标识
    });
  },

  // 英雄选择改变
  onAgentChange(e) {
    const idx = e.detail.value;
    const selected = this.data.allAgents[idx];
    this.setData({
      agentIndex: idx,
      heroName: selected.displayName,
      "formData.agentId": selected.uuid, // 使用数据中的 uuid 作为标识
    });
  },

  // 图片上传
  uploadImg(e) {
    const { type } = e.currentTarget.dataset;
    // 如果已有图片，点击时优先预览而非重新上传（更符合微信逻辑）
    if (type === "standImg" && this.data.formData.standImg) {
      this.previewStandImg(e);
      return;
    }

    // 调用微信选择图片API
    wx.chooseMedia({
      count: 1, // 仅上传1张
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 更新formData中的站位图片
        this.setData({
          [`formData.${type}`]: tempFilePath,
        });
        wx.showToast({
          title: "图片上传成功",
          icon: "success",
        });
      },
      fail: (err) => {
        wx.showToast({
          title: "图片选择失败",
          icon: "none",
        });
        console.error("选择图片失败：", err);
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

  /**
   * 保存图片到相册（扩展功能）
   */
  saveImgToAlbum(imgUrl) {
    wx.saveImageToPhotosAlbum({
      filePath: imgUrl,
      success: () => {
        wx.showToast({
          title: "保存到相册成功",
          icon: "success",
        });
      },
      fail: (err) => {
        wx.showToast({
          title: "保存失败，请开启相册权限",
          icon: "none",
        });
        console.error("保存图片失败：", err);
      },
    });
  },

  submitForm() {
    const { formData } = this.data;
    if (!formData.title || !formData.standImg) {
      wx.showToast({ title: "请填写完整信息", icon: "none" });
      return;
    }

    wx.showLoading({ title: "发布中..." });

    // 模拟存入数据库逻辑
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: "发布成功" });
      wx.navigateBack();
    }, 1500);
  },

  async submitForm() {
    const { formData, mapName, heroName } = this.data;

    // 1. 基础校验 (瓦罗兰特点位没标题和图是没灵魂的)
    if (!formData.title)
      return wx.showToast({ title: "请输入方案标题", icon: "none" });
    if (!formData.mapId)
      return wx.showToast({ title: "请选择地图", icon: "none" });
    if (!formData.standImg)
      return wx.showToast({ title: "请上传站位图", icon: "none" });

    wx.showLoading({ title: "正在同步星际...", mask: true });

    try {
      // 2. 处理图片上传 (并行上传 3 张图)
      // 过滤出存在的本地路径进行上传
      const imgTypes = ["standImg", "aimImg", "resultImg"];
      const uploadTasks = imgTypes.map((type) => {
        if (
          (formData[type] && formData[type].startsWith("http://tmp")) ||
          formData[type].startsWith("wxfile://")
        ) {
          return this.uploadFilePromise(
            `valorant/points/${Date.now()}_${type}.jpg`,
            formData[type],
          );
        }
        return Promise.resolve(formData[type]); // 如果已经是云路径或空，直接返回
      });

      const [standUrl, aimUrl, resultUrl] = await Promise.all(uploadTasks);

      // 3. 构造最终存入数据库的对象
      const finalData = {
        ...formData,
        standImg: standUrl,
        aimImg: aimUrl,
        resultImg: resultUrl,
        mapName: mapName, // 冗余存储名称，方便展示无需联表
        heroName: heroName,
        createTime: new Date(),
        status: 1, // 1: 正常, 0: 隐藏
      };

      // 4. 调用云数据库 (以微信云开发为例)
      const db = wx.cloud.database();
      await db.collection("points").add({
        data: finalData,
      });

      wx.hideLoading();
      wx.showToast({
        title: "部署成功",
        icon: "success",
        duration: 2000,
        success: () => {
          const eventChannel = this.getOpenerEventChannel();
          if (eventChannel && eventChannel.emit) {
            eventChannel.emit("refreshList");
          }
          setTimeout(() => wx.navigateBack(), 2000);
        },
      });
    } catch (err) {
      console.error("上传失败：", err);
      wx.hideLoading();
      wx.showModal({
        title: "同步失败",
        content: "辐射能干扰，请检查网络后重试",
        showCancel: false,
      });
    }
  },

  /**
   * 封装上传 Promise (适配云开发)
   */
  uploadFilePromise(cloudPath, filePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => resolve(res.fileID),
        fail: (err) => reject(err),
      });
    });
  },
});
