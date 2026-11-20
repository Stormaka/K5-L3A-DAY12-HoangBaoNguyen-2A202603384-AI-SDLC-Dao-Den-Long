# Changelog

## v1.0.0 / phase-4 — Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3

Ghi chú và giả định: [docs/notes/phase-4.md](docs/notes/phase-4.md). Số đo: [docs/proof/phase-4/](docs/proof/phase-4/). Retro: [docs/retro.md](docs/retro.md).

### ⚠ Breaking changes
- **`run_cmd`:** đổi từ `npm start` thành `node server.js`. `npm start` vẫn chạy được, nhưng npm không chuyển tiếp tham số `--export-leaderboard` sang server.
- **Phím tạm dừng mặc định:** `P` (đổi được). `Esc` vẫn tạm dừng, trừ khi người chơi gán `Esc` cho hành động khác.
- **`game.contract.json` v1.3:** thêm `bench_cmd`, `soak_cmd`; mọi khóa v1.0–v1.2 giữ nguyên.

### Thêm mới
- **Benchmark** `node scripts/bench.js --seed 42 --duration 30 --out bench.json`:
  - Chạy cảnh chuẩn: Đêm 1, 200 Bóng Mực, 100 đom đóm, L1–L3 sáng, camera bay vòng.
  - Chrome mở có cửa sổ, viewport 1280×720, tắt vsync. Tính avg / 1% thấp / p95, thời gian tải, đỉnh bộ nhớ.
- **Soak test** `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json`:
  - 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed.
  - Đo bộ nhớ ổn định ở đầu và cuối.
- **Bảng xếp hạng cục bộ:**
  - Nhập tên sau Bình Minh hoặc khi thua; tên 3–12 ký tự, nhận chữ có dấu tiếng Việt.
  - Lưu top 10 vào `data/leaderboard.json`; xem từ menu.
  - Xuất bằng `node server.js --export-leaderboard out.json`.
- **Dễ tiếp cận:**
  - Đổi phím cho 11 hành động, báo trùng phím, khôi phục mặc định.
  - Phụ đề / chỉ báo: Bóng Mực xuất hiện kèm mũi tên ở mép màn hình, gió sắp thổi, 10 giây cuối, đèn sắp cạn dầu.
  - Giảm chuyển động. Chữ ≥ 18 px, tùy chọn chữ lớn ×1.25.
- **Đóng gói:**
  - `npm run package` tạo bản Release chạy bằng `node server.js`, không cần `npm install`.
  - Thêm `Dockerfile`.
  - README cho bản phát hành; CREDITS đầy đủ.

### Hiệu năng
- Bóng Mực và đom đóm vẽ bằng `InstancedMesh`; tia hút dầu gộp vào một `LineSegments`.
- Sim: bỏ việc sao chép và sắp xếp mảng đèn ở mỗi tick. Mỗi tick nhanh hơn khoảng 7 lần; đầu ra headless giống từng byte.
- Kết quả bench trên máy dev: avg 315.1 FPS, 1% thấp 34.5 FPS, tải 2.2 s (bench.json). Đo lặp khi chạy pin: 1% thấp 18.2–34.5, xem docs/proof/phase-4/README.md.
- Sau khi agent chấm độc lập phát hiện, cảnh bench được sửa để cả 200 Bóng Mực di chuyển suốt buổi đo (A4-14). `bench.js` báo rõ khi Node < 22. Thêm `.gitattributes` để file bằng chứng `.jsonl` giữ nguyên byte trên mọi hệ điều hành.

## phase-3 — Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md). Giả định và test bị đổi: [docs/notes/phase-3.md](docs/notes/phase-3.md).

### ⚠ Breaking changes
- **Luật thắng:**
  - Không còn thắng ngay khi thắp hết đèn.
  - Chỉ thắng ở bình minh, khi Mây còn sống và có ≥ ceil(0.6 × tổng) đèn **đang sáng**.
  - `game_over.reason` có thêm `dawn_survived`; **`all_lit` bị bỏ**.
- **Thời lượng Đêm:** 300/330/360 s → **240/270/300 s** (`night1..3_duration_s`).
- **Đèn có thể tắt:**
  - Đèn có dầu 0–100, hao 1/s, bị Bóng Mực hút 5/s.
  - Hết dầu → `lantern_out`, `lit:false`, `deposited:0`.
  - Đèn đã sáng giờ **nhận thêm đom đóm** (châm dầu).
