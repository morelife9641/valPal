// cloud/functions/updateStats/index.js
// 更新新闻统计数据云函数

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { newsId, type, value = 1 } = event; // type: 'up', 'down', 'view'

  // 参数验证
  if (!newsId) {
    return { success: false, message: '缺少 newsId 参数' };
  }
  
  if (!['up', 'down', 'view'].includes(type)) {
    return { success: false, message: 'type 参数错误，应为 up/down/view' };
  }

  try {
    const updateField = `stats.${type}`;
    
    // 更新统计数据
    await db.collection('valorant_news').doc(newsId).update({
      data: {
        [updateField]: _.inc(value),
        stats: {
          hot: _.inc(type === 'view' ? 1 : 5) // 互动权重更高
        },
        updatedAt: new Date()
      }
    });

    // 获取更新后的数据
    const updated = await db.collection('valorant_news')
      .doc(newsId)
      .get();

    if (!updated.data) {
      return { success: false, message: '新闻不存在' };
    }

    return {
      success: true,
      stats: updated.data.stats,
      message: '更新成功'
    };

  } catch (error) {
    console.error('更新统计失败:', error);
    return {
      success: false,
      message: error.message,
      error: error.stack
    };
  }
};
