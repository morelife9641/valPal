const db = wx.cloud.database();

Page({
  data: {
    id: "",
    categories: ["patch", "news", "esports", "skin"],
    categoryLabels: ["全部", "电竞", "皮肤", "官方", "版本"],
    catIndex: 0,
    form: {
      title: "",
      category: "",
      isHot: false,
      thumb: "",
      content: "",
      summary: "",
    },
    categoryOptions: [
      { key: "all", label: "全部" },
      { key: "esports", label: "电竞" },
      { key: "skin", label: "皮肤" },
      { key: "news", label: "官方" },
      { key: "patch", label: "版本" },
    ],
    isEditorReady: false, // 🚩 标记编辑器是否初始化完成
    formats: {}, // 存储当前选区文字的样式状态
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.fetchDetail(options.id);
    }
  },

  // 获取原始数据
  async fetchDetail(id) {
    wx.showLoading({ title: "调取数据..." });
    const res = await db.collection("valorant_news").doc(id).get();
    const data = res.data;

    const catIndex = this.data.categories.indexOf(data.category);

    this.setData({
      form: {
        title: data.title || "",
        category: data.category || "news",
        isHot: data.isHot || false,
        thumb: data.thumb || "",
        content: data.content || "",
        summary: data.summary || "",
      },
      // catIndex: catIndex > -1 ? catIndex : 0,
      catIndex: catIndex > -1 ? catIndex : 0, // 如果没找到，默认选第一个
    });
    if (this.editorCtx) {
      this.forceSetContent(data.content);
    }
    wx.hideLoading();
  },

  safeSetContents(html) {
    if (!this.editorCtx) return;

    // 针对你的“手工富文本”：如果 content 是纯文本或含有特殊转义，
    // editor 组件有时会解析失败。这里可以做一层基础清洗。
    let cleanHtml = html
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    this.editorCtx.setContents({
      html: cleanHtml,
      success: () => {
        console.log("✅ 富文本内容同步成功");
      },
      fail: (err) => {
        console.error("❌ 富文本同步失败，尝试以纯文本插入", err);
        // 兜底方案：如果 HTML 解析失败，尝试插入 text
        this.editorCtx.insertText({ text: html });
      },
    });
  },

  // 通用输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onEditorInput(e) {
    this.setData({
      ["form.content"]: e.detail.html,
    });
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .select("#editor")
      .context((res) => {
        this.editorCtx = res.context;

        // 🚩 关键点：哪怕 Ready 了，也给它 300ms 缓冲时间再回填
        // 很多时候渲染引擎卡在这一两百毫秒
        setTimeout(() => {
          if (this.data.form.content) {
            console.log("开始强行回填内容...");
            this.forceSetContent(this.data.form.content);
          }
        }, 300);
      })
      .exec();
  },

  forceSetContent(html) {
    if (!this.editorCtx) return;

    this.editorCtx.setContents({
      html: html,
      success: (res) => {
        console.log("✅ 强行回填成功");
      },
      fail: (err) => {
        console.warn("❌ 强行回填失败，尝试第二次尝试...");
        // 如果失败，可能是内容还没加载完，1秒后再试最后一次
        setTimeout(() => {
          this.editorCtx.setContents({ html: html });
        }, 1000);
      },
    });
  },

  // 🚩 核心：监听样式状态变化 (比如点到加粗文字，B按钮要变红)
  onStatusChange(e) {
    const formats = e.detail;
    this.setData({ formats });
  },

  // 统一的格式化指令
  format(e) {
    let { name, value } = e.target.dataset;
    if (!name) return;
    this.editorCtx.format(name, value);
  },

  clear() {
    this.editorCtx.removeFormat();
  },

  async insertImage() {
    const res = await wx.chooseImage({ count: 1 });
    wx.showLoading({ title: "情报上传中..." });

    const cloudPath = `news_content/${Date.now()}.png`;
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath: res.tempFilePaths[0],
    });

    this.editorCtx.insertImage({
      src: uploadRes.fileID,
      width: "100%",
      data: { id: uploadRes.fileID },
      success: () => wx.hideLoading(),
    });
  },
  onCatChange(e) {
    const idx = parseInt(e.detail.value);
    const selectedOption = this.data.categoryOptions[idx];

    this.setData({
      catIndex: idx,
      ["form.category"]: selectedOption.key, // 🚩 存入数据库的是 'esports' 等英文
    });

    console.log("当前选择类别 Key:", selectedOption.key);
  },

  onHotToggle(e) {
    this.setData({ ["form.isHot"]: e.detail.value });
  },

  // 图片上传逻辑
  async uploadImage() {
    const res = await wx.chooseImage({ count: 1 });
    wx.showLoading({ title: "上传中..." });
    const cloudPath = `news_covers/${Date.now()}.png`;
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath: res.tempFilePaths[0],
    });
    this.setData({ ["form.thumb"]: uploadRes.fileID });
    wx.hideLoading();
  },

  // 封装回填方法，确保稳定
  setEditorContent(html) {
    if (this.editorCtx) {
      this.editorCtx.setContents({
        html: html,
        success: () => console.log("情报内容回填成功"),
        fail: (err) => console.error("回填失败", err),
      });
    }
  },

  // 1. 格式化工具逻辑
  format(e) {
    let { name, value } = e.target.dataset;
    if (!name || !this.editorCtx) return;
    this.editorCtx.format(name, value);
  },

  // 2. 状态监听（让按钮变红）
  onStatusChange(e) {
    this.setData({ formats: e.detail });
  },

  // 3. 修复：清除选中文字的格式
  removeFormat() {
    this.editorCtx.removeFormat();
    wx.showToast({ title: "已清除样式", icon: "none" });
  },

  // 4. 修复：彻底清空编辑器所有内容
  clearAll() {
    wx.showModal({
      title: "清空警告",
      content: "确定要抹除当前编辑的所有正文吗？",
      success: (res) => {
        if (res.confirm) {
          this.editorCtx.setContents({
            html: "",
            success: () => {
              this.setData({ ["form.content"]: "" });
              wx.showToast({ title: "已清空", icon: "none" });
            },
          });
        }
      },
    });
  },

  async submitUpdate() {
    if (!this.data.id) return;

    // 如果你在自定义安全规则里配置了 OpenID，可以直接在前端 update
    // 否则需要调用你之前那个 manageUser 云函数
    wx.showLoading({ title: "情报同步中..." });

    try {
      // 提取需要更新的字段，避免把 _id 等系统字段传回去报错
      const { title, summary, content, category, thumb, isHot } =
        this.data.form;

      await db
        .collection("valorant_news")
        .doc(this.data.id)
        .update({
          data: {
            title,
            summary,
            content,
            category,
            thumb,
            isHot,
            fetchTime: db.serverDate(),
            updatedAt: db.serverDate(), // 使用服务器时间
          },
        });

      wx.hideLoading();
      wx.showToast({ title: "同步成功" });

      // 延迟返回，让用户看清提示
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      console.error("保存失败:", err);
      wx.hideLoading();
      wx.showToast({ title: "权限或网络错误", icon: "none" });
    }
  },
});
