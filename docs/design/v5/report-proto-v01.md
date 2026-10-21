# 軌 3 報告：介面配合 API v0.1（10/21 第二批）

依據：`~/audit-loupe/docs/lab/parallel-1021b-task.md` 的「軌 3」。分支 `feat/v5`，PR #4（https://github.com/yansheng133/audit-loupe-ui/pull/4）。開始 14:40。

**一句話結論**：雲端做好的 patch 照原樣套上了（sha256 相符），lint、build、PR #4 的 CI 都通過，dev server 編譯成功；對照時發現一個版面問題（第 3 節第 1 點），照任務書規定沒有自己改。3-8 透過 dev server 的代理確認過：軌 1 更新後的本機 server 回的新欄位都拿得到。

## 1. 步驟對照表

| 步驟 | 做了什麼 | 證據 |
|---|---|---|
| 3-1 | 比對 patch 的 sha256，再用 `git am` 套用 | sha256 `9c6fc471…19f3`，和 README 一樣；套用前 `HEAD`＝`origin/feat/v5`＝`bbc478c`；`git am` 成功，產生 commit `9e84be9`。改了 5 個檔，全部是 v5 的檔案（`ChangeMapV5.vue`、`components/v5/DetailPanel.vue`、`components/v5/OverviewTable.vue`、`lib/v5.js`、`styles/change-map-v5.scss`） |
| 3-2 | 逐項對照 README 的「做了什麼」表、任務書原本的 3-1～3-6，以及 `docs/api/changemap-v0.md` 的「v0.1 變更」 | 六項都有對應的程式。有 3 個地方和約定或版面對不上，寫在第 3 節，**沒有改** |
| 3-7 | `yarn lint`、`yarn build-pkg audit-loupe`（SUSE BCI Node 24 容器）→ push（不 force）→ 啟動 dev server、確認編譯 → 停掉 | lint：`eslint --max-warnings 0 .` 結束碼 0。build：結束碼 0，只有原本就有的 3 個 webpack 大小建議（bundle 從 296 KiB 變 300 KiB）。push：`bbc478c..9e84be9`。dev server（`PORT=8006`，`AL_LOCAL_API=http://host.docker.internal:18090`，`API` 填假網址）：`Compiled successfully in 14741ms`，之後 `docker stop`。沒有登入 Rancher。CI（run 39557056974）：「Find Extensions to Build」通過、「Test build audit-loupe」通過 |
| 3-8 | 確認軌 1 已完成 1-9，再開 dev server，透過代理確認新欄位拿得到；做完停掉 | 確認方式是 `/api/changemap/detail?key=x` 改回 400：14:43 還是 404，14:43:50 變成 400。透過 `https://127.0.0.1:8006/k8s/clusters/local/.../proxy` 打 10/17～10/21 都是 200，`meta`、整批列、不透明 cursor、`related`、detail API 都拿得到，細節見第 5 節 |
| 3-9 | push（不 force）本報告，更新 PR #4 描述 | 本報告的 commit；PR #4 描述加上 v0.1 這一節 |

## 2. 卡住的地方

沒有。

## 3. 任務書沒寫但我做了的事

- **lint 與 build 用了另一個 node_modules volume**：在容器裡跑 `yarn lint`、`yarn build-pkg` 時，我用了暫時的 volume `audit-loupe-ui-v5-nm`，沒有用 `scripts/dev.sh` 的 `audit-loupe-ui-node-modules`。原因是 Sam 的 dev server（`audit-loupe-ui-dev`，8005）正在用那個 volume，`yarn install` 寫進去可能影響它；上一批也是這樣做。3-9 收尾時刪掉了這個暫時的 volume。dev server 那一步是直接執行 `scripts/dev.sh`，沒有改它。

## 4. 3-2 對照結果

| 任務書原本的項目 | patch 裡的做法 | 結果 |
|---|---|---|
| 整批列 | `batch: true` 或 `name` 是 `*` 的列顯示「整批」，滑鼠移上去說明是沒有名稱的寫入，並附上資源名稱；右側細節的標題也一樣 | 一致 |
| cursor 原樣帶回 | 沒有改，原本就是原樣帶回 `next` | 一致 |
| 設定與相關物件分開 | `dependsOn` 的物件顯示成「取決於設定：<setting>」加上 `text`；`related` 另外列在「相關物件」；舊後端放在 `dependsOn` 的字串當成相關物件 | 一致 |
| 點一列只打 detail | 只有 `select` 變了，就呼叫 `GET /api/changemap/detail`；回 404 時改打整頁 | 一致，但多帶了一個參數，見下面第 3 點 |
| `meta` 提示 | 有 `meta` 時，在分頁列下方顯示一行：`dataNote`、「資料最後一筆」的日期與時間 | 內容一致，但版面有問題，見下面第 1 點 |
| 相容舊回應 | 沒有 `related`、`meta`、detail API 時都有退路 | 一致 |

