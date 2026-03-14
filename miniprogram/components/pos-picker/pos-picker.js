Component({
  properties: {
    visible: { type: Boolean, value: false },
    activeValue: { type: String, value: "all" },
  },

  data: {
    posOptions: [
      { label: "A", value: "A", desc: "A区" },
      { label: "B", value: "B", desc: "B区" },
      { label: "O", value: "Others", desc: "其他" },
    ],
  },

  methods: {
    onSelect(e) {
      const { item } = e.currentTarget.dataset;
      // wx.vibrateShort({ type: "light" });

      this.triggerEvent("change", {
        value: item.value,
        label: item.label,
      });
      this.close();
    },
    close() {
      this.triggerEvent("close");
    },
    prevent() {},
  },
});
