 # 工单助手
 
 iOS 风格的图片生成器（Web App），用于批量派发营销执行任务。
 
- 任务卡生成：填表 → 渲染可分享的任务指令图
- 买家秀评语：调用 LLM 生成真实感评价
- 派发二维码：把任务卡 + 评语 + 配图打包成 QR，员工扫码查看
 
 ## 文件结构
 
     工单生成派发/
     ├── index.html        管理端
     ├── viewer.html       员工查看页
     ├── styles.css        iOS 风格样式
     ├── app.js            管理端逻辑
     └── viewer.js         查看页逻辑
 
 不需要构建工具，不依赖 npm。所有第三方库通过 CDN 引入：
 - html2canvas（任务卡渲染成图片）
 - qrcode（二维码生成）
 
 ## 本地运行
 
 静态站点，需要 HTTP 服务器（不能直接双击 HTML，fetch/CORS 会受限）。
 
     cd "/Users/a1-6/Documents/工单生成派发"
     python3 -m http.server 8765
 
 然后手机和电脑都连同一个 Wi-Fi，手机浏览器打开 http://电脑IP:8765/index.html。
 
 查电脑 IP（Mac）：
 
     ipconfig getifaddr en0
 
 ## 部署到 GitHub Pages
 
 ### 1. 创建仓库
 
 在 GitHub 新建一个空仓库（例如 workorder），把本目录所有文件 push 上去：
 
     cd "/Users/a1-6/Documents/工单生成派发"
     git init
     git add .
     git commit -m "init"
     git branch -M main
     git remote add origin git@github.com:你的用户名/workorder.git
     git push -u origin main
 
 ### 2. 开启 Pages
 
 仓库 Settings - Pages - Source 选 main 分支根目录 - Save。
 
 几分钟后，访问 https://你的用户名.github.io/workorder/ ，能看到首页就成功了。
 
 ### 3. 在 App 设置里填入部署地址
 
 打开 App - 右上角齿轮 - 设置：
 - GitHub Pages 地址：https://你的用户名.github.io/workorder
 - AI 服务的 API 地址、模型、API Key（支持任何 OpenAI 兼容接口，下面有示例）
 - 图床 API：默认 https://catbox.moe/user/api.php （免 Key）

 ## AI 服务配置示例

 应用支持任何 OpenAI 兼容的聊天补全接口。常见配置：

     原版 DeepSeek
     API 地址：https://api.deepseek.com/v1
     模型：deepseek-chat
     Key：在 platform.deepseek.com 申请

     火山方舟（豆包 / DeepSeek / 自定义）
     API 地址：https://ark.cn-beijing.volces.com/api/v3
     模型：doubao-1-5-pro-32k-250115 （豆包）
          或 deepseek-v3-250324 （火山部署的 DeepSeek）
          或 ep-xxxxxxxxxxxxx （你在方舟控制台创建的接入点 ID）
     Key：在 volcengine.com 开通方舟后获取

     OpenAI
     API 地址：https://api.openai.com/v1
     模型：gpt-4o-mini
     Key：sk-...

     其他兼容服务（月之暗面、Mistral、本地 Ollama 等）
     按服务商给的地址填入即可
 
 ## 使用流程
 
 ### 派发单个商品
 
 1. 任务卡：填店铺名、商品名 - 上传封面图 - 填搜索词 - 勾选营销动作 - 可选改价 / 下单要求 - 生成任务卡
 2. 评语：写 60 字内的需求概括（含完整产品名）- 选字数 / 关键词 / 风格 / 身份 / 目标产品 - 可上传评价配图 - 生成评语
 3. 派发：点击首页"生成派发二维码" - 上传到 catbox - 显示 QR
 4. 长按 QR 保存图片，发到员工群
 
 ### 员工查看
 
 员工用微信扫 QR - 自动跳转到 viewer.html?data=catbox URL - 浏览器展示：
 - 任务卡图片
 - 搜索词 / 营销动作 / 价格 / 下单要求
 - 评语文本（可复制）
 - 评价配图（可点开放大、长按保存）
 
 ## 数据存储
 
 所有数据存浏览器 IndexedDB：
 - 词条历史（店铺 / 商品 / 搜索词）
 - 封面图历史
 - 任务卡历史
 - 评语历史
 
 清除浏览器数据会清空。建议定期备份。
 
 ## 配置项
 
 ### 关键词（必含要素）
 
 内置 8 个高频：正品 / 已经再用了 / 发货很快 / 买了好多回了 / 质量好 / 效果很好 / 包装精美 / 客服很有耐心。加 1 个自定义输入。
 
 要修改内置列表：编辑 index.html 里的 #rev-keywords 卡片。
 
 ### 语句风格
 
 内置 10 个：热情 / 感谢 / 夸赞 / 一般 / 网络 / 抽象 / 幽默调侃 / 真诚朴实 / 种草安利 / 简洁干练。加 1 个自定义。
 
 每个风格在 app.js 的 STYLE_MATRIX 对象里有独立的高 / 中 / 低强度定义。要改强度描述直接编辑那里。
 
 ### 身份
 
 8 个：学生党 / 上班族 / 宝妈 / 情侣 / 送礼党 / 中老年用户 / 成分党 / 复购老客户。加 1 个自定义。
 
 ### 目标产品
 
 7 个预设：欧莱雅染膏 / 施华蔻染膏 / 欧莱雅发膜 / 施华蔻发膜 / 欧莱雅 magic touch 补色喷雾 / 洗发水护发素 / 自定义。
 
 ## 常见问题
 
 ### QR 扫不出来 / 显示"链接无效"
 
 检查设置里"GitHub Pages 地址"是否填对了：
 - 不要带末尾斜杠
 - 必须能公网访问
 - viewer.html 必须和 index.html 在同一目录下
 
### AI 接口报 401 / 403 / 404
 
 - API Key 错了
 - API Key 没有余额
 - 网络问题
 
 ### catbox 上传失败
 
 - 国内网络可能访问不了 catbox.moe，换别的图床
 - 自建图床：把 API 地址改成自己的，需支持 multipart/form-data 上传 + 返回 URL 字符串
 
 ### 想加新功能
 
 代码是单一入口的纯 JS，没有构建步骤。改完直接刷新页面就能看效果。
 
 ## 安全提醒
 
- API Key 存在浏览器本地（IndexedDB），不上传
 - 不要把带 Key 的截图发到公网
 - 如果在公共设备上使用，记得在设置里清空
