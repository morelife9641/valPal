import { AGENTS_CONFIG } from "../../config/agents_new";

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: function (newVal) {
        const list = this.data && this.data.agentList;
        // 修正：检查是否存在且长度
        if (newVal && (!list || list.length === 0)) {
          // return;
          this.initAgentIcons();
        }
      },
    },
    currentAgentUuid: { type: String, value: "" },
  },

  data: {
    popupTabs: ["全部", "决斗", "控场", "先锋", "哨卫"],
    currentTab: "全部",
    agentList: [], // 存储带 URL 的全量数据
    filteredList: [], // 视图渲染用的过滤后列表
  },

  methods: {
    async initAgentIcons() {
      wx.showLoading({ title: "同步特工...", mask: true });
      try {
        const cloudPrefix =
          "cloud://cloud1-5gqun0xd80e8dd85.636c-cloud1-5gqun0xd80e8dd85-1396911701/icons/";

        const fileList = AGENTS_CONFIG.map((agent) => ({
          fileID: `${cloudPrefix}${agent.uuid}.png`,
        }));

        const res = await wx.cloud.getTempFileURL({
          fileList: fileList.map((item) => item.fileID),
        });

        const finalAgents = AGENTS_CONFIG.map((agent, index) => ({
          ...agent,
          displayIcon: res.fileList[index].tempFileURL || "",
        }));

        // 关键修复：初始化时同时给 filteredList 赋值
        this.setData({
          agentList: finalAgents,
          filteredList: finalAgents,
          currentTab: "全部",
        });
      } catch (err) {
        console.error("加载特工图标失败", err);
      } finally {
        wx.hideLoading();
      }
    },

    onTabChange(e) {
      const tab = e.currentTarget.dataset.tab;
      const { agentList } = this.data;

      // 逻辑修复：确保是从全量 agentList 中过滤
      let filtered =
        tab === "全部"
          ? agentList
          : agentList.filter((item) => item.role === tab);

      this.setData({
        currentTab: tab,
        filteredList: filtered,
      });
    },

    onClose() {
      this.triggerEvent("close");
    },

    onSelect(e) {
      const item = e.currentTarget.dataset.item;
      // 先抛出事件
      this.triggerEvent("select", { item });

      // 稍微延迟关闭，让渲染层有时间处理完“选中”的样式更新，再执行“销毁”
      setTimeout(() => {
        this.triggerEvent("close");
      }, 50);
    },
  },
});
