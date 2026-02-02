const tcb = require("tcb-admin-node");
const axios = require("axios");

// 1. 初始化云开发环境
const app = tcb.init({
  secretId: "你的腾讯云SecretId", // 如果你在开发者工具内运行，可以跳过这些鉴权
  secretKey: "你的腾讯云SecretKey",
  env: "cloud1-5gqun0xd80e8dd85",
});
const db = app.database();

async function fetchAndSave() {
  const pageSize = 50;
  // 按照你之前找到的规律，大概有31页左右
  for (let page = 1; page <= 31; page++) {
    console.log(`正在获取第 ${page} 页数据...`);
    try {
      const res = await axios.post(
        "https://router4.gamersky.com/@valorant/Skin/GetSkinList",
        {
          pageIndex: page,
          pageSize: pageSize,
          weaponName: "全部",
          skinRarity: [],
          skinSort: 0,
          keyword: "",
          RegionName: "ChianMainland",
        },
      );

      const list = res.data.skinList;
      if (!list || list.length === 0) break;

      // 2. 批量写入云数据库
      // 注意：本地脚本不受云函数时长限制，可以慢慢跑
      for (const skin of list) {
        await db
          .collection("valorant_skins")
          .add({
            ...skin,
            createTime: db.serverDate(),
          })
          .then(() => {
            console.log(`[成功] 写入: ${skin.name_SC}`);
          })
          .catch((err) => {
            console.error(`[失败] ${skin.name_SC}:`, err.message);
          });
      }
    } catch (e) {
      console.error(`第 ${page} 页请求失败`, e.message);
    }
  }
  console.log("全部数据同步完成！");
}

fetchAndSave();
