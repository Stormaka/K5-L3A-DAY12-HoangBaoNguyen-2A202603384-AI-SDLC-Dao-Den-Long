# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3

## 1. Ticket yêu cầu gì

1. Benchmark có cảnh chuẩn: ngưỡng avg ≥ 60 FPS, 1% thấp ≥ 30 FPS, tải ≤ 10 s.
2. Soak test 10 Đêm trong một tiến trình: 0 crash, bộ nhớ ≤ ×1.2.
3. Bảng xếp hạng cục bộ: top 10, lưu trên đĩa, có lệnh xuất.
4. Dễ tiếp cận: đổi phím, phụ đề / chỉ báo hình ảnh, giảm chuyển động, chữ ≥ 18 px, chữ lớn.
5. Đóng gói: clone rồi chạy được trong ≤ 3 lệnh; README, CHANGELOG, CREDITS, LICENSE; Release v1.0.0.
6. Contract v1.3: thêm `bench_cmd`, `soak_cmd`.
7. Retro và video demo.

## 2. Giả định

| # | Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|---|
| A4-01 | "Bóng Mực di chuyển theo luật wander" trong bench | Trong bench, Bóng Mực **không phát hiện Mây** (không chuyển sang `chase`), chỉ `wander`: đi tới đèn tắt gần nhất (luật Ticket-03). Ba đèn sáng không bao giờ yếu vì dầu không hao, nên không có `drain` | Cảnh phải giống nhau giữa các bài; sát thương đã tắt nên `chase` không có ý nghĩa |
| A4-02 | "Rải đều trên đảo" | Phân bố đều theo diện tích trên đĩa bán kính 39 m: r = 39·√u, góc = 2πv, rng seed 42 (`src/sim/bench.js`) | Đều theo diện tích, không dồn vào tâm |
| A4-03 | Soak: "Đêm thứ i dùng seed 7 + i" | i đếm từ 1: Đêm 1 dùng seed 8, …, Đêm 10 dùng seed 17. Input lấy từ một rng riêng (seed ⊕ 0x5eed). Mỗi Đêm chạy tới khi kết thúc hoặc hết thời lượng chuẩn | "Đêm thứ i" là thứ tự đếm từ 1 |
| A4-04 | Cách đo RSS trong soak | Trước khi đo Đêm 1 có một lượt khởi động JIT (3000 tick mỗi Đêm, seed 0, không tính vào kết quả). `mem_start` và `mem_end` đều đo bằng cùng một cách: GC → chờ 300 ms → GC → RSS. `soak_cmd` dùng `node --expose-gc` | Nếu không làm vậy, RSS dao động 48–58 MB tùy thời điểm V8 trả bộ nhớ (xem [soak-60-nights.json](../proof/phase-4/soak-60-nights.json): không tăng dần), và `mem_end` có thể rơi đúng đỉnh |
| A4-05 | `peak_mem_mb` của bản web | Tổng bộ nhớ của **cây tiến trình trình duyệt** (main + GPU + renderer + utility). Trên Windows đọc `PeakWorkingSetSize` **một lần sau khi đo** (cận trên); trên Linux/macOS lấy mẫu `ps` mỗi 2 s | Lấy mẫu bằng PowerShell/WMI trong lúc đo làm 1% thấp tụt từ ~90 xuống ~22 FPS |
| A4-06 | Tắt vsync | Cờ Chromium `--disable-gpu-vsync --disable-frame-rate-limit`; `vsync_off: true` | Trình duyệt không cho tắt vsync từ trong trang |
| A4-07 | Cửa sổ 1280×720 | Chrome chạy có cửa sổ (`--app`), viewport được ép đúng 1280×720 với `devicePixelRatio` 1 qua `Emulation.setDeviceMetricsOverride`; renderer dùng pixel ratio 1 | Kích thước cửa sổ Chrome tính cả thanh tiêu đề |
| A4-08 | Chọn GPU | Cờ `--force_high_performance_gpu`; trang cũng xin `powerPreference: 'high-performance'` | Máy hai GPU chạy cảnh 3D trên GPU rời như một game bình thường |
| A4-09 | Lưu bảng xếp hạng "trên đĩa" | Server (`node server.js`) ghi `data/leaderboard.json` (ghi file tạm rồi đổi tên, nên không hỏng file giữa chừng). Chỉ khi trang được mở từ một host tĩnh không có API thì mới lưu vào localStorage | Trình duyệt không ghi file được; server là một phần của game |
| A4-10 | `run_cmd` | Đổi từ `npm start` sang `node server.js` | `npm start --export-leaderboard f` sẽ bị npm nuốt mất tham số |
| A4-11 | Tên hợp lệ | `^[\p{L}\p{N}_]{3,12}$` sau khi chuẩn hóa NFC (điểm cộng: nhận chữ có dấu); thời điểm lưu theo giờ địa phương kèm múi giờ (ví dụ `+07:00`); bằng điểm thì so thời điểm theo UTC | |
| A4-12 | `score` và `nights_won` khi thua | Điểm = tổng các Đêm đã thắng trong lượt chơi này (Đêm đang thua không tính); `seed` = seed của Đêm đầu tiên trong lượt chơi | "Tổng điểm các Đêm đã thắng" |
| A4-13 | Phím Esc | Luôn mở tạm dừng, trừ khi người chơi gán Esc cho hành động khác. Phím tạm dừng mặc định đổi được (mặc định `P`) | |

