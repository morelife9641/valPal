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
      const cloudBase =
        "https://636c-cloud1-5gqun0xd80e8dd85-1396911701.tcb.qcloud.la/maps/";
      const trainingMap = mapsData.find((m) => m.displayName === "基础训练");

      let filtered = mapsData
        .filter(
          (map) =>
            Object.keys(this.data.targetMaps).includes(map.displayName) &&
            map.displayName !== "全部" &&
            map.displayName !== "基础训练",
        )
        .map((map) => {
          // 🚩 核心：如果配置里是 uuid，拼接成可访问的 https 地址
          return {
            ...map,
            // 假设你的图片命名规则是 [uuid]_listviewicon.png
            listViewIcon: `${cloudBase}${map.uuid}_listviewicon.png`,
          };
        });

      const allOption = {
        displayName: "全部地图",
        uuid: "all",
        // 同样处理“全部”的底图
        listViewIcon: trainingMap
          ? `${cloudBase}${trainingMap.uuid}_listviewicon.png`
          : "/assets/icons/all_maps.png",
      };

      filtered.unshift(allOption);

      this.setData({ mapList: filtered }, () => {
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
