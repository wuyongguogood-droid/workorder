 # 部署步骤

 按顺序在终端跑下面这些命令。

 ## 1. 配置 git（如果没配过）

     cd "/Users/a1-6/Documents/工单生成派发"
     git config --global user.email "你的邮箱"
     git config --global user.name "你的名字"

 ## 2. 提交代码（如果还没提交）

     git add .
     git commit -m "init: 工单助手"

 ## 3. 在 GitHub 上创建空仓库

 打开 https://github.com/new

 - Repository name: workorder（或随便起）
 - Description: 可选
 - Public（必须 Public，Pages 才有免费额度）
 - 不要勾 Add a README file / .gitignore / license（本地已经有文件了）
 - 点 Create repository

 ## 4. 推送代码

 回到终端：

     git remote add origin https://github.com/wuyongguogood-droid/workorder.git
     git branch -M main
     git push -u origin main

 第一次 push 会让你登录 GitHub。弹窗里需要 Personal Access Token（不是密码）：

 1. 打开 https://github.com/settings/tokens
 2. Generate new token - 选 classic
 3. Note 随便填，Expiration 选 No expiration
 4. Scopes 勾 repo 全部
 5. Generate，复制那串 token（只显示一次）
 6. 推送时用户名填 wuyongguogood-droid，密码填这串 token

 ## 5. 开启 Pages

 1. 打开 https://github.com/wuyongguogood-droid/workorder/settings/pages
 2. Source: Deploy from a branch
 3. Branch: main / (root)
 4. Save

 等 1-2 分钟，访问：

     https://wuyongguogood-droid.github.io/workorder/

 看到首页 = 部署成功。

 ## 6. 在 App 里填入部署地址

 打开部署好的页面 - 右上齿轮 - 设置 - GitHub Pages 地址：

     https://wuyongguogood-droid.github.io/workorder

 保存。

 之后生成的派发二维码员工就能正常扫了。