## 3. Tiêu chí nghiệm thu → bằng chứng

| Mục | Tiêu chí | Kiểm chứng |
|---|---|---|
| §1 Benchmark | Cảnh chuẩn: 200 `wander` + 100 đom đóm + L1–L3 dầu 100; không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc; camera (30,15,0) quay ngược chiều kim đồng hồ, 15 s/vòng; công thức avg / p1 / p95 | P4-04, P4-05, P4-06; [bench.json](../proof/phase-4/bench.json); ảnh [bench-scene](../proof/phase-4/img/bench-scene.png) |
| §1 Ngưỡng | avg ≥ 60, 1% thấp ≥ 30, tải ≤ 10 s | bench.json: **243.6 / 74.4 FPS, 1917 ms** (máy dev). Đo lặp: avg 231–320, 1% thấp 44.6–92.2 |
| §2 Soak | 10 Đêm 1→2→3 trong 1 tiến trình, seed + i, input ngẫu nhiên đúng tỉ lệ, 0 crash, mem ≤ ×1.2 | P4-07; [soak.json](../proof/phase-4/soak.json): **0 crash, 47.4 → 48.3 MB (×1.02)**; 60 Đêm: 46.9 → 49.4 MB |
| §3 Bảng xếp hạng | Tên 3–12, top 10, điểm giảm dần / bằng điểm thì sớm hơn đứng trên, lưu đĩa, còn sau khi mở lại, lệnh xuất đúng thứ tự, màn hình từ menu, nhập tên sau Bình Minh hoặc khi thua | P4-01, P4-02, P4-03; ảnh [leaderboard](../proof/phase-4/img/leaderboard.png), [save-score](../proof/phase-4/img/save-score.png) |
| §4 Đổi phím | 11 hành động, báo trùng phím, khôi phục mặc định, được lưu | Ảnh [keys-duplicate](../proof/phase-4/img/keys-duplicate.png). Bấm phím thật **chưa kiểm chứng tự động** |
| §4 Phụ đề | Bóng Mực xuất hiện + mũi tên ở mép màn hình; gió sắp thổi; 10 s cuối; đèn < 30 dầu | Ảnh [captions](../proof/phase-4/img/captions.png) (Bóng Mực + mũi tên). Ba loại còn lại có trong code (`visualCues()`), **chưa có ảnh riêng** |
| §4 Giảm chuyển động | Tắt rung camera và chớp màn hình | Code: `body.reduce` ẩn `#flash`/`#hurt`; rung chỉ chạy khi `!settings.reduceMotion`. **Chưa kiểm chứng bằng mắt** |
| §4 Cỡ chữ | ≥ 18 px ở 1280×720, tùy chọn ×1.25 | CSS: `html { font-size: 18px }`, mọi cỡ chữ ≥ 1rem (đã grep); ảnh [large-text](../proof/phase-4/img/large-text.png) |
| §5 Đóng gói | ≤ 3 lệnh; bản Release chạy được không cần npm | `npm run package`; đã thử chạy gói trên máy (server 200, 73/73 test bên trong gói); Dockerfile |
| §6 Contract v1.3 | `bench_cmd`, `soak_cmd`, các khóa v1.0–v1.2 giữ nguyên | P4-08, C-01 |
| DoD | Test ẩn Phase 1–3 vẫn đạt | 65 test cũ + 28 kịch bản headless; các file `runs/*.jsonl` của Phase 3 **giống từng byte** sau khi tối ưu sim |

## 4. Tối ưu hiệu năng đã làm (có đo trước / sau)

