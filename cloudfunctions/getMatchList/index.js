const cloud = require("wx-server-sdk");
const axios = require("axios");

cloud.init({ env: cloud.DYNAMIC_TYPE_ENV });

exports.main = async (event, context) => {
  const url =
    "https://val.native.game.qq.com/esports/v1/data/VAL_Match_1000055.json";

  try {
    const res = await axios.get(url, {
      timeout: 5000,
      headers: {
        Referer: "https://vct.qq.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    const rawMatches = res.data.msg || [];

    const matchList = rawMatches
      .map((item) => {
        const teamA = item.teamA || { teamShortName: "TBD" };
        const teamB = item.teamB || { teamShortName: "TBD" };

        // 这里的处理要细心：从 "2026-02-04T17:00:00+08:00" 提取
        // 统一提取完整日期 yyyy-MM-dd
        const fullDate = item.matchDate ? item.matchDate.substring(0, 10) : "";

        return {
          match_id: item.bMatchId,
          date: fullDate, // 2026-02-04
          time: item.matchDate ? item.matchDate.substring(11, 16) : "--:--",
          stage: item.bMatchName || "启点赛",
          teamA: { name: teamA.teamShortName, score: item.scoreA || 0 },
          teamB: { name: teamB.teamShortName, score: item.scoreB || 0 },
          status: item.matchStatusId, // 1:未开始 2:进行中 3:已结束
        };
      })
      .filter((item) => item.date !== ""); // 过滤掉完全没日期的脏数据

    // 排序：按比赛时间先后顺序（前端切换日期后，同一天内的比赛按时间顺序排）
    matchList.sort((a, b) => a.match_id - b.match_id);

    return {
      status: "success",
      data: matchList,
    };
  } catch (err) {
    return { status: "error", message: err.message };
  }
};
