# World Golf Weather PWA

亞洲高爾夫球場天氣資訊 Progressive Web App。

## 專案原則
- 本 Repository 與 Taiwan Golf Weather PWA 完全獨立。
- 以 Taiwan Golf Weather PWA **完整版**作為天氣介面與呈現邏輯母版；不採用 compact 版本。
- 不連結或寫入台灣版的資料快取、資料分支或 GitHub Actions。
- 初期涵蓋日本、南韓、中國、越南、泰國、馬來西亞、新加坡、印尼。
- 每座球場以球場座標對應 IANA 時區；印尼等跨時區國家不可只用國家名稱推定時區。
- 官方地址、地圖地址、座標及驗證狀態分欄保存；未驗證資料不得偽裝成官方資料。
- 搜尋支援正式名稱、別名、拼寫容錯、城市、行政區、國家及地址；本地索引優先。
- 天氣觀測、預報與模型估算必須標示來源及資料時間，不得混為同一種資料。

## 目前開發狀態（development branch）
- 已移植完整版本的主要天氣介面及預報運算程式。
- 已建立亞洲國家篩選、文字搜尋、模糊比對、收藏及最近搜尋介面。
- 已建立 41 筆亞洲球場名錄：7 筆 GPS 已核實、13 筆部分核實、21 筆尚未核實。
- 日本：5 座 GPS 已核實；Camellia Hills 已核實名稱及地址，GPS 待補。
- 南韓：Nine Bridges、Black Stone Jeju 已核實 GPS；其他 3 座已核實名稱及地址，GPS 待補。
- 中國：觀瀾湖深圳、觀瀾湖東莞、佘山、亞龍灣已建立名稱／地址來源，GPS 待補；山欽灣仍待核實。
- 越南：Ba Na Hills、Hoiana Shores、Laguna Lang Co、Legend Da Nang、Montgomerie Links 已核實官方名稱及地址，GPS 待補。
- 泰國、馬來西亞、新加坡、印尼仍為待核實候選。沒有座標的球場不會使用推測座標，天氣查詢保持停用。
- 全球即時觀測／METAR 尚未接入；介面明確顯示未接入，不以預報冒充實測。
- 亞洲獨立預報快取尚未啟用；目前天氣預報查詢改走 Open-Meteo 即時 API。
- PWA manifest、獨立 Service Worker 快取名稱、離線頁及圖示已建立。
- 尚未部署 Cloudflare Pages，也尚未合併至 main。

## 目錄
- `index.html`：完整版天氣介面及亞洲球場搜尋。
- `manifest.json`、`sw.js`、`offline.html`、`pwa/`：獨立 PWA。
- `icons/`：App 圖示。
- `data/courses/asia-courses.json`：亞洲球場名錄。
- `data/schemas/course.schema.json`：球場資料 schema。
- `docs/COURSE-SEARCH-SPEC.md`：搜尋規格。
- `docs/PORTING-STATUS.md`：母版移植狀態及驗收清單。

## 安全邊界
不得將台灣版自動化 workflow 原樣複製到本專案。所有新 workflow 必須使用本 Repository 專屬資料來源、快取分支、Secrets 及部署設定。
