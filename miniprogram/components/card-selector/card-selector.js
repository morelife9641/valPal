import { PLAYER_CARDS } from "./player_cards_index";
const PAGE_SIZE = 20; // 每次加载20条

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: function (newVal) {
        if (newVal) {
          this.initData(); // 每次打开重置数据
        }
      },
    },

    usePlayerCard: { type: Boolean, value: false },
    currentCardUuid: { type: String, value: "" },
  },

  data: {
    popupTabs: ["全部"],
    currentTab: "全部",
    searchQuery: "",
    displayCards: [],
    fullList: [], // 当前搜索结果的总列表
    currentPage: 1,
  },

  // 关键：监听 show 属性的变化

  methods: {
    initData() {
      this.setData({
        searchQuery: "",
        fullList: PLAYER_CARDS,
        displayCards: PLAYER_CARDS.slice(0, PAGE_SIZE),
        currentPage: 1,
      });
    },
    loadMore() {
      const { displayCards, fullList, currentPage, searchQuery } = this.data;

      // 如果已经加载完了，直接返回
      if (displayCards.length >= fullList.length) return;

      const nextPage = currentPage + 1;
      const start = currentPage * PAGE_SIZE;
      const end = nextPage * PAGE_SIZE;

      // 从总列表中切出下一页数据
      const newBatch = fullList.slice(start, end);

      this.setData({
        displayCards: displayCards.concat(newBatch),
        currentPage: nextPage,
      });

      console.log(
        `已加载第 ${nextPage} 页，总数: ${this.data.displayCards.length}`,
      );
    },

    handleClearSearch() {
      this.setData({
        searchQuery: "",
        fullList: PLAYER_CARDS,
        displayCards: PLAYER_CARDS.slice(0, 20), // 恢复初始20条
        currentPage: 1,
      });
    },

    // 修改 handleSearch 逻辑，确保输入为空时也能正确重置
    handleSearch(e) {
      const query = e.detail.value.toLowerCase();

      if (!query) {
        this.handleClearSearch();
        return;
      }

      const filteredFullList = PLAYER_CARDS.filter((card) =>
        card.displayName.toLowerCase().includes(query),
      );

      this.setData({
        searchQuery: query,
        fullList: filteredFullList,
        displayCards: filteredFullList.slice(0, 20),
        currentPage: 1,
      });
    },

    handleSelect(e) {
      const card = e.currentTarget.dataset.card;
      console.log(card);

      this.triggerEvent("select", { card });
    },

    handleReset() {
      this.triggerEvent("reset");
    },

    onClose() {
      // 触发父组件关闭
      this.triggerEvent("close");
    },
  },
});
