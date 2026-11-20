# Bằng chứng Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Chạy lại tất cả (ở tag `phase-3`): `npm install && npm test && npm run proof`.

- Báo cáo test: [test-report.txt](test-report.txt), 65/65 đạt:
  - 19 test Phase 1 và 25 test Phase 2 chạy lại; 7 test bị luật mới làm sai đã được cập nhật kèm lý do.
  - 12 test Phase 3 mới.
  - 9 test contract.
- Kịch bản headless qua CLI thật: [headless-evidence.md](headless-evidence.md), 28/28 PASS.
  - Mỗi kịch bản chạy 2 lần, kết quả giống nhau từng byte.
  - Một Đêm đầy đủ chạy ≤ 1.3 s.
  - Output nằm trong [runs/](runs/).
- Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md) · Breaking change: [CHANGELOG.md](../../../CHANGELOG.md) · Giả định A3-xx và test bị đổi: [docs/notes/phase-3.md](../../notes/phase-3.md)
- Ảnh (Chrome headless, 1280×720): [img/](img/)

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (Ticket-03) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| §1 Thắp → dầu 100, hao 1/s (đơn vị nguyên 1/60), hết dầu thì tắt: `lantern_out`, `deposited` 0, `ever_lit` | Dầu theo tick; tắt đúng tick 6000 | P3-01, headless P3-fuel-out | Đạt |
| §1 Châm dầu: `used = min(mang, ceil((100−fuel)/10))`, tối đa 100, chọn đèn nhận được gần nhất / id nhỏ | Sự kiện `refuel` | P3-02, headless P3-refuel | Đạt |
| §1 Thắp lại 5 đom đóm (chưa từng sáng vẫn 10), `relight`, `relit_count` | Sự kiện `lantern_lit` | P3-03, P3-12, headless P3-relight | Đạt |
| §1 Thanh dầu; dưới 30 thì đèn và thanh nhấp nháy 1 Hz | Ảnh | [n1-prompt-refuel](img/n1-prompt-refuel.png), [n1-fuel](img/n1-fuel.png) | Đạt (ảnh tĩnh, một pha nhấp nháy) |
| §2 Dưới 30 mất vùng an toàn, đúng 30 vẫn còn | Vị trí bóng ở biên | P3-05, headless P3-lowfuel | Đạt |
| §2 Bóng `wander` → đèn yếu gần nhất → ≤ 2 m thì `drain`, 5/s cộng dồn, `fuel_drain` mỗi 60 tick | Trạng thái, dầu, sự kiện | P3-06, P3-07, headless P3-drain, ảnh [n1-fuel](img/n1-fuel.png) (tia hút) | Đạt |
| §2 Thoát `drain` (Mây ≤ 6 m → `chase`; tắt / châm ≥ 30 / > 2 m → `wander`; Tỏa Sáng → `stunned`); hết choáng → `wander`; châm dầu ≥ 30 thì đẩy bóng ra ≤ 30 tick, không sát thương | Trạng thái, vị trí, không có `player_hit` | P3-08, P3-09, headless P3-drain-refuel | Đạt |
| §3 Thời lượng 240/270/300; không thắng sớm; thắng `dawn_survived` khi đủ ≥ 3/5, 4/6, 5/7 đèn sáng ở tick cuối; `no_flames` luôn xét trước | `game_over` | P3-10, P3-11, AC-11, P2-15, headless P3-dawn-win, P3-dawn-lose | Đạt |
| §3 Mỗi Đêm thắng được với luật mới | Bot chơi trên sim thật, ghi inputs, chạy lại qua headless | headless P1-win-n1 (seed 1), P2-win-n2 (seed 1), P2-win-n3 (seed 2): đều `dawn_survived` | Đạt. Tỉ lệ thắng của bot: Đêm 1 3/3, Đêm 2 3/7, Đêm 3 2/7 (xem đánh giá cân bằng trong notes) |
| §4 Sức chứa 10 + 2 × lần thắp, tối đa 20, đặt lại mỗi Đêm, đèn đặt sẵn không tính; HUD đang mang/sức chứa | `player.capacity` | P3-04, headless P3-capacity, ảnh [n1-prompt-refuel](img/n1-prompt-refuel.png) | Đạt |
| §5 Điểm mới (+5, +100/+40, +5/+15, thưởng bình minh, bỏ thưởng thời gian) | `score` | AC-08, AC-09, P3-02, P3-03, P3-08, P3-10, headless P1-lantern, P3-dawn-win | Đạt |
| §6 Chế độ mù màu: được lưu; Bóng Mực #00B3FF; cảnh báo trắng + ⚠; đèn tắt xẹp 20% + vết rách | Ảnh so sánh thường / mù màu | [settings-cb](img/settings-cb.png), [n1-fuel](img/n1-fuel.png) / [n1-fuel-cb](img/n1-fuel-cb.png), [unlit-normal](img/unlit-normal.png) / [unlit-cb](img/unlit-cb.png) | Đạt (ảnh). Việc lưu qua lần tải lại trang **chưa kiểm chứng tự động** |
| §7 Contract v1.2: tuning, snapshot, scenario (sai định dạng → mã 2), sự kiện | CLI thật trên cả 3 Đêm | C-01, C-05, C-08 | Đạt |
| DoD: ADR mô tả mô hình trạng thái đèn và luật thắng | — | [docs/adr/0001](../../adr/0001-lantern-fuel-and-dawn-win.md) | Đạt |
| DoD: test cũ bị làm sai được cập nhật hoặc xóa có ghi lý do, không skip | Đánh dấu `T3:` trong code + bảng §4 trong notes | AC-01, AC-08, AC-09, AC-11, AC-19, P2-15, P2-16, C-01, headless P1-idle-lose | Đạt |
| DoD: changelog liệt kê breaking change | — | [CHANGELOG.md](../../../CHANGELOG.md) | Đạt |
| DoD: test Phase 1–2 không bị thay thế vẫn đạt | Chạy lại toàn bộ | 37 test Phase 1–2 không đổi + 19 kịch bản headless Phase 1–2 | Đạt (với test của bài; test ẩn chưa biết) |

## FPS (1280×720, Chrome + DevTools Protocol, 10 s, camera chạy vòng)

Máy dev: Intel i7-13620H, NVIDIA GeForce RTX 5050 Laptop GPU.

| Cảnh | Trung bình | Thấp nhất | Số khung < 30 FPS |
|---|---|---|---|
| Đêm 3, 7/7 đèn sáng (2 lần đo) | 163.1 / 159.9 FPS | 9.0 / 7.1 | 2 / 1631, 2 / 1599 |
| Đêm 2, 6/6 đèn sáng | 158.2 FPS | 4.0 | 3 / 1548 |
| Đêm 1, đèn yếu + Bóng Mực hút, chế độ mù màu | 168.2 FPS | 42.7 | — |

Khoảng 0.15% số khung bị giật dưới 30 FPS. Đã thêm bước làm nóng shader khi bắt đầu Đêm; phần giật còn lại chưa xác định được nguyên nhân và được ghi lại ở đây.

## Việc còn phải làm tay (người chơi)

- Chơi một Đêm với luật mới: châm dầu, thắp lại, đuổi Bóng Mực khỏi đèn yếu, sống tới bình minh.
- Bật "Bảng màu dễ phân biệt", tải lại trang và xem cài đặt còn giữ không.