| Thay đổi | Trước | Sau |
|---|---|---|
| Bóng Mực + đom đóm vẽ bằng `InstancedMesh`, tia hút gộp vào một `LineSegments` (khoảng 1300 draw call → khoảng 8) | avg 50.8 / 1% thấp 19.6 FPS (GPU Intel) | avg 110 / 22.8 |
| Sim: bỏ việc sao chép và sắp xếp mảng đèn ở mỗi tick cho từng Bóng Mực (đèn vốn đã theo thứ tự id) | 0.78 ms mỗi tick, max 11 ms | 0.107 ms mỗi tick, max 5.7 ms. Đầu ra headless không đổi |
| Không lấy mẫu bộ nhớ bằng PowerShell trong lúc đo (A4-05) | 1% thấp 21–30 | 1% thấp 44–100 |
| Chọn GPU rời (A4-08) | GPU Intel UHD | RTX 5050 |

## 5. Nhật ký dùng AI (Phase 4)

- Quy trình:
  1. Đọc ticket, rồi thêm chế độ bench vào sim (cờ nội bộ, không qua scenario, nên đầu ra headless không đổi).
  2. Viết module bảng xếp hạng thuần + API trên server + lệnh xuất; viết `soak.js`; viết `bench.js` (Chrome qua CDP).
  3. Đo, thấy chưa đạt, tìm nguyên nhân bằng cách gắn đo đạc theo từng khung, rồi tối ưu (bảng §4).
  4. Thêm phần dễ tiếp cận, chụp ảnh, đóng gói, viết tài liệu.
- **Token/chi phí ước tính cho Phase 4:** khoảng 300–400k token input và 60–80k token output. _Thay bằng số thật từ `/cost` hoặc trang usage._

### Lỗi của AI và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Đổ lỗi cho GPU / số draw call trong khi khung giật thật ra đến từ **chính công cụ đo** (PowerShell/WMI chạy trong lúc đo) | Gắn đo đạc cho 12 khung chậm nhất: JS ~1 ms, render 2–7 ms, nhưng "late" (trình duyệt trễ) 11–18 ms | Không chạy gì trong cửa sổ đo (A4-05) |
| Đo "sync" sai vì lấy mốc `now` của rAF (đã gồm độ trễ trước callback) | Con số không khớp tổng thời gian khung | Đặt mốc `performance.now()` ngay trước `sync()` |
| Kết luận soak "phẳng" chỉ từ 3 lần chạy may mắn | Lần chạy chính thức ra ×1.18 | Chạy lặp 5–6 lần cho mỗi cấu hình, chạy 60 Đêm để thấy dao động; đo RSS đã ổn định cho cả hai đầu (A4-04) |
| Thử `--min-semi-space-size` để làm đẹp số bộ nhớ | Mức nền nhảy lên 76 MB mà tỉ lệ không cải thiện rõ | Bỏ: cách đó che vấn đề chứ không đo đúng hơn |
| Lại hỏng ký tự `\` khi vá file bằng `node -e` trong bash | Lỗi cú pháp ngay khi chạy | Dùng công cụ Edit cho dòng có `\` |
| Ảnh phụ đề đầu tiên trống | Mở ảnh ra xem | Tính lại thời điểm tick 300 so với ngân sách thời gian ảo của Chrome headless |

## 6. Đánh giá Phase 4

- **Đạt, có số đo:**
  - Benchmark vượt ngưỡng nhiều lần trên máy dev.
  - Soak: 0 crash, bộ nhớ ×1.02.
  - Bảng xếp hạng và lệnh xuất có test.
  - Contract v1.3.
  - Gói Release chạy được không cần npm.
  - 73/73 test, 28/28 kịch bản headless.
- **Rủi ro:**
  - Máy chấm có thể không có Chrome; `bench.js` báo lỗi rõ ràng và cho chỉ định đường dẫn.
  - Trên GPU tích hợp yếu, 1% thấp có thể sát 30. Đã giảm draw call, nhưng chưa có LOD và đèn vẫn dùng point light động.
- **Chưa kiểm chứng (người chơi):**
  - Đổi phím bằng bàn phím thật.
  - Nghe hiệu ứng.
  - Nhìn chế độ giảm chuyển động.
  - Lưu tên có dấu qua giao diện.
  - **Video demo phải do bạn tự quay** (xem [docs/demo/README.md](../demo/README.md)).
- **Release v1.0.0** cần tạo trên GitHub (máy dev không có `gh`). Hướng dẫn ở [docs/demo/README.md](../demo/README.md).
