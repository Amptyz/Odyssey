# 新电脑开发与构建

## 1. 安装工具

- Git。
- Cocos Dashboard，并从官方渠道安装 **Creator 3.8.8**。按新电脑平台选择安装包，首次使用按提示登录和处理许可协议。
- **Node.js 26.x**（本项目实测 26.0.0，`.nvmrc` 已记录）。
- **pnpm 11.25.0**：`npm install -g pnpm@11.25.0`。
- 只有执行浏览器自动化测试才需要 Google Chrome；普通编辑开发不要求额外安装测试浏览器。

## 2. 拉取代码和依赖

```bash
git clone https://github.com/Amptyz/Odyssey.git
cd Odyssey
pnpm install --frozen-lockfile
pnpm check
```

依赖安装在仓库根目录。`pnpm check` 检查纯逻辑、Cocos 官方类型、工具脚本和 64 项单元测试，并编译核心代码；它不代替 Cocos 发布构建。

## 3. 导入已配置的 Cocos 工程

在 Dashboard 中添加 / 导入本地工程，选择 **Odyssey/EmberDemo**，使用 Creator **3.8.8** 打开。等待编辑器重新生成 library / temp 并完成资源导入，打开 `assets/Main.scene`，点击顶部预览按钮。

已有 Main 场景、Canvas、Camera、GameBootstrap 组件和资源 `.meta` 均随仓库提交。无需新建项目、重新创建场景或再次挂载脚本。不要选择外层 Odyssey 目录作为 Cocos 工程。

## 4. 开发与提交

- 唯一游戏源码：`EmberDemo/assets/scripts/ember/`。直接修改这里，测试也读取这里，不需要同步另一份源码。
- 场景、预制体、素材在 `EmberDemo/assets/`；请通过编辑器移动 / 重命名资源，并同时提交对应 `.meta`，避免改变资源标识而破坏引用。
- 提交源码、测试、锁文件、工程 `settings/`、`.creator/` 和 `build-templates/`。
- 不提交 `node_modules/`、`.pnpm-store/`、`library/`、`temp/`、`profiles/`、本地安装记录和构建输出。仓库已配置忽略规则。
- 当前美术由代码生成，无外部素材，也不依赖 Git LFS。以后加入大贴图、PSD、模型或音频时再配置 LFS；制作源文件可放仓库根目录 `art-source/`，游戏导出资源放在 `EmberDemo/assets/`。
- 根目录是唯一 Git 仓库，EmberDemo 是普通子目录，不是 submodule。

日常开发流程：`git pull` → 必要时 `pnpm install --frozen-lockfile` → 修改 → `pnpm check` → 编辑器预览 / 构建 → `git add`、`git commit`、`git push`。

## 5. 构建与独立试玩

构建任务属于编辑器的本地状态，不会从另一台电脑自动同步。在 Creator 的 **Project → Build** 面板创建 Web Desktop 任务：

- 场景列表勾选 `assets/Main.scene`，设为启动场景。
- 构建路径 `build`，输出名 `web-desktop`。
- 点击 Build，确认成功后回到仓库根目录执行 `pnpm play`。

打开 <http://127.0.0.1:8080/>。首次拉取必须先构建才能运行这个独立服务；`build/` 不在 Git 中。服务只监听本机地址，不能用 file:// 双击页面替代。每次改代码后重新 Build，再刷新页面即可。

`EmberDemo/build-templates/web-desktop/` 是已提交的 Cocos 自定义网页模板，负责 16:9 自适应和页面信息。

浏览器回归（另开终端，先保持 `pnpm play` 运行）：

```bash
pnpm test:controls
pnpm test:content
node --import tsx scripts/browser-playthrough.ts
```

基础冒烟测试，macOS / Linux：

```bash
EMBER_PREVIEW_URL=http://127.0.0.1:8080 pnpm smoke
```

Windows PowerShell：

```powershell
$env:EMBER_PREVIEW_URL='http://127.0.0.1:8080'
pnpm smoke
```

浏览器测试逐个执行，JSON 报告和本机截图写入 `reports/`。报告中的旧时间与路径是开发记录，不是另一台电脑的测试结果。目前实际引擎 / 浏览器验证来自 macOS + Chrome；Windows 开发环境尚未实测。

## 官方参考

- [Cocos 下载](https://www.cocos.com/creator-download)
- [创建场景及挂载脚本](https://docs.cocos.com/creator/3.8/manual/en/getting-started/helloworld/)
- [自定义构建模板](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-project-build-template.html)
