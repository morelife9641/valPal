const mapsData = require("../../../config/maps_data.js");
import { toggleFavoriteStatus } from "../../../utils/fav.js";
import { AGENTS_CONFIG } from "../../../config/agents_merged";

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const app = getApp();

// 辅助函数：处理 RRGGBBAA 颜色
const formatThemeColor = (hex) => {
  if (!hex) return "rgba(139, 145, 150, 0.2)";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
};

Page({
  data: {
    sideIndex: 0,
    showLoginPopup: false,
    totalCount: 0,
    pendingAdd: false, // 🚩 新增：记录是否需要跳转到添加页
    sideOptions: [
      { name: "全部", value: "all" },
      { name: "进攻", value: "atk" },
      { name: "防守", value: "def" },
    ],
    showPopup: false,
    popupType: "",
    sideFilter: "all",
    filterSideLabel: "全部", // 初始默认值
    allList: [], // 原始总列表
    isFavoriteOnly: false, // 是否开启“只看收藏”
    filteredList: [], // 筛选后的列表
    maps: [{ uuid: "all", displayName: "全部地图" }],
    mapIndex: 0,
    filterSide: "all", // all, atk, def

    pointOptions: [
      { name: "全部", value: "" },
      { name: "A点", value: "A" },
      { name: "B点", value: "B" },
      { name: "其他", value: "其他" },
    ],
    pointIndex: 0,
    filterPointLabel: "全部", // 用于 DOM 显示
    pointType: "", // 用于后端过滤的具体值

    showMapPopup: false,
    mapIndex: 0,
    filterMap: { displayName: "全部地图", uuid: "all" }, // 初始化默认值
    totalCount: 0,
    filteredList: [],

    showSidePopup: false,
    filterSide: "all", // 默认全部，或者 'atk' / 'def'
    sideLabel: "全部",

    // 也可以在 data 里定义 sides 的简易映射，方便 UI 显示
    sideMap: {
      all: "全部",
      atk: "进攻",
      def: "防守",
    },

    showPosPopup: false,
    filterPos: "all", // 'A' / 'B' / 'C' / 'Others'
    posLabel: "全部",
  },

  onLoad(options) {
    const { agentId, mapId, type } = options;

    // 1. 先处理特工列表（保持基础数据，因为选择器还需要用到）
    const processedAgents = AGENTS_CONFIG.map((agent) => {
      const rawColor = agent.backgroundGradientColors
        ? agent.backgroundGradientColors[0]
        : "8b9196ff";
      const themeColor = formatThemeColor(rawColor);
      return {
        ...agent,
        themeColor,
        pageStyle: `background: linear-gradient(180deg, ${themeColor} 0%, #0f1923 100%);`,
        displayIcon: `https://636c-cloud1-5gqun0xd80e8dd85-1396911701.tcb.qcloud.la/icons/${agent.uuid}.png`,
        themeStyle: `background: linear-gradient(135deg, ${themeColor} 0%, rgba(15, 25, 35, 0) 100%);`,
      };
    });

    // 2. 初始化地图参数
    let initialMap = { displayName: "全部地图", uuid: "all" };
    if (mapId) {
      const mapConfig = mapsData.find((m) => m.uuid === mapId);
      if (mapConfig) {
        initialMap = {
          displayName: mapConfig.displayName,
          uuid: mapConfig.uuid,
        };
      }
    }

    // 3. 判断是否是“通用点位”模式
    const isGeneralMode = type === "general";
    let targetAgent = null;

    if (!isGeneralMode && agentId) {
      targetAgent = processedAgents.find((a) => a.uuid === agentId) || null;
    }

    this.setData(
      {
        agentList: processedAgents,
        filterAgent: targetAgent, // 如果是通用模式，这里就是 null
        filterMap: initialMap,
        agentIndex: targetAgent ? processedAgents.indexOf(targetAgent) : 0,
        // 如果是通用模式，背景给个纯黑或中立色
        pageStyle: targetAgent ? targetAgent.pageStyle : "background: #0f1923;",
        isGeneralMode: isGeneralMode, // 🚩 存一个标志位方便后续判断
      },
      () => {
        // 设置标题
        wx.setNavigationBarTitle({
          title: targetAgent
            ? `${targetAgent.displayName} - lineups`
            : "通用点位库",
        });

        // 🚩 核心分流加载
        this.refreshPageData();
      },
    );
  },

  onShow() {
    // this.loadPointList();
  },

  async loadPointList(isAppend = false) {
    const { filterMap, filterSide, filterPos, allList } = this.data;
    wx.showLoading({ title: "同步战术库...", mask: true });

    try {
      const db = wx.cloud.database();
      // 通用点位不需要 agentId，主要看 mapId 和 status
      let query = { status: 1 };

      if (filterMap && filterMap.uuid !== "all") {
        query.mapId = filterMap.uuid;
      }
      if (filterSide && filterSide !== "all") {
        query.side = filterSide;
      }
      if (filterPos && filterPos !== "all") {
        // 如果你数据库里存的是“其他”，而组件传出的是“Others”，这里要做个转换
        const dbValue = filterPos === "Others" ? "其他" : filterPos;
        query.pointType = dbValue;
      }

      // 🚩 处理分页，如果是刷新则从0开始
      const offset = isAppend ? allList.length : 0;

      const res = await db
        .collection("points")
        .where(query)
        .orderBy("createTime", "desc")
        .skip(offset)
        .limit(20)
        .get();

      const list = res.data.map((item) => {
        // 🚩 直接从原始 mapsData 找配置，避免使用 this.data.maps 可能产生的过滤丢失
        const mapConfig = mapsData.find((m) => m.uuid === item.mapId);

        return {
          ...item,
          // 🚩 修复：通用点位通常需要展示更宏观的地图背景
          // 这里的图片路径务必确保在你的 wxml 中 map-preview-img 类下能被 filter 渲染
          mapThumb: mapConfig
            ? mapConfig.splash || mapConfig.listViewIconTall
            : "",

          // 补全地图显示名称
          mapName:
            item.mapName || (mapConfig ? mapConfig.displayName : "未知区域"),

          // 为了兼容你刚才改的 WXML 结构，通用点位强制给一个 side
          // 如果数据库没存 side (攻守)，默认给个中立值或从 pointType 判断
          side: item.side || "def",

          // 日期处理
          dateDisplay: item.createTime ? formatDate(item.createTime) : "刚刚",
        };
      });

      this.setData({
        allList: isAppend ? [...allList, ...list] : list,
        // 如果你共用一个渲染列表名，请统一改为 filteredList
        filteredList: isAppend ? [...allList, ...list] : list,
      });
    } catch (err) {
      console.error("加载通用点位失败", err);
      wx.showToast({ title: "检索失败", icon: "none" });
    } finally {
      wx.hideLoading();
      console.log(this.data.filteredList);
    }
  },

  // 2. 之前的加载方法（去除count逻辑，专注列表更新）
  async loadAgentLineups(isAppend = false) {
    const { filterAgent, filterMap, filterSide, filterPos, filteredList } =
      this.data;
    if (!filterAgent || !filterAgent.uuid) return;

    wx.showLoading({ title: "同步战术中...", mask: true });

    try {
      const db = wx.cloud.database();
      let query = { agentId: filterAgent.uuid };
      if (filterMap && filterMap.uuid !== "all") {
        query.mapId = filterMap.uuid;
      }

      // 阵营过滤 (atk/def)
      if (filterSide && filterSide !== "all") {
        query.side = filterSide;
      }

      // 区域过滤 (A/B/其他)
      if (filterPos && filterPos !== "all") {
        // 统一转换逻辑：如果组件传出 Others，数据库匹配“其他”
        const dbValue =
          filterPos === "Others" || filterPos === "O" ? "其他" : filterPos;
        query.pointType = dbValue;
      }

      // 处理分页偏移量
      const offset = isAppend ? filteredList.length : 0;

      const res = await db
        .collection("lineup_points")
        .where(query)
        .skip(offset) // 跳过已有的条数
        .limit(10) // 每次拿10条
        .orderBy("createTime", "desc")
        .get();

      const newList = res.data.map((item) => {
        const mapConfig = mapsData.find((m) => m.uuid === item.mapId);
        return {
          ...item,
          mapThumb: mapConfig
            ? mapConfig.listViewIconTall || mapConfig.splash
            : "",
          mapName:
            item.mapName || (mapConfig ? mapConfig.displayName : "未知地图"),
          dateDisplay: item.createTime ? formatDate(item.createTime) : "刚刚",
        };
      });

      this.setData({
        filteredList: isAppend ? [...filteredList, ...newList] : newList,
      });
    } catch (err) {
      console.error("加载失败", err);
    } finally {
      wx.hideLoading();
    }
  },

  //查询lineup数量
  async updateLineupsCount() {
    const { filterAgent, filterMap } = this.data;
    if (!filterAgent || !filterAgent.uuid) return;

    const db = wx.cloud.database();
    let query = { agentId: filterAgent.uuid };
    if (filterMap && filterMap.uuid !== "all") {
      query.mapId = filterMap.uuid;
    }

    try {
      const res = await db.collection("lineup_points").where(query).count();
      this.setData({ totalCount: res.total });
      console.log(this.data.totalCount);
    } catch (err) {
      console.error("计数失败", err);
    }
  },

  onAgentCardClick() {
    this.setData({
      showPopup: true,
      popupType: "hero",
    });
  },

  // 🚩 2. 关闭弹窗的方法
  togglePanel() {
    this.setData({
      showPopup: false,
      popupType: "",
    });
  },

  selectAgent(e) {
    const selectedItem = e.detail.item;
    console.log("选中的特工原始数据:", selectedItem);

    if (!selectedItem) return;

    // --- 🚩 核心修复：手动计算该特工的动态样式 ---
    const rawColor = selectedItem.backgroundGradientColors
      ? selectedItem.backgroundGradientColors[0]
      : "8b9196ff";
    const themeColor = formatThemeColor(rawColor); // 确保你的页面里能访问到这个格式化函数

    // 1. 重新生成卡片背景 (themeStyle)
    const themeStyle = `background: linear-gradient(135deg, ${themeColor} 0%, rgba(15, 25, 35, 0) 100%);`;

    // 2. 重新生成全屏/吸顶背景 (pageStyle) - 对应你之前的 180deg 实色渐变
    const pageStyle = `background-color: #0f1923; background-image: linear-gradient(180deg, ${themeColor} 0%, #0f1923 100%);`;

    // 3. 将样式合并到对象中
    const updatedAgent = {
      ...selectedItem,
      themeStyle,
      pageStyle,
    };

    // 更新页面数据
    this.setData(
      {
        filterAgent: updatedAgent,
        agentIndex: this.data.agentList.findIndex(
          (a) => a.uuid === selectedItem.uuid,
        ),
        showPopup: false,
        popupType: "",
      },
      () => {
        // 刷新列表
        wx.setNavigationBarTitle({
          title: `${updatedAgent.displayName} - linups`,
        });
        this.loadAgentLineups();
        this.updateLineupsCount();

        // 回到顶部
        console.log(this.data.filterAgent);

        wx.pageScrollTo({ scrollTop: 0, duration: 300 });
      },
    );
  },

  formatDate(date) {
    if (!date) return "刚刚";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}/${month}/${day}`;
  },

  applyFilter() {
    // 🚩 1. 从 data 中解构出 pointType
    const { allList, maps, mapIndex, filterSide, isFavoriteOnly, pointType } =
      this.data;
    const selectedMap = maps[mapIndex];

    const filtered = allList.filter((item) => {
      // 地图匹配：UUID 为 "all" 或匹配 item.mapId
      const mapMatch =
        selectedMap.uuid === "all" || item.mapId === selectedMap.uuid;

      // 阵营匹配：filterSide 为 "all" 或匹配 item.side
      const sideMatch = filterSide === "all" || item.side === filterSide;

      // 🚩 2. 新增：位置匹配逻辑 (pointType)
      // 如果 pointType 为空字符串（即选择了“全部”），则直接通过；
      // 否则，匹配 item.pointType 是否等于选中的值 (A/B/其他)
      const pointMatch = !pointType || item.pointType === pointType;

      // 收藏匹配
      const favMatch = isFavoriteOnly ? item.isFavorite === true : true;

      // 🚩 3. 四个条件必须同时满足
      return mapMatch && sideMatch && pointMatch && favMatch;
    });

    // 更新渲染列表
    this.setData({ filteredList: filtered });

    // 调试用：查看过滤后的数量
    console.log(`过滤完成，当前显示条数: ${filtered.length}`);
  },

  onLoginClose() {
    this.setData({ showLoginPopup: false });
  },

  async toggleFavorite(e) {
    const pointId = e.currentTarget.dataset.id;
    const app = getApp();
    // 🚩 身份拦截：未登录则记录意图并弹窗
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingId: pointId, // 记录想收藏的点位ID
      });
      return;
    }

    // 已登录直接执行
    await this.executeFavorite(pointId);
  },

  async executeFavorite(pointId) {
    const listName = "filteredList";
    const list = this.data[listName];

    // 1. 查找索引
    const index = list.findIndex((item) => item._id === pointId);
    if (index === -1) return;

    // 2. 获取当前收藏状态并乐观更新 UI
    const isAlreadyFav = list[index].isFavorite || false;
    this.setData({
      [`${listName}[${index}].isFavorite`]: !isAlreadyFav,
    });

    try {
      // 3. 调用通用工具函数，业务类型传入 'point'
      const res = await toggleFavoriteStatus(pointId, "point");

      // 4. 反馈
      wx.showToast({
        title: res.isFavorite ? "已加入收藏" : "已取消收藏",
        icon: "none",
      });

      // 5. 状态同步校验
      if (res.isFavorite === isAlreadyFav) {
        this.setData({ [`${listName}[${index}].isFavorite`]: res.isFavorite });
      }
    } catch (err) {
      console.error("点位收藏操作失败:", err);
      // 6. 失败回滚
      this.setData({
        [`${listName}[${index}].isFavorite`]: isAlreadyFav,
      });
      wx.showToast({ title: "操作失败", icon: "none" });
    }
  },

  onMapChange(e) {
    const { value, label, uuid } = e.detail;

    // 更新页面显示的地图信息
    this.setData(
      {
        mapIndex: value,
        filterMap: {
          displayName: label,
          uuid: uuid,
        },
      },
      () => {
        // 🚩 核心逻辑：条件改变后，同步刷新计数和列表
        this.refreshPageData();
      },
    );
  },

  // 3. 控制弹窗开关
  openMapPopup() {
    console.log(2);

    this.setData({ showMapPopup: true });
  },

  closeMapPopup() {
    this.setData({ showMapPopup: false });
  },

  toggleFavoriteFilter() {
    const newStatus = !this.data.isFavoriteOnly;

    // 1. 更新状态开关
    this.setData(
      {
        isFavoriteOnly: newStatus,
      },
      () => {
        // 2. 状态更新后，执行统一的过滤逻辑
        this.applyFilter();
      },
    );

    // 交互反馈
    // if (newStatus) {
    //   wx.showToast({ title: "已开启只看收藏", icon: "none" });
    // }
  },

  clearMapFilter(e) {
    // 使用 catchtap 阻止冒泡，避免触发 openMapPopup
    this.setData(
      {
        mapIndex: 0,
        filterMap: { displayName: "全部地图", uuid: "all" },
      },
      () => {
        this.refreshPageData(); // 重新计数并加载列表
      },
    );
  },

  // 专门用于计算通用点位（points库）的数量
  async updateGeneralCount() {
    const { filterMap } = this.data;
    const db = wx.cloud.database();

    // 这里的查询条件必须和 loadPointList 保持一致
    let query = { status: 1 };

    if (filterMap && filterMap.uuid !== "all") {
      query.mapId = filterMap.uuid;
    }

    try {
      const res = await db.collection("points").where(query).count();
      console.log("通用点位总数:", res.total);

      this.setData({
        totalCount: res.total, // 🚩 更新这个值，按钮上的数字 ({{totalCount}}) 才会变
      });
    } catch (err) {
      console.error("通用计数查询失败", err);
      this.setData({ totalCount: 0 });
    }
  },

  clearSideFilter() {
    this.setData(
      {
        // sideIndex: 0, // 如果你不再用 picker，这个可以去掉
        filterSide: "all",
        sideLabel: "全部", // 确保变量名和你显示用的对应
      },
      () => {
        // 🚩 重点：直接调用刷新逻辑，让数据库带上最新的 filterSide (all) 去查询
        this.refreshPageData();
      },
    );
  },

  goToAdd() {
    const app = getApp();
    const { filterAgent, filterMap } = this.data;

    // 1. 拦截未登录 (保持原样)
    if (!app.globalData.isLogin) {
      this.setData({
        showLoginPopup: true,
        pendingAdd: true,
      });
      return;
    }

    // 2. 构建跳转路径
    let url = "../add-point/add-point";
    let params = [];

    // 如果当前选了特工，把特工 ID 传过去
    if (filterAgent && filterAgent.uuid && filterAgent.uuid !== "all") {
      params.push(`agentId=${filterAgent.uuid}`);
      params.push(`agentName=${filterAgent.displayName}`);
    }

    // 如果当前选了地图，把地图 ID 传过去
    if (filterMap && filterMap.uuid && filterMap.uuid !== "all") {
      params.push(`mapId=${filterMap.uuid}`);
      params.push(`mapName=${filterMap.displayName}`);
    }

    // 拼接参数
    if (params.length > 0) {
      url += "?" + params.join("&");
    }

    console.log("即将跳转添加页，携带参数:", url);

    // 3. 执行跳转
    wx.navigateTo({ url });
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
        // Step 3: 更新全局状态与本地缓存
        const serverUserInfo = res.result.data;
        app.globalData.isLogin = true;
        app.globalData.userInfo = serverUserInfo;
        wx.setStorageSync("userInfo", serverUserInfo);

        // Step 4: 关闭弹窗
        this.setData({ showLoginPopup: false });

        // Step 5: 意图恢复 (按照优先级执行)
        if (this.data.pendingAdd) {
          // 场景 A：刚才想去添加页
          this.setData({ pendingAdd: false });
          wx.navigateTo({ url: "../add-point/add-point" });
        } else if (this.data.pendingId) {
          // 场景 B：刚才想收藏某个准星
          const id = this.data.pendingId;
          this.setData({ pendingId: null });
          await this.executeFavorite(id);
        } else {
          // 场景 C：纯手动点击登录，仅刷新列表状态
          if (this.initData) await this.initData();
        }

        wx.showToast({ title: "特工档案已激活", icon: "success" });
      }
    } catch (err) {
      console.error("激活失败:", err);
      wx.showToast({ title: "激活失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // 1. 打开弹窗
  openSidePopup() {
    this.setData({ showSidePopup: true });
  },

  // 2. 监听组件选择事件
  onSideChange(e) {
    const { value, label } = e.detail;
    this.setData(
      {
        filterSide: value,
        sideLabel: label,
        showSidePopup: false,
      },
      () => {
        // 🚩 核心：阵营变了，必须重新从第一页加载数据
        this.refreshPageData();
      },
    );
  },

  // 3. 关闭弹窗
  closeSidePopup() {
    this.setData({ showSidePopup: false });
  },

  // 4. 修改刷新逻辑，把 side 传入查询
  async refreshPageData() {
    const { filterAgent } = this.data;

    // 这里的 count 和 load 方法内部会自动读取 this.data.filterSide
    if (filterAgent && filterAgent.uuid && filterAgent.uuid !== "all") {
      await this.updateLineupsCount();
      this.loadAgentLineups(false);
    } else {
      await this.updateGeneralCount();
      this.loadPointList(false);
    }
  },

  // --- Pos 弹窗逻辑 ---

  // 1. 打开弹窗
  openPosPopup() {
    // 增加一个震动反馈，提升“战术面板”的操作手感
    // wx.vibrateShort({ type: "light" });
    this.setData({ showPosPopup: true });
  },

  // 2. 关闭弹窗
  closePosPopup() {
    this.setData({ showPosPopup: false });
  },

  // 3. 当组件内点击了 A/B/C/Others 后的回调
  onPosChange(e) {
    const { value, label } = e.detail; // 组件抛出的 value(如'A') 和 label(如'A区')

    this.setData(
      {
        filterPos: value,
        posLabel: label,
        showPosPopup: false, // 选中后自动关闭
      },
      () => {
        // 🚩 核心：筛选条件变了，立即刷新计数和列表数据
        this.refreshPageData();
      },
    );
  },

  // 4. 点击 ✕ 清除筛选
  clearPosFilter() {
    this.setData(
      {
        filterPos: "all",
        posLabel: "全部",
      },
      () => {
        // 🚩 核心：清除后也要重新加载“全部”的数据
        this.refreshPageData();
      },
    );
  },

  // list.js
  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    // 🚩 核心：从 filteredList 或 allList 中找到这个数据，判断有没有 agentId
    // 或者直接在 WXML 的 data- 属性里传过来
    const item =
      this.data.filteredList.find((i) => i._id === id) ||
      this.data.allList.find((i) => i._id === id);

    const type = item && item.agentId ? "agent" : "common";

    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?id=${id}&type=${type}`,
    });
  },
});
