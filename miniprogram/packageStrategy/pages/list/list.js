const mapsData = require("../../../config/maps_data.js");
import { toggleFavoriteStatus } from "../../../utils/fav.js";

Page({
  data: {
    sideIndex: 0,
    sideOptions: [
      { name: "全部阵营", value: "all" },
      { name: "进攻", value: "atk" },
      { name: "防守", value: "def" },
    ],
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
  },

  onLoad() {
    // 1. 获取原始地图数据
    const rawMaps = Array.isArray(mapsData) ? mapsData : mapsData.maps || [];

    // 2. 定义目标地图名称集合 (Key)
    const targetMaps = {
      全部: "all",
      幽邃地窟: "abyss",
      霓虹町: "split",
      微风岛屿: "breeze",
      深海明珠: "pearl",
      隐世修所: "haven",
      源工重镇: "bind",
      盐海矿镇: "corrode",
      亚海悬城: "ascent", // 补上你示例中的亚海悬城，否则它会被过滤掉
    };

    // 获取所有需要保留的名字
    const allowedNames = Object.keys(targetMaps);

    // 3. 过滤并保留需要的字段（可选，建议只保留核心字段以节省内存）
    const filteredMaps = rawMaps
      .filter((item) => allowedNames.includes(item.displayName))
      .map((item) => ({
        uuid: item.uuid,
        displayName: item.displayName,
        displayIcon: item.displayIcon, // 详情页标点底图需要用到
        splash: item.splash, // 列表展示可能用到
      }));

    // 4. 合并“全部地图”选项并更新数据
    this.setData({
      maps: [{ uuid: "all", displayName: "全部地图" }, ...filteredMaps],
    });
  },

  onShow() {
    this.loadPointList();
  },

  loadPointList() {
    const db = wx.cloud.database();
    wx.showLoading({ title: "同步战术库..." });

    db.collection("points")
      .where({ status: 1 })
      .orderBy("createTime", "desc")
      .get()
      .then((res) => {
        const list = res.data.map((item) => {
          // 核心：在 data.maps 中寻找对应的地图配置
          // 注意：这里的 maps 是你在 onLoad 中过滤后生成的精简数组
          const mapConfig = this.data.maps.find((m) => m.uuid === item.mapId);

          return {
            ...item,
            // 优先级：配置中的长版图标 > 配置中的全景图 > 默认图
            mapThumb: mapConfig
              ? mapConfig.listViewIconTall || mapConfig.splash
              : "",
            // 日期处理：增加年份或更详细的格式
            dateDisplay: item.createTime
              ? `${item.createTime.getMonth() + 1}/${item.createTime.getDate()}`
              : "刚刚",
          };
        });

        this.setData({ allList: list }, () => {
          this.applyFilter();
          wx.hideLoading();
        });
      })
      .catch((err) => {
        console.error(err);
        wx.hideLoading();
      });
  },

  formatDate(date) {
    if (!date) return "刚刚";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}/${month}/${day}`;
  },

  async loadPointList() {
    wx.showLoading({ title: "同步中..." });
    const db = wx.cloud.database();

    try {
      // --- 步骤 1: 获取点位类型的收藏 ID ---
      const favRes = await db
        .collection("user_favorites")
        .where({
          type: "point", // 🚩 只取点位类
        })
        .get();

      const myFavIds = favRes.data.map((f) => f.targetId);

      // --- 步骤 2: 获取点位主表数据 ---
      const res = await db
        .collection("points")
        .where({ status: 1 })
        .orderBy("createTime", "desc")
        .get();

      // --- 步骤 3: 数据合并渲染 ---
      const processedList = res.data.map((item) => {
        // 匹配地图配置获取图标（沿用你之前的逻辑）
        const mapConfig = this.data.maps.find((m) => m.uuid === item.mapId);

        return {
          ...item,
          isFavorite: myFavIds.includes(item._id), // 🚩 匹配并点亮星星
          mapThumb: mapConfig
            ? mapConfig.listViewIconTall || mapConfig.splash
            : "",
          dateDisplay: item.createTime
            ? this.formatDate(item.createTime)
            : "--",
        };
      });

      this.setData({
        allList: processedList,
        filteredList: processedList,
      });
    } catch (err) {
      console.error("加载列表失败", err);
    } finally {
      wx.hideLoading();
    }
  },

  // 切换地图筛选
  onMapFilterChange(e) {
    this.setData({ mapIndex: e.detail.value }, () => this.applyFilter());
  },

  // 切换阵营筛选
  toggleSideFilter() {
    const modes = ["all", "atk", "def"];
    let next = modes[(modes.indexOf(this.data.sideFilter) + 1) % 3];
    this.setData({ sideFilter: next }, () => this.applyFilter());
  },

  // 执行筛选算法
  applyFilter() {
    const { allList, maps, mapIndex, sideFilter } = this.data;
    const selectedMap = maps[mapIndex];

    const filtered = allList.filter((item) => {
      const mapMatch =
        selectedMap.uuid === "all" || item.mapId === selectedMap.uuid;
      const sideMatch = sideFilter === "all" || item.side === sideFilter;
      return mapMatch && sideMatch;
    });

    this.setData({ filteredList: filtered });
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

  /**
   * 点位收藏切换
   */
  async toggleFavorite(e) {
    const pointId = e.currentTarget.dataset.id; // WXML 中传来的 item._id
    const listName = "filteredList"; // 🚩 确认你页面渲染用的数组名，如果是 allList 就改回 allList
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
      // 注意：这里的字段名在 fav.js 存入的是 targetId
      const res = await toggleFavoriteStatus(pointId, "point");

      // 4. 反馈
      wx.showToast({
        title: res.isFavorite ? "已加入收藏" : "已取消收藏",
        icon: "none",
      });

      // 5. 可选：如果 res 状态与预期不符，则强制同步一次
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
    const idx = e.detail.value;
    this.setData(
      {
        mapIndex: idx,
        filterMap: this.data.maps[idx],
      },
      () => this.applyFilter(),
    );
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

  onSideChange(e) {
    const idx = e.detail.value;
    const selectedSide = this.data.sideOptions[idx];
    this.setData(
      {
        sideIndex: idx,
        filterSide: selectedSide.value,
        // 新增：专门存一个字符串用于页面显示，保持 DOM 简洁
        filterSideLabel: selectedSide.name,
      },
      () => this.applyFilter(),
    );

    console.log("Selected side:", this.data.filterSideLabel);
  },

  // --- 清除逻辑 ---

  clearMapFilter() {
    this.setData({ filterMap: {}, mapIndex: 0 }, () => this.applyFilter());
  },

  // 位置选择改变
  onPointChange(e) {
    const idx = e.detail.value;
    const selectedPoint = this.data.pointOptions[idx];

    this.setData(
      {
        pointIndex: idx,
        pointType: selectedPoint.value,
        filterPointLabel: selectedPoint.name,
      },
      () => {
        this.applyFilter(); // 执行筛选过滤
      },
    );

    console.log("Selected Point:", this.data.filterPointLabel);
  },

  // 清除位置筛选
  clearPointFilter() {
    this.setData(
      {
        pointIndex: 0,
        pointType: "",
        filterPointLabel: "全部",
      },
      () => {
        this.applyFilter();
      },
    );
  },

  clearSideFilter() {
    this.setData(
      {
        sideIndex: 0,
        filterSide: "all",
        filterSideLabel: "全部",
      },
      () => this.applyFilter(),
    );
  },

  goToAdd() {
    wx.navigateTo({ url: "../add-point/add-point" });
  },
  goToDetail(e) {
    console.log(e);

    wx.navigateTo({
      url: `/packageStrategy/pages/detail/detail?id=${e.currentTarget.dataset.id}`,
    });
  },
});
