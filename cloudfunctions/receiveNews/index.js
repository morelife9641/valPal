// cloud/functions/receiveNews/index.js
// 接收 OpenClaw 抓取的新闻数据并入库

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 验证 token（防止未授权访问）
const CONFIG = {
  TOKEN: 'valorant_news_secret_token_2026'  // 实际使用时请修改并保密
};

exports.main = async (event, context) => {
  const startTime = Date.now();
  
  // 验证 token
  const { token, newsList, source } = event;
  
  if (token !== CONFIG.TOKEN) {
    return {
      success: false,
      message: '认证失败：token 错误'
    };
  }
  
  if (!newsList || !Array.isArray(newsList) || newsList.length === 0) {
    return {
      success: false,
      message: '参数错误：newsList 不能为空'
    };
  }
  
  console.log(`收到 ${newsList.length} 条新闻数据`);
  
  try {
    // 1. 数据验证和清洗
    const validated = newsList
      .map(item => validateAndClean(item, source))
      .filter(item => item !== null);
    
    console.log(`验证通过：${validated.length} 条`);
    
    if (validated.length === 0) {
      return {
        success: true,
        message: '没有有效数据',
        count: 0
      };
    }
    
    // 2. 去重检查
    const unique = await filterDuplicates(validated);
    console.log(`去重后：${unique.length} 条`);
    
    if (unique.length === 0) {
      return {
        success: true,
        message: '所有数据已存在',
        count: 0
      };
    }
    
    // 3. 批量入库
    const results = [];
    const errors = [];
    
    for (const item of unique) {
      try {
        const result = await db.collection('valorant_news').add({
          data: {
            ...item,
            stats: { down: 0, hot: 0, up: 0, view: 0 },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        results.push(result);
      } catch (error) {
        if (error.errMsg && error.errMsg.includes('duplicate')) {
          console.log('跳过重复:', item.source.postId);
        } else {
          console.error('入库失败:', error, item.source.postId);
          errors.push({
            postId: item.source.postId,
            error: error.message
          });
        }
      }
    }
    
    // 4. 记录接收统计
    await db.collection('fetch_stats').add({
      data: {
        fetchTime: new Date(),
        source: source || 'openclaw',
        rawCount: newsList.length,
        validatedCount: validated.length,
        uniqueCount: unique.length,
        savedCount: results.length,
        duplicates: validated.length - unique.length,
        errors: errors,
        duration: Date.now() - startTime,
        status: 'success'
      }
    });
    
    return {
      success: true,
      message: '接收完成',
      count: results.length,
      ids: results.map(r => r._id),
      duration: Date.now() - startTime,
      stats: {
        raw: newsList.length,
        validated: validated.length,
        unique: unique.length,
        saved: results.length,
        errors: errors.length
      }
    };
    
  } catch (error) {
    console.error('接收失败:', error);
    
    // 记录错误
    try {
      await db.collection('fetch_stats').add({
        data: {
          fetchTime: new Date(),
          source: source || 'openclaw',
          rawCount: newsList.length,
          validatedCount: 0,
          uniqueCount: 0,
          savedCount: 0,
          duplicates: 0,
          errors: [error.message, error.stack],
          duration: Date.now() - startTime,
          status: 'failed'
        }
      });
    } catch (logError) {
      console.error('记录日志失败:', logError);
    }
    
    return {
      success: false,
      message: error.message,
      error: error.stack,
      duration: Date.now() - startTime
    };
  }
};

/**
 * 验证和清洗数据
 */
function validateAndClean(item, source) {
  try {
    // 必填字段检查
    if (!item.title || !item.source || !item.source.postId) {
      console.log('跳过：缺少必填字段', item);
      return null;
    }
    
    // 分类验证
    const validCategories = ['skin', 'patch', 'esports', 'game', 'skin_leak', 'patch_leak'];
    const category = validCategories.includes(item.category) ? item.category : 'game';
    
    // 时间处理
    const publishTime = item.publishTime ? new Date(item.publishTime) : new Date();
    
    // 构建完整记录
    return {
      category,
      title: String(item.title).slice(0, 200),
      summary: String(item.summary || '').slice(0, 500),
      content: String(item.content || ''),
      source: {
        platform: item.source.platform || 'x',
        account: item.source.account || '',
        accountName: item.source.accountName || '',
        postId: item.source.postId,
        url: item.source.url || ''
      },
      publishTime,
      fetchTime: new Date(),
      metrics: {
        likes: item.metrics?.likes || 0,
        reposts: item.metrics?.reposts || 0,
        replies: item.metrics?.replies || 0,
        views: item.metrics?.views || 0
      },
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 10) : [],
      images: Array.isArray(item.images) ? item.images.slice(0, 5) : [],
      videos: Array.isArray(item.videos) ? item.videos.slice(0, 3) : [],
      sentiment: ['positive', 'negative', 'neutral'].includes(item.sentiment) ? item.sentiment : 'neutral',
      verified: !!item.source.verified,
      language: item.language || 'zh-CN',
      region: item.region || 'global',
      status: 'published',
      fetchSource: source || 'openclaw'
    };
    
  } catch (error) {
    console.error('验证失败:', error, item);
    return null;
  }
}

/**
 * 去重检查
 */
async function filterDuplicates(items) {
  const unique = [];
  
  for (const item of items) {
    try {
      const exists = await db.collection('valorant_news')
        .where({ 'source.postId': item.source.postId })
        .count();
      
      if (exists.total === 0) {
        unique.push(item);
      } else {
        console.log('已存在:', item.source.postId);
      }
    } catch (error) {
      console.error('去重检查失败:', error, item.source.postId);
      unique.push(item); // 出错时保留
    }
  }
  
  return unique;
}
