// 云函数 index.js
const cloud = require("wx-server-sdk");
// 🚩 修复点 1: cloud.init 语法修复
cloud.init({ env: cloud.DYNAMIC_TYPE_CA });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { pointId, oldAction, newAction } = event;
  const { OPENID } = cloud.getWXContext();

  // 1. 处理 user_actions (记录谁点了什么)
  if (newAction === "") {
    // 🚩 注意：云函数端删除可以用 where，但需保证权限或逻辑正确
    await db
      .collection("user_actions")
      .where({
        point_id: pointId,
        _openid: OPENID,
      })
      .remove();
  } else if (oldAction === "") {
    await db.collection("user_actions").add({
      data: {
        point_id: pointId,
        action_type: newAction,
        _openid: OPENID,
        createTime: db.serverDate(),
      },
    });
  } else {
    await db
      .collection("user_actions")
      .where({
        point_id: pointId,
        _openid: OPENID,
      })
      .update({
        data: { action_type: newAction },
      });
  }

  // 2. 处理 points (更新总票数)
  let updateData = {};
  // 🚩 修复点 2: 动态键名必须加 [ ]
  if (oldAction) {
    updateData[`stats.${oldAction}`] = _.inc(-1);
  }
  if (newAction) {
    updateData[`stats.${newAction}`] = _.inc(1);
  }

  // 3. 执行更新
  try {
    return await db.collection("points").doc(pointId).update({
      data: updateData,
    });
  } catch (e) {
    return e;
  }
};
