const mapsData = require("../../config/maps_data.js");

Component({
  properties: {
    // 父组件传进来的当前选中索引
    activeIndex: {
      type: Number,
      value: 0,
    },
    // 控制弹窗显隐
    visible: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    // 内部维护过滤后的地图列表
    mapList: [],
    // 你的目标地图白名单映射
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
  },

  lifetimes: {
    attached() {
      this.initMapData();
    },
  },

  methods: {
    // 1. 初始化并过滤地图数据

    initMapData() {
      // 1. 先从原始数据中找出“基础训练”这一项，作为“全部”的底图
      const trainingMap = mapsData.find((m) => m.displayName === "基础训练");

      // 2. 过滤出你白名单中的其他地图（排除掉“全部”和“基础训练”本身，防止重复）
      let filtered = mapsData.filter(
        (map) =>
          Object.keys(this.data.targetMaps).includes(map.displayName) &&
          map.displayName !== "全部" &&
          map.displayName !== "基础训练",
      );

      // 3. 构造“全部”选项
      const allOption = {
        // 如果找到了基础训练，就用它的数据，否则用兜底图
        ...(trainingMap || {}),
        displayName: "全部地图",
        uuid: "all", // 保持逻辑上的 all 标识
        // 强制使用基础训练那张蓝色的背景图作为“全部”的图标
        listViewIcon: trainingMap
          ? trainingMap.listViewIcon
          : "/assets/icons/all_maps.png",
      };

      // 4. 将构造好的“全部”塞到数组首位
      filtered.unshift(allOption);

      this.setData({ mapList: filtered }, () => {
        // 数据准备好后，通知父组件初始状态
        this._notifyChange(this.properties.activeIndex);
      });
    },

    _notifyChange(index) {
      const selected = this.data.mapList[index];
      if (selected) {
        this.triggerEvent("change", {
          value: Number(index), // 🚩 强制转为数字，确保传出去的是数字
          label: selected.displayName,
          icon: selected.listViewIcon,
          uuid: selected.uuid,
        });
      }
    },

    // 3. 点击选项触发
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      // 这里的震动反馈能显著提升“战术工具”的手感
      // wx.vibrateShort({ type: "light" });

      this._notifyChange(index);
      this.close();
    },

    // 4. 触发关闭事件
    close() {
      this.triggerEvent("close");
    },

    // 5. 辅助方法
    prevent() {
      return;
    },
    stop() {
      return;
    },
  },
});
