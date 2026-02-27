const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command; // 引入指令用于原子操作

/**
 * 云函数：管理用户信息 (manageUser)
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, userInfo, rank } = event;

  try {
    // 1. 查找当前特工记录
    const userResult = await db
      .collection("users")
      .where({ _openid: OPENID })
      .get();

    const existUser = userResult.data.length > 0 ? userResult.data[0] : null;

    // --- 场景 A：静默检查 (check) ---
    if (action === "check") {
      if (existUser) {
        // 自动修复逻辑：如果老用户缺少新字段，则补全
        const updateData = { lastLogin: db.serverDate() };
        if (existUser.points === undefined) updateData.points = 10;
        if (!existUser.rank)
          updateData.rank = { tier: "all", label: "全部段位", icon: "0" };
        if (!existUser.actionLimit)
          updateData.actionLimit = { usedToday: 0, lastActionDate: "" };

        await db
          .collection("users")
          .doc(existUser._id)
          .update({ data: updateData });

        // 返回合并后的最新数据
        return {
          success: true,
          registered: true,
          data: { ...existUser, ...updateData },
        };
      }
      return { success: true, registered: false };
    }

    // --- 场景 B：注册/更新档案 (register) ---
    if (action === "register") {
      const userData = {
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatarUrl,
        lastLogin: db.serverDate(),
        updatedAt: db.serverDate(),
      };

      if (existUser) {
        await db
          .collection("users")
          .doc(existUser._id)
          .update({ data: userData });
        return { success: true, data: { ...existUser, ...userData } };
      } else {
        const newUser = {
          _openid: OPENID,
          ...userData,
          role: 0,
          points: 10,
          rank: { tier: "all", label: "全部段位", icon: "0" },
          actionLimit: { usedToday: 0, lastActionDate: "" },
          createTime: db.serverDate(),
        };
        const res = await db.collection("users").add({ data: newUser });
        return { success: true, data: { ...newUser, _id: res._id } };
      }
    }

    // --- 场景 C：每日签到领取辐能 (checkIn) ---
    if (action === "checkIn") {
      if (!existUser) return { success: false, msg: "档案未激活" };

      // 获取北京时间当前日期字符串 (YYYY-MM-DD)
      const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
      const todayStr = now.toISOString().split("T")[0];

      // 校验逻辑
      if (
        existUser.actionLimit &&
        existUser.actionLimit.lastActionDate === todayStr
      ) {
        return { success: false, msg: "今日能量补给已领取" };
      }

      const rewardPoints = 3;
      const newPoints = (existUser.points || 0) + rewardPoints;

      await db
        .collection("users")
        .doc(existUser._id)
        .update({
          data: {
            points: newPoints,
            "actionLimit.lastActionDate": todayStr,
            "actionLimit.usedToday": 1, // 签到时重置今日操作计数
            updatedAt: db.serverDate(),
          },
        });

      return { success: true, newPoints: newPoints, msg: "辐射能入库成功" };
    }

    // --- 场景 D：更新段位 (updateRank) ---
    if (action === "updateRank") {
      if (!existUser) return { success: false, msg: "档案未激活" };
      await db
        .collection("users")
        .doc(existUser._id)
        .update({
          data: { rank: rank, updatedAt: db.serverDate() },
        });
      return { success: true, msg: "段位同步成功" };
    }

    return { success: false, msg: "未定义的特工指令" };
  } catch (err) {
    console.error("云函数执行故障:", err);
    return { success: false, error: err };
  }
};
