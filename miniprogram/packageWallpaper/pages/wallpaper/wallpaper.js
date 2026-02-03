const db = wx.cloud.database();
const WEAPON_MAP = {
  近战: "melee",
  标配: "classic",
  短炮: "shorty",
  狂怒: "frenzy",
  鬼魅: "ghost",
  正义: "sheriff",
  蜂刺: "stinger",
  骇灵: "spectre",
  判官: "judge",
  雄鹿: "bucky",
  飞将: "marshal",
  獠犬: "bulldog",
  戍卫: "guardian",
  幻影: "phantom",
  狂徒: "vandal",
  莽侠: "outlaw",
  冥驹: "operator",
  战神: "ares",
  奥丁: "odin",
};

Page({
  data: {
    showPopup: false,
    popupType: "hero",
    weaponTransform: {
      x: 200, // 稍微给个初始值，或者在代码里动态计算
      y: 500,
      scale: 0.5,
    },

    // --- 英雄相关数据 ---
    allAgents: [],
    currentAgent: null,
    heroTabs: [], // 【补全】存储 ["全部", "先锋", "决斗" ...]
    heroMap: {}, // 【补全】存储 {"全部": [], "决斗": [] ...}

    // --- 武器相关数据 ---
    allWeapons: [],
    currentWeapon: null,
    weaponTabs: [
      "近战",
      "标配",
      "短炮",
      "狂怒",
      "鬼魅",
      "正义",
      "蜂刺",
      "骇灵",
      "判官",
      "雄鹿",
      "飞将",
      "獠犬",
      "戍卫",
      "幻影",
      "狂徒",
      "莽侠",
      "冥驹",
      "战神",
      "奥丁",
    ],
    weaponCache: {},
    popupTabs: [],
    filteredList: [],
    currentTab: "",

    // --- 弹窗与过滤逻辑 ---
    currentTab: "全部",
    popupTabs: [], // 这是弹窗渲染时直接 wx:for 的数组
    filteredList: [],
    tempChromaUuid: "",

    // --- 画布与系统相关 ---
    canvasCtx: null,
    systemInfo: {},
    canvasWrapperStyle: "",
    weaponMenuExpanded: false,
    showWeaponPopup: false,
    canvasWeapons: [],
    weaponPageSize: 20,
    isWeaponLoading: false,
    isWeaponOver: false,
    canUndo: false,
    canRedo: false,
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

  // 你的初始化 canvas 方法（可能在 onReady 或其他地方）
  onReady() {
    const query = wx.createSelectorQuery();
    query
      .select("#testCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");

        const dpr = wx.getSystemInfoSync().pixelRatio;
        const { windowWidth, windowHeight } = wx.getSystemInfoSync();

        // 关键：设置 canvas 实际尺寸
        canvas.width = windowWidth * dpr;
        canvas.height = windowHeight * dpr;

        // 缩放上下文以匹配设备像素比
        ctx.scale(dpr, dpr);

        this.canvasNode = canvas;
        this.canvasCtx = ctx;
        this.setData({ systemInfo: wx.getSystemInfoSync() });

        // 初始绘制
        this.drawWithLocalFiles();
        this.loadData();
      });
  },

  async loadData() {
    try {
      wx.showLoading({ title: "同步英雄资源..." });

      // --- 1. 获取全量英雄数据 (处理分页) ---
      const agentCount = await db.collection("agents").count();
      const MAX_LIMIT = 20;
      const batchTimes = Math.ceil(agentCount.total / MAX_LIMIT);
      const tasks = [];

      for (let i = 0; i < batchTimes; i++) {
        const promise = db
          .collection("agents")
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();
        tasks.push(promise);
      }

      const results = await Promise.all(tasks);
      const allAgentsRaw = results.reduce(
        (acc, cur) => acc.concat(cur.data),
        [],
      );

      // --- 2. 预处理：下载图片并转换本地路径 ---
      // 这里确保了 drawWithLocalFiles 使用的是下载好的路径
      const agentsWithLocal = await Promise.all(
        allAgentsRaw.map(async (agent) => {
          // 下载背景图
          const backgroundLocal = await this.downloadFileToLocal(
            agent.background,
          );
          // 下载英雄半身像
          const portraitLocal = await this.downloadFileToLocal(
            agent.bustPortrait,
          );
          // 下载英雄图标 (弹窗用)
          const iconLocal = await this.downloadFileToLocal(agent.displayIcon);

          return {
            ...agent,
            backgroundLocal: backgroundLocal,
            bustPortraitLocal: portraitLocal,
            displayIconLocal: iconLocal,
          };
        }),
      );

      // --- 3. 分类装箱逻辑 (用于弹窗 Tabs) ---
      const heroRoles = [
        ...new Set(agentsWithLocal.map((a) => a.role.displayName)),
      ];
      const heroMap = { 全部: agentsWithLocal };

      heroRoles.forEach((roleName) => {
        heroMap[roleName] = agentsWithLocal.filter(
          (a) => a.role.displayName === roleName,
        );
      });

      // --- 4. 一次性同步状态并设置初始数据 ---
      this.setData({
        allAgents: agentsWithLocal, // 全量数据
        heroTabs: ["全部", ...heroRoles], // 弹窗 Tabs
        heroMap: heroMap, // 分类 Map
        filteredList: agentsWithLocal, // 弹窗初始展示列表
        currentTab: "全部", // 初始 Tab 状态
      });

      // --- 5. 核心：执行默认选中并触发 Canvas 绘制 ---
      if (agentsWithLocal.length > 0) {
        const defaultAgent = agentsWithLocal[0];
        // 调用 selectAgent 处理背景色计算并执行 drawWithLocalFiles
        this.selectAgent(defaultAgent);
      }

      wx.hideLoading();
      console.log(`英雄数据初始化成功，共 ${agentsWithLocal.length} 条数据`);
    } catch (err) {
      console.error("Agent loadData 失败:", err);
      wx.hideLoading();
      wx.showToast({ title: "资源加载失败", icon: "none" });
    }
  },

  async loadWeapons() {
    // 1. 防抖：如果正在加载中，直接返回
    if (this.data.isWeaponLoading) return;

    this.setData({ isWeaponLoading: true });

    // 首次加载显示 loading，滚动加载不显示
    if (this.data.allWeapons.length === 0) {
      wx.showLoading({ title: "加载装饰..." });
    }

    try {
      const skip = this.data.allWeapons.length;
      // 保底处理，防止 pageSize 读不到
      const pageSize = this.data.weaponPageSize || 20;

      const { data } = await db
        .collection("weapons")
        .skip(skip)
        .limit(pageSize)
        .get();

      // 判断是否是最后一页
      if (data.length < pageSize) {
        this.setData({ isWeaponOver: true });
      }

      // ========================================================
      // 【核心修复】给每个下载任务加“单兵容错”
      // ========================================================
      const newWeaponsWithLocal = await Promise.all(
        data.map(async (item) => {
          // 默认使用原路径（万一下载失败，image 标签也许还能直接读 cloud:// 路径显示）
          let localPath = item.image;

          try {
            if (item.image) {
              // 尝试下载
              localPath = await this.downloadFileToLocal(item.image);
            }
          } catch (e) {
            // ！！！关键点！！！
            // 捕获单个图片的下载失败，打印日志，但不抛出错误
            // 这样 Promise.all 就不会因为一张图挂了而全军覆没
            console.warn(`[容错处理] 武器图片下载失败: ${item.skinName}`, e);

            // 如果你希望下载失败时显示一张默认图，可以在这里赋值
            // localPath = '/images/default_weapon.png';
          }

          return {
            ...item,
            imageLocal: localPath,
          };
        }),
      );
      // ========================================================

      // 追加数据
      this.setData({
        allWeapons: this.data.allWeapons.concat(newWeaponsWithLocal),
        isWeaponLoading: false,
      });

      console.log(
        `武器加载：新获取 ${newWeaponsWithLocal.length} 条 (总数 ${this.data.allWeapons.length + newWeaponsWithLocal.length})`,
      );

      if (skip === 0) wx.hideLoading();
    } catch (err) {
      console.error("加载武器主逻辑失败", err); // 只有数据库连接挂了才会走到这里
      this.setData({ isWeaponLoading: false });
      if (this.data.allWeapons.length === 0) wx.hideLoading();
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

  selectAgent(e) {
    // 兼容：如果是点击触发，从 dataset 拿；如果是 loadData 自动触发，直接用传入的对象
    const agent = e.currentTarget ? e.currentTarget.dataset.item : e;

    if (!agent) {
      console.error("未找到英雄数据");
      return;
    }

    // 处理渐变背景样式
    let gradientStyle = "";
    if (
      agent.backgroundGradientColors &&
      agent.backgroundGradientColors.length > 0
    ) {
      const colors = agent.backgroundGradientColors.map((color) => {
        // 瓦罗兰特颜色格式通常是 rrggbbaa
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        const a = parseInt(color.substr(6, 2), 16) / 255;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      });
      gradientStyle = `background: linear-gradient(to bottom, ${colors.join(", ")});`;
    }

    this.setData(
      {
        currentAgent: agent,
        canvasWrapperStyle: gradientStyle,
      },
      () => {
        // 确保数据设置成功后，立刻调用画布绘制
        if (this.drawWithLocalFiles) {
          this.drawWithLocalFiles();
        }
      },
    );
  },

  loadImage(src) {
    return new Promise((resolve, reject) => {
      if (!src) return resolve(null);

      const img = this.canvasNode.createImage();

      img.onload = () => {
        resolve(img);
      };

      img.onerror = (e) => {
        console.error("❌ 图片加载失败路径:", src);
        // 尝试去掉可能存在的 query string 再次加载（防御性代码）
        if (src.includes("?")) {
          img.src = src.split("?")[0];
        } else {
          reject(e);
        }
      };

      // 真机上 src 的赋值建议放在最后
      img.src = src;
    });
  },

  async drawWithLocalFiles() {
    console.log("🚀 [Canvas] 开始重绘...");
    if (!this.canvasCtx || !this.canvasNode) {
      console.log("🛠 [真机修复] 尝试重新初始化 Canvas 实例...");
      const res = await new Promise((resolve) => {
        const query = wx.createSelectorQuery();
        query
          .select("#mainCanvas")
          .fields({ node: true, size: true })
          .exec((res) => resolve(res[0]));
      });
      if (res) {
        this.canvasNode = res.node;
        this.canvasCtx = res.node.getContext("2d");
        // 重要：真机必须重新设置画布宽高，否则会黑屏
        const dpr = wx.getSystemInfoSync().pixelRatio;
        this.canvasNode.width = res.width * dpr;
        this.canvasNode.height = res.height * dpr;
        this.canvasCtx.scale(dpr, dpr);
      }
    }

    const ctx = this.canvasCtx;
    // 【核心】必须每次重绘都从 data 实时获取最新快照
    const { currentAgent, currentWeapon, systemInfo, weaponTransform } =
      this.data;

    if (!ctx || !this.canvasNode || !currentAgent) {
      console.error("❌ [Canvas] 绘图环境缺失");
      return;
    }

    const cw = systemInfo.windowWidth || 375;
    const ch = systemInfo.windowHeight || 667;

    // 1. 清空画布
    ctx.clearRect(0, 0, cw, ch);

    try {
      // 2. 准备所有素材（并行加载）
      const tasks = [
        this.loadImage(
          currentAgent.backgroundLocal || currentAgent.background,
        ).catch(() => null),
        this.loadImage(
          currentAgent.bustPortraitLocal || currentAgent.bustPortrait,
        ).catch(() => null),
        // 武器加载：强制优先读取最新存入的 imageLocal
        this.loadImage(currentWeapon?.imageLocal || currentWeapon?.image).catch(
          () => null,
        ),
      ];

      const [bgRes, pRes, wRes] = await Promise.all(tasks);

      // 3. 绘制层级
      // 背景层
      if (bgRes) {
        const bgScale = Math.max(cw / bgRes.width, ch / bgRes.height);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(
          bgRes,
          (cw - bgRes.width * bgScale) / 2,
          (ch - bgRes.height * bgScale) / 2,
          bgRes.width * bgScale,
          bgRes.height * bgScale,
        );
        ctx.globalAlpha = 1.0;
      }

      // 英雄层
      if (pRes) {
        const pRenderH = ch * 0.85;
        const pRatio = pRes.width / pRes.height;
        const pRenderW = pRenderH * pRatio;
        ctx.drawImage(
          pRes,
          (cw - pRenderW) / 2,
          ch - pRenderH,
          pRenderW,
          pRenderH,
        );
      }

      // 武器层 (Top)
      if (wRes && currentWeapon) {
        console.log("🎨 [Canvas] 正在绘制新色彩武器...");
        // 使用你调整好的 0.3-0.35 缩放
        const scale = weaponTransform.scale || 0.35;
        const wW = wRes.width * scale;
        const wH = wRes.height * scale;

        ctx.save();
        ctx.translate(weaponTransform.x, weaponTransform.y);
        // 居中绘制
        ctx.drawImage(wRes, -wW / 2, -wH / 2, wW, wH);
        ctx.restore();
      }

      console.log("✅ [Canvas] 绘制完毕");
    } catch (err) {
      console.error("🔥 [Canvas] 绘制流程崩溃:", err);
    }
  },

  saveCanvas() {
    const { systemInfo } = this.data;
    if (!systemInfo || !this.canvasNode || !this.canvasCtx) return;

    wx.showLoading({ title: "保存中..." });

    const ctx = this.canvasCtx;
    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 重新绘制，这次包含渐变背景
    this.drawWithGradient(() => {
      // 绘制完成后保存
      wx.canvasToTempFilePath({
        canvas: this.canvasNode,
        x: 0,
        y: 0,
        width: cw,
        height: ch,
        destWidth: cw * 2,
        destHeight: ch * 2,
        success: (res) => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: "保存成功", icon: "success" });
              // 恢复为不含渐变的版本（透出 CSS 渐变）
              this.drawWithLocalFiles();
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: "请授权保存相册", icon: "none" });
              this.drawWithLocalFiles();
            },
          });
        },
        fail: (err) => {
          console.error("保存失败", err);
          wx.hideLoading();
          wx.showToast({ title: "保存失败", icon: "none" });
          this.drawWithLocalFiles();
        },
      });
    });
  },

  drawGradientBackground(ctx, cw, ch) {
    const { currentAgent } = this.data;
    if (
      !currentAgent.backgroundGradientColors ||
      currentAgent.backgroundGradientColors.length === 0
    ) {
      return;
    }

    // 过滤掉完全透明的颜色
    const validColors = currentAgent.backgroundGradientColors.filter(
      (color) => {
        const a = parseInt(color.substr(6, 2), 16);
        return a > 0; // 只保留 alpha > 0 的颜色
      },
    );

    if (validColors.length === 0) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, ch);

    validColors.forEach((color, index) => {
      const position = index / (validColors.length - 1);
      const r = parseInt(color.substr(0, 2), 16);
      const g = parseInt(color.substr(2, 2), 16);
      const b = parseInt(color.substr(4, 2), 16);
      const a = parseInt(color.substr(6, 2), 16) / 255;

      gradient.addColorStop(position, `rgba(${r}, ${g}, ${b}, ${a})`);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cw, ch);

    console.log("渐变绘制：", cw, ch, "有效颜色数：", validColors.length);
  },

  drawWithGradient(callback) {
    const ctx = this.canvasCtx;
    const { currentAgent, systemInfo } = this.data;
    if (!ctx || !currentAgent || !this.canvasNode) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;
    const dpr = systemInfo.pixelRatio;

    // 保存当前状态
    ctx.save();

    // 重置并重新设置 scale（防止之前的操作影响）
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换
    ctx.scale(dpr, dpr); // 重新缩放

    // 清空画布
    ctx.clearRect(0, 0, cw, ch);

    console.log("开始绘制 - 窗口尺寸:", cw, ch);
    console.log("Canvas尺寸:", this.canvasNode.width, this.canvasNode.height);

    // 绘制渐变背景
    this.drawGradientBackground(ctx, cw, ch);

    // 绘制背景图
    const bgImg = this.canvasNode.createImage();
    bgImg.src = currentAgent.backgroundLocal;
    bgImg.onload = () => {
      const bgScale = Math.max(cw / bgImg.width, ch / bgImg.height);
      const bgW = bgImg.width * bgScale;
      const bgH = bgImg.height * bgScale;
      const bgX = (cw - bgW) / 2;
      const bgY = (ch - bgH) / 2;

      ctx.globalAlpha = 0.6;
      ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);
      ctx.globalAlpha = 1.0;

      // 绘制英雄
      const pImg = this.canvasNode.createImage();
      pImg.src = currentAgent.bustPortraitLocal;
      pImg.onload = () => {
        const pRenderH = ch * 0.85;
        const pRatio = pImg.width / pImg.height;
        const pRenderW = pRenderH * pRatio;
        const px = (cw - pRenderW) / 2;
        const py = ch - pRenderH;

        ctx.drawImage(pImg, px, py, pRenderW, pRenderH);

        console.log("绘制完成");

        // 恢复状态
        ctx.restore();

        // 等待确保绘制完成
        if (callback) {
          setTimeout(() => callback(), 150);
        }
      };
    };
  },

  async selectWeapon(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    console.log(
      "👉 [DEBUG] 点击事件触发对象:",
      e.currentTarget.dataset.item.skinName,
    );

    // 2. 看看这一刻，英雄数据还是不是英雄
    console.log(
      "🕵️ [DEBUG] 此时此刻 Agent 还是英雄吗？",
      this.data.currentAgent.displayName || "已经丢了",
    );
    // 调试 Log：看看这一步 currentAgent 是不是正常的英雄
    console.log("Before SetData - Agent:", this.data.currentAgent.displayName);

    wx.showLoading({ title: "装配中...", mask: true });

    try {
      let localPath = item.imageLocal;
      if (!localPath) {
        localPath = await this.downloadFileToLocal(item.image);
      }

      const updatedWeapon = { ...item, imageLocal: localPath };
      const info = this.data.systemInfo.windowWidth
        ? this.data.systemInfo
        : wx.getSystemInfoSync();

      // ⚠️ 关键修正：只更新 currentWeapon，严禁把 item 赋给 currentAgent
      this.setData(
        {
          // 这里绝对不要写 currentAgent: item
          currentWeapon: updatedWeapon,
          weaponTransform: {
            x: info.windowWidth / 2,
            y: info.windowHeight * 0.6,
            scale: 0.35, // 从 0.6 调小到 0.35，避免占满全屏
            lastX: 0,
            lastY: 0,
          },
        },
        () => {
          console.log(
            "After SetData - Agent Check:",
            this.data.currentAgent.displayName,
          );
          this.drawWithLocalFiles();
        },
      );
    } catch (err) {
      console.error("❌ 选中失败:", err);
    } finally {
      wx.hideLoading();
    }
  },

  async changeChroma(e) {
    const chroma = e.currentTarget.dataset.chroma;
    const { currentWeapon } = this.data;
    if (!chroma || !currentWeapon) return;

    console.log("🔍 [Chroma] 原始数据检查:", chroma); // 看看 log 里到底有什么字段

    this.setData({ tempChromaUuid: chroma.chromaUuid });
    wx.showLoading({ title: "同步色彩...", mask: true });

    try {
      // 1. 尝试多个可能的字段，瓦罗兰特 API 幻彩图常见字段：fullRender > displayIcon > swatch
      // 如果都没有，兜底使用皮肤的主图 currentWeapon.image
      const chromaImg =
        chroma.fullRender ||
        chroma.displayIcon ||
        chroma.swatch ||
        currentWeapon.image;

      if (!chromaImg) {
        throw new Error("未找到有效的图片地址");
      }

      // 2. 下载
      const localPath = await this.downloadFileToLocal(chromaImg);

      // 3. 严格检查 localPath 是否成功拿到
      if (!localPath) {
        console.error("❌ 下载失败，路径为空");
        return;
      }

      const timestampedPath = `${localPath}?t=${Date.now()}`;

      const updatedWeapon = {
        ...currentWeapon,
        imageLocal: timestampedPath,
        chromaUuid: chroma.chromaUuid,
      };

      this.setData(
        {
          currentWeapon: updatedWeapon,
        },
        () => {
          console.log("✅ [Chroma] 数据更新成功，新路径:", timestampedPath);
          this.drawWithLocalFiles();
        },
      );
    } catch (err) {
      console.error("❌ 切换幻彩失败:", err);
      wx.showToast({ title: "该幻彩暂无预览图", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async changeChroma(e) {
    const chroma = e.currentTarget.dataset.chroma;
    const { currentWeapon } = this.data;
    if (!chroma || !currentWeapon) return;

    this.setData({ tempChromaUuid: chroma.chromaUuid });
    wx.showLoading({ title: "同步色彩...", mask: true });

    try {
      const chromaImg = chroma.image || chroma.swatch || currentWeapon.image;
      const localPath = await this.downloadFileToLocal(chromaImg);

      if (!localPath) return;

      // 【关键修复】不要在路径后面加 ?t=...
      // 直接传原始临时路径，真机对这种路径的读取最稳定
      const updatedWeapon = {
        ...currentWeapon,
        imageLocal: localPath,
        chromaUuid: chroma.chromaUuid,
      };

      this.setData(
        {
          currentWeapon: updatedWeapon,
        },
        () => {
          // 延迟一小会儿执行，给系统文件 IO 一点反应时间
          setTimeout(() => {
            this.drawWithLocalFiles();
          }, 50);
        },
      );
    } catch (err) {
      console.error("❌ 切换幻彩失败:", err);
    } finally {
      wx.hideLoading();
    }
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

  toggleWeaponMenu() {
    this.setData({
      weaponMenuExpanded: !this.data.weaponMenuExpanded,
    });
  },

  // 1. 核心抓取函数：确保返回 Promise 以便 togglePanel 等待
  async fetchWeaponData(tabName, isNextPage = false) {
    // 检查分页状态
    if (isNextPage && this.data.isWeaponOver) return;

    const db = wx.cloud.database();
    const collectionName = WEAPON_MAP[tabName];
    // 修复：确保 pageSize 有默认值，防止报错 -401002
    const size = this.data.pageSize || 20;
    const page = isNextPage ? this.data.weaponPage + 1 : 0;

    if (!isNextPage) wx.showLoading({ title: "加载素材中...", mask: true });

    try {
      const res = await db
        .collection(collectionName)
        .skip(page * size)
        .limit(size)
        .get();

      const newData = res.data;
      const totalList = isNextPage
        ? this.data.filteredList.concat(newData)
        : newData;

      // 同步更新数据和缓存
      this.setData({
        filteredList: totalList,
        weaponPage: page,
        isWeaponOver: newData.length < size,
        [`weaponCache.${tabName}`]: totalList,
      });
      return totalList; // 返回结果供 togglePanel 使用
    } catch (err) {
      console.error("加载失败", err);
      wx.showToast({ title: "资源同步失败", icon: "none" });
      throw err;
    } finally {
      if (!isNextPage) wx.hideLoading();
    }
  },

  // 2. 重构后的 togglePanel：先加载，后弹窗
  async togglePanel(e) {
    const type = e.currentTarget ? e.currentTarget.dataset.type : e;

    // 关闭逻辑
    if (!type || (this.data.showPopup && this.data.popupType === type)) {
      this.setData({ showPopup: false });
      return;
    }

    const isHero = type === "hero";
    const defaultTab = isHero ? "全部" : "近战";

    // 预检数据：如果没数据，先去抓取
    if (type === "weapon" && !this.data.weaponCache[defaultTab]) {
      try {
        await this.fetchWeaponData(defaultTab);
        // 抓取成功后再往下走，此时 filteredList 已经有值了
      } catch (e) {
        return; // 抓取失败不弹窗
      }
    } else if (isHero) {
      // 英雄数据通常在 onLoad 已备好
      this.setData({ filteredList: this.data.heroMap[defaultTab] || [] });
    } else {
      // 武器已有缓存，直接赋值
      this.setData({ filteredList: this.data.weaponCache[defaultTab] });
    }

    // 最后一步：展示弹窗并设置 Tab
    // 此时 DOM 里的数据已经就绪，不会出现图片撑开的跳动
    this.setData({
      showPopup: true,
      popupType: type,
      currentTab: defaultTab,
      popupTabs: isHero ? this.data.heroTabs : this.data.weaponTabs,
    });
  },

  onTabChange: function (e) {
    const tab = e.currentTarget.dataset.tab;
    const { popupType, allAgents, allWeapons } = this.data;
    let newList = [];

    if (popupType === "hero") {
      newList =
        tab === "全部"
          ? allAgents
          : allAgents.filter((a) => a.role.displayName === tab);
    } else {
      newList =
        tab === "全部"
          ? allWeapons
          : allWeapons.filter((w) => w.category === tab);
    }

    this.setData({
      currentTab: tab,
      filteredList: newList,
    });
  },

  onTabChange: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });

    if (this.data.popupType === "hero") {
      // 英雄：查本地 heroMap
      this.setData({ filteredList: this.data.heroMap[tab] || [] });
    } else {
      // 武器：按需查缓存或数据库
      if (this.data.weaponCache[tab]) {
        this.setData({ filteredList: this.data.weaponCache[tab] });
      } else {
        this.fetchWeaponData(tab);
      }
    }
  },

  loadMoreWeapons: function () {
    if (this.data.popupType === "hero") return; // 英雄数据少，通常不需要分页
    if (this.data.isWeaponOver) return;

    console.log("触底加载更多武器...");
    this.fetchWeaponData(this.data.currentTab, true);
  },
});
