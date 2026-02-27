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
      { tier: "Iron", label: "黑铁", icon: "3" }, // 对应 3.png
      { tier: "Bronze", label: "青铜", icon: "6" },
      { tier: "Silver", label: "白银", icon: "9" },
      { tier: "Gold", label: "黄金", icon: "12" },
      { tier: "Platinum", label: "白金", icon: "15" },
      { tier: "Diamond", label: "钻石", icon: "18" },
      { tier: "Ascendant", label: "超凡", icon: "21" },
      { tier: "Immortal", label: "神话", icon: "24" },
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

    recommendPoints: [],
    currentMapIdx: 0,
    allData: [],
    newsList: [
      {
        _id: "news_001",
        title: "版本更新 8.11 // 特工平衡性调整",
        desc: "雷兹与捷风的位移技能进行了重大重写，旨在提升竞技公平性。",
        cover:
          "https://picture.mval.qq.com/source/818/20260221/1771603214aedf116905866108.png", // 示例图
        tag: "PATCH NOTES",
        dateStr: "2026.02.24",
        priority: "URGENT",
      },
      {
        _id: "news_002",
        title: "冠军巡回赛 // 首尔大师赛正式开赛",
        desc: "全球顶尖战队集结首尔，争夺本赛季首个世界冠军头衔。",
        cover:
          "https://picture.mval.qq.com/source/818/20260221/17716032143937ffd59b84191e.jpg",
        tag: "ESPORTS",
        dateStr: "2026.02.22",
        priority: "NORMAL",
      },
      {
        _id: "news_003",
        title: "深度档案 // 新地图「幽邃地窟」点位全解析",
        desc: "如何在深渊之中占据地利？点击查阅各英雄最强点位推荐。",
        cover:
          "https://picture.mval.qq.com/source/818/20260221/1771603214b37eeeaa42b5be24.jpg",
        tag: "STRATEGY",
        dateStr: "2026.02.20",
        priority: "HOT",
      },
    ],
  },

  async onLoad() {
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
    const filteredMaps = mapsData.filter((map) =>
      Object.keys(this.data.targetMaps).includes(map.displayName),
    );

    // 2. 同步设置地图，确保 updateDisplayStats 运行时 maps 已经存在
    this.setData({
      maps: filteredMaps,
    });

    // 3. 执行图标同步（异步）
    await this.initAgentIcons();

    // 4. 等地图和图标都到位了，再进行第一次排行榜渲染
    this.updateDisplayStats();

    // 5. 更新报点
    this.updateCallouts();

    this.fetchMapRecommendations();

    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0,
      });
    }
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

      const finalAgents = AGENTS_CONFIG.map((agent, index) => ({
        ...agent,
        displayIcon: res.fileList[index].tempFileURL || "",
      }));

      // 使用 Promise 的方式确保 setData 完成
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

  // 1. 点击表头唤起弹窗
  openRankPopup() {
    this.setData({ isPopupShow: true });

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

  // 3. 选中某个段位后
  onRankSelect(e) {
    // 关键：直接从 e.detail 拿组件算好的 label 和 index
    const { value, label } = e.detail;

    this.setData({
      rankIndex: value,
      currentRankLabel: label,
      isPopupShow: false,
    });

    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setTabBarHidden(false);
    }
    this.updateDisplayStats(); // 去查询数据库
  },

  // 排行榜页面的跳转逻辑
  navToAgentStrategy(e) {
    const statItem = e.currentTarget.dataset.agent;
    const { maps, currentMapIdx, agentList } = this.data;

    const currentMap = maps[currentMapIdx];
    // 匹配完整的特工配置，获取 bustPortrait 和 uuid
    const agentInfo = (agentList || []).find(
      (a) =>
        a.displayName === statItem.finalName ||
        a.displayName === statItem.agentCn,
    );

    if (!agentInfo || !currentMap) return;

    // 构建参数
    const params = {
      mapId: currentMap.uuid,
      mapName: currentMap.displayName,
      heroId: agentInfo.uuid,
      heroName: agentInfo.displayName,
      heroNameEn: agentInfo.developerName || agentInfo.displayName, // 英文名
      // 由于 URL 长度限制，图片 URL 建议在目标页通过 heroId 重新查，或者进行编码
      bustPortrait: encodeURIComponent(
        agentInfo.bustPortrait || agentInfo.fullPortrait || "",
      ),
    };

    // 拼接 URL
    const query = Object.keys(params)
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    wx.navigateTo({
      url: `/packageStrategy/pages/list/list?${query}`,
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
        this.updateCallouts();
        this.updateDisplayStats();
        this.fetchMapRecommendations();
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

    db.collection("points")
      .where({
        mapId: currentMap.uuid,
      })
      .limit(5) // 推荐位显示5个
      .orderBy("createTime", "desc")
      .get()
      .then((res) => {
        this.setData({
          recommendPoints: res.data,
        });
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

  // 4. 跳转到点位列表（查看全部）
  navToAllPoints() {
    const currentMap = this.data.maps[this.data.currentMapIdx];
    // 这里跳转到你之前写的 List 页面
    wx.navigateTo({
      url: `/packageStrategy/pages/list/list?mapId=${currentMap.uuid}&mapName=${encodeURIComponent(currentMap.displayName)}`,
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
});
