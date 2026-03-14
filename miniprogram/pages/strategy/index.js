const mapsData = require("../../config/maps_data.js");
import { AGENTS_CONFIG } from "../../config/agents_merged.js";
// import { valorantMasterData } from "../../packageStrategy/maps_data_statistics.js";
const db = wx.cloud.database();

// index.js 顶部
const targetMaps = {
  全部: "all",
  幽邃地窟: "abyss",
  霓虹町: "split",
  微风岛屿: "breeze",
  深海明珠: "pearl",
  隐世修所: "haven",
  源工重镇: "bind",
  盐海矿镇: "corrode",
};

// 角色图标路径映射
const roleIconMap = {
  全部: "/assets/unnamed.png",
  哨卫: "/assets/哨卫.png",
  决斗: "/assets/决斗.png",
  先锋: "/assets/先锋.png",
  控场: "/assets/控场.png",
};

Page({
  data: {
    // 目标地图 UUID 映射表
    targetMaps: {
      全部: "all",
      幽邃地窟: "abyss",
      霓虹町: "split",
      微风岛屿: "breeze",
      深海明珠: "pearl",
      隐世修所: "haven",
      源工重镇: "bind",
      盐海矿镇: "corrode",
    },

    mapLoaded: true,

    currentSwiperIndex: 0,
    focusList: [], // 你的数据列表

    rankList: [
      { tier: "all", label: "全部段位", icon: "0" }, // 对应 0.png
      { tier: "Iron", label: "黑铁", icon: "5" }, // 对应 3.png
      { tier: "Bronze", label: "青铜", icon: "8" },
      { tier: "Silver", label: "白银", icon: "11" },
      { tier: "Gold", label: "黄金", icon: "14" },
      { tier: "Platinum", label: "白金", icon: "17" },
      { tier: "Diamond", label: "钻石", icon: "20" },
      { tier: "Ascendant", label: "超凡", icon: "23" },
      { tier: "Immortal", label: "神话", icon: "26" },
      { tier: "Radiant", label: "无畏战魂", icon: "27" },
    ],
    rankIndex: 0,
    currentRankLabel: "全部段位",
    displayStats: [],
    isPopupShow: false,

    allAgents: AGENTS_CONFIG, // 原始全量数据
    maps: [],
    agents: [],
    currentMapIdx: 3,
    currentAgentIdx: 0,
    currentCallouts: [],
    //列表
    currentRankId: 0,
    agentList: [], // 存储同步完图标的特工

    displayStats: [],
    currentRankLabel: "未定级",

    rankIndex: 0, // 对应 rankOptions 的索引
    isMapPopupShow: false, // 控制 Map 弹窗
    currentMapIdx: 0, // 当前选中地图的索引
    currentMapLabel: "全部地图", // 首页 Tag 显示的文字
    maps: [], // 存放从 config 过滤出来的地图数组 (对象数组)

    // --- 4. Table (数据展示) 相关 ---
    displayStats: [], // 最终渲染在 Table 里的特工战绩数组
    scrollTop: 0, // 切换条件时，让 Table 回到顶部
    recommendPoints: [],
    currentMapIdx: 0,
    allData: [],

    roleIndex: 0,
    currentRoleLabel: "全部角色",
    currentRoleIcon: "/assets/unnamed.png",
    isRolePopupShow: false,

    // 定义选择项列表
    // index.js data
    roleOptions: [
      { label: "全部角色", value: "all", icon: "/assets/unnamed.png" },
      { label: "哨卫", value: "哨卫", icon: "/assets/哨卫.png" },
      { label: "决斗", value: "决斗", icon: "/assets/决斗.png" },
      { label: "先锋", value: "先锋", icon: "/assets/先锋.png" },
      { label: "控场", value: "控场", icon: "/assets/控场.png" },
    ],
  },

  async onLoad() {
    this.fetchFocusNews();
    require
      .async("../../packageStrategy/maps_data_statistics.js")
      .then((res) => {
        // 注意：这里取决于你文件是怎么导出的
        // 如果是 export const valorantMasterData，则取 res.valorantMasterData
        // 如果是 module.exports，则取 res
        const data = res.valorantMasterData || res;

        // 这里的变量名要和 Page 外部定义的引用名对齐
        // 建议直接全局挂载或者存入 data
        this.allData = data;

        console.log("分包数据异步加载成功");
        this.updateDisplayStats();
      })
      .catch((err) => {
        console.error("加载分包数据失败", err);
      });
    // 1. 先初始化地图数据（基础）
    // const filteredMaps = mapsData.filter((map) =>
    //   Object.keys(this.data.targetMaps).includes(map.displayName),
    // );

    // this.setData({
    //   maps: filteredMaps,
    // });
    // 1. 过滤出白名单地图
    let filteredMaps = mapsData.filter(
      (map) =>
        Object.keys(this.data.targetMaps).includes(map.displayName) &&
        map.displayName !== "全部" &&
        map.displayName !== "基础训练",
    );

    // 2. 🚩 关键：手动构造那个带“基础训练”图片的“全部”选项
    const trainingMap = mapsData.find((m) => m.displayName === "基础训练");
    const allOption = {
      ...(trainingMap || {}),
      displayName: "全部地图",
      uuid: "all",
      // 这里的路径要和组件里对应上
      listViewIcon: trainingMap
        ? trainingMap.listViewIcon
        : "/assets/icons/all_maps.png",
    };

    // 3. 把“全部”塞到数组最前面
    filteredMaps.unshift(allOption);

    // 4. 同步设置到 data，并初始化首页显示的图标
    this.setData({
      maps: filteredMaps,
      currentMapIdx: 0,
      currentMapLabel: "全部地图",
      currentMapIcon: allOption.listViewIcon, // 🚩 这样首页一进来就有地图图标了
    });

    // 3. 执行图标同步（异步）
    await this.initAgentIcons();

    // 4. 等地图和图标都到位了，再进行第一次排行榜渲染
    this.updateDisplayStats();

    // 5. 更新报点
    // this.updateCallouts();

    // this.fetchMapRecommendations();

    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0,
      });
    }
    console.log(this.data.currentMapLabel);
  },

  onShow() {
    // 🚩 每次回到首页（包括从后台切回、从详情页返回）都会触发
    console.log("首页可见，开始同步最新情报...");
    this.fetchFocusNews();
  },

  async initAgentIcons() {
    wx.showLoading({ title: "同步特工...", mask: true });
    try {
      const cloudPrefix =
        "cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/";
      const fileList = AGENTS_CONFIG.map(
        (agent) => `${cloudPrefix}${agent.uuid}.png`,
      );

      const res = await wx.cloud.getTempFileURL({ fileList });

      const finalAgents = AGENTS_CONFIG.map((agent, index) => {
        // 🚩 直接拿 agent.role (比如 "先锋") 去查 roleIconMap
        // 注意：确保字典里的 Key "先锋" 和数据里的 "先锋" 字符完全一致
        const iconPath = roleIconMap[agent.role] || roleIconMap["全部"];

        return {
          ...agent,
          displayIcon: res.fileList[index].tempFileURL || "",
          roleIcon: iconPath, // 这样 "先锋" 就会匹配到 "/assets/先锋.png"
        };
      });

      return new Promise((resolve) => {
        this.setData(
          {
            agentList: finalAgents,
            filteredList: finalAgents,
            currentTab: "全部",
          },
          resolve,
        );
      });
    } catch (err) {
      console.error("加载特工图标失败", err);
    } finally {
      console.log(this.data.agentList);

      wx.hideLoading();
    }
  },

  onSwiperChange(e) {
    this.setData({
      currentSwiperIndex: e.detail.current,
    });
  },

  // 辅助函数：转换英文 Role 到中文映射 Key
  _getRoleChineseName(roleEn) {
    const dict = {
      Sentinel: "哨卫",
      Duelist: "决斗",
      Initiator: "先锋",
      Controller: "控场",
    };
    return dict[roleEn] || "全部";
  },

  // 1. 点击表头唤起弹窗
  openRankPopup() {
    this.setData({ isPopupShow: true });

    // 隐藏自定义 TabBar
    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(true);
    }
  },

  openMapPopup() {
    this.setData({ isMapPopupShow: true });

    // 隐藏自定义 TabBar
    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(true);
    }
  },

  // 2. 关闭弹窗（点击遮罩或关闭按钮）
  closeRankPopup() {
    this.setData({ isPopupShow: false });

    // 恢复显示自定义 TabBar
    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false);
    }
  },

  onRankSelect(e) {
    console.log(e);

    const { value, label } = e.detail;

    // 确保 value 是数字类型，防止字符串索引导致无法读取数组
    const index = parseInt(value);

    this.setData({
      rankIndex: index,
      currentRankLabel: label,
      isPopupShow: false,
    });

    // 🚩 调试：看看拼接出来的图标名对不对

    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false);
    }

    this.updateDisplayStats();
  },

  // 1. 关闭地图弹窗（点击遮罩或关闭按钮）
  closeMapPopup() {
    this.setData({ isMapPopupShow: false });

    // 恢复显示自定义 TabBar
    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false);
    }
  },

  onMapSelect(e) {
    const { value, label, icon } = e.detail; // 这里的 value 就是 index
    const index = parseInt(value);

    this.setData({
      currentMapIdx: index,
      currentMapLabel: label,
      currentMapIcon: icon, // 将选中的地图图标存入 data
      isMapPopupShow: false,
    });

    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false);
    }

    this.updateDisplayStats();
  },

  // 打开职业弹窗
  openRolePopup() {
    this.setData({ isRolePopupShow: true });
    if (this.getTabBar()) this.getTabBar().setTabBarHidden(true);
  },

  // 关闭职业弹窗
  closeRolePopup() {
    this.setData({ isRolePopupShow: false });
    if (this.getTabBar()) this.getTabBar().setTabBarHidden(false);
  },

  // 🚩 核心：选择职业后的联动逻辑
  onRoleSelect(e) {
    const { value, label, icon } = e.detail; // 假设组件传回这些
    const index = parseInt(value);

    this.setData({
      roleIndex: index,
      currentRoleLabel: label,
      currentRoleIcon: icon,
      isRolePopupShow: false,
    });

    if (this.getTabBar()) this.getTabBar().setTabBarHidden(false);

    // 重新触发数据计算
    this.updateDisplayStats();
  },

  // 排行榜页面的跳转逻辑
  navToAgentStrategy(e) {
    const { agent } = e.currentTarget.dataset;
    const map = this.data.maps[this.data.currentMapIdx];
    wx.navigateTo({
      url: `/packageStrategy/pages/list/list?mapId=${map.uuid}&agentId=${agent.Agent_EN}&type=agent`,
    });
  },

  // index.js
  navToAgentStrategy(e) {
    const { agent } = e.currentTarget.dataset;
    const map = this.data.maps[this.data.currentMapIdx];

    // 🚩 核心：从 agentList 中通过英文名找到对应的 uuid
    const agentInfo = this.data.agentList.find(
      (a) =>
        a.displayNameEn === agent.Agent_EN || a.displayName === agent.Agent,
    );
    const targetId = agentInfo ? agentInfo.uuid : agent.Agent_EN;

    wx.vibrateShort({ type: "light" });

    wx.navigateTo({
      // 传 uuid 过去是最稳的
      url: `/packageStrategy/pages/list/list?agentId=${targetId}&mapId=${map.uuid}&type=agent`,
    });
  },

  // index.js

  navToAgentStrategy(e) {
    const { agent } = e.currentTarget.dataset;
    // 1. 获取当前选中的地图对象
    const currentMap = this.data.maps[this.data.currentMapIdx];
    const mapId = currentMap ? currentMap.uuid : "all";

    // 2. 查找特工对应的 UUID (假设数据里存在，或者通过配置查找)
    // 如果 item 里没有 uuid，建议在 updateDisplayStats 时就补全，或者直接传 Agent_EN
    const agentInfo = this.data.agentList.find(
      (a) => a.Agent_EN === agent.Agent_EN || a.displayName === agent.Agent,
    );
    const targetAgentId = agentInfo ? agentInfo.uuid : agent.Agent_EN;

    // wx.vibrateShort({ type: 'light' });

    // 3. 执行跳转，带上精准的 uuid
    wx.navigateTo({
      url: `/packageStrategy/pages/list/list?agentId=${targetAgentId}&mapId=${mapId}&type=agent`,
    });
  },

  updateDisplayStats() {
    const {
      maps,
      currentMapIdx,
      rankIndex,
      rankList,
      agentList,
      roleOptions,
      roleIndex,
    } = this.data;
    const valorantMasterData = this.allData;

    // 1. 安全检查
    const mapIdx = parseInt(currentMapIdx);
    const rIdx = parseInt(rankIndex);
    if (
      isNaN(mapIdx) ||
      isNaN(rIdx) ||
      !maps ||
      !maps[mapIdx] ||
      !valorantMasterData
    )
      return;

    // 2. 获取筛选词
    const mapKey =
      maps[mapIdx].displayName === "全部"
        ? "all"
        : targetMaps[maps[mapIdx].displayName] || "all";
    const currentRankWord = rankList[rIdx].tier;
    // 🚩 获取当前选中的职业英文 Value (如 'Sentinel' 或 'all')
    const targetRoleValue = roleOptions[roleIndex].value;

    // 3. 地图 + 段位过滤
    let filtered = valorantMasterData.filter((item) => {
      return (
        (item.Map || "").toLowerCase() === mapKey.toLowerCase() &&
        (item.Rank_Level || "").toLowerCase() === currentRankWord.toLowerCase()
      );
    });

    // 4. 职业过滤与数据加工
    const processed = [];
    filtered.forEach((stat) => {
      // 🚩 匹配特工信息
      const agentInfo = agentList.find(
        (a) =>
          a.displayNameEn === stat.Agent_EN || a.displayName === stat.Agent,
      );

      // 如果选了特定职业，进行拦截
      if (targetRoleValue !== "all") {
        // 如果找不到特工信息或者职业不符，直接跳过
        if (!agentInfo || agentInfo.role !== targetRoleValue) return;
      }

      const winValue = parseFloat(stat.Win_Rate.replace("%", "")) || 0;

      processed.push({
        ...stat,
        finalName: stat.Agent,
        agentIcon: agentInfo ? agentInfo.displayIcon : "",
        // 🚩 直接使用 initAgentIcons 里存好的 roleIcon
        roleIcon: agentInfo ? agentInfo.roleIcon : roleIconMap["全部"],
        winValue: winValue,
        winRateDisplay: winValue.toFixed(1),
        kd: stat.KD || "0.00",
        pickRate: stat.Pick_Rate ? stat.Pick_Rate.replace("%", "") : "0.0",
        matches: stat.Matches || "0",
      });
    });

    // 5. 排序渲染
    processed.sort((a, b) => b.winValue - a.winValue);
    const displayStats = processed.map((item, index) => ({
      ...item,
      rankPos: index + 1,
    }));

    this.setData({ displayStats, scrollTop: 0 });
    console.log(this.data.displayStats);
  },

  // 辅助函数：将英文 Role 转为对应的中文 Key 以匹配你的 roleIconMap
  _getRoleChineseName(roleEn) {
    const map = {
      Sentinel: "哨卫",
      Duelist: "决斗",
      Initiator: "先锋",
      Controller: "控场",
    };
    return map[roleEn] || "全部";
  },

  resetFilters() {
    // 1. 震动反馈
    // wx.vibrateShort({ type: "medium" });

    // 2. 恢复所有初始状态
    this.setData({
      // Rank
      rankIndex: 0,
      currentRankLabel: "全部段位",

      // Map (注意：这里要对应你之前 initMapFilter 里的初始值)
      currentMapIdx: 0,
      currentMapLabel: "全部地图",
      currentMapIcon: this.data.maps[0].listViewIcon, // 或者是你定义的那个基础训练图

      // Role
      roleIndex: 0,
      currentRoleLabel: "全部角色",
      currentRoleIcon: "/assets/unnamed.png",
    });

    // 3. 重新拉取/计算数据
    this.updateDisplayStats();

    wx.showToast({
      title: "配置已重置",
      icon: "none",
      duration: 1000,
    });
  },

  // 职业筛选逻辑：基于同步后的 agentList 进行过滤
  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    const { agentList } = this.data;

    let filtered = agentList;
    if (role !== "全部") {
      filtered = agentList.filter((item) => item.role === role);
    }

    this.setData({
      currentTab: role,
      filteredList: filtered,
      currentAgentIdx: 0, // 切换职业时重置选中位置
    });
  },

  selectAgent(e) {
    this.setData({ currentAgentIdx: e.currentTarget.dataset.idx });
  },

  goToAddPoint() {
    wx.navigateTo({
      url: "/pages/add-point/add-point",
    });
  },

  selectMap(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData(
      {
        currentMapIdx: idx,
        mapLoaded: false, // 切换时先重置状态，让图片变透明
      },
      () => {
        // this.updateCallouts();
        this.updateDisplayStats();
        // this.fetchMapRecommendations();
      },
    );
  },

  onMapImgLoad() {
    this.setData({
      mapLoaded: true, // 图片就绪后再渐现，此时滤镜已同步生效
    });
  },

  navToPointDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?id=${id}`,
    });
  },

  navToAllPoints() {
    const map = this.data.maps[this.data.currentMapIdx];
    wx.navigateTo({
      url: `/packageStrategy/pages/list/list?mapId=${map.uuid}&type=general`,
    });
  },

  navToCrosshair() {
    wx.navigateTo({
      // 注意：必须从根目录开始写，且包含分包名 packageTools
      url: "/packageTools/pages/crosshair/list",
      fail: (err) => {
        console.error("分包页面跳转失败，请检查 app.json 配置:", err);
        wx.showToast({ title: "模块载入中", icon: "none" });
      },
    });
  },

  navToProSettings() {
    wx.navigateTo({
      url: "/packageTools/pages/pro-settings/list",
      fail: (err) => {
        console.error("跳转失败", err);
        wx.showToast({ title: "模块载入中", icon: "none" });
      },
    });
  },
  /**
   * 跳转至情报局（新闻列表）
   */
  navToWiki() {
    wx.navigateTo({
      url: "/pages/valo_news/index",
      // 如果你把这个页面配置在了 app.json 的 tabBar 里，则需要用 switchTab
      // url: '/pages/valo_news/index',
      // success: (res) => {},
      fail: (err) => {
        console.error("跳转失败，请检查路径是否在 app.json 中注册", err);
      },
    });
  },

  // index.js
  goToAddPoint() {
    const { maps, currentMapIdx, filteredList, currentAgentIdx } = this.data;

    // 健壮性检查：确保有选中的数据
    if (!maps[currentMapIdx] || !filteredList[currentAgentIdx]) {
      wx.showToast({
        title: "请先选择地图和英雄",
        icon: "none",
      });
      return;
    }

    const selectedMap = maps[currentMapIdx];
    const selectedHero = filteredList[currentAgentIdx];

    // 拼接参数：带上地图ID、地图名、英雄ID、英雄名
    // 注意：路径必须以 / 开头，且确保分包路径拼写准确
    const url = `/packageStrategy/pages/detail/detail?mapId=${selectedMap.uuid}&mapName=${selectedMap.displayName}&heroId=${selectedHero.uuid}&heroName=${selectedHero.displayName}`;

    wx.navigateTo({
      url: url,
      success: () => {
        console.log("跳转成功", {
          map: selectedMap.displayName,
          hero: selectedHero.displayName,
        });
      },
      fail: (err) => {
        console.error("跳转失败，请检查路径是否正确", err);
        wx.showToast({
          title: "路径配置错误",
          icon: "none",
        });
      },
    });
  },

  async fetchFocusNews() {
    try {
      // 1. 先查 hot，如果没有 hot 就取最新的 5 条
      const res = await db
        .collection("valorant_news")
        .orderBy("fetchTime", "desc")
        .limit(10) // 拿10条出来筛选
        .get();

      const CAT_MAP = {
        patch: "版本公告",
        news: "官方资讯",
        esports: "电竞赛事",
        skin: "皮肤情报",
      };

      // 2. 格式化数据
      const formatted = res.data.map((item) => {
        const timestamp = item.fetchTime?.$date || item.fetchTime || Date.now();
        const d = new Date(timestamp);
        return {
          ...item,
          displayTag: CAT_MAP[item.category] || "特工情报",
          displayTime: `${d.getMonth() + 1}-${d.getDate()}`,
          thumb: item.thumb || (item.images && item.images[0]) || "",
        };
      });

      // 3. 筛选 focus 内容：优先 isHot，没 hot 取前 5
      const hotItems = formatted.filter((i) => i.isHot === true);
      const finalFocus = hotItems.length > 0 ? hotItems : formatted.slice(0, 5);

      this.setData({ focusList: finalFocus });
    } catch (err) {
      console.error("首页情报加载失败:", err);
    }
  },

  /**
   * 跳转到新闻详情
   */
  navToNewsDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/valo_news/detail?id=${id}`,
    });
  },
});
