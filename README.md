# H. pylori 除菌決策工具

成人幽門桿菌除菌的互動決策工具，含示範病例 6 例、考題 20 題（基礎 10、高階 10）與心智圖。

線上版：https://yht5582-source.github.io/H-pylori/

## 依據

- ACG Clinical Guideline, Am J Gastroenterol 2024（僅讀摘要，細節來自 UIC FAQ 與 G&H 2026 整理）
- Maastricht VI/Florence, Gut 2022
- Taipei Global Consensus II, Gut 2025
- 台灣 2019–2024 抗藥性：WJG 2025 社論轉述的 1408 株研究（原始論文未讀）

三份指引意見不同時，頁面會並列呈現，例如三合一失敗後能否用 Levofloxacin。

## 尚未查證

- 台灣健保給付與院內品項（Vonoprazan、Rifabutin、鉍劑等）
- 高劑量雙重療法的原始試驗劑量（沿用舊版）
- Vonoprazan 與 Tetracycline 或 Minocycline 雙重療法的劑量（因此頁面不列）
- P-CAB 檢測前停藥天數（工具假設至少比照 PPI）

## 檔案

- `index.html`：單一頁面，無第三方相依。決策引擎在 `/*ENGINE-START*/`，教學內容在 `/*TEACH-START*/`
- `sw.js`、`manifest.webmanifest`、`icon.svg`：離線與加入主畫面
- `tests.cjs`：`node tests.cjs`，含所有輸入組合的安全檢查

更新內容後，請同步修改 `sw.js` 的 `CACHE` 版本。推送到 `main` 即部署（GitHub Pages）。

## 聲明

本工具僅為臨床決策輔助，不適用於孕婦、哺乳者與兒童。實際處方須由醫師依病人肝腎功能、併用藥與藥品可近性判斷。所有運算在瀏覽器內完成，不儲存也不傳送資料。
