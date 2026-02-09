const db = wx.cloud.database();
import { availableTags } from "../../../config/tags";
// import { PLAYER_CARDS } from "../../../config/player_cards_index";

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

// 在 Page 外定义，存图片对象
let ImageCache = {
  bg: null,
  hero: null,
  weapons: {},
  lastBgSrc: "",
  lastHeroSrc: "",
  lastWeaponSrc: "",
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

    activeWeapons: [], // 存储当前画布上所有的武器对象
    selectedWeaponIndex: -1, // 当前正在拖拽或选中的武器索引

    //首图数据
    currentAgent: {
      uuid: "e370fa57-4757-3604-3648-499e1f642d3f",
      displayName: "盖可",
      role: "先锋",
      bustPortrait:
        "cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/agents/portraits/e370fa57-4757-3604-3648-499e1f642d3f.webp",
      background:
        "cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/agents/backgrounds/e370fa57-4757-3604-3648-499e1f642d3f.webp",
      backgroundGradientColors: [
        "371c5cff",
        "0f1923ff",
        "3a2656ff",
        "0f192300",
      ],
    },
    canvasWrapperStyle:
      "background: linear-gradient(to bottom, rgba(55, 28, 92, 1), rgba(15, 25, 35, 1));", // 初始背景色

    // 保存弹窗
    showSaveModal: false,
    presetName: "",
    selectedTags: [],
    availableTags: availableTags,
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query
      .select("#testCanvas")
      .fields({ node: true, size: true })
      .exec(async (res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const { windowWidth, windowHeight } = wx.getSystemInfoSync();

        canvas.width = windowWidth * dpr;
        canvas.height = windowHeight * dpr;
        ctx.scale(dpr, dpr);

        this.canvasNode = canvas;
        this.canvasCtx = ctx;
        this.setData({ systemInfo: wx.getSystemInfoSync() });

        // 2. 触发第一个英雄的下载（这会调用 downloadFileToLocal 并最终触发绘制）
        this.selectAgent(this.data.currentAgent);
      });
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
    return new Promise((resolve) => {
      // 注意：这里只传 resolve，不传 reject
      if (!cloudPath) return resolve(null);

      // 如果已经是本地路径，直接返回
      if (
        cloudPath.startsWith("http://tmp") ||
        cloudPath.startsWith("wxfile://")
      ) {
        return resolve(cloudPath);
      }

      if (!cloudPath.startsWith("cloud://")) {
        // 处理普通 HTTP 路径的下载
        wx.downloadFile({
          url: cloudPath,
          success: (res) =>
            resolve(res.statusCode === 200 ? res.tempFilePath : null),
          fail: () => resolve(null),
        });
        return;
      }

      // 处理云路径
      wx.cloud.getTempFileURL({
        fileList: [cloudPath],
        success: (res) => {
          const file = res.fileList[0];
          // 关键：如果 status 不是 0 或者 tempUrl 为空，说明云端文件有问题
          if (!file || !file.tempFileURL || file.status !== 0) {
            console.warn(`⚠️ 云端资源失效或不存在: ${cloudPath}`);
            return resolve(null); // 优雅返回 null，不报错
          }

          wx.downloadFile({
            url: file.tempFileURL,
            success: (downloadRes) => {
              resolve(
                downloadRes.statusCode === 200
                  ? downloadRes.tempFilePath
                  : null,
              );
            },
            fail: () => resolve(null),
          });
        },
        fail: () => resolve(null),
      });
    });
  },

  async selectAgent(e) {
    console.log(e);
    let agent = null;
    if (e.detail && e.detail.item) {
      agent = e.detail.item;
    } else if (e.currentTarget && e.currentTarget.dataset.item) {
      agent = e.currentTarget.dataset.item;
    } else {
      agent = e;
    }

    // const agent = e.currentTarget ? e.currentTarget.dataset.item : e;
    if (!agent) return;

    // --- 1. 处理渐变背景样式 (纯计算，先行设置) ---
    let gradientStyle = "";
    if (agent.backgroundGradientColors?.length > 0) {
      const colors = agent.backgroundGradientColors.map((color) => {
        const r = parseInt(color.substr(0, 2), 16),
          g = parseInt(color.substr(2, 2), 16),
          b = parseInt(color.substr(4, 2), 16),
          a = parseInt(color.substr(6, 2), 16) / 255;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      });
      gradientStyle = `background: linear-gradient(to bottom, ${colors.join(", ")});`;
    }

    // --- 2. 核心：检查是否需要下载图片 (Lazy Load) ---
    // 如果没有 backgroundLocal，说明是第一次切换到该英雄
    if (!agent.backgroundLocal || !agent.bustPortraitLocal) {
      wx.showLoading({ title: "加载英雄立绘...", mask: true });

      // 下载该英雄特有的资源
      const [bgLocal, portraitLocal] = await Promise.all([
        this.downloadFileToLocal(agent.background),
        this.downloadFileToLocal(agent.bustPortrait),
      ]);

      // 更新该英雄在内存中的数据，这样下次点就不走这里了
      agent.backgroundLocal = bgLocal;
      agent.bustPortraitLocal = portraitLocal;

      // 同步更新全量列表中的该项（可选，保持数据一致性）
      const index = this.data.allAgents.findIndex((a) => a.uuid === agent.uuid);
      if (index !== -1) {
        this.setData({ [`allAgents[${index}]`]: agent });
      }

      wx.hideLoading();
    }

    // --- 3. 设置当前选中的英雄并重绘 ---
    this.setData(
      {
        currentAgent: agent,
        canvasWrapperStyle: gradientStyle,
      },
      () => {
        // 此时图片路径已是本地/缓存路径，绘制会非常丝滑
        this.drawWithLocalFiles();
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
    const ctx = this.canvasCtx;
    const { currentAgent, activeWeapons, systemInfo } = this.data;

    if (!ctx || !this.canvasNode || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    try {
      // --- 1. 准备加载任务队列 ---
      const bgSrc = currentAgent.backgroundLocal || currentAgent.background;
      const heroSrc =
        currentAgent.bustPortraitLocal || currentAgent.bustPortrait;
      const loadTasks = [];

      // 背景图缓存检查
      if (bgSrc !== ImageCache.lastBgSrc || !ImageCache.bg) {
        loadTasks.push(
          this.loadImage(bgSrc).then((img) => {
            ImageCache.bg = img;
            ImageCache.lastBgSrc = bgSrc;
          }),
        );
      }

      // 英雄图缓存检查
      if (heroSrc !== ImageCache.lastHeroSrc || !ImageCache.hero) {
        loadTasks.push(
          this.loadImage(heroSrc).then((img) => {
            ImageCache.hero = img;
            ImageCache.lastHeroSrc = heroSrc;
          }),
        );
      }

      // 多武器图缓存检查：遍历 activeWeapons 数组
      activeWeapons.forEach((w) => {
        const wId = w.instanceId;
        const wSrc = w.imageLocal || w.image;
        // 如果这个实例没缓存，或者图片路径变了（切换了幻彩），则加载
        if (
          !ImageCache.weapons[wId] ||
          ImageCache.weapons[wId].src.indexOf(w.imageLocal) === -1
        ) {
          loadTasks.push(
            this.loadImage(wSrc).then((img) => {
              ImageCache.weapons[wId] = img;
            }),
          );
        }
      });

      // 等待所有新素材加载完成
      if (loadTasks.length > 0) {
        await Promise.all(loadTasks);
      }

      // --- 2. 开始物理绘制 ---
      // 清空画布（由于图片已在内存，这一步之后立即绘制不会闪烁）
      ctx.clearRect(0, 0, cw, ch);

      // A. 绘制背景
      if (ImageCache.bg) {
        const bg = ImageCache.bg;
        const bgScale = Math.max(cw / bg.width, ch / bg.height);
        console.log("--- 背景计算参数 ---", {
          原始宽: bg.width,
          原始高: bg.height,
          缩放后宽: bg.width * bgScale,
          缩放后高: bg.height * bgScale,
          绘制起点的X: (cw - bg.width * bgScale) / 2,
          绘制起点的Y: (ch - bg.height * bgScale) / 2,
        });
        ctx.globalAlpha = 0.6;
        ctx.drawImage(
          bg,
          (cw - bg.width * bgScale) / 2,
          (ch - bg.height * bgScale) / 2,
          bg.width * bgScale,
          bg.height * bgScale,
        );
        ctx.globalAlpha = 1.0;
      }

      // B. 绘制英雄
      if (ImageCache.hero) {
        const hero = ImageCache.hero;
        const pRenderH = ch * 0.85;
        const pRatio = hero.width / hero.height;
        const pRenderW = pRenderH * pRatio;
        console.log("--- 英雄计算参数 ---", {
          画布宽cw: cw,
          画布高ch: ch,
          渲染高度H: pRenderH,
          渲染宽度W: pRenderW,
          英雄比例Ratio: pRatio,
          英雄绘制起点Y: ch - pRenderH,
        });
        ctx.drawImage(
          hero,
          (cw - pRenderW) / 2,
          ch - pRenderH,
          pRenderW,
          pRenderH,
        );
      }

      // C. 绘制所有武器 (遍历数组)
      activeWeapons.forEach((w, index) => {
        const wImg = ImageCache.weapons[w.instanceId];
        if (wImg) {
          ctx.save();
          ctx.translate(w.x, w.y);

          // 如果是当前选中的武器，可以加个简单的视觉反馈（可选）
          if (index === this.data.selectedWeaponIndex) {
            // ctx.shadowBlur = 15;
            // ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
          }

          const scale = w.scale || 0.35;
          const wW = wImg.width * scale;
          const wH = wImg.height * scale;

          // 居中绘制武器
          ctx.drawImage(wImg, -wW / 2, -wH / 2, wW, wH);
          ctx.restore();
        }
      });

      console.log(`✅ [Canvas] 成功渲染英雄 + ${activeWeapons.length} 把武器`);
    } catch (err) {
      console.error("🔥 [Canvas] 绘制异常:", err);
    }
  },

  async drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const {
      currentAgent,
      currentCard,
      usePlayerCard,
      activeWeapons,
      systemInfo,
    } = this.data;

    // 基础检查：没有 Context 或英雄数据则无法绘制
    if (!ctx || !this.canvasNode || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    try {
      // --- 1. 动态确定素材来源 ---

      // 背景来源：根据开关决定是使用英雄背景还是玩家卡面
      let bgSrc = "";
      if (usePlayerCard && currentCard) {
        bgSrc = currentCard.localPath || currentCard.url;
      } else {
        bgSrc = currentAgent.backgroundLocal || currentAgent.background;
      }

      // 英雄立绘来源
      const heroSrc =
        currentAgent.bustPortraitLocal || currentAgent.bustPortrait;

      const loadTasks = [];

      // 背景图缓存与加载任务
      if (bgSrc !== ImageCache.lastBgSrc || !ImageCache.bg) {
        loadTasks.push(
          this.loadImage(bgSrc).then((img) => {
            ImageCache.bg = img;
            ImageCache.lastBgSrc = bgSrc;
          }),
        );
      }

      // 英雄图缓存与加载任务
      if (heroSrc !== ImageCache.lastHeroSrc || !ImageCache.hero) {
        loadTasks.push(
          this.loadImage(heroSrc).then((img) => {
            ImageCache.hero = img;
            ImageCache.lastHeroSrc = heroSrc;
          }),
        );
      }

      // 武器图缓存与加载任务 (遍历 activeWeapons)
      activeWeapons.forEach((w) => {
        const wId = w.instanceId;
        const wSrc = w.imageLocal || w.image;
        if (!ImageCache.weapons[wId] || ImageCache.weapons[wId].src !== wSrc) {
          loadTasks.push(
            this.loadImage(wSrc).then((img) => {
              ImageCache.weapons[wId] = img;
              ImageCache.weapons[wId].src = wSrc; // 标记来源用于比对
            }),
          );
        }
      });

      // 等待所有素材进入内存
      if (loadTasks.length > 0) {
        await Promise.all(loadTasks);
      }

      // --- 2. 开始物理绘制流程 ---

      // A. 清空画布
      ctx.clearRect(0, 0, cw, ch);

      // B. 绘制背景层
      if (ImageCache.bg) {
        const bg = ImageCache.bg;
        // 使用 Aspect Fill 算法：确保图片覆盖全屏且不拉伸
        const bgScale = Math.max(cw / bg.width, ch / bg.height);
        const drawW = bg.width * bgScale;
        const drawH = bg.height * bgScale;
        const drawX = (cw - drawW) / 2;
        const drawY = (ch - drawH) / 2;

        ctx.save();
        // 如果是卡面，100%不透明；如果是英雄背景，保持 0.6 透明度透出底部的渐变
        ctx.globalAlpha = usePlayerCard ? 1.0 : 0.6;
        ctx.drawImage(bg, drawX, drawY, drawW, drawH);
        ctx.restore();
      }

      // C. 绘制英雄层 (叠加在背景之上)
      if (ImageCache.hero) {
        const hero = ImageCache.hero;
        // 英雄立绘通常占据屏幕高度的 85%
        const pRenderH = ch * 0.85;
        const pRatio = hero.width / hero.height;
        const pRenderW = pRenderH * pRatio;
        const pX = (cw - pRenderW) / 2;
        const pY = ch - pRenderH;

        ctx.save();
        // 如果背景是复杂的卡面，可以给英雄加一个微弱的投影增强立体感
        if (usePlayerCard) {
          ctx.shadowBlur = 30;
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        }
        ctx.drawImage(hero, pX, pY, pRenderW, pRenderH);
        ctx.restore();
      }

      // D. 绘制武器层 (最顶层)
      activeWeapons.forEach((w, index) => {
        const wImg = ImageCache.weapons[w.instanceId];
        if (wImg) {
          ctx.save();
          // 移动坐标系到武器中心
          ctx.translate(w.x, w.y);

          // 选中的武器加光晕反馈
          if (index === this.data.selectedWeaponIndex) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#ff4655";
          }

          const scale = w.scale || 0.35;
          const wW = wImg.width * scale;
          const wH = wImg.height * scale;

          // 绘制武器（坐标已 offset，所以是 -wW/2）
          ctx.drawImage(wImg, -wW / 2, -wH / 2, wW, wH);
          ctx.restore();
        }
      });

      console.log(
        `🎨 [Canvas] 渲染成功: ${usePlayerCard ? "卡面背景" : "英雄背景"}`,
      );
    } catch (err) {
      console.error("❌ [Canvas] 绘制失败:", err);
      wx.showToast({ title: "画布渲染异常", icon: "none" });
    }
  },

  async drawWithLocalFiles() {
    const ctx = this.canvasCtx;
    const {
      currentAgent,
      currentCard,
      usePlayerCard,
      activeWeapons,
      systemInfo,
    } = this.data;

    // 1. 基础校验
    if (!ctx || !this.canvasNode || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    try {
      // --- 准备素材路径 ---
      let bgSrc =
        usePlayerCard && currentCard
          ? currentCard.localPath || currentCard.url
          : currentAgent.backgroundLocal || currentAgent.background;

      const heroSrc =
        currentAgent.bustPortraitLocal || currentAgent.bustPortrait;
      const loadTasks = [];

      // --- 异步加载/缓存检查 ---
      if (bgSrc !== ImageCache.lastBgSrc || !ImageCache.bg) {
        loadTasks.push(
          this.loadImage(bgSrc).then((img) => {
            ImageCache.bg = img;
            ImageCache.lastBgSrc = bgSrc;
          }),
        );
      }
      if (heroSrc !== ImageCache.lastHeroSrc || !ImageCache.hero) {
        loadTasks.push(
          this.loadImage(heroSrc).then((img) => {
            ImageCache.hero = img;
            ImageCache.lastHeroSrc = heroSrc;
          }),
        );
      }
      activeWeapons.forEach((w) => {
        const wSrc = w.imageLocal || w.image;
        if (
          !ImageCache.weapons[w.instanceId] ||
          ImageCache.weapons[w.instanceId].src !== wSrc
        ) {
          loadTasks.push(
            this.loadImage(wSrc).then((img) => {
              ImageCache.weapons[w.instanceId] = img;
              ImageCache.weapons[w.instanceId].src = wSrc;
            }),
          );
        }
      });

      if (loadTasks.length > 0) await Promise.all(loadTasks);

      // --- 2. 物理绘制流程 (顺序决定层级) ---
      ctx.clearRect(0, 0, cw, ch);

      // 【第一层：背景】
      if (ImageCache.bg) {
        ctx.save(); // 保存初始状态
        const bg = ImageCache.bg;
        const bgScale = Math.max(cw / bg.width, ch / bg.height);
        const dW = bg.width * bgScale;
        const dH = bg.height * bgScale;

        // 如果是卡面，全显；如果是原厂背景，半透明透出底部的渐变
        ctx.globalAlpha = usePlayerCard ? 1.0 : 0.6;
        ctx.drawImage(bg, (cw - dW) / 2, (ch - dH) / 2, dW, dH);
        ctx.restore(); // 恢复状态，确保 alpha 不影响后续绘制
      }

      // 【第二层：英雄立绘】
      if (ImageCache.hero) {
        ctx.save();
        const hero = ImageCache.hero;
        const pRenderH = ch * 0.85;
        const pRatio = hero.width / hero.height;
        const pRenderW = pRenderH * pRatio;

        // 可以在这里给英雄加一个微弱的投影，使其从背景中脱离出来
        if (usePlayerCard) {
          ctx.shadowBlur = 40;
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        }

        ctx.drawImage(
          hero,
          (cw - pRenderW) / 2,
          ch - pRenderH,
          pRenderW,
          pRenderH,
        );
        ctx.restore();
      }

      // 【第三层：所有武器】
      activeWeapons.forEach((w, index) => {
        const wImg = ImageCache.weapons[w.instanceId];
        if (wImg) {
          ctx.save();
          ctx.translate(w.x, w.y);

          // 选中态反馈
          if (index === this.data.selectedWeaponIndex) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = "#ff4655";
          }

          const scale = w.scale || 0.35;
          const wW = wImg.width * scale;
          const wH = wImg.height * scale;

          ctx.drawImage(wImg, -wW / 2, -wH / 2, wW, wH);
          ctx.restore();
        }
      });

      console.log("✅ Canvas 层级绘制完成");
    } catch (err) {
      console.error("❌ Canvas 绘制异常:", err);
    }
  },

  saveCanvas() {
    const { systemInfo } = this.data;
    if (!this.canvasNode) return;

    wx.showLoading({ title: "合成壁纸中...", mask: true });

    // 执行带渐变的重绘
    this.drawWithGradient(() => {
      wx.canvasToTempFilePath({
        canvas: this.canvasNode,
        // 这里的宽高决定了导出的清晰度
        destWidth: this.canvasNode.width,
        destHeight: this.canvasNode.height,
        fileType: "jpg",
        quality: 1,
        success: (res) => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({ title: "已存至相册", icon: "success" });
            },
            complete: () => {
              wx.hideLoading();
              // 导出完记得切回“透明背景”版，否则界面上会看到两层颜色
              this.drawWithLocalFiles();
            },
          });
        },
        fail: (err) => {
          console.error("导出失败", err);
          wx.hideLoading();
          this.drawWithLocalFiles();
        },
      });
    });
  },

  drawGradientBackground(ctx, cw, ch) {
    const { currentAgent } = this.data;
    let colors = currentAgent.backgroundGradientColors || [];
    if (colors.length === 0) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, ch);

    colors.forEach((color, index) => {
      // 移除 # 号
      const hex = color.replace("#", "");
      const position = index / (colors.length - 1);

      // 提取 RGBA
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      // 如果只有 6 位则 alpha 默认为 1，如果是 8 位则计算 alpha
      const a = hex.length === 8 ? parseInt(hex.substr(6, 2), 16) / 255 : 1;

      gradient.addColorStop(position, `rgba(${r}, ${g}, ${b}, ${a})`);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cw, ch);
  },

  drawWithGradient(callback) {
    const ctx = this.canvasCtx;
    const { currentAgent, activeWeapons, systemInfo } = this.data;
    if (!ctx || !this.canvasNode || !currentAgent) return;

    const cw = systemInfo.windowWidth;
    const ch = systemInfo.windowHeight;

    // 1. 绘制渐变层 (最底层)
    this.drawGradientBackground(ctx, cw, ch);

    // 2. 绘制背景图 (从缓存拿，不用等待 onload)
    if (ImageCache.bg) {
      const bg = ImageCache.bg;
      const bgScale = Math.max(cw / bg.width, ch / bg.height);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(
        bg,
        (cw - bg.width * bgScale) / 2,
        (ch - bg.height * bgScale) / 2,
        bg.width * bgScale,
        bg.height * bgScale,
      );
      ctx.globalAlpha = 1.0;
    }

    // 3. 绘制英雄
    if (ImageCache.hero) {
      const hero = ImageCache.hero;
      const pRenderH = ch * 0.85;
      const pRatio = hero.width / hero.height;
      const pRenderW = pRenderH * pRatio;
      ctx.drawImage(
        hero,
        (cw - pRenderW) / 2,
        ch - pRenderH,
        pRenderW,
        pRenderH,
      );
    }

    // 4. 【关键：绘制所有武器】
    activeWeapons.forEach((w) => {
      const wImg = ImageCache.weapons[w.instanceId];
      if (wImg) {
        ctx.save();
        ctx.translate(w.x, w.y);
        const scale = w.scale || 0.35;
        const wW = wImg.width * scale;
        const wH = wImg.height * scale;
        ctx.drawImage(wImg, -wW / 2, -wH / 2, wW, wH);
        ctx.restore();
      }
    });

    // 5. 强制等待一小会儿确保硬件缓冲区写入
    setTimeout(() => {
      if (callback) callback();
    }, 200);
  },

  async selectWeapon(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    // 1. 开启加载提示，防止用户重复点击
    wx.showLoading({ title: "正在装配武器...", mask: true });

    try {
      const { systemInfo, activeWeapons } = this.data;
      const cw = systemInfo.windowWidth;
      const ch = systemInfo.windowHeight;

      // 2. 确定初始显示的图片（如果有炫彩优先取第一个炫彩，否则取主图）
      const displayImg =
        item.chromas && item.chromas.length > 0
          ? item.chromas[0].image || item.image
          : item.image;

      // 3. 资源安检：转换云路径并下载到本地临时目录
      const localPath = await this.downloadFileToLocal(displayImg);

      // 如果下载失败（如云端文件不存在），拦截后续逻辑
      if (!localPath) {
        wx.hideLoading();
        wx.showToast({ title: "资源获取失败", icon: "none" });
        return;
      }

      // 4. 计算新成员的索引位置
      const newIndex = activeWeapons.length;

      // 5. 创建武器实例
      const newWeaponInstance = {
        ...item, // 继承原始数据（含 chromas 数组）
        instanceId: Date.now(), // 唯一实例标识，用于 ImageCache 缓存 key
        imageLocal: localPath, // 核心：Canvas 绘图只认这个本地路径
        chromaUuid:
          item.chromas && item.chromas.length > 0
            ? item.chromas[0].chromaUuid
            : "",
        // 初始物理状态
        x: cw / 2,
        y: ch / 2,
        scale: 0.35, // 默认缩放比例
        lastX: 0,
        lastY: 0,
      };

      // 6. 原子化更新数据
      this.setData(
        {
          // 将新武器追加到画布数组
          activeWeapons: [...activeWeapons, newWeaponInstance],
          // 【关键】立即选中这把新武器，后续 changeChroma 才能精准定位
          selectedWeaponIndex: newIndex,
          // 同步给 UI 层渲染的引用
          currentWeapon: item,
          // 重置下方炫彩栏的选择态
          tempChromaUuid: newWeaponInstance.chromaUuid,
        },
        () => {
          // 7. 渲染层同步后，触发 Canvas 重绘
          this.drawWithLocalFiles();
          wx.hideLoading();

          // 可选：添加成功后自动关闭选择弹窗
          // this.setData({ showPopup: false });
        },
      );
    } catch (err) {
      console.error("❌ selectWeapon 流程异常:", err);
      wx.hideLoading();
      wx.showToast({ title: "装配发生错误", icon: "none" });
    }
  },

  async changeChroma(e) {
    const chroma = e.currentTarget.dataset.chroma;
    const { activeWeapons, selectedWeaponIndex } = this.data;

    // 【核心修复】必须确保有一个被选中的索引，且该索引在数组范围内
    if (
      !chroma ||
      selectedWeaponIndex === -1 ||
      !activeWeapons[selectedWeaponIndex]
    ) {
      console.warn("⚠️ 未选中任何武器实例，无法更换炫彩");
      return;
    }

    this.setData({ tempChromaUuid: chroma.chromaUuid });
    wx.showLoading({ title: "同步色彩...", mask: true });

    try {
      // 确定图片地址
      const chromaImg = chroma.image || chroma.swatch;
      const localPath = await this.downloadFileToLocal(chromaImg);

      if (!localPath) {
        wx.hideLoading();
        return;
      }

      // 【核心修复】精准更新数组中“当前选中”的那一把
      const targetWeapon = activeWeapons[selectedWeaponIndex];
      const updatedWeapon = {
        ...targetWeapon,
        imageLocal: localPath,
        chromaUuid: chroma.chromaUuid,
      };

      this.setData(
        {
          // 1. 更新当前选中的 UI 引用（供底栏使用）
          "currentWeapon.imageLocal": localPath,
          "currentWeapon.chromaUuid": chroma.chromaUuid,
          // 2. 使用 ES6 动态键名精准修改数组中的特定项
          [`activeWeapons[${selectedWeaponIndex}]`]: updatedWeapon,
        },
        () => {
          // 渲染层同步完成后重绘
          this.drawWithLocalFiles();
          wx.hideLoading();
        },
      );
    } catch (err) {
      console.error("❌ 切换炫彩失败:", err);
      wx.hideLoading();
    }
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

  touchStart(e) {
    // 如果弹窗开着，或者没有武器，不处理
    if (this.data.showPopup || this.data.activeWeapons.length === 0) return;

    const currentTime = e.timeStamp;
    const lastTapTime = this.lastTapTime || 0;
    this.lastTapTime = currentTime;

    // --- 1. 双击判定 (用于删除) ---
    if (currentTime - lastTapTime < 300) {
      console.log("🖱️ 检测到双击，尝试删除选中武器");
      // 如果点中了某个武器才执行删除
      if (this.data.selectedWeaponIndex !== -1) {
        this.deleteSelectedWeapon(); // 确保你之前写的删除函数名叫 deleteSelected
      }
      return;
    }

    // --- 2. 坐标与选中判定 ---
    if (e.touches.length === 1) {
      const { clientX, clientY } = e.touches[0];
      const { activeWeapons } = this.data;

      // 判定点中了哪把枪（倒序查找，优先最上层）
      let foundIndex = -1;
      for (let i = activeWeapons.length - 1; i >= 0; i--) {
        const w = activeWeapons[i];
        // 判定范围 60 像素
        if (Math.abs(clientX - w.x) < 60 && Math.abs(clientY - w.y) < 60) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        const selectedW = activeWeapons[foundIndex];
        this.setData(
          {
            selectedWeaponIndex: foundIndex,
            currentWeapon: selectedW, // 同步给底部的 Chroma 栏
            tempChromaUuid: selectedW.chromaUuid || "",
            [`activeWeapons[${foundIndex}].lastX`]: clientX,
            [`activeWeapons[${foundIndex}].lastY`]: clientY,
          },
          () => {
            this.drawWithLocalFiles(); // 重绘以显示高亮
          },
        );
      } else {
        // 点在空白处取消选中
        this.setData({ selectedWeaponIndex: -1 });
        this.drawWithLocalFiles();
      }
    }
    // --- 3. 双指缩放初始化 ---
    else if (e.touches.length === 2 && this.data.selectedWeaponIndex !== -1) {
      const xLen = e.touches[1].clientX - e.touches[0].clientX;
      const yLen = e.touches[1].clientY - e.touches[0].clientY;
      // 记录初始双指间距
      this.startDistance = Math.sqrt(xLen * xLen + yLen * yLen);
      // 记录初始缩放值
      this.startScale =
        this.data.activeWeapons[this.data.selectedWeaponIndex].scale || 0.35;
    }
  },

  touchMove(e) {
    const { activeWeapons, selectedWeaponIndex, showPopup } = this.data;
    if (showPopup || selectedWeaponIndex === -1) return;

    // --- A. 单指拖拽逻辑 ---
    if (e.touches.length === 1) {
      const { clientX, clientY } = e.touches[0];
      const w = activeWeapons[selectedWeaponIndex];

      // 计算位移
      const dx = clientX - w.lastX;
      const dy = clientY - w.lastY;

      this.setData(
        {
          [`activeWeapons[${selectedWeaponIndex}].x`]: w.x + dx,
          [`activeWeapons[${selectedWeaponIndex}].y`]: w.y + dy,
          [`activeWeapons[${selectedWeaponIndex}].lastX`]: clientX,
          [`activeWeapons[${selectedWeaponIndex}].lastY`]: clientY,
        },
        () => {
          this.drawWithLocalFiles();
        },
      );
    }
    // --- B. 双指缩放逻辑 ---
    else if (e.touches.length === 2) {
      const xLen = e.touches[1].clientX - e.touches[0].clientX;
      const yLen = e.touches[1].clientY - e.touches[0].clientY;
      const currentDistance = Math.sqrt(xLen * xLen + yLen * yLen);

      // 如果初始间距太小，避免计算错误
      if (this.startDistance > 10) {
        const ratio = currentDistance / this.startDistance;
        let newScale = this.startScale * ratio;

        // 限制缩放范围：最小 0.1 倍，最大 1.5 倍
        newScale = Math.max(0.1, Math.min(newScale, 1.5));

        this.setData(
          {
            [`activeWeapons[${selectedWeaponIndex}].scale`]: newScale,
          },
          () => {
            this.drawWithLocalFiles();
          },
        );
      }
    }
  },

  // 3. 触摸结束：清理状态（可选）
  touchEnd() {
    // 可以在这里做一些自动对齐或者保存的操作
  },

  deleteSelectedWeapon() {
    const { activeWeapons, selectedWeaponIndex } = this.data;

    if (selectedWeaponIndex === -1 || activeWeapons.length === 0) {
      wx.showToast({ title: "请先选择一把武器", icon: "none" });
      return;
    }

    const targetId = activeWeapons[selectedWeaponIndex].instanceId;

    // 1. 清理缓存
    if (ImageCache.weapons[targetId]) {
      delete ImageCache.weapons[targetId];
    }

    // 2. 从数组中移除
    const newList = activeWeapons.filter(
      (_, index) => index !== selectedWeaponIndex,
    );

    this.setData(
      {
        activeWeapons: newList,
        selectedWeaponIndex: -1, // 删除后重置选中状态
      },
      () => {
        this.drawWithLocalFiles();
        wx.showToast({ title: "已移除", icon: "success" });
      },
    );
  },

  resetCanvas() {
    wx.showModal({
      title: "提示",
      content: "确定要清空所有装饰吗？",
      success: (res) => {
        if (res.confirm) {
          // 清空数组
          this.setData(
            {
              activeWeapons: [],
              selectedWeaponIndex: -1,
            },
            () => {
              // 清空所有武器缓存
              ImageCache.weapons = {};
              this.drawWithLocalFiles();
            },
          );
        }
      },
    });
  },
  // 保存逻辑
  // 打开弹窗
  openSaveModal() {
    if (this.data.activeWeapons.length === 0) {
      wx.showToast({ title: "请先添加武器", icon: "none" });
      return;
    }
    this.setData({ showSaveModal: true });
  },

  closeSaveModal() {
    this.setData({ showSaveModal: false, presetName: "", selectedTags: [] });
  },

  onNameInput(e) {
    this.setData({ presetName: e.detail.value });
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    let selectedTags = this.data.selectedTags || []; // 确保是数组

    const index = selectedTags.indexOf(tag);

    if (index > -1) {
      // 已经有了，就删掉
      selectedTags.splice(index, 1);
    } else {
      // 没有，就加进去
      selectedTags.push(tag);
    }

    // 重点：一定要重新 setData
    this.setData({
      selectedTags: selectedTags,
    });

    console.log("选中的标签数组:", selectedTags);
  },

  closeSaveModal() {
    this.setData({
      showSaveModal: false,
      presetName: "",
      selectedTags: [],
    });
  },

  async submitPreset() {
    const { presetName, selectedTags, activeWeapons, currentAgent } = this.data;

    if (!presetName.trim()) {
      wx.showToast({ title: "请输入方案名称", icon: "none" });
      return;
    }

    wx.showLoading({ title: "上传作品中...", mask: true });

    try {
      // --- 1. 生成快照临时路径 ---
      // 确保此时画布是“带渐变”的完整重绘版
      const snapshotPath = await new Promise((resolve, reject) => {
        this.drawWithGradient(() => {
          wx.canvasToTempFilePath({
            canvas: this.canvasNode,
            destWidth: this.canvasNode.width,
            destHeight: this.canvasNode.height,
            fileType: "jpg",
            quality: 0.8, // 预览图不需要 1.0 那么大，0.8 兼顾清晰度和体积
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(err),
          });
        });
      });

      // --- 2. 上传快照到云存储 ---
      const cloudPath = `presets/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: snapshotPath,
      });
      const snapshotFileID = uploadRes.fileID;

      // --- 3. 最终入库 ---
      const db = wx.cloud.database();
      await db.collection("user_presets").add({
        data: {
          name: presetName,
          snapshot: snapshotFileID, // 【核心】预览直接用这个
          tags: selectedTags,
          isFavorite: false, // 初始收藏状态：未收藏
          likeCount: 0, // 初始点赞数：0
          agent: {
            uuid: currentAgent.uuid,
            name: currentAgent.displayName,
            background: currentAgent.background,
            portrait: currentAgent.bustPortrait,
            // 记得把颜色数组也存进去，万一以后要改色
            backgroundGradientColors:
              currentAgent.backgroundGradientColors || [],
          },
          weapons: activeWeapons.map((w) => ({
            uuid: w.uuid,
            instanceId: w.instanceId,
            image: w.image,
            chromaUuid: w.chromaUuid,
            x: w.x,
            y: w.y,
            scale: w.scale,
            width: w.width, // 存一下原始宽
            height: w.height, // 存一下原始高
          })),
          createTime: db.serverDate(),
          userInfo: wx.getStorageSync("userInfo") || {},
        },
      });

      // 绘制完记得切回编辑器透明版
      this.drawWithLocalFiles();

      wx.hideLoading();
      wx.showToast({
        title: "上传成功",
        icon: "success",
        success: () => {
          // 延迟一秒返回，让用户看清成功提示
          setTimeout(() => {
            // wx.event.emit("refresh_presets");
            wx.navigateBack();
          }, 1000);
        },
      });
      this.closeSaveModal();
    } catch (err) {
      console.error("保存失败详情:", err);
      wx.hideLoading();
      wx.showToast({ title: "保存失败", icon: "none" });
      // 失败也切回透明版
      this.drawWithLocalFiles();
    }
  },

  //卡面逻辑

  // 切换回英雄背景
  resetToHeroBg() {
    this.setData({
      usePlayerCard: false,
      currentCard: null,
      activePanel: null,
    });
    this.drawWithLocalFiles(); // 重新触发 Canvas 绘制
  },

  openCardPanel() {
    this.setData({ showCardPanel: true });
    console.log(1);
  },

  // 关闭弹窗
  closeCardPanel() {
    this.setData({ showCardPanel: false });
  },

  // 重置回英雄背景
  onCardReset() {
    this.setData({
      usePlayerCard: false,
      currentCard: null,
      showCardPanel: false,
    });
    this.drawWithLocalFiles();
  },

  // 选中玩家卡面
  async onCardSelect(e) {
    console.log("=== [DEBUG] 1. 收到选中事件 ===");
    console.log("Event Detail:", e.detail);

    const card = e.detail.card;
    if (!card) {
      console.error("❌ 错误：未获取到 card 对象");
      return;
    }

    // 先把弹窗关掉，排除 Portal 干扰
    this.setData({ showCardPanel: false });
    console.log("=== [DEBUG] 2. 弹窗已尝试关闭 ===");

    wx.showLoading({ title: "加载背景...", mask: true });

    try {
      console.log("=== [DEBUG] 3. 开始下载卡面 ===", card.largeArt);
      const localPath = await this.downloadFileToLocal(card.largeArt);
      console.log("=== [DEBUG] 4. 下载完成, 本地路径:", localPath);

      if (localPath) {
        // 记录一下 setData 之前，操作区依赖的几个核心变量
        console.log("=== [DEBUG] 5. 准备 setData 渲染前检查 ===");
        console.log("当前 Agent:", this.data.currentAgent);
        console.log("当前武器数:", this.data.activeWeapons.length);

        const newWrapperStyle =
          "height: 100vh; width: 100vw; position: relative; background: #000;";

        this.setData(
          {
            usePlayerCard: true,
            currentCard: { ...card, localPath },
            showCardPanel: false,
            // canvasWrapperStyle: newWrapperStyle,
            canvasWrapperStyle: "background-color: #000000;",
          },
          () => {
            console.log("=== [DEBUG] 6. setData 回调执行，开始绘图 ===");
            this.drawWithLocalFiles();
          },
        );
      } else {
        console.error("❌ 错误：localPath 为空，下载可能失败了");
      }
    } catch (err) {
      console.error("❌ [DEBUG] 捕获到异常:", err);
    } finally {
      wx.hideLoading();
    }
  },

  async onCardSelect(e) {
    const card = e.detail.card;
    console.log("=== [STEP 1] 选中卡面:", card.displayName);

    // 1. 先记录当前的 UI 状态
    const query = wx.createSelectorQuery().in(this);
    query.select(".canvas-operation-left").boundingClientRect();
    query.exec((res) => {
      console.log("=== [STEP 2] setData 前操作区状态:", res[0]);
    });

    this.setData({ showCardPanel: false });
    wx.showLoading({ title: "加载背景...", mask: true });

    const localPath = await this.downloadFileToLocal(card.largeArt);

    if (localPath) {
      console.log("=== [STEP 3] 准备更新背景并渲染 ===");

      // 我们在这里做 setData
      this.setData(
        {
          usePlayerCard: true,
          currentCard: { ...card, localPath },
          canvasWrapperStyle:
            "height: 100vh; width: 100vw; position: relative; background: #000;",
        },
        () => {
          // --- 关键探测：setData 渲染后的 DOM 状态 ---
          const nextQuery = wx.createSelectorQuery().in(this);
          nextQuery.select(".canvas-operation-left").boundingClientRect();
          nextQuery.select(".main-canvas").boundingClientRect();
          nextQuery.exec((res) => {
            const opRes = res[0];
            const cvRes = res[1];

            console.log("=== [STEP 4] 渲染后操作区 DOM 信息 ===", opRes);
            console.log("=== [STEP 4] 渲染后 Canvas DOM 信息 ===", cvRes);

            if (!opRes || opRes.height === 0) {
              console.error(
                "❌ 警告：操作区节点高度为 0 或不存在，可能被 wx:if 卸载或样式坍塌",
              );
            } else if (opRes.top < 0 || opRes.top > 800) {
              console.error(
                "❌ 警告：操作区位置异常，发生了位移，当前 top 为:",
                opRes.top,
              );
            }

            this.drawWithLocalFiles();
          });
        },
      );
    }
    wx.hideLoading();
  },
});
