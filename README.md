# Audit Loupe UI

Audit Loupe 的 Rancher UI extension（UI extensions v3）。後端、Helm chart 與文件在 [yansheng133/audit-loupe](https://github.com/yansheng133/audit-loupe)。

The Rancher UI extension for Audit Loupe. Backend, chart and docs: [yansheng133/audit-loupe](https://github.com/yansheng133/audit-loupe).

## 安裝 / Install

1. 在 Rancher 的 `Apps` → `Repositories` 加入 `https://yansheng133.github.io/audit-loupe-ui`。
2. 到 Extensions 頁面安裝 Audit Loupe。
3. 升級：在 Extensions 頁面選新版本。用 helm 指令升級時加 `--reset-values`，不要用 `--reuse-values`（會沿用舊版的下載位址，Rancher 找不到檔案，擴充功能載不起來）。0.7.0 的變更地圖需要 server 0.7.0（`/api/behaviors`）。

後端（server 與收集元件）的安裝見主 repo 的 `docs/deploy.md`。

## 開發 / Develop

本機不用裝 Node 24：開發伺服器跑在 SUSE BCI Node.js 24 容器裡（需要 Rancher Desktop 之類的容器引擎）。

```bash
API=https://<Rancher 網址> scripts/dev.sh
```

打開 `https://127.0.0.1:8005`（自簽憑證），在那裡登入 Rancher。改 `pkg/` 底下的檔案，瀏覽器會自動更新。macOS 掛進容器的資料夾收不到檔案變更通知，所以 `dev.sh` 預設用輪詢偵測變更，存檔後約 5～7 秒更新。不需要輪詢的環境可以加 `WATCHPACK_POLLING=false` 關掉。

打包由 CI 負責（每個 PR 都會跑官方的建置測試），本機不需要另外打包。

## 發佈 / Release

用 Rancher 官方的 extension workflow（`.github/workflows/build-extension-charts.yml`）：

- 建立 GitHub Release，tag 寫成 `audit-loupe-<版本>`。版本要等於 `pkg/audit-loupe/package.json` 的 `version`。
- workflow 把 Helm repository 發佈到 `gh-pages`。
- 每個 PR 都會跑官方的建置測試（`build-extensions-test.yml`）。

## 授權 / License

Apache-2.0
