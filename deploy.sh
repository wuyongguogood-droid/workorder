#!/bin/bash
set -e
echo "==> 清理旧临时目录"
rm -rf /tmp/workorder-deploy
mkdir -p /tmp/workorder-deploy
echo "==> 同步最新代码到临时目录"
cp -R "/Users/a1-6/Documents/工单生成派发/." /tmp/workorder-deploy/
rm -rf /tmp/workorder-deploy/.git
cd /tmp/workorder-deploy
echo "==> 推送到 CloudBase"
tcb hosting deploy ./ /workorder -e my-workorder-d5g01wydcbd24f1c0
echo "==> 完成！强刷浏览器即可"
