const db = wx.cloud.database();

Page({
  data: {
    showPopup: false,
    allAgents: [],
    currentAgent: null,
    canvasCtx: null,
    systemInfo: {},
  },

  onReady() {
    this.setData({ systemInfo: wx.getSystemInfoSync() });

    // 获取 Canvas 2D 实例
    const query = wx.createSelectorQuery();
    query
      .select("#testCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");

        // 处理高清屏适配
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.canvasNode = canvas; // 存储节点供保存时使用
        this.canvasCtx = ctx; // 存储上下文
        this.loadData();
      });
  },

  // 修改绘制逻辑（2D 模式下不需要调用 draw()，是实时渲染的）
  drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const { currentAgent, systemInfo } = this.data;
    if (!ctx || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 清空
    ctx.clearRect(0, 0, cw, ch);

    // 绘制图片需要先创建 Image 对象
    const bgImg = this.canvasNode.createImage();
    bgImg.src = currentAgent.backgroundLocal;
    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, cw, ch);

      // 绘制人物
      const pImg = this.canvasNode.createImage();
      pImg.src = currentAgent.bustPortraitLocal;
      pImg.onload = () => {
        ctx.drawImage(pImg, cw * 0.1, ch * 0.2, cw * 0.8, ch * 0.7);
      };
    };
  },

  /**
   * 加载数据 + 转换云存储路径 + 下载图片到本地
   */
  async loadData() {
    try {
      wx.showLoading({ title: "加载英雄数据..." });
      const { data } = await db.collection("agents").get();

      // 核心：批量转换路径并下载图片到本地
      const agentsWithLocalPath = await Promise.all(
        data.map(async (agent) => {
          // 下载背景图到本地
          const backgroundLocal = await this.downloadFileToLocal(
            agent.background,
          );
          // 下载头像到本地
          const portraitLocal = await this.downloadFileToLocal(
            agent.bustPortrait,
          );
          // 下载英雄图标到本地（弹窗用）
          const iconLocal = await this.downloadFileToLocal(agent.displayIcon);

          return {
            ...agent,
            backgroundLocal: backgroundLocal,
            bustPortraitLocal: portraitLocal,
            displayIconLocal: iconLocal,
          };
        }),
      );

      this.setData({ allAgents: agentsWithLocalPath });
      console.log("处理后的英雄数据（本地路径）：", this.data.allAgents);

      if (agentsWithLocalPath.length > 0) {
        this.selectAgent({
          currentTarget: { dataset: { agent: agentsWithLocalPath[0] } },
        });
      }
      wx.hideLoading();
    } catch (err) {
      console.error("数据加载/图片下载失败", err);
      wx.hideLoading();
      wx.showToast({ title: "数据加载失败", icon: "none" });
    }
  },

  /**
   * 核心工具：下载云存储图片到本地（兼容所有版本）
   * 返回本地临时文件路径 wxfile:// 开头
   */
  downloadFileToLocal(cloudPath) {
    return new Promise((resolve, reject) => {
      // 非云存储路径直接返回
      if (!cloudPath || !cloudPath.startsWith("cloud://")) {
        resolve(cloudPath);
        return;
      }

      // 第一步：把cloud://转临时HTTP链接
      wx.cloud.getTempFileURL({
        fileList: [cloudPath],
        success: (res) => {
          const tempUrl = res.fileList[0].tempFileURL;
          if (!tempUrl) {
            reject(new Error(`临时链接获取失败：${cloudPath}`));
            return;
          }

          // 第二步：下载临时链接的图片到本地
          wx.downloadFile({
            url: tempUrl,
            success: (downloadRes) => {
              // 下载成功返回本地路径
              resolve(downloadRes.tempFilePath);
            },
            fail: (err) => {
              console.error(`图片下载失败：${tempUrl}`, err);
              reject(err);
            },
          });
        },
        fail: (err) => {
          console.error(`临时链接转换失败：${cloudPath}`, err);
          reject(err);
        },
      });
    });
  },

  /**
   * 选择英雄：使用本地文件绘制
   */
  selectAgent(e) {
    const agent = e.currentTarget.dataset.agent;

    this.setData({ currentAgent: agent }, () => {
      this.drawWithLocalFiles();

      // 只有当弹窗是打开状态（手动切换英雄）时，才执行关闭和提示
      if (this.data.showPopup) {
        this.setData({ showPopup: false });
        wx.showToast({ title: `已选择 ${agent.displayName}`, icon: "none" });
      }
    });
  },

  drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const { currentAgent, systemInfo } = this.data;
    if (!ctx || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 清空
    ctx.clearRect(0, 0, cw, ch);

    // 绘制图片需要先创建 Image 对象
    const bgImg = this.canvasNode.createImage();
    bgImg.src = currentAgent.backgroundLocal;
    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, cw, ch);

      // 绘制人物
      const pImg = this.canvasNode.createImage();
      pImg.src = currentAgent.bustPortraitLocal;
      pImg.onload = () => {
        ctx.drawImage(pImg, cw * 0.1, ch * 0.2, cw * 0.8, ch * 0.7);
      };
    };
  },
  drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const { currentAgent, systemInfo } = this.data;
    if (!ctx || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 1. 清空（保持原样）
    ctx.clearRect(0, 0, cw, ch);

    const bgImg = this.canvasNode.createImage();
    bgImg.src = currentAgent.backgroundLocal;
    bgImg.onload = () => {
      // --- 优化点：背景图等比填充 (Aspect Fill) ---
      // 这样背景不会因为拉伸变形，且能占满整屏
      const bgScale = Math.max(cw / bgImg.width, ch / bgImg.height);
      const bgW = bgImg.width * bgScale;
      const bgH = bgImg.height * bgScale;
      const bgX = (cw - bgW) / 2;
      const bgY = (ch - bgH) / 2;

      ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);

      const pImg = this.canvasNode.createImage();
      pImg.src = currentAgent.bustPortraitLocal;
      pImg.onload = () => {
        // --- 优化点：人物比例优化 ---
        // 保持你原有的比例逻辑，但让它稍微向下偏移，更符合壁纸视觉
        const pW = cw * 0.9; // 稍微调大一点，更有视觉冲击力
        const pH = pW * (pImg.height / pImg.width); // 保持原图宽高比
        const pX = (cw - pW) / 2;
        const pY = ch - pH; // 底部对齐

        ctx.drawImage(pImg, pX, pY, pW, pH);
      };
    };
  },
  drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const { currentAgent, systemInfo } = this.data;
    if (!ctx || !currentAgent || !this.canvasNode) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 1. 【找回背景色】手动绘制渐变底色
    // 解析 backgroundGradientColors (取前两位即可实现瓦罗兰特那种深邃感)
    if (
      currentAgent.backgroundGradientColors &&
      currentAgent.backgroundGradientColors.length >= 2
    ) {
      const colors = currentAgent.backgroundGradientColors.map(
        (c) => "#" + c.substring(0, 6),
      );
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, colors[0]); // 顶部深紫/蓝
      grad.addColorStop(1, colors[1]); // 底部极黑
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.fillStyle = "#0f1923";
      ctx.fillRect(0, 0, cw, ch);
    }

    // 2. 绘制背景图 (Aspect Fill)
    const bgImg = this.canvasNode.createImage();
    bgImg.src = currentAgent.backgroundLocal;
    bgImg.onload = () => {
      const bgScale = Math.max(cw / bgImg.width, ch / bgImg.height);
      const bgW = bgImg.width * bgScale;
      const bgH = bgImg.height * bgScale;
      const bgX = (cw - bgW) / 2;
      const bgY = (ch - bgH) / 2;

      // 给背景加一点透明度，让底部的渐变色能透出来，更有层次感
      ctx.globalAlpha = 0.7;
      ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);
      ctx.globalAlpha = 1.0;

      // 3. 【优化人物比例】绘制英雄全身像
      const pImg = this.canvasNode.createImage();
      pImg.src = currentAgent.bustPortraitLocal;
      pImg.onload = () => {
        // 这里的逻辑改为：以屏幕高度为基准，让英雄占据屏幕 80% 的高度
        // 这样无论手机多长，英雄看起来都足够大且震撼
        const pRenderH = ch * 0.8;
        const pRatio = pImg.width / pImg.height;
        const pRenderW = pRenderH * pRatio;

        const px = (cw - pRenderW) / 2;
        const py = ch - pRenderH; // 底部对齐

        ctx.drawImage(pImg, px, py, pRenderW, pRenderH);
      };
    };
  },

  drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const { currentAgent, systemInfo } = this.data;
    if (!ctx || !currentAgent || !this.canvasNode) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 1. 【核心改动】去掉 ctx.fillRect
    // 只做清空，保持画布透明，透出下层的 CSS 渐变
    ctx.clearRect(0, 0, cw, ch);

    // 2. 绘制背景图 (Aspect Fill)
    const bgImg = this.canvasNode.createImage();
    bgImg.src = currentAgent.backgroundLocal;
    bgImg.onload = () => {
      const bgScale = Math.max(cw / bgImg.width, ch / bgImg.height);
      const bgW = bgImg.width * bgScale;
      const bgH = bgImg.height * bgScale;
      const bgX = (cw - bgW) / 2;
      const bgY = (ch - bgH) / 2;

      ctx.globalAlpha = 0.6; // 让背景图半透明，透出下方的 CSS 渐变色
      ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);
      ctx.globalAlpha = 1.0;

      // 3. 绘制英雄全身像
      const pImg = this.canvasNode.createImage();
      pImg.src = currentAgent.bustPortraitLocal;
      pImg.onload = () => {
        const pRenderH = ch * 0.85; // 保持震撼的大比例
        const pRatio = pImg.width / pImg.height;
        const pRenderW = pRenderH * pRatio;
        const px = (cw - pRenderW) / 2;
        const py = ch - pRenderH;

        ctx.drawImage(pImg, px, py, pRenderW, pRenderH);
      };
    };
  },

  /**
   * 保存画布（本地文件绘制，保存无问题）
   */
  saveCanvas() {
    const { systemInfo } = this.data;
    if (!systemInfo) return;

    wx.showLoading({ title: "保存中..." });
    wx.canvasToTempFilePath({
      // canvasId: "testCanvas",
      canvas: this.canvasNode, // 传入节点对象而非 canvasId
      x: 0,
      y: 0,
      width: systemInfo.windowWidth,
      height: systemInfo.windowHeight,
      destWidth: systemInfo.windowWidth * 2,
      destHeight: systemInfo.windowHeight * 2,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: "保存成功", icon: "success" });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: "请授权保存相册", icon: "none" });
          },
        });
      },
      fail: (err) => {
        console.error("保存失败", err);
        wx.hideLoading();
        wx.showToast({ title: "保存失败", icon: "none" });
      },
    });
  },

  /**
   * 重置画布
   */
  resetCanvas() {
    const { systemInfo } = this.data;
    if (!systemInfo) return;

    this.canvasCtx.clearRect(
      0,
      0,
      systemInfo.windowWidth,
      systemInfo.windowHeight,
    );
    this.canvasCtx.setFillStyle("#e5e5e5");
    this.canvasCtx.fillRect(50, 50, 100, 100);
    this.canvasCtx.draw(true);

    wx.showToast({ title: "画布已重置", icon: "none" });
  },

  togglePanel() {
    const nextState = !this.data.showPopup;

    if (nextState) {
      // 开启弹窗
      this.setData({ showPopup: true });
    } else {
      // 关闭弹窗
      this.setData({ showPopup: false });
    }
  },
});
