# 暖学英语 Warm English 📚

温暖的英语学习小助手 —— 手机浏览器打开就能用的英语学习 App（网页 App / PWA）。

## 功能

- 📖 **教材选择**：按课组织（目前是新概念英语第一册，内容持续补充中）
- 🔤 **词汇学习**：单词卡片（音标、释义、例句、发音），可翻卡、收藏进生词本
- 🎧 **句子听写**：听发音，把句子一个词一个词写出来（有几个单词就有几条横线），
  提交后逐词批改，并展示中文翻译 + 句子成分解析（主谓宾定状补彩色标注）
- 🗣️ **文章影子跟读**：逐句播放、可调语速、可录音回放对比
- 🃏 **单词卡片（生词本）**：智能间隔复习 —— 忘记了 10 分钟后再考，模糊明天再考，
  认识了间隔逐渐拉长（1天→3天→6天…）
- 📊 **学习进度**：每课的词汇/句子/文章完成情况自动记录
- 💾 **数据保存在手机本地**，无需注册账号
- 📴 **离线可用**：访问过一次后，没网也能学

## 目录结构

```
warm-english/
├── index.html         页面入口
├── manifest.webmanifest  App 安装配置
├── sw.js               离线缓存
├── css/style.css       样式（白色 + 暖色调）
├── js/                 程序代码
├── data/               学习内容（JSON，可随时补充）
│   ├── textbooks.json  教材列表
│   └── nce1/           新概念1的课程文件
├── icons/              App 图标
└── tools/gen-icons.js  图标生成脚本（改图标时用）
```

## 在电脑上本地运行

需要电脑装有 Python 或 Node.js（装一个即可）：

```bash
# 方法一：Python
cd warm-english
python -m http.server 8787
# 浏览器打开 http://localhost:8787

# 方法二：Node.js
npx serve .
```

> 注意：直接双击 index.html 不行（浏览器会限制读取本地文件），必须用上面的方式。

## 发布到 GitHub Pages（让同学用手机访问）

### 第 1 步：在 GitHub 网站上创建仓库

1. 打开 github.com 并登录
2. 点右上角 `+` → `New repository`
3. 仓库名填 `warm-english`（英文小写），选 **Public（公开）**
4. 不要勾选任何初始化选项，点 `Create repository`

### 第 2 步：把代码推上去

在电脑上（已安装 Git 的前提下），打开命令行执行：

```bash
cd warm-english
git init
git add .
git commit -m "暖学英语 v0.1"
git branch -M main
git remote add origin https://github.com/你的用户名/warm-english.git
git push -u origin main
```

### 第 3 步：开启 Pages

1. 仓库页面点 `Settings` → 左侧 `Pages`
2. `Source` 选 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`，保存
3. 等 1~2 分钟，页面顶部会显示网址：`https://你的用户名.github.io/warm-english/`

把这个网址发给同学，手机打开后按设置页里的说明「添加到主屏幕」即可。

### 以后更新内容

修改文件后重新推送即可：

```bash
git add .
git commit -m "更新内容"
git push
```

手机上刷新页面（或关掉重开）就能看到新课。

## 如何添加新课内容

1. 在 `data/nce1/` 下新建 `L011.json`（参考现有课程文件的格式）
2. 在 `data/nce1/index.json` 的 lessons 列表里加一条记录
3. 重新推送即可

课程文件格式：

```json
{
  "id": "L011",
  "title": "Lesson 11 · Is this your shirt?",
  "titleZh": "第11课 这是你的衬衫吗？",
  "words": [
    {
      "word": "shirt",
      "phonetic": "/ʃɜːt/",
      "meaning": "n. 衬衫",
      "examples": [
        { "en": "Is this your shirt?", "zh": "这是你的衬衫吗？" }
      ]
    }
  ],
  "sentences": [
    {
      "en": "Is this your shirt?",
      "zh": "这是你的衬衫吗？",
      "analysis": [
        { "text": "Is", "roles": ["谓语"] },
        { "text": "this", "roles": ["主语"] },
        { "text": "your", "roles": ["定语"] },
        { "text": "shirt", "roles": ["表语"] }
      ]
    }
  ],
  "article": [
    { "en": "Whose shirt is that?", "zh": "那是谁的衬衫？" }
  ]
}
```

句子成分可选值：主语、谓语、宾语、表语、定语、状语、补语、连词、感叹词。

## 常见问题

- **没有声音？** 先点一下页面任意位置再点发音按钮；检查手机音量。
- **录音失败？** 需要在浏览器弹出的提示中允许麦克风权限；录音功能必须在 https（如 GitHub Pages）或 localhost 下使用。
- **数据会丢吗？** 数据存在本机浏览器里，清除浏览器数据或换手机会丢失。
- **版权提醒**：教材课文有版权，仅供个人/同学间学习使用，请勿大规模公开传播。

## 版本

v0.1.0 — 前 5 课内容 + 全部功能
