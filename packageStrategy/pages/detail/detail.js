const allAgents = require("./agents_processed");
Page({
  data: {
    isReady: false, // 控制页面整体显隐
    allAgents: allAgents,
    currentRole: "",
    agentScrollLeft: 0, // 强制英雄列表回弹到最左侧
    currentAgentName: "",
    currentAbilities: [],
    currentIconType: "", // 存储 slot 名
    touchMode: "draw", // 'view' (缩放平移) 或 'draw' (战术绘制)
    currentIconType: "attack",
    pins: [], // 仅存储已确认的点位
    iconList: [
      { type: "attack", label: "进攻", url: "../../../assets/pinpoint.png" },
      // { type: "defense", label: "防守", url: "/assets/icons/def.png" },
      // { type: "smoke", label: "烟幕", url: "/assets/icons/smoke.png" },
    ],
  },

  // 1. 解决卡顿的关键：非响应式变量，不走 setData
  state: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    lastX: 0,
    lastY: 0,
    lastDist: 0,
    canvasRect: null,
    isInitial: true,
  },

  // 存储 Image 对象
  iconObjects: {},
  mapImg: null,
  tempLine: null, // 正在绘制的临时线条 {x, y, angle, len}

  onLoad(options) {
    if (allAgents && allAgents.length > 0) {
      // 1. 定义你想要的排序顺序
      const roleOrder = ["控场", "哨卫", "先锋", "决斗"];

      // 2. 提取并排序角色
      const rawRoles = [...new Set(allAgents.map((a) => a.roleName))];
      const roles = roleOrder.filter((r) => rawRoles.includes(r));

      // 3. 按角色归类英雄
      const agentsByRole = {};
      roles.forEach((role) => {
        agentsByRole[role] = allAgents.filter((a) => a.roleName === role);
      });

      // 4. 默认选中“控场”及其下的第一个英雄
      const defaultRole = "控场";
      const defaultAgent = agentsByRole[defaultRole][0];

      this.setData({
        allAgents: allAgents,
        roles: roles,
        agentsByRole: agentsByRole,
        currentRole: defaultRole, // 默认选中控场
        currentAgentName: defaultAgent.displayName,
        currentAbilities: defaultAgent.abilities,
        currentIconType: defaultAgent.abilities[0].slot,
      });

      // 别忘了同步加载 Canvas 图片
      this.loadAgentIcons(defaultAgent.abilities, defaultAgent.displayName);
    }
    this.setData({
      mapName: decodeURIComponent(options.name || "地图详情"),
      displayIcon: decodeURIComponent(options.icon),
    });
  },

  onReady() {
    console.log(1);

    this.initCanvas();
  },

  selectAgent(e) {
    console.log(e);

    const agent = e.currentTarget.dataset.agent;
    if (this.data.currentAgentName === agent.displayName) return;

    this.setData({
      currentAgentName: agent.displayName,
      currentAbilities: agent.abilities,
      currentIconType: agent.abilities[0].slot,
    });

    // 检查 canvas 是否已初始化
    if (this.canvas) {
      this.loadAgentIcons(agent.abilities, agent.displayName);
    }
  },

  initAgent(agent) {
    this.setData({
      currentAgentName: agent.displayName,
      currentAbilities: agent.abilities,
      currentIconType: agent.abilities[0].slot, // 默认选中第一个技能
    });

    // 重要：预加载该英雄的所有技能图标到 iconObjects 中
    agent.abilities.forEach((ability) => {
      if (!this.iconObjects[ability.slot]) {
        // 避免重复加载
        const img = this.canvas.createImage();
        img.src = ability.displayIcon;
        img.onload = () => {
          this.mapImg = img;
          this.autoCenter();
          this.setData({ isReady: true });

          // 强制增加一个重绘循环，确保 Canvas 刷新
          setTimeout(() => {
            if (this.canvas) this.draw();
          }, 100);
        };
      }
    });
  },

  selectIcon(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ currentIconType: type });
  },

  selectRole(e) {
    console.log(e);

    const role = e.currentTarget.dataset.role;
    const filteredAgents = this.data.agentsByRole[role];

    if (filteredAgents && filteredAgents.length > 0) {
      const firstAgent = filteredAgents[0];

      // 1. 同步更新角色、当前英雄、技能列表、以及默认选中的第一个技能槽位
      this.setData({
        currentRole: role,
        currentAgentName: firstAgent.displayName,
        currentAbilities: firstAgent.abilities,
        currentIconType: firstAgent.abilities[0].slot, // 重置选中第一个技能
      });

      // 2. 必须联动加载 Canvas 图片，否则画图时找不到对应图标
      this.loadAgentIcons(firstAgent.abilities, firstAgent.displayName);
    } else {
      // 防护：如果该分类下没英雄（虽然不太可能）
      this.setData({ currentRole: role });
    }
  },

  async initCanvas() {
    console.log(1);

    const query = wx.createSelectorQuery();
    const res = await new Promise((r) =>
      query.select("#mapCanvas").fields({ node: true, size: true }).exec(r),
    );

    if (!res || !res[0]) return;

    const canvas = res[0].node;
    const ctx = canvas.getContext("2d");
    const dpr = wx.getWindowInfo().pixelRatio;

    canvas.width = res[0].width * dpr;
    canvas.height = res[0].height * dpr;
    ctx.scale(dpr, dpr);

    this.canvas = canvas;
    this.ctx = ctx;
    this.canvasWidth = res[0].width;
    this.canvasHeight = res[0].height;

    wx.createSelectorQuery()
      .select("#mapCanvas")
      .boundingClientRect((rect) => {
        this.state.canvasRect = rect;
      })
      .exec();

    // 增加一个 3 秒后的强制亮起，防止加载卡死
    const timer = setTimeout(() => {
      if (!this.data.isReady) {
        console.warn("⚠️ 加载超时，强制亮起页面");
        this.setData({ isReady: true });
      }
    }, 3000);

    // --- 核心修复：底图加载 ---
    const img = canvas.createImage();
    // 确保从 options 或 data 中拿到正确的 URL
    img.src = this.data.displayIcon;

    img.onload = () => {
      this.mapImg = img;
      this.autoCenter();

      // 只要底图加载完，立刻显示页面！
      this.setData({ isReady: true });

      // 异步加载其他资源，不阻塞主画面出现
      this.loadAgentIcons(
        this.data.currentAbilities,
        this.data.currentAgentName,
      );

      // 加载通用图标 (进攻/防守图标)
      if (this.data.iconList) {
        this.data.iconList.forEach((item) => {
          const icon = canvas.createImage();
          icon.src = item.url;
          icon.onload = () => {
            this.iconObjects[item.type] = icon;
            this.draw();
          };
        });
      }
    };

    img.onerror = (err) => {
      console.error("底图加载失败，检查路径:", this.data.displayIcon, err);
      this.setData({ isReady: true }); // 即使失败也亮起，方便调试
    };
  },

  loadAgentIcons(abilities, agentName) {
    if (!this.canvas) return;

    abilities.forEach((ability) => {
      // 关键修改：Key 变为 "盖可_Ability1"
      const uniqueKey = `${agentName}_${ability.slot}`;

      if (!this.iconObjects[uniqueKey]) {
        const img = this.canvas.createImage();
        if (ability.displayIcon) {
          img.src = ability.displayIcon;
          img.onload = () => {
            this.iconObjects[uniqueKey] = img;
            this.draw();
          };
        }
      }
    });
  },

  // 2. 居中算法：根据图片比例计算初始位置
  autoCenter() {
    const baseSize = 300; // 假定底图渲染基准大小
    const padding = 40;
    const availableW = this.canvasWidth - padding;
    const availableH = this.canvasHeight - padding;

    // 计算缩放：使图片完整适应屏幕
    const scale = Math.min(availableW / baseSize, availableH / baseSize);

    this.state.scale = scale;
    this.state.offsetX = (this.canvasWidth - baseSize * scale) / 2;
    this.state.offsetY = (this.canvasHeight - baseSize * scale) / 2;

    this.draw();
  },

  // 3. 高性能渲染：使用 requestAnimationFrame
  draw() {
    if (!this.canvas || !this.mapImg) return;

    this.canvas.requestAnimationFrame(() => {
      const ctx = this.ctx;
      const { scale, offsetX, offsetY } = this.state;

      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx.save();

      // 应用视图变换
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // 画底图
      ctx.drawImage(this.mapImg, 0, 0, 300, 300);

      // 画所有已保存的战术点
      this.data.pins.forEach((pin) => this.renderTacticalItem(pin));

      // 画当前正在拉动的临时线
      if (this.tempLine) {
        this.renderTacticalItem({
          ...this.tempLine,
          type: this.data.currentIconType,
        });
      }

      ctx.restore();
    });
  },

  renderTacticalItem(item) {
    const ctx = this.ctx;
    const s = this.state.scale;
    const icon = this.iconObjects[item.type];
    const iconSize = 28 / s; // 补偿缩放，让图标视觉大小恒定

    // 1. 画图标
    if (icon) {
      ctx.drawImage(
        icon,
        item.x - iconSize / 2,
        item.y - iconSize / 2,
        iconSize,
        iconSize,
      );
    }

    // 2. 画动态长度的矢量线 (只有长度大于一定值才画)
    if (item.len && item.len > 5) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.angle);

      ctx.strokeStyle = "#ff4655";
      ctx.lineWidth = 2.5 / s;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(item.len, 0);
      ctx.stroke();

      // 箭头帽
      ctx.fillStyle = "#ff4655";
      const headLen = 10 / s;
      ctx.beginPath();
      ctx.moveTo(item.len, 0);
      ctx.lineTo(item.len - headLen, -headLen / 2);
      ctx.lineTo(item.len - headLen, headLen / 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // 4. 坐标转换公式
  getLogicPos(clientX, clientY) {
    const rect = this.state.canvasRect;
    return {
      x: (clientX - rect.left - this.state.offsetX) / this.state.scale,
      y: (clientY - rect.top - this.state.offsetY) / this.state.scale,
    };
  },

  // --- 手势处理 ---

  touchStart(e) {
    const t = e.touches;
    if (t.length >= 2) {
      this.isMultiTouch = true;
      this.state.lastDist = this.getDist(t);
    } else {
      this.isMultiTouch = false;
      this.state.lastX = t[0].clientX;
      this.state.lastY = t[0].clientY;

      if (this.data.touchMode === "draw") {
        const pos = this.getLogicPos(t[0].clientX, t[0].clientY);
        this.tempLine = { x: pos.x, y: pos.y, angle: 0, len: 0 };
      }
    }
  },

  touchMove(e) {
    const t = e.touches;

    // 无论什么模式，双指始终触发缩放
    if (t.length >= 2) {
      const dist = this.getDist(t);
      if (this.state.lastDist > 0) {
        const factor = dist / this.state.lastDist;
        this.state.scale = Math.min(
          Math.max(this.state.scale * factor, 0.3),
          8,
        );
      }
      this.state.lastDist = dist;
      this.draw();
      return;
    }

    // 单指逻辑分发
    if (this.data.touchMode === "view") {
      // 平移地图
      this.state.offsetX += t[0].clientX - this.state.lastX;
      this.state.offsetY += t[0].clientY - this.state.lastY;
      this.state.lastX = t[0].clientX;
      this.state.lastY = t[0].clientY;
      this.draw();
    } else if (this.data.touchMode === "draw" && this.tempLine) {
      // 自由拉线
      const pos = this.getLogicPos(t[0].clientX, t[0].clientY);
      const dx = pos.x - this.tempLine.x;
      const dy = pos.y - this.tempLine.y;
      this.tempLine.angle = Math.atan2(dy, dx);
      this.tempLine.len = Math.sqrt(dx * dx + dy * dy);
      this.draw();
    }
  },

  touchEnd() {
    if (this.tempLine) {
      // 关键修改：存储时合成唯一 Key
      const uniqueType = `${this.data.currentAgentName}_${this.data.currentIconType}`;

      const finalPin = {
        ...this.tempLine,
        type: uniqueType, // 这里存的是 "盖可_Ability1"
      };

      this.setData({
        pins: [...this.data.pins, finalPin],
      });
      this.tempLine = null;
      this.draw();
    }
    this.state.lastDist = 0;
  },

  getDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // 模式与图标切换
  changeMode(e) {
    this.setData({ touchMode: e.currentTarget.dataset.mode });
  },

  clearPins() {
    this.setData({ pins: [] }, () => this.draw());
  },

  undoPin() {
    let pins = this.data.pins;
    pins.pop();
    this.setData({ pins }, () => this.draw());
  },

  async saveToAlbum() {
    wx.showLoading({ title: "正在生成图片...", mask: true });
    try {
      const ctx = this.ctx;
      const canvas = this.canvas;

      // 1. 在导出前手动绘制背景色
      ctx.save();
      // destination-over 确保新画的颜色位于所有已有内容的“下方”
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#0f1923"; // 瓦罗兰特主背景色，确保与 UI 风格统一
      // 注意：这里使用 canvas 的原始物理像素宽高
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx.restore();

      // 2. 稍微等待硬件缓冲区刷新
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. 生成临时文件
      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: this.canvas,
          // 建议导出为 jpg，自带底色且兼容性最好，体积更小
          fileType: "jpg",
          quality: 0.9,
          destWidth: this.canvasWidth * 2, // 保持高分辨率
          destHeight: this.canvasHeight * 2,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err),
        });
      });

      // 4. 权限检查逻辑（保持不变）
      const auth = await wx.getSetting();
      if (!auth.authSetting["scope.writePhotosAlbum"]) {
        try {
          await wx.authorize({ scope: "scope.writePhotosAlbum" });
        } catch (e) {
          wx.hideLoading();
          wx.showModal({
            title: "提示",
            content: "需要授权保存图片到相册",
            success: (res) => {
              if (res.confirm) wx.openSetting();
            },
          });
          return;
        }
      }

      // 5. 保存到相册
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });

      // 6. 关键：保存完成后，重绘一次 Canvas 以恢复透明/原始状态
      this.draw();

      wx.hideLoading();
      wx.showToast({ title: "战术板已保存", icon: "success" });
    } catch (error) {
      console.error("保存失败", error);
      wx.hideLoading();
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
    }
  },

  // pages/strategy/detail/detail.js

  // ... (其他代码)

  // 新增一个异步方法来获取分享图片
  async getShareImage() {
    this.draw(); // 确保最新状态绘制
    await new Promise((resolve) => setTimeout(resolve, 50)); // 短暂等待

    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        x: 0,
        y: 0,
        width: this.canvasWidth,
        height: this.canvasHeight,
        destWidth: this.canvasWidth * 1.5, // 分享图不需要太高分辨率，适当放大
        destHeight: this.canvasHeight * 1.5,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(err),
      });
    });
  },

  onShareAppMessage() {
    const pinsData = JSON.stringify(this.data.pins);
    const title = `${this.data.mapName} 战术分享`;
    const path = `/pages/strategy/detail/detail?mapName=${encodeURIComponent(this.data.mapName)}&displayIcon=${encodeURIComponent(this.data.displayIcon)}&pins=${encodeURIComponent(pinsData)}`;

    return {
      title,
      path,
      // 返回一个 Promise，等待图片生成
      promise: this.getShareImage()
        .then((imageUrl) => {
          return { imageUrl };
        })
        .catch((err) => {
          console.error("生成分享图片失败，使用默认图", err);
          return { imageUrl: this.data.displayIcon }; // 失败时退回使用默认底图
        }),
    };
  },

  // 3. 返回列表
  goBack() {
    wx.navigateBack({
      delta: 1,
    });
  },
});
