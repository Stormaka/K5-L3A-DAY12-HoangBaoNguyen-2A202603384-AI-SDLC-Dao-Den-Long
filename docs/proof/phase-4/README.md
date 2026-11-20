# Bằng chứng Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Chạy lại (ở tag `phase-4`):

```bash
npm install && npm test && npm run proof
node scripts/bench.js --seed 42 --duration 30 --out bench.json
node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json
```

| File | Nội dung |
|---|---|
| [bench.json](bench.json) | Benchmark tự chạy (máy dev) |
| [soak.json](soak.json) | Soak 10 Đêm tự chạy |
| [soak-60-nights.json](soak-60-nights.json) | Soak 60 Đêm, ghi RSS sau từng Đêm: chứng minh không rò rỉ |
| [test-report.txt](test-report.txt) | 73/73 test đạt (gồm 8 test Phase 4) |
| [headless-evidence.md](headless-evidence.md) | 28/28 kịch bản headless Phase 1–3 chạy lại, tất định |
| [img/](img/) | Ảnh: bảng xếp hạng, lưu điểm, đổi phím, phụ đề, chữ lớn, cảnh bench |

## Kết quả đo (máy dev)

Máy: Intel i7-13620H (16 luồng), 16 GB RAM, NVIDIA RTX 5050 Laptop, Windows 11, Chrome 158. Số do giảng viên đo trên máy chấm mới là số chính thức.

| Chỉ số | Ngưỡng | bench.json | Dải qua các lần đo lặp |
|---|---|---|---|
| avg_fps | ≥ 60 | **243.6** | 231 – 320 |
| p1_low_fps | ≥ 30 | **74.4** | 44.6 – 92.2 |
| frame_ms_p95 | — | 8.3 ms | 6.6 – 9.2 ms |
| load_ms | ≤ 10000 | **1917** | 1740 – 3559 |
| peak_mem_mb | — | 640 | 626 – 642 |

| Soak | Ngưỡng | soak.json |
|---|---|---|
| crashes | = 0 | **0** |
| mem_end_mb / mem_start_mb | ≤ 1.2 | **48.3 / 47.4 = 1.02** (6 lần lặp: 1.02 – 1.03) |
| duration_s | — | 1.09 s |

## Truy vết yêu cầu → bằng chứng

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| §1 Lệnh `bench_cmd --seed 42 --duration 30 --out bench.json`, cửa sổ 1280×720, vsync tắt, cảnh chuẩn, 3 s khởi động, đúng các trường | [bench.json](bench.json), P4-04, P4-05, P4-06, ảnh [bench-scene](img/bench-scene.png) | Đạt |
| §2 `soak_cmd --seed 7 --nights 10 --out soak.json`, 1 tiến trình, xoay vòng Đêm, input ngẫu nhiên theo tỉ lệ ticket | [soak.json](soak.json), P4-07 | Đạt |
| §3 Bảng xếp hạng: nhập tên sau Bình Minh hoặc khi thua; tên 3–12 (có dấu = điểm cộng); top 10; sắp xếp; lưu đĩa; xem từ menu; lệnh `--export-leaderboard` | P4-01, P4-02, P4-03, [leaderboard](img/leaderboard.png), [save-score](img/save-score.png) | Đạt |
| §4 Đổi phím (11 hành động, báo trùng, khôi phục, lưu) | [keys-duplicate](img/keys-duplicate.png) | Đạt (ảnh); thao tác bàn phím thật **chưa kiểm chứng** |
| §4 Phụ đề / chỉ báo (Bóng Mực + mũi tên, gió, 10 s, đèn < 30) | [captions](img/captions.png) | Đạt cho Bóng Mực (ảnh); ba loại còn lại có trong code, **chưa có ảnh** |
| §4 Giảm chuyển động | Code `settings.reduceMotion` / `body.reduce` | **Chưa kiểm chứng bằng mắt** |
| §4 Chữ ≥ 18 px, tùy chọn ×1.25 | CSS rem với gốc 18 px; [large-text](img/large-text.png) | Đạt |
| §5 Clone → ≤ 3 lệnh → chơi; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE | [README](../../../README.md), [CHANGELOG](../../../CHANGELOG.md), [CREDITS](../../../CREDITS.md), [LICENSE](../../../LICENSE) | Đạt |
| §5 Release v1.0.0 có bản chạy được | `npm run package` → zip/tar.gz (đã thử chạy, không cần npm); [Dockerfile](../../../Dockerfile) | Gói đã sẵn sàng; **Release trên GitHub cần bạn tạo** |
| §6 Contract v1.3 | [game.contract.json](../../../game.contract.json), P4-08, C-01 | Đạt |
| §7 Retro | [docs/retro.md](../../retro.md) | Đạt |
| §7 Video demo < 5 phút | [docs/demo/README.md](../../demo/README.md) (kịch bản quay) | **Chưa có**: cần bạn tự quay |
| DoD: bench.json, soak.json được commit | file trong thư mục này | Đạt |
| DoD: test ẩn Phase 1–3 vẫn đạt | 65 test cũ + 28 kịch bản headless; runs Phase 3 giống từng byte | Đạt (với test của bài) |
