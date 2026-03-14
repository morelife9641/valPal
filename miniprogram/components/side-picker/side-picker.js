Component({
  properties: {
    visible: Boolean,
    activeValue: { type: String, value: "atk" },
  },
  data: {
    sides: [
      { label: "进攻", value: "atk" }, // 替换为你的图标路径
      { label: "防守", value: "def" },
    ],
  },
  methods: {
    onSelect(e) {
      // 🚩 核心修改：从 dataset 中提取完整的 item 对象
      const { item } = e.currentTarget.dataset;

      // 加上安全判断，防止意外
      if (!item) {
        console.error("未能获取到选项数据，请检查 WXML 中的 data-item 绑定");
        return;
      }

      // 触感反馈
      // wx.vibrateShort({ type: "light" });

      // 打印调试一下，看看拿到的数据对不对
      console.log("选中的阵营:", item);

      // 向上层抛出事件
      this.triggerEvent("change", {
        value: item.value,
        label: item.label,
      });

      // 关闭弹窗
      this.close();
    },
    close() {
      this.triggerEvent("close");
    },
    prevent() {},
  },
});
