# v5 介面原型：軌 C 報告

寫作：2026-10-21（09:22 開始，09:38 收尾）。依 `audit-loupe` 主 repo 的 `docs/lab/parallel-1021-task.md`「軌 C」。
**一句話結論**：總覽、關係、事件三個分頁、右側物件細節與底部時間列都做出來了，資料全部來自 `/api/changemap`；dev server 可以用 `AL_LOCAL_API` 改接軌 B 的本機 server，已確認代理拿得到 10/18 的真實資料。沒有登入 Rancher（任務書規定不自己登入），改用一個只在本機的檢視頁，把同一份 v5 程式接上本機 server 的真實資料，截圖看過三個分頁、細節、時間列、深色與英文。在 Rancher 裡面的樣子（Rancher 自己的主題變數、選單）仍留給 Sam 確認。

## 1. Sam 要做的事：用軌 B 的本機 server 開 v5

前提：軌 B 的本機 server 跑在 `127.0.0.1:18090`（`~/audit-loupe-lab/proto/STATUS.md`）。確認：

```sh
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:18090/api/changemap?day=2026-10-18'   # 要是 200
# 沒起來就執行：~/audit-loupe-lab/proto/start-server.sh
```

啟動 v5 的 dev server（另開一個埠，不影響現在 8005 那個）：

```sh
cd ~/audit-loupe-ui-v5
API=https://<lab 的 Rancher 網址> \
AL_LOCAL_API=http://host.docker.internal:18090 \
PORT=8006 NAME=audit-loupe-ui-v5-dev \
scripts/dev.sh
```

- 看到 `Audit Loupe: /k8s/clusters/local/.../proxy -> http://host.docker.internal:18090` 與 `Compiled successfully` 就好了（第一次約 15 秒）。
- 打開 `https://127.0.0.1:8006`（自簽憑證），登入 lab 的 Rancher，左側選 Audit Loupe →「變更地圖」。
- 直接開某一天：`https://127.0.0.1:8006/audit-loupe/c/_/changes?day=2026-10-18`
  - 有資料的日子：10/17（14:16 起）、**10/18（最多，下游 09:23–17:37 中斷）**、10/19、**10/20（整天、沒有中斷）**、10/21（只有 00:00–00:02）。
- 停止：在那個終端機按 Ctrl+C（或 `docker stop audit-loupe-ui-v5-dev`）。
- 不設 `AL_LOCAL_API` 時，行為和以前一樣，全部轉給 lab 的 Rancher。
- 舊版變更地圖還在：`/audit-loupe/c/_/changes-v4`（只有網址，不在選單上）。

## 2. 這次做了什麼

| 項目 | 狀態 | 說明 |
|---|---|---|
| 分頁列＋篩選（叢集可多選、Namespace、稽核狀態）＋時區 | 完成 | 切換分頁時篩選保留；時區滑鼠移上去顯示來源 |
| 總覽：摘要行、四種狀態件數（可點＝套用篩選） | 完成 | 載入中顯示「—」，不顯示 0 |
| 總覽：表格八欄、迷你條（紅＝警示）、只畫看得到的列 | 完成 | 排序照 API；翻頁用 `next`（「載入更多」） |
| 總覽：隱藏列說明＋顯示切換（`system=1`） | 完成 | |
| 右側物件細節 | 完成（大部分） | 標題、狀態與原因、當天狀態條、三個動作、誰動了它（原文可展開）、取決於設定、匯出／複製連結／雜湊鏈 |
| 三個動作 | 完成 | 點了才呼叫既有的 `/api/history`；沒有版本時停用並說明原因 |
| 窄螢幕：細節改成抽屜 | 完成 | 1100px 以下 |
| 底部時間列 | 完成（以範圍選取代替播放頭） | 合併線／每叢集一條（後端給幾條畫幾條）；看不到＝斜線；操作＝細短線；缺口滑鼠移上去看起訖與原因；前一天／後一天／日期 |
| 事件分頁 | 完成 | 物件狀態與收集事件分開標示來源；收集用「正常／看不到」 |
| 關係分頁 | 完成（基本） | 四欄、狀態上色、線粗＝次數、繞過 Rancher＝紅虛線、點身分／管道／叢集只看相關的、可一鍵清除。選取物件的路徑：API 的線是兩兩彙總，往回追會把所有身分都點亮，所以改用細節裡「誰動了它」的身分與管道決定要亮哪幾條 |
| 網址還原畫面 | 完成 | 日期、分頁、叢集、Namespace、狀態、系統元件、選取物件、時間範圍都在網址 |
| 中英兩套文字 | 完成 | 沿用 Rancher 的語系（`i18n/current`） |
| 開頁只送一個請求、在路由進入時送出 | 完成 | `beforeRouteEnter` 先送，頁面建立時接手同一個請求；不等 Rancher 叢集清單 |
| `AL_LOCAL_API` 開關 | 完成 | 只改 `vue.config.js` 與 `scripts/dev.sh`，extension 程式不受影響；預設關閉 |

## 3. 驗證

