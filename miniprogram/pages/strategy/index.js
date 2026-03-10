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

    this.fetchMapRecommendations();

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
      wx.hideLoading();
    }
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

  // 2. 选择地图后的回调
  onMapSelect(e) {
    // 根据你 map-picker 组件里 triggerEvent 传回的字段获取
    const { index, label } = e.detail;

    // 确保 index 是数字类型
    const mapIdx = parseInt(index);

    this.setData({
      currentMapIdx: mapIdx,
      currentMapLabel: label,
      isMapPopupShow: false,
    });

    // 恢复显示自定义 TabBar
    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false);
    }

    // 选择完地图后，立即刷新战绩列表
    this.updateDisplayStats();
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

  updateDisplayStats() {
    const { maps, currentMapIdx, rankIndex, rankList, agentList } = this.data;
    const valorantMasterData = this.allData;
    // 1. 安全检查：确保数据源和索引存在
    if (
      !maps[currentMapIdx] ||
      !rankList[rankIndex] ||
      typeof valorantMasterData === "undefined"
    ) {
      return;
    }

    // 2. 获取匹配词
    const mapDisplayName = maps[currentMapIdx].displayName;
    const mapKey = targetMaps[mapDisplayName] || "all";
    const currentRankWord = rankList[rankIndex].tier;

    console.log(`🔍 正在筛选 - 地图: ${mapKey}, 段位: ${currentRankWord}`);

    // 3. 过滤逻辑
    let filtered = valorantMasterData.filter((item) => {
      // 确保 item.Map 和 item.Rank_Level 存在再进行比对
      const isMapMatch =
        item.Map && item.Map.toLowerCase() === mapKey.toLowerCase();
      const isRankMatch =
        item.Rank_Level &&
        item.Rank_Level.toLowerCase() === currentRankWord.toLowerCase();
      return isMapMatch && isRankMatch;
    });

    if (filtered.length === 0) {
      console.warn("未找到匹配数据");
      this.setData({ displayStats: [] });
      return;
    }

    // 4. 数据加工 (针对你提供的新数据结构)
    const processed = filtered.map((stat) => {
      // 查找特工静态配置（头像、职业）
      const agentInfo = agentList.find(
        (a) =>
          a.displayNameEn === stat.Agent_EN || a.displayName === stat.Agent,
      );

      // 计算胜率数字（用于排序和样式判断）
      const winValue = parseFloat(stat.Win_Rate.replace("%", "")) || 0;

      return {
        ...stat,
        finalName: stat.Agent,
        agentIcon: agentInfo ? agentInfo.displayIcon : "",
        roleIcon: agentInfo ? roleIconMap[agentInfo.role] : "",

        // 核心展示数据处理
        winValue: winValue, // 纯数字，用于 WXML 判断 {{item.winValue >= 50}}
        winRateDisplay: winValue.toFixed(1), // 格式化显示如 "47.9"

        kd: stat.KD || "0.00",
        pickRate: stat.Pick_Rate ? stat.Pick_Rate.replace("%", "") : "0.0",
        matches: stat.Matches || "0",

        // 因为新数据里没有 ACS 和 KDA，这里给个占位符防止 WXML 报错
        avgScore: "N/A",
        kda: { k: "-", d: "-", a: "-" },
      };
    });

    // 5. 排序：按胜率降序
    processed.sort((a, b) => b.winValue - a.winValue);

    // 6. 赋予排名序号
    const displayStats = processed.map((item, index) => ({
      ...item,
      rankPos: index + 1,
    }));

    // 7. 更新视图
    this.setData({ displayStats });
  },

  updateDisplayStats() {
    const { maps, currentMapIdx, rankIndex, rankList, agentList } = this.data;
    const valorantMasterData = this.allData;

    // 1. 安全检查：确保索引是有效的数字且数据已加载
    const mapIdx = parseInt(currentMapIdx);
    const rIdx = parseInt(rankIndex);

    if (
      isNaN(mapIdx) ||
      isNaN(rIdx) ||
      !maps ||
      !maps[mapIdx] ||
      !rankList ||
      !rankList[rIdx] ||
      !valorantMasterData
    ) {
      console.warn("⏳ 筛选条件或大数据源尚未就绪", { mapIdx, rIdx });
      return;
    }

    // 2. 获取匹配词：处理“全部”逻辑
    const currentMap = maps[mapIdx];
    const mapDisplayName = currentMap.displayName;

    // 🚩 核心修正：如果地图名是“全部”，映射为 "all"；否则去 targetMaps 找
    const mapKey =
      mapDisplayName === "全部" ? "all" : targetMaps[mapDisplayName] || "all";
    const currentRankWord = rankList[rIdx].tier;

    console.log(
      `📊 执行过滤 -> 地图Key: ${mapKey}, 段位Word: ${currentRankWord}`,
    );

    // 3. 过滤逻辑
    let filtered = valorantMasterData.filter((item) => {
      // 确保字段存在并统一转小写比对
      const itemMap = (item.Map || "").toLowerCase();
      const itemRank = (item.Rank_Level || "").toLowerCase();
      const targetMap = mapKey.toLowerCase();
      const targetRank = currentRankWord.toLowerCase();

      return itemMap === targetMap && itemRank === targetRank;
    });

    // 4. 空数据处理：如果没搜到，清空列表
    if (filtered.length === 0) {
      console.warn("❌ 未找到匹配数据，请检查 JSON 中的 Map/Rank_Level 字段");
      this.setData({ displayStats: [] });
      return;
    }

    // 5. 数据加工 (保持你的逻辑，优化头像匹配)
    const processed = filtered.map((stat) => {
      const agentInfo = agentList.find(
        (a) =>
          a.displayNameEn === stat.Agent_EN || a.displayName === stat.Agent,
      );

      const winValue = parseFloat(stat.Win_Rate.replace("%", "")) || 0;

      return {
        ...stat,
        finalName: stat.Agent,
        agentIcon: agentInfo ? agentInfo.displayIcon : "",
        roleIcon: agentInfo ? roleIconMap[agentInfo.role] : "",
        winValue: winValue,
        winRateDisplay: winValue.toFixed(1),
        kd: stat.KD || "0.00",
        pickRate: stat.Pick_Rate ? stat.Pick_Rate.replace("%", "") : "0.0",
        matches: stat.Matches || "0",
        avgScore: "N/A",
        kda: { k: "-", d: "-", a: "-" },
      };
    });

    // 6. 排序与排名
    processed.sort((a, b) => b.winValue - a.winValue);
    const displayStats = processed.map((item, index) => ({
      ...item,
      rankPos: index + 1,
    }));

    // 7. 更新视图并重置滚动位置
    this.setData({
      displayStats,
      scrollTop: 0, // 切换条件后回到顶部
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
    const targetRoleValue = roleOptions[roleIndex].value; // 如 'Sentinel' 或 'all'

    // 3. 基础过滤：地图 + 段位
    let filtered = valorantMasterData.filter((item) => {
      return (
        (item.Map || "").toLowerCase() === mapKey.toLowerCase() &&
        (item.Rank_Level || "").toLowerCase() === currentRankWord.toLowerCase()
      );
    });

    // 4. 加工数据并进行“职业筛选”
    const processed = [];
    filtered.forEach((stat) => {
      // 找到该特工的详细配置（为了拿职业信息）
      const agentInfo = agentList.find(
        (a) =>
          a.displayNameEn === stat.Agent_EN || a.displayName === stat.Agent,
      );

      // 🚩 职业二次过滤逻辑
      if (targetRoleValue !== "all") {
        // 如果选了特定职业，但当前特工不属于该职业，则跳过
        if (!agentInfo || agentInfo.role !== targetRoleValue) return;
      }

      const winValue = parseFloat(stat.Win_Rate.replace("%", "")) || 0;

      processed.push({
        ...stat,
        agentIcon: agentInfo ? agentInfo.displayIcon : "",
        // 使用你提供的本地资源映射
        roleIcon: agentInfo
          ? roleIconMap[this._getRoleChineseName(agentInfo.role)] || ""
          : "",
        winValue: winValue,
        winRateDisplay: winValue.toFixed(1),
        kd: stat.KD || "0.00",
        pickRate: stat.Pick_Rate ? stat.Pick_Rate.replace("%", "") : "0.0",
        matches: stat.Matches || "0",
      });
    });

    // 5. 排序与更新
    processed.sort((a, b) => b.winValue - a.winValue);
    const displayStats = processed.map((item, index) => ({
      ...item,
      rankPos: index + 1,
    }));

    this.setData({ displayStats, scrollTop: 0 });
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

  fetchMapRecommendations() {
    const currentMap = this.data.maps[this.data.currentMapIdx];
    if (!currentMap) return;

    const db = wx.cloud.database(); // 确保定义了 db

    db.collection("points")
      .where({
        mapId: currentMap.uuid,
      })
      .limit(10) // 既然分了两行，建议把上限调到10，每行5个左右视觉更饱满
      .orderBy("createTime", "desc")
      .get()
      .then((res) => {
        const allPoints = res.data;

        // 核心过滤逻辑：根据你数据库里的字段（假设字段名是 side）
        // 如果你的字段名不同，请修改下面的 'atk' 和 'def'
        const atkPoints = allPoints.filter(
          (p) => p.side === "atk" || p.type === "进攻",
        );
        const defPoints = allPoints.filter(
          (p) => p.side === "def" || p.type === "防守",
        );

        this.setData({
          recommendPoints: allPoints, // 用于控制整体的 wx:if
          atkPoints: atkPoints,
          defPoints: defPoints,
        });
      })
      .catch((err) => {
        console.error("推荐点位加载失败", err);
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

  // 更新当前地图的报点区域（按 A/B/中区 分类）
  updateCallouts() {
    const map = this.data.maps[this.data.currentMapIdx];
    if (!map || !map.callouts) return;

    // 按 superRegionName 分组，方便列表展示
    const groups = {};
    map.callouts.forEach((c) => {
      const groupName = c.superRegionName || "其他";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(c.regionName);
    });

    this.setData({ currentCallouts: groups });
  },

  // 跳转详情页
  navToDetail(e) {
    const { region } = e.currentTarget.dataset;
    const map = this.data.maps[this.data.currentMapIdx];
    const agent = this.data.agents[this.data.currentAgentIdx];

    wx.navigateTo({
      url: `/pages/map-detail/map-detail?mapId=${map.uuid}&agentId=${agent.uuid}&region=${region}`,
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