對不上的地方（照任務書規定，都**沒有改**）：

1. **有 `meta` 時版面會跑掉。**
   - 原因：v5 的版面是固定 4 列的格線，依序是 `44px 3px minmax(0,1fr) auto`，分別給分頁列、進度條、主畫面、時間列。patch 在分頁列和進度條中間多放了一個提示的元素，畫面變成 5 個元素。
   - 結果：提示會被擠進 3px 那一列；進度條拿到會撐滿高度的那一列；主畫面變成只有內容高度；時間列被推到格線外多出來的一列。上一批遇過同一種問題：時間列被擠出畫面。
   - 什麼時候會發生：後端設了 `AL_DATA_NOTE` 才會出現。軌 1 的 1-10 會把它設起來，所以那之後打開 v5 就會看到。
   - 建議改法：格線多加一列，例如 `44px auto 3px minmax(0,1fr) auto`，提示一律放在那一列，沒有 `meta` 時內容空白。
2. **提示的顏色變數名稱不一樣**：`.al5-note` 用的是 `--muted`、`--border`，其他 v5 樣式用的是 `--al-muted`、`--al-border`（有預設值）。在 Rancher 裡看起來一樣，脫離 Rancher 的主題就沒有預設顏色。影響很小。
3. **detail API 多帶 `system=1`**：約定寫的是 `GET /api/changemap/detail?day=&key=`，patch 在勾了「顯示系統帳號」時多帶 `system=1`。後端不認得這個參數就忽略，不會出錯；要不要把它寫進約定，由軌 1 或 Sam 決定。

另外確認過：改的 5 個檔都在本軌允許的範圍內；舊頁、lint 設定、`vue.config.js`、`scripts/dev.sh` 沒有被動到（`git show --stat 9e84be9`）。
4. **detail API 回 404 時，分不出是舊後端還是找不到物件**：新後端遇到不存在的物件鍵也回 404（3-8 實測：`key=local//pods/x/does-not-exist` 回 404）。patch 收到 404 一律當成舊後端，改打整頁。結果只是多打一次整頁，畫面不會錯。要分清楚的話，可以看回應內容，或在約定裡另外定一個狀態碼。

## 5. 3-8 透過代理實測（軌 1 更新後的 18090）

dev server：`API=https://x AL_LOCAL_API=http://host.docker.internal:18090 PORT=8006 NAME=audit-loupe-ui-v5-dev scripts/dev.sh`，`Compiled successfully in 13208ms`。下面的請求全部打 `https://127.0.0.1:8006/k8s/clusters/local/api/v1/namespaces/audit-loupe-system/services/http:audit-loupe:8080/proxy/...`，也就是瀏覽器實際會打的路徑。做完 `docker stop`。

| 日期 | HTTP | 大小 | 列數（第 1 頁） | 整批列 | `next` | `related`（預設選取） |
|---|---|---|---|---|---|---|
| 10/17 | 200 | 73,410 B | 100 | 2 | 字串 | 0 |
| 10/18 | 200 | 72,598 B | 100 | 0 | 字串 | 2 |
| 10/19 | 200 | 74,736 B | 100 | 3 | 字串 | 2 |
| 10/20 | 200 | 72,845 B | 100 | 2 | 字串 | 0 |
| 10/21 | 200 | 10,692 B | 3 | 0 | `null` | 1 |

- **`meta`**：5 天都有，`dataNote` 是「原型：資料是 10/17–10/21 的 lab 資料庫副本，不是即時資料」（軌 1 的 1-10 已經設好），也有 `dataUntilMs`。所以第 4 節第 1 點的版面問題，現在打開 v5 就會出現。
- **整批列**：例如 10/19 有 `pods/al-sample/*`（Pod）、`ext.cattle.io/selfuser//*`、`catalog.cattle.io/clusterrepos/rancher-ui-plugins/*`，都是 `batch: true`、`name` 是 `*`。
- **cursor**：`next` 是一串看不出意思的字串。照原樣帶回 `cursor=`，10/20 第 2 頁回 200、100 列，`next` 仍是字串。
- **`related`**：10/18 預設選取的物件有 `mounts` ConfigMap 與 `runs_as` ServiceAccount，格式和約定一樣（`rel`、`kind`、`namespace`、`name`）。
- **detail API**：10/18、10/20 用預設選取的物件鍵打 `/api/changemap/detail`，回 200。排序欄位後，和整頁回應附的 `detail` 完全相同。多帶 `system=1` 也回 200，內容相同。不存在的物件鍵回 404。
- **`dependsOn` 的設定項目**：每天第 1 頁前 15 個 Pod 的 detail 都是空陣列，所以這次沒看到「取決於設定」那一塊的真實資料。有 exec 的 Pod 由軌 1 的 1-4 驗證。
- 只確認了 API 回應。沒有登入 Rancher，所以沒在瀏覽器裡看畫面，任務書也沒有要求。