- **Vùng an toàn:** chỉ còn khi `fuel ≥ 30`. Bóng Mực **có thể** vào vùng của đèn yếu.
- **Bóng Mực:**
  - Thêm trạng thái `drain`.
  - `wander` nay đi tới đèn yếu; nếu không có thì tới đèn tắt gần nhất (cũ: lang thang giữa các điểm sinh đom đóm).
  - Hết choáng → `wander` (cũ: `chase` nếu Mây trong 12 m).
- **Điểm:**
  - `per_mote` 10 → **5**, tính cho mọi đom đóm nạp vào (thắp, thắp lại, châm dầu).
  - +40 thắp lại.
  - +15 cho Tỏa Sáng trúng bóng đang hút.
  - **Bỏ thưởng thời gian** (`per_second_left` = 0).
  - Thưởng bình minh, chỉ khi thắng: 50 + floor(dầu) mỗi đèn sáng, +50 mỗi Ngọn Lửa.
- **Sức chứa:** không còn cố định 10. Nay là 10 + 2 × số lần thắp thành công trong Đêm, tối đa 20.
- **Contract v1.2:**
  - `contract_version` "1.2".
  - Tuning thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
  - Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`; player thêm `capacity`.
  - Scenario thêm `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.
  - Sự kiện mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` có thêm `relight`.
- **Dung sai "trong bán kính r":** 1e-9 → 1e-6 m. Kết quả ở 3 chữ số thập phân không đổi.

### Thêm mới
- Thanh dầu trên đèn. Đèn dưới 30 dầu nhấp nháy 1 Hz. Có tia hút dầu nối Bóng Mực với đèn.
- Cài đặt "Bảng màu dễ phân biệt" (được lưu):
  - Bóng Mực màu #00B3FF.
  - Cảnh báo màu trắng kèm ⚠.
  - Đèn tắt xẹp 20% và có vết rách.
- HUD:
  - Đang mang/sức chứa (tới 20 ô).
  - "Đèn sáng k/n (cần m)".
  - Gợi ý Thắp / Thắp lại / Châm dầu.
- Kiểm chứng:
  - 12 test Phase 3.
  - 9 kịch bản headless mới (tổng 28).
  - Bot theo chiến lược giữ đèn tới bình minh.
  - Làm nóng shader khi bắt đầu Đêm.

## phase-2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1
- Số liệu chuẩn của ticket thay toàn bộ số tự chọn ở Phase 1. Thứ tự xử lý trong một tick theo ticket.
- 3 Đêm với bản đồ chuẩn:
  - Đêm 1: Đảo Bến.
  - Đêm 2: Đảo Cau, gồm 2 đảo, cầu tre và bục nhảy.
  - Đêm 3: Đảo Chuông, gồm 3 tầng, dốc, bục nhảy, tháp chuông và gió.
- Lướt, rơi khỏi đảo, đom đóm rơi có thời hạn, vùng an toàn đẩy Bóng Mực, trạng thái Bóng Mực spawning/wander/chase/recoil/stunned.
- Gió Lạc, Bùa Gió, tạm dừng.
- Client web:
  - Menu → giới thiệu Đêm → kết quả → Bình Minh.
  - Cài đặt được lưu lại, âm thanh WebAudio.
  - HUD đầy đủ, mũi tên chỉ đèn, bảng màu chuẩn.
- Headless v1.1: `--night 1..3`, các trường snapshot, scenario, input và sự kiện mới.
- Kiểm chứng:
  - 53 test.
  - 19 kịch bản headless tất định.
  - Bot tìm đường thắng được cả 3 Đêm.
  - Đo FPS bằng Chrome DevTools Protocol.

## phase-1 — PRD-0 + Test Contract v1.0
- Đêm 1 – Đảo Bến: di chuyển, nhảy, camera 3D, đom đóm, nạp đèn, Bóng Mực đuổi, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless tất định + game.contract.json.
- 26 test tự động, 5 kịch bản headless có bằng chứng, hook Stop chặn khi test đỏ, CI.
