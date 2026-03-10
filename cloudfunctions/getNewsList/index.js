// cloud/functions/getNewsList/index.js
// 获取新闻列表云函数

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const {
    category,
    page = 1,
    pageSize = 20,
    keyword,
    sortBy = 'publishTime',  // publishTime | stats.hot | metrics.likes
    orderBy = 'desc'         // asc | desc
  } = event;

  try {
    // 构建查询条件
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (keyword) {
      query.$or = [
        { title: db.RegExp({ regexp: keyword, options: 'i' }) },
        { summary: db.RegExp({ regexp: keyword, options: 'i' }) },
        { content: db.RegExp({ regexp: keyword, options: 'i' }) }
      ];
    }

    // 验证排序字段
    const validSortFields = ['publishTime', 'stats.hot', 'metrics.likes', 'fetchTime'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'publishTime';
    const sortOrder = orderBy === 'asc' ? 'asc' : 'desc';

    // 分页查询
    const result = await db.collection('valorant_news')
      .where(query)
      .orderBy(sortField, sortOrder)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 统计总数
    const count = await db.collection('valorant_news')
      .where(query)
      .count();

    return {
      success: true,
      data: result.data,
      total: count.total,
      page,
      pageSize,
      hasMore: result.data.length === pageSize
    };

  } catch (error) {
    console.error('获取新闻列表失败:', error);
    return {
      success: false,
      message: error.message,
      error: error.stack
    };
  }
};
