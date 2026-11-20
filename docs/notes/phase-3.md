# Phase 3 — Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

## 1. Ticket yêu cầu gì (tóm tắt)

1. **Nhiên liệu đèn:**
   - Đèn sáng có dầu 0–100, hao 1/s. Hết dầu thì đèn tắt (`lantern_out`).
   - Châm dầu bằng đom đóm (1 con = 10 dầu).
   - Thắp lại đèn đã từng sáng chỉ tốn 5.
2. **Bóng Mực hút dầu:**
   - Đèn dưới 30 dầu mất vùng an toàn.
   - Bóng Mực `wander` tìm tới đèn yếu và chuyển sang trạng thái `drain` (hút 5/s).
3. **Luật thắng mới:**
   - Không còn thắng sớm.
   - Thắng khi còn sống tới bình minh với ≥ 60% số đèn đang sáng.
   - Thời lượng Đêm là 240 / 270 / 300 s.
4. **Sức chứa tăng:** 10 + 2 × số lần thắp thành công trong Đêm, tối đa 20.
5. **Điểm mới:**
   - +5 mỗi đom đóm nạp vào.
   - +100 khi thắp lần đầu, +40 khi thắp lại.
   - +5 mỗi Bóng Mực trúng Tỏa Sáng, +15 nếu nó đang hút dầu.
   - Thưởng ở bình minh. Bỏ thưởng thời gian.
6. **Chế độ mù màu** (được lưu):
   - Bóng Mực đổi sang #00B3FF.
   - Cảnh báo đổi sang trắng kèm ⚠.
   - Đèn tắt bị xẹp 20% và có vết rách.
7. **Test Contract v1.2:**
   - Thêm 8 khóa tuning, đổi thời lượng.
   - Thêm trường snapshot và scenario mới.
   - Thêm các sự kiện `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` có thêm `relight`.
   - Thêm lý do kết thúc `dawn_survived`.