| 項目 | 結果 |
|---|---|
| build（`yarn build-pkg audit-loupe`，SUSE BCI Node 24 容器） | 通過；只有既有的 bundle 大小警告（296 KiB） |
| dev server 啟動、編譯 | 通過，`Compiled successfully in 14226ms`，無錯誤；驗證完已停掉 |
| 代理：Audit Loupe 路徑 → 本機 server | 通過：經 dev server 取得 10/18 overview，`objects 172`、`ops 911`、100 列 |
| 代理：其他路徑照舊轉 Rancher | 通過（驗證時 `API` 用不存在的網址，所以回 598，表示確實轉向 Rancher 那一邊） |
| 容器連 Mac 的 `127.0.0.1` | `host.docker.internal` 可以連到（Rancher Desktop），不用把 server 開到對外 |
| **lint** | **沒辦法跑**：repo 的 `node_modules` 裡是 ESLint 10，不讀 `.eslintrc.js`；改用 ESLint 8 又缺 `eslint-config-standard`。main 上就是這個狀態，不是這次造成的。CI 目前也沒有 lint 這一步。建議另開一張單修 |
| 本機檢視頁（不經 Rancher）截圖 | 10/18、10/20 真實資料：總覽、關係、事件、右側細節、時間列、深色＋英文、只選一個叢集（每分鐘一格）、網址帶時間範圍重開、設定差異選兩個版本都看過。過程中找到並修掉：時間列被擠出畫面、關係圖左三欄跑到畫面外、選取路徑全部被點亮、`/api/history` 是新到舊排序（原本當成舊到新）、找不到執行者時名字空白 |
| 窄螢幕抽屜 | 沒看到：瀏覽器視窗縮不下來，只寫了樣式（1100px 以下） |
| 登入 Rancher 用眼睛看 | 沒做（任務書規定不自己登入） |

## 4. 沒做完、或和規格不同的地方

1. **播放頭**：v0 API 沒有「到某個時間點為止的狀態」參數，在瀏覽器裡重算又違反「不在瀏覽器計算」，所以照規格的退路，先做「拖曳時間列選取範圍」：總覽變淡範圍外的列、事件只列範圍內的。範圍會寫進網址。
2. **叢集篩選**：可多選，後端選幾個叢集就回幾條線；只選一個時後端回每分鐘一格，畫面照畫，不在瀏覽器重算（已截圖確認）。
3. **身分群組展開**：關係圖會照 API 畫群組節點，但「點了展開」需要 API 支援（例如帶參數要求展開某群組），v0 約定沒有，先沒做。
4. **被擱置的行**：事件分頁有欄位位置（`held`、`heldHref`），但 v0 API 沒回這兩個欄位，所以不會出現。
5. **匯出**：目前匯出 API 給的 `detail` 與該列資料。規格要的「原始紀錄、規則設定代碼、雜湊與驗證結果」要等 API 補欄位。
6. **全螢幕與側邊選單收合**：規格說沿用 `al-full`／`al-nav-collapsed`，但這個 repo 的 `ChangeMap.vue` 與 `change-map.scss` 裡沒有這兩個（可能在主 repo 的 mock），這次沒做。
7. **關係圖的節點說明**：身分只顯示分類（例如「人」），沒有「本機帳號，可能多人共用」這類說明，因為關係圖的節點 v0 沒有 `note`。
8. **處理中進度列**：目前只在請求進行中顯示；「重新計算、收集元件重新啟動」這類後端狀態，v0 API 沒提供。

## 5. 給 API 約定的建議（不自己改約定，供軌 B／Sam 決定）

- 關係圖的物件節點 `id` 是 `object:<物件鍵>`，選取時介面要自己去掉前綴；建議在約定裡寫明，或加 `key` 欄位。
- 事件的 `subject`：物件事件是物件鍵、收集事件是叢集 ID，同一個欄位兩種意思。建議分成 `key` 與 `cluster`。
- 管道（`via`）實際值有 `direct`、`impersonation`、`rancher`、`unknown`，約定沒列；介面已對應成「直連 apiserver／Rancher 代理／Rancher／不明」。
- 身分節點也加 `note`（見上面第 7 點）。
- **`detail.dependsOn` 的內容不對題**：實際回的是相關物件（例如「mounts: ConfigMap al-sample/pod-watcher-script」），畫面上就出現「取決於設定：mounts: ConfigMap …」。規格的「取決於設定」是「這筆紀錄有沒有因為設定而看不到的部分」（例如進入容器時是否啟用 SUSE Security 收集）。建議相關物件改放別的欄位，`dependsOn` 只放設定項目。
- 關係圖的線若要準確標出「某個身分經某管道動了某物件」，需要帶路徑的邊（身分→物件），或讓 `select` 時回傳該物件的路徑。

## 6. 改了哪些檔案

- 新增：`pages/ChangeMapV5.vue`、`components/v5/`（`StateTag`、`OverviewTable`、`DetailPanel`、`EventsList`、`RelationsGraph`、`TimelineBar`）、`lib/v5.js`、`styles/change-map-v5.scss`。
- 修改：`routing.js`（「變更地圖」改用 v5，舊頁留在 `changes-v4`）、`lib/api.js`（`getJson` 接受可重複的參數，例如多個 `cluster`）。
- 開發設定：`vue.config.js`（`AL_LOCAL_API` 代理規則，會拿掉 Rancher 的 cookie 與 authorization 才轉出去）、`scripts/dev.sh`（傳入 `AL_LOCAL_API`；`PORT`、`NAME` 可改）。
- 規格：`docs/design/v5/`（原本在主工作目錄未 commit，複製進來一起 commit）。
