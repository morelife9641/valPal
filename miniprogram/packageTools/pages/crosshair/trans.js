const fs = require("fs");
const path = require("path");

// 1. 引入你原始的数据（注意：如果你的原文件是 module.exports 形式，可以直接 require）
const oldData = require("./crosshairs.js");

/**
 * 简单的 ID 生成器：将中文名转为拼音或直接提取特征
 * 这里我们采用 "ch_" + 索引 的方式最稳妥，不会冲突
 */
const newData = oldData.map((item, index) => {
  // 生成唯一 ID，例如 ch_0, ch_1...
  // 如果想要更语义化，可以根据 name 处理，但 index 是最安全的
  const uniqueId = `ch_${index}`;

  return {
    id: uniqueId,
    name: item.name,
    code: item.code,
    // 处理一下原数据里讨厌的转义斜杠
    local_img: item.local_img ? item.local_img.replace(/\\\//g, "/") : "",
    img_url: item.img_url ? item.img_url.replace(/\\\//g, "/") : "",
  };
});

// 2. 将处理后的数据写回成一个新的 JS 文件
const fileContent = `module.exports = ${JSON.stringify(newData, null, 2)};`;

const outputPath = path.join(__dirname, "crosshairs_new.js");

fs.writeFile(outputPath, fileContent, (err) => {
  if (err) {
    console.error("写入失败:", err);
  } else {
    console.log("✅ 处理完成！新文件已生成在: crosshairs_new.js");
    console.log(`🚀 共处理了 ${newData.length} 条数据。`);
  }
});