Quyết định thiết kế được ghi ở [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Danh sách breaking change ở [CHANGELOG.md](../../CHANGELOG.md).

## 2. Giả định cho chỗ ticket chưa nói rõ

| # | Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|---|
| A3-01 | Dầu "1 chữ số thập phân" | Lưu số nguyên đơn vị 1/60; xuất `round(fuel × 10) / 10`. Thưởng bình minh dùng `floor(đơn vị / 60)` | Ticket gợi ý; tránh trôi số thực |
| A3-02 | Scenario `lit: true` mà không có `ever_lit` | `ever_lit = true`, nên khi tắt chỉ cần 5 để thắp lại. Có thể đặt `ever_lit: false` | Đèn đang sáng nghĩa là đã từng sáng |
| A3-03 | Scenario `fuel` cho đèn tắt | Bỏ qua (đèn tắt luôn có fuel 0) | Contract: "đèn tắt có fuel: 0" |
| A3-04 | "Đi về đèn tắt gần nhất như trước" | Bóng `wander` đi 2 m/s tới đèn tắt gần nhất **tính từ nó**, dừng cách đèn 1 m. Không còn đèn tắt nào và không có đèn yếu thì đi lang thang như Phase 2 | Phase 2 chưa định nghĩa đích của `wander`; đây là cách hiểu sát chữ nhất |
| A3-05 | Sự kiện `fuel_drain` | Một sự kiện cho mỗi cặp (bóng, đèn), sau mỗi 60 tick hút liên tục của bóng đó (tick thứ 60, 120, …), `fuel` là giá trị sau khi trừ | "ghi mỗi 60 tick khi đang hút" |
| A3-06 | Hút dầu bắt đầu khi nào | Bóng chuyển `drain` ở bước 8 và bắt đầu trừ dầu ở bước 2 của tick sau. Bóng được đặt `drain` bằng scenario thì hút ngay từ tick 0 | Bám thứ tự xử lý; không trừ hai lần |
| A3-07 | Châm dầu lên ≥ 30 thì đẩy bóng | Áp dụng cho **mọi** lần châm dầu có kết quả ≥ 30, dùng lại cơ chế đẩy của lúc thắp (≤ 30 tick, không gây sát thương). Bóng đang `drain` bị đẩy thì về `wander` | Ticket: "giống khi đèn vừa thắp" |
| A3-08 | Hết `recoil` / `spawning` | Giữ như Phase 2 (về `chase` nếu Mây trong 12 m). Chỉ hết **choáng** mới về `wander` | Ticket chỉ đổi luật hết choáng |
| A3-09 | Đèn đầy dầu | Thực tế hầu như không gặp: dầu bị trừ ở bước 2 trước bước tương tác, nên đèn sáng luôn còn thiếu ít nhất 1/60. `used = 0` chỉ xảy ra khi dầu đúng 100 | Làm đúng công thức của ticket, không thêm ngoại lệ |
| A3-10 | `per_second_left` trong tuning | Đặt **0** (thưởng thời gian đã bỏ). Thưởng thắp lại 40, choáng-khi-hút 15, đèn sáng lúc bình minh 50 nằm trong `WORLD` | Contract v1.2 không thêm khóa điểm mới, nên giữ nguyên hình dạng `score` |
| A3-11 | Dung sai "trong bán kính r" | Tăng từ 1e-9 lên **1e-6 m**. Vẫn nhỏ hơn rất nhiều so với 3 chữ số thập phân ở đầu ra | 90 bước 1/30 m trên lưới 1e-9 trôi khoảng 3e-8, làm "≤ 2 m" trễ 1 tick (P3-06) |
| A3-12 | Ánh sáng môi trường "giảm theo" | Vẫn là 0.15 + 0.55 × (đèn **đang sáng** / tổng), nên tự giảm khi đèn tắt | Công thức Phase 2 |

## 3. Tiêu chí nghiệm thu → test

| Mục ticket | Tiêu chí | Test | Kịch bản headless |
|---|---|---|---|
| §1 Nhiên liệu | Thắp → 100; hao 1/s; tắt đúng ở 0 (tick 6000); `deposited` về 0; `ever_lit` | P3-01 | P3-fuel-out |
| §1 Châm dầu | `used = min(mang, ceil((100−fuel)/10))`, giới hạn 100, +5/đom đóm, chọn đèn gần nhất nhận được | P3-02 | P3-refuel |
| §1 Thắp lại | Chi phí 5, +40, `relight:true`, `relit_count`, dầu 100; đèn `ever_lit:false` vẫn cần 10 | P3-03, P3-12 | P3-relight |
| §2 Vùng an toàn | Đúng 30 vẫn bảo vệ, dưới 30 thì mất | P3-05 | P3-lowfuel |
| §2 Hút dầu | Bóng `wander` → đèn yếu gần nhất → ≤ 2 m thì `drain`, −5/s cộng dồn, `fuel_drain` mỗi 60 tick, đèn tắt thì về `wander` | P3-06, P3-07 | P3-drain |
| §2 Thoát `drain` | Mây trong 6 m → `chase`; châm dầu ≥ 30 → bị đẩy ra, không sát thương; Tỏa Sáng → `stunned` +15; hết choáng → `wander` | P3-08, P3-09 | P3-drain-refuel |
| §3 Thắng/thua | Thời lượng 240/270/300; không thắng sớm; ngưỡng 3/5, 4/6, 5/7 ở tick cuối; `dawn_survived` / `dawn` / `no_flames` trước tiên; thưởng bình minh chỉ khi thắng | P3-10, P3-11, P2-15, AC-11 | P3-dawn-win, P3-dawn-lose, P1-win-n1, P2-win-n2, P2-win-n3 |
| §4 Sức chứa | 10 + 2 × lần thắp (gồm thắp lại), tối đa 20; đèn đặt sẵn không tính; nhặt tới sức chứa mới | P3-04 | P3-capacity |
| §5 Điểm | +5/đom đóm (thắp, thắp lại, châm dầu), +100 / +40, +5 / +15, thưởng bình minh | AC-08, AC-09, P3-02, P3-03, P3-08, P3-10 | P1-lantern, P3-refuel, P3-relight, P3-dawn-win |
| §6 Mù màu | Cài đặt được lưu; Bóng Mực #00B3FF; cảnh báo trắng + ⚠; đèn tắt xẹp 20% + vết rách; đèn sắp hết dầu nhấp nháy | Ảnh `docs/proof/phase-3/img/` | — |
| §1 Hiển thị | Thanh dầu trên đèn sáng; < 30 thì đèn và thanh nhấp nháy 1 Hz | Ảnh | — |
| §7 Contract v1.2 | Tuning; snapshot `fuel` / `ever_lit` / `relit_count` / `capacity`; trạng thái `drain`; scenario mới (và lỗi định dạng → mã 2); sự kiện mới | C-01, C-05, C-08 | Mọi kịch bản P3-* |

## 4. Test cũ bị Ticket-03 làm sai (ghi "T3:" trong code)

| Test | Thay đổi | Lý do |
|---|---|---|
| AC-01 | `player` có thêm `capacity: 10` | Snapshot v1.2 |
| AC-08 | Điểm 150 (10 × 5 + 100); `lantern_lit` có `relight:false` | Điểm mới; sự kiện v1.2 |
| AC-09 | Điểm 15 (3 × 5) | +5 mỗi đom đóm |
| AC-11 | **Viết lại.** Trước: "thắp đèn cuối → thắng `all_lit` ngay". Nay: "thắp đèn cuối **không** kết thúc Đêm" | Luật "thắng ngay khi tất cả đèn sáng" bị THAY THẾ; phần thắng ở bình minh chuyển sang P3-10 |
| AC-19 | Đèn đặt sẵn có thêm `fuel: 100`, `ever_lit: true` | Snapshot v1.2, A3-02 |
| P2-15 | **Viết lại** theo luật mới: đủ ngưỡng ở tick bình minh → `dawn_survived` (điểm tính lại theo thưởng bình minh); hết lửa ở tick bình minh vẫn `no_flames` | Lý do `all_lit` không còn tồn tại |
| P2-16 | `time_left_s` 239.667 (cũ 299.667) | Đêm 1 dài 240 s |
| C-01 | `contract_version` 1.2, thêm 8 khóa, thời lượng mới, điểm mới | Contract v1.2 |
| headless P1-idle-lose | Kỳ vọng đổi từ "thua `no_flames`" sang "thua `dawn`, Bóng Mực ở trạng thái `wander`" | A3-04: Bóng Mực nay tụ ở đèn tắt, cách Mây đứng giữa đảo 25 m (ngoài tầm 12 m) |

Không test nào bị skip hay xóa âm thầm; mọi thay đổi đều có lý do ở bảng trên.

## 5. Kế hoạch kiểm chứng (lập trước khi code)

1. Mỗi khóa tuning mới được đối chiếu với **số trong ticket** (C-01), không đối chiếu với code.
2. Test hành vi với số tính tay trước:
   - Đèn tắt ở tick 6000.
   - Bóng tới ≤ 2 m sau 90 tick, hút −6/s, `fuel_drain` ở tick 150 / 210 / 270, đèn tắt ở tick 275.
   - Thưởng bình minh 3 × (50 + 99) + 150.
   - Biên đúng 30: bóng bị chặn ở 6.002, sang tick sau đi vào 5.935.
3. Chạy lại toàn bộ test Phase 1–2. Test nào đỏ thì phải chỉ ra được dòng luật bị THAY THẾ trước khi sửa test.
4. Thêm 9 kịch bản headless Phase 3 qua CLI thật, mỗi kịch bản có hàm kiểm riêng; tất định; chạy dưới 30 s.
5. Bot chơi theo chiến lược mới (thắp lần đầu để lấy điểm, giữ ngưỡng + 1 đèn trong cửa sổ cuối) để chứng minh mỗi Đêm thắng được.
6. Ảnh cho thanh dầu, đèn yếu, Bóng Mực đang hút, chế độ mù màu. Đo lại FPS.

## 6. Nhật ký dùng AI

- Công cụ: Claude Code (VS Code), model Claude Opus 5.5, cùng phiên với Phase 1–2.
- Quy trình:
  1. Người dùng dán Ticket-03.
  2. Agent tóm tắt, liệt kê luật bị THAY THẾ và dự đoán các test sẽ đỏ trước khi code.
  3. Sửa config, rồi sim (dầu, `drain`, luật thắng), rồi chạy test: đúng 7 test đỏ như dự đoán.
  4. Sửa 7 test đó kèm lý do, rồi viết 12 test Phase 3.
  5. Viết bot, proof, client web, ảnh, FPS, rồi ADR, notes, changelog.
- Lời nhắc chính: "làm phase 3 cho tôi" (kèm Ticket-03).
- **Token/chi phí ước tính cho Phase 3:** khoảng 200–300k token input và 50–70k token output. _Thay bằng số thật từ `/cost` hoặc trang usage._

### Lỗi của AI và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa / phòng ngừa |
|---|---|---|
| Quên rằng bóng `drain` đặt bằng scenario hút ngay tick 0 (kỳ vọng 50, thực tế 49.9) | P3-08 đỏ | Sửa kỳ vọng; ghi A3-06 |
| Test P3-05 chạy quá ngắn (30 tick) để bóng đi 4.9 m | P3-05 đỏ | Tăng lên 120 tick, ghi phép tính vào comment |
| **Lỗi thật trong sim:** trôi sai số trên lưới 1e-9 làm "≤ 2 m" trễ 1 tick | P3-06 đỏ (`wander` thay vì `drain` ở tick 90) | Tăng dung sai lên 1e-6 m (A3-11); toàn bộ 65 test vẫn xanh |
| Lại hỏng heredoc trong bash khi vá file dài | Lỗi "here-document delimited by end-of-file" | Ghi script vá ra file bằng công cụ Write rồi chạy; mọi lần vá đều kiểm chuỗi khớp (báo lỗi nếu không thấy) |
| Ảnh đầu tiên cho thanh dầu: Mây đã chết vì đứng trong tầm Bóng Mực | Mở ảnh ra xem (0 lửa, đom đóm rơi quanh) | Thêm tham số `god` (chỉ dùng khi chụp ảnh); chụp lại |
| Vết rách trên đèn tắt không thấy được (chỉ có một mặt, màu tối) | Mở ảnh ra xem | Đặt vết rách ở bốn mặt, màu sáng, hai mặt |
| Một khung hình giật khi một loại vật thể mới xuất hiện (biên dịch shader) | Đo FPS (min 4 FPS) | Làm nóng shader bằng `renderer.compile` khi bắt đầu Đêm. Còn lại 2–3/1600 khung dưới 30 FPS, đã ghi trung thực |

## 7. Đánh giá Phase 3

- **Đạt, có bằng chứng tự động:**
  - Toàn bộ §1–§5 và §7.
  - `npm test` 65/65.
  - `npm run proof` 28/28 PASS, tất định.
  - Có ADR, changelog liệt kê breaking change, và 7 test cũ được cập nhật có ghi lý do.
- **Đạt bằng ảnh:** §6 mù màu, thanh dầu, Bóng Mực đang hút, nhấp nháy (ảnh tĩnh chỉ cho thấy một pha của nhịp nhấp nháy).
- **Chưa kiểm chứng (cần người chơi):** cảm giác chơi với luật mới, nghe âm thanh `lantern_out`, cài đặt mù màu còn giữ sau khi tải lại trang.
- **Cân bằng:**
  - Bot thắng Đêm 1 3/3, Đêm 2 3/7, Đêm 3 2/7. Thua chủ yếu vì thiếu đom đóm: Bóng Mực canh đèn tắt, mỗi lần thắp lại phải Tỏa Sáng (tốn 3).
  - Đêm 2–3 có thể quá khó với người chơi mới. Đề xuất bàn ở Phase 4: cho Bóng Mực đứng canh xa hơn, hoặc tăng nhịp sinh đom đóm. Đây là số chuẩn của ticket nên chưa đổi.
- **FPS:** trung bình 158–169 FPS @1280×720 (RTX 5050 Laptop). Có 2–3 trên khoảng 1600 khung giật dưới 30 FPS.
- **Rủi ro với test ẩn:** A3-04 (đích của `wander`, dừng cách đèn 1 m), A3-05 (nhịp `fuel_drain`), A3-10 (`per_second_left = 0`).
