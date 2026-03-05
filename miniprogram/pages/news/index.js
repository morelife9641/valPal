import { annualEvents } from "./eventsData";
Page({
  data: {
    tabs: ["赛程", "战队", "赛事"],
    currentTab: 0,
    isLoading: false,
    allMatches: [], // 存储所有赛程
    displayMatches: [], // 当前日期显示的赛程
    dateList: [], // 日期选择器的数组
    selectedDate: "", // 当前选中的日期
    matchData: [], // 存放从云函数拿回来的比赛列表
    logoMap: {
      "Titan Esports Club": "TEC",
      "EDward Gaming": "EDG",
      "Bilibili Gaming": "BLG",
      "FunPlus Phoenix": "FPX",
      "Trace Esports": "TE",
      "JDG Esports": "JDG",
      "Nova Esports": "NOVA",
      "All Gamers": "AG",
      TYLOO: "TYL",
      "Wolves Esports": "WOL",
      "Dragon Ranger Gaming": "DRG",
    },
    teamsList: [],
    annualEvents: annualEvents || [],
  },
  onLoad: function () {
    this.initDates();
    this.getVctMatches();
    // this.setActiveEvent(annualEvents);
    this.handleEventHighlight();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1, // 对应你 list 里的索引，skins 是第 3 个，所以是 2
      });
    }
  },

  handleTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentTab: e.currentTarget.dataset.index });
    // 这里可以根据 index 去请求不同的接口
    if (index === 1 && this.data.teamsList.length === 0) {
      this.fetchTeamsData();
    }
    if (index === 2) {
      this.handleEventHighlight(); // 切到赛事重算高亮状态
    }
  },

  fetchTeamsData() {
    wx.showLoading({ title: "加载中..." });
    const db = wx.cloud.database();

    // 假设你的集合名称是 'vct_teams'
    db.collection("vct_teams_full")
      .limit(20)
      .get()
      .then((res) => {
        // 对数据进行二次加工：映射 Logo 缩写
        const processedData = res.data.map((team) => {
          return {
            ...team,
            logoName: this.mapLogoName(team.teamName),
          };
        });

        this.setData(
          {
            teamsList: processedData,
          },
          () => {
            wx.hideLoading();
          },
        );
      })
      .catch((err) => {
        console.error("数据库获取失败", err);
        wx.hideLoading();
      });
  },

  // 名字映射逻辑：确保能找到 assets/logos/ 下对应的图片
  mapLogoName(fullName) {
    const logoMap = {
      "All Gamers": "AG",
      "Bilibili Gaming": "BLG",
      "EDward Gaming": "EDG",
      "FunPlus Phoenix": "FPX",
      "JD Gaming": "JDG",
      "Nova Esports": "NOVA",
      "Titan Esports Club": "TEC",
      "Trace Esports": "TE",
      TYLOO: "TYL",
      "Wolves Esports": "WOL",
      "XLG Esports": "XLG",
      "Dragon Ranger Gaming": "DRG",
    };
    return logoMap[fullName] || "VCT"; // 找不到则用默认图
  },

  initDates() {
    const dates = [];
    const now = new Date();
    for (let i = -2; i < 5; i++) {
      // 显示前2天到后4天
      const d = new Date();
      d.setDate(now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push({
        full: `${year}-${month}-${day}`,
        short: `${month}-${day}`,
        weekday: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()],
      });
    }
    const today = dates[2].full; // 对应 i=0 的今天
    this.setData({ dateList: dates, selectedDate: today });
    console.log(dates, today);
  },

  setActiveEvent: function (rawEvents) {
    // 如果传入的参数没拿到，再尝试拿 data 里的
    const events = rawEvents || this.data.annualEvents;

    if (!events || events.length === 0) {
      console.error("数据源读取失败，请检查 import 路径");
      return;
    }

    const now = new Date().getTime();

    const updatedEvents = events.map((event) => {
      // 这里的 .replace(/-/g, '/') 是为了兼容 iOS 真机对日期格式的严格要求
      const startTime = new Date(event.start.replace(/-/g, "/")).getTime();
      const endTime = new Date(event.end.replace(/-/g, "/")).getTime();

      let status = "upcoming";
      if (now >= startTime && now <= endTime) {
        status = "active"; // 今天是2月5日，广州站会命中这个
      } else if (now > endTime) {
        status = "past";
      }
      return { ...event, status };
    });

    // 渲染到页面
    this.setData({ annualEvents: updatedEvents });
    console.log("赛事列表已更新渲染状态");
  },

  handleEventHighlight: function () {
    const rawData = this.data.annualEvents;
    const now = new Date().getTime();

    const processedEvents = rawData.map((item) => {
      // ... 之前的日期处理逻辑保持不变 ...
      const start = new Date(item.start.replace(/-/g, "/")).getTime();
      const end = new Date(item.end.replace(/-/g, "/")).getTime();

      let statusText = "未开始";
      let status = "upcoming";
      if (now >= start && now <= end) {
        statusText = "进行中";
        status = "active";
      } else if (now > end) {
        statusText = "已结束";
        status = "past";
      }

      // --- 新增：国旗 Emoji 匹配逻辑 ---
      let flag = "🇨🇳"; // 默认为中国国旗
      if (item.location.includes("智利")) {
        flag = "🇨🇱";
      } else if (item.location.includes("英国")) {
        flag = "🇬🇧";
      }

      let type = "league";
      if (item.name.includes("Masters")) type = "masters";
      if (item.name.includes("Champions")) type = "champions";

      return { ...item, status, statusText, type, flag };
    });

    this.setData({ annualEvents: processedEvents });
  },

  filterByDate() {
    const { allMatches, selectedDate } = this.data;
    const filtered = allMatches.filter((m) => m.date === selectedDate);

    this.setData({ displayMatches: filtered });
  },

  // 点击日期切换
  onDateTap(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ selectedDate: date }, () => {
      this.filterByDate();
    });
  },

  onLogoError(e) {
    const { team, index } = e.currentTarget.dataset;
    const defaultLogo = "../../assets/default_icon.png"; // 🚩 替换为你的默认图路径

    // 动态修改对应数组项的图片路径
    const key = `displayMatches[${index}].${team}.logoUrl`;

    this.setData({
      [key]: defaultLogo,
    });
  },

  getVctMatches: function () {
    wx.showLoading({ title: "加载中..." });

    wx.cloud.callFunction({
      name: "getMatchList",
      success: (res) => {
        console.log("云端原始返回：", res.result);
        if (res.result && res.result.status === "success") {
          // 统一使用 allMatches，不要再用 matchData 了
          this.setData(
            {
              allMatches: res.result.data,
            },
            () => {
              this.filterByDate();
              console.log("今日过滤结果：", this.data.displayMatches);
            },
          );
        }
      },
      fail: (err) => {
        console.error("云函数调用失败：", err);
        wx.showToast({
          title: "网络连接失败",
          icon: "none",
        });
      },
      complete: () => {
        // 关键：无论成功还是失败，都关闭 Loading
        wx.hideLoading();
        // 如果你用了自定义的下拉刷新，也在这里停止
        wx.stopPullDownRefresh();
      },
    });
  },
});
