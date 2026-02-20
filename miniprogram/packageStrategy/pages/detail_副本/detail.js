Page({
  data: {
    pins: [], // 存储图钉：[{x, y, slot}]
    isReady: false,
  },

  onReady() {
    this.initCanvas();
    this.abilityIcons = {}; // 初始化图标容器
  },

  state: {
    scale: 1, // 缩放倍率
    offsetX: 0, // 水平平移
    offsetY: 0, // 垂直平移
    lastX: 0, // 用于处理拖拽
    lastY: 0,
    baseScale: 1, // 初始缩放（Contain 模式）
    canvasRect: null, // 画布矩形信息
  },

  async initCanvas() {
    const query = wx.createSelectorQuery();
    const res = await new Promise((r) =>
      query.select("#mapCanvas").fields({ node: true, size: true }).exec(r),
    );

    const canvas = res[0].node;
    const ctx = canvas.getContext("2d");
    const dpr = wx.getWindowInfo().pixelRatio;

    // 解决 100% 宽高导致的模糊和偏移
    canvas.width = res[0].width * dpr;
    canvas.height = res[0].height * dpr;
    ctx.scale(dpr, dpr);

    this.canvas = canvas;
    this.ctx = ctx;
    this.canvasWidth = res[0].width;
    this.canvasHeight = res[0].height;

    // 开始加载本地 SVG 资源
    this.loadMapLayers();
  },

  // detail.js
  initView(img) {
    const canvasW = this.canvasWidth;
    const canvasH = this.canvasHeight;
    const imgW = img.width;
    const imgH = img.height;

    // 1. 计算 Cover/Contain 比例
    // 取画布宽度与图片宽度、画布高度与图片高度比例的最小值，确保图片完整显示
    const scale = Math.min(canvasW / imgW, canvasH / imgH);

    // 2. 计算居中偏移量
    // 目标是让 (图片宽度 * scale) 在画布水平居中
    const offsetX = (canvasW - imgW * scale) / 2;
    const offsetY = (canvasH - imgH * scale) / 2;

    // 3. 写入状态
    this.state.scale = scale;
    this.state.offsetX = offsetX;
    this.state.offsetY = offsetY;

    // 记录一个初始缩放，方便后续限制缩放范围（比如最小不能小于初始缩放的 0.8 倍）
    this.state.baseScale = scale;

    this.draw(); // 立即重绘
  },

  async loadMapLayers() {
    wx.showLoading({ title: "正在合成地图...", mask: true });

    // 你的本地路径列表 (注意：微信小程序中加载本地资源建议使用绝对路径 /assets/...)
    const layerPaths = [
      "/assets/png_output/layout.png", // 底层轮廓
      "/assets/png_output/defending_walls.png", // 中层墙体
      "/assets/png_output/defending_labels.png", // 顶层报点文字
    ];

    try {
      // 1. 并行加载所有图层
      const images = await Promise.all(
        layerPaths.map((path) => this.loadImage(path)),
      );

      this.mapLayers = images;

      // 2. 初始化缩放比例（以第一张图为基准进行 Contain 适配）
      this.calculateViewport(images[0]);

      // 3. 绘制
      this.draw();

      this.initView(images[0]);

      this.setData({ isReady: true });
      wx.hideLoading();
    } catch (err) {
      console.error("加载 SVG 失败:", err);
      wx.showToast({ title: "SVG渲染受限，建议转PNG", icon: "none" });
    }
  },

  // 封装加载图片的 Promise
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = this.canvas.createImage();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  },

  // 计算地图在 Canvas 里的居中比例
  calculateViewport(img) {
    const scale = Math.min(
      this.canvasWidth / img.width,
      this.canvasHeight / img.height,
    );
    this.scale = scale;
    this.offsetX = (this.canvasWidth - img.width * scale) / 2;
    this.offsetY = (this.canvasHeight - img.height * scale) / 2;
  },

  state: {
    scale: 1, // 缩放倍率
    offsetX: 0, // 水平平移
    offsetY: 0, // 垂直平移
    lastX: 0, // 用于处理拖拽
    lastY: 0,
    baseScale: 1, // 初始缩放（Contain 模式）
    canvasRect: null, // 画布矩形信息
  },

  /**
   * 点击画布放置图钉
   */
  handleTap(e) {
    const { x, y } = e.detail; // 这里的 x,y 是相对于 canvas 容器的
    const { scale, offsetX, offsetY } = this.state;

    // 公式：原始坐标 = (点击坐标 - 偏移量) / 缩放比例
    const mapX = (x - offsetX) / scale;
    const mapY = (y - offsetY) / scale;

    // 获取当前选中的技能（假设你界面上有个变量记录选中的技能 slot）
    const selectedSlot = this.data.currentAbilitySlot || "E";

    const newPin = {
      x: mapX,
      y: mapY,
      slot: selectedSlot,
    };

    this.setData({
      pins: [...this.data.pins, newPin],
    });
    this.draw();
  },

  draw() {
    const ctx = this.ctx;
    if (!this.mapLayers) return;

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.save();
    // 全局变换：平移 + 缩放
    ctx.translate(this.state.offsetX, this.state.offsetY);
    ctx.scale(this.state.scale, this.state.scale);

    // 1. 画地图底图层
    this.mapLayers.forEach((img) => {
      ctx.drawImage(img, 0, 0);
    });

    // 2. 画图钉 Pins
    this.data.pins.forEach((pin) => {
      // 我们假设你已经提前把技能图标加载到了 this.abilityIcons 对象里
      const icon = this.abilityIcons[pin.slot];
      if (icon) {
        // 设置图标大小，比如 40 像素
        // 注意：这里画在已经经过 scale 的坐标系中，图标会随地图放大
        const size = 30 / this.state.scale; // 如果希望图标大小固定，可以除以 scale
        ctx.drawImage(icon, pin.x - size / 2, pin.y - size / 2, size, size);
      } else {
        // 临时画个红点代替
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FF4655";
        ctx.fill();
      }
    });

    ctx.restore();
  },

  draw() {
    const ctx = this.ctx;
    if (!this.mapLayers) return;

    // 清空画布
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // 性能优化：移动过程中降低图像平滑度，减少计算量
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    // 应用变换：平移 + 缩放
    ctx.translate(this.state.offsetX, this.state.offsetY);
    ctx.scale(this.state.scale, this.state.scale);

    // 1. 批量绘制地图图层
    for (let i = 0; i < this.mapLayers.length; i++) {
      ctx.drawImage(this.mapLayers[i], 0, 0);
    }

    // 2. 绘制图钉 Pins
    if (this.data.pins && this.data.pins.length > 0) {
      // 图标大小随地图缩放反向调整，保持视觉尺寸一致
      const size = 32 / this.state.scale;
      this.data.pins.forEach((pin) => {
        const icon = this.abilityIcons[pin.slot];
        if (icon) {
          ctx.drawImage(icon, pin.x - size / 2, pin.y - size / 2, size, size);
        } else {
          // 兜底红点
          ctx.beginPath();
          ctx.arc(pin.x, pin.y, 6 / this.state.scale, 0, Math.PI * 2);
          ctx.fillStyle = "#FF4655";
          ctx.fill();
        }
      });
    }

    ctx.restore();
    // 绘图结束后恢复高品质（可选）
    ctx.imageSmoothingEnabled = true;
  },

  requestDraw() {
    if (isDrawing) return;
    isDrawing = true;

    this.canvas.requestAnimationFrame(() => {
      this.draw();
      isDrawing = false;
    });
  },

  touchStart(e) {
    if (e.touches.length === 1) {
      // 单指：记录起始点
      this.state.lastX = e.touches[0].x;
      this.state.lastY = e.touches[0].y;
    } else if (e.touches.length >= 2) {
      // 双指：记录初始距离
      const dx = e.touches[1].x - e.touches[0].x;
      const dy = e.touches[1].y - e.touches[0].y;
      this.state.startDistance = Math.sqrt(dx * dx + dy * dy);
    }
  },

  touchMove(e) {
    if (e.touches.length === 1) {
      // --- 单指拖拽 ---
      const dx = e.touches[0].x - this.state.lastX;
      const dy = e.touches[0].y - this.state.lastY;

      this.state.offsetX += dx;
      this.state.offsetY += dy;

      this.state.lastX = e.touches[0].x;
      this.state.lastY = e.touches[0].y;
    } else if (e.touches.length >= 2) {
      // --- 双指缩放 ---
      const x1 = e.touches[0].x;
      const y1 = e.touches[0].y;
      const x2 = e.touches[1].x;
      const y2 = e.touches[1].y;

      // 1. 计算当前双指间的距离
      const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

      // 2. 计算双指的中点（缩放中心）
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;

      if (this.state.startDistance > 0) {
        // 3. 计算缩放倍率变化
        const ratio = distance / this.state.startDistance;
        const oldScale = this.state.scale;
        let newScale = oldScale * ratio;

        // 4. 缩放范围限制：最小不小于初始显示的 0.8 倍，最大 5 倍
        const minScale = this.state.baseScale * 0.8;
        const maxScale = 5;
        if (newScale < minScale) newScale = minScale;
        if (newScale > maxScale) newScale = maxScale;

        // 5. 【核心】缩放中心点偏移补偿公式
        // 逻辑：保持双指中点在地图上的“相对位置”不变
        const realRatio = newScale / oldScale;
        this.state.offsetX =
          centerX - (centerX - this.state.offsetX) * realRatio;
        this.state.offsetY =
          centerY - (centerY - this.state.offsetY) * realRatio;

        this.state.scale = newScale;
      }

      this.state.startDistance = distance;
    }

    this.draw();
  },

  touchMove(e) {
    if (e.touches.length === 1) {
      // --- 单指拖拽：保持原样，不做实时限制，确保绝对丝滑 ---
      const dx = e.touches[0].x - this.state.lastX;
      const dy = e.touches[0].y - this.state.lastY;
      this.state.offsetX += dx;
      this.state.offsetY += dy;
      this.state.lastX = e.touches[0].x;
      this.state.lastY = e.touches[0].y;
    } else if (e.touches.length >= 2) {
      const x1 = e.touches[0].x,
        y1 = e.touches[0].y;
      const x2 = e.touches[1].x,
        y2 = e.touches[1].y;

      const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;

      if (this.state.startDistance > 0) {
        const ratio = distance / this.state.startDistance;
        const oldScale = this.state.scale;
        let newScale = oldScale * ratio;

        // --- 核心修复：放大上限逻辑 ---
        const maxScale = 5.0; // 最大放大 5 倍

        // 如果当前已经达到最大倍数，且用户还在做放大的动作（ratio > 1）
        // 则强制将 newScale 锁定在 maxScale，且不进行后续的偏移计算
        if (oldScale >= maxScale && ratio > 1) {
          newScale = maxScale;
        } else if (newScale > maxScale) {
          newScale = maxScale;
        }

        // 只有当缩放比例确实发生变化时，才计算偏移补偿
        // 这样可以防止到达上限后地图还跟着手指位移
        if (newScale !== oldScale) {
          const realRatio = newScale / oldScale;
          this.state.offsetX =
            centerX - (centerX - this.state.offsetX) * realRatio;
          this.state.offsetY =
            centerY - (centerY - this.state.offsetY) * realRatio;
          this.state.scale = newScale;
        }
      }

      this.state.startDistance = distance;
    }
    this.draw();
  },

  touchEnd() {
    this.state.startDistance = 0;
  },

  touchEnd(e) {
    this.state.startDistance = 0;

    // --- 回弹检测逻辑 ---
    const { scale, baseScale } = this.state;
    let targetScale = scale;
    let targetX = this.state.offsetX;
    let targetY = this.state.offsetY;
    let needSpring = false;

    // 1. 如果缩得比 baseScale 还小，触发回弹
    if (scale < baseScale) {
      targetScale = baseScale;
      // 计算居中坐标
      const imgW = this.mapLayers[0].width * targetScale;
      const imgH = this.mapLayers[0].height * targetScale;
      targetX = (this.canvasWidth - imgW) / 2;
      targetY = (this.canvasHeight - imgH) / 2;
      needSpring = true;
    }

    // 2. 执行回弹动画
    if (needSpring) {
      this.animateSpring(targetScale, targetX, targetY);
    }
  },

  /**
   * 简易线性插值动画，让回弹更自然
   */
  animateSpring(tScale, tX, tY) {
    const step = () => {
      // 每次移动剩余距离的 20%，产生丝滑的减速感
      const diffS = (tScale - this.state.scale) * 0.2;
      const diffX = (tX - this.state.offsetX) * 0.2;
      const diffY = (tY - this.state.offsetY) * 0.2;

      this.state.scale += diffS;
      this.state.offsetX += diffX;
      this.state.offsetY += diffY;

      this.draw();

      if (Math.abs(diffS) > 0.001 || Math.abs(diffX) > 0.1) {
        this.canvas.requestAnimationFrame(step);
      } else {
        // 最终对齐
        this.state.scale = tScale;
        this.state.offsetX = tX;
        this.state.offsetY = tY;
        this.draw();
      }
    };
    step();
  },
});
