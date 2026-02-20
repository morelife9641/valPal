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
    // 组件内部维护的段位常量数据
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
  },

  // 生命周期：组件在页面上挂载时执行
  lifetimes: {
    attached() {
      // 初始渲染时，主动通知父组件当前的 label
      this._notifyChange(this.properties.activeIndex);
    },
  },

  methods: {
    // 内部私有方法：统一处理向父组件发送的消息
    _notifyChange(index) {
      const selected = this.data.rankList[index];
      if (selected) {
        this.triggerEvent("change", {
          value: index, // 对应的数组下标
          label: selected.label, // 对应的中文名称
          tier: selected.tier, // 对应的图标 ID
        });
      }
    },

    // 点击选项触发
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      // 1. 发送选中数据给父组件
      this._notifyChange(index);
      // 2. 这里的逻辑通常伴随关闭弹窗，交给父组件控制 visible 或者直接通知
      this.close();
    },

    // 触发关闭事件（给遮罩或关闭按钮用）
    close() {
      this.triggerEvent("close");
    },

    // 阻止冒泡和滚动穿透的基础方法
    prevent() {
      return;
    },
    stop() {
      return;
    },
  },
});
