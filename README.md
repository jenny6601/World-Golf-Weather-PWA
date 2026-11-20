# World Golf Weather PWA

亞洲高爾夫球場天氣資訊 Progressive Web App。

## 專案原則

- 本 Repository 與 Taiwan Golf Weather PWA 完全獨立。
- 以 Taiwan Golf Weather PWA 完整版的介面與呈現邏輯作為設計母版；不採用 compact 版本。
- 不連結或寫入台灣版的快取分支、資料儲存或 GitHub Actions。
- 初期涵蓋日本、南韓、中國、越南、泰國、馬來西亞、新加坡、印尼。
- 每座球場以 GPS 座標對應 IANA 時區；印尼等跨時區國家不可只用國家名稱推定時區。
- 球場官方地址、地圖定位地址及資料驗證狀態分欄保存；未驗證資料不得偽裝成官方資料。
- 搜尋以本地索引優先，支援正式名稱、別名、拼寫容錯、城市、行政區、國家、地址及當地語言。
- 天氣觀測、預報與模型估算必須標示來源及資料時間，不得混為同一種資料。

## 目錄規劃

- `index.html`：PWA 入口與主要介面（從完整版母版移植後再改造）。
- `manifest.json`：獨立 PWA 安裝資訊。
- `sw.js`：獨立 Service Worker 與快取命名空間。
- `pwa/`：安裝及 PWA 啟動程式。
- `icons/`：World Golf Weather 圖示。
- `data/courses/`：亞洲球場資料集。
- `src/search/`：球場搜尋、排序及索引。
- `docs/`：資料規格、來源及驗證政策。

## 初期國家

Japan, South Korea, China, Vietnam, Thailand, Malaysia, Singapore, Indonesia.

## 目前狀態

Repository 已建立。正在建立與台灣版隔離的前端母版、球場資料模型及搜尋系統。尚未部署，也尚未啟用全球天氣資料收集流程。

## 安全邊界

不得將台灣版的自動化 workflow 原樣複製到本專案。所有新 workflow 必須使用本 Repository 專屬的資料來源、快取分支、Secrets 及部署設定。
