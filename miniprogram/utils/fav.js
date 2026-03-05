export const toggleFavoriteStatus = async (id, type) => {
  const db = wx.cloud.database();
  const col = db.collection("user_favorites");

  try {
    // 1. 查找是否已存在
    // 在小程序端查询，默认就只能查到自己的数据，不需要手动传 _openid
    const checkRes = await col
      .where({
        targetId: id,
        type: type,
      })
      .get();

    if (checkRes.data.length > 0) {
      // 2. 取消收藏
      await col.doc(checkRes.data[0]._id).remove();
      return { isFavorite: false, msg: "已取消收藏" };
    } else {
      // 3. 添加收藏
      // 注意：不要手动写 _openid 字段，云开发会自动补全真实的 OpenID
      await col.add({
        data: {
          targetId: id,
          type: type,
          createTime: db.serverDate(),
        },
      });
      return { isFavorite: true, msg: "收藏成功" };
    }
  } catch (err) {
    console.error("操作失败", err);
    throw err;
  }
};
