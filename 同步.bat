@echo off
echo ?? 正在从上游仓库获取最新代码...
git fetch upstream

echo ?? 正在合并上游更新...
git merge upstream/master

if %errorlevel% neq 0 (
    echo ?? 发现冲突！请手动解决冲突后，执行 git commit 提交。
    pause
    exit /b
)

echo ?? 正在推送到你自己的 GitHub 仓库...
git push origin master

echo ? 同步完成！你的仓库现在是最新的了。
pause