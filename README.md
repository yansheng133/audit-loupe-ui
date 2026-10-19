# Audit Loupe UI

Audit Loupe 的 Rancher UI extension（UI extensions v3）。後端、Helm chart 與文件在 [yansheng133/audit-loupe](https://github.com/yansheng133/audit-loupe)。

The Rancher UI extension for Audit Loupe. Backend, chart and docs: [yansheng133/audit-loupe](https://github.com/yansheng133/audit-loupe).

## 安裝 / Install

1. 在 Rancher 的 `Apps` → `Repositories` 加入 `https://yansheng133.github.io/audit-loupe-ui`。
2. 到 Extensions 頁面安裝 Audit Loupe。

後端（server 與收集元件）的安裝見主 repo 的 `docs/deploy.md`。

## 開發 / Develop

```bash
yarn install --frozen-lockfile
yarn build-pkg audit-loupe
```

本機測試可用 `yarn serve-pkgs`，再在 Rancher 的 Extensions 頁面用 Developer Load 載入。

## 發佈 / Release

用 Rancher 官方的 extension workflow（`.github/workflows/build-extension-charts.yml`）：

- 建立 GitHub Release，tag 寫成 `audit-loupe-<版本>`。版本要等於 `pkg/audit-loupe/package.json` 的 `version`。
- workflow 把 Helm repository 發佈到 `gh-pages`。
- 每個 PR 都會跑官方的建置測試（`build-extensions-test.yml`）。

## 授權 / License

Apache-2.0
