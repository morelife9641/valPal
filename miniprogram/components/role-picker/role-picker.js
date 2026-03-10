Component({
  properties: {
    visible: { type: Boolean, value: false },
    activeIndex: { type: Number, value: 0 },
    list: { type: Array, value: [] },
  },
  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      const selected = this.properties.list[index];

      // 触感反馈
      // wx.vibrateShort({ type: "light" });

      this.triggerEvent("change", {
        value: index,
        label: selected.label,
        icon: selected.icon,
        role: selected.value, // Sentinel, Duelist 等
      });
      this.close();
    },
    close() {
      this.triggerEvent("close");
    },
    prevent() {
      return;
    },
  },
});
