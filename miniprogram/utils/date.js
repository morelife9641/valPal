/**
 * 格式化相对时间
 * @param {Date|Number|Object} time 传入的时间对象
 */
const formatRelativeTime = (time) => {
  if (!time) return "未知时间";

  // 处理云数据库可能返回的 {$date: xxx} 结构或普通时间戳
  const date = time && time.$date ? new Date(time.$date) : new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime(); // 毫秒差

  if (diff < 0) return "未来情报"; // 容错

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // 1. 刚刚：5分钟以内
  if (minutes < 5) {
    return "刚刚";
  }

  // 2. 小时前：1 ~ 23小时内
  if (hours < 24) {
    if (hours < 1) return `${minutes}分钟前`;
    return `${hours}小时前`;
  }

  // 3. 天前：1 ~ 9天内
  if (days >= 1 && days <= 9) {
    return `${days}天前`;
  }

  // 4. 往后：显示具体日期 (202x-xx-xx)
  const Y = date.getFullYear();
  const M =
    date.getMonth() + 1 < 10
      ? "0" + (date.getMonth() + 1)
      : date.getMonth() + 1;
  const D = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
  return `${Y}-${M}-${D}`;
};

module.exports = {
  formatRelativeTime: formatRelativeTime,
};
