const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 1. 从 API 获取官方稀有度映射关系
    const response = await axios.get('https://valorant-api.com/v1/content-tiers?language=zh-CN')
    const tiers = response.data.data // 这是一个数组，包含各种稀有度的 uuid, name, displayIcon
    
    // 2. 建立一个简单的映射表 { "精选": "https://..." }
    const iconMap = {}
    tiers.forEach(tier => {
      iconMap[tier.displayName] = tier.displayIcon
    })

    // 3. 批量更新数据库 (注意：云数据库批量更新建议分批或在服务器端处理)
    // 这里以更新“精选”级别为例
    const rarities = ['精选', '豪华', '尊爵', '极致', '奢华']
    
    const tasks = rarities.map(async (name) => {
      if (iconMap[name]) {
        return await db.collection('valorant_skins').where({
          skinRarityDescription: name
        }).update({
          data: {
            rarityIcon: iconMap[name] // 存入新字段
          }
        })
      }
    })

    await Promise.all(tasks)
    
    return { success: true, message: '图标同步完成' }
  } catch (err) {
    return { success: false, error: err }
  }
}