# Phase 1 — PRD-0 + Test Contract v1.0

## 1. Yêu cầu bắt buộc (trích PRD-0)

Một màn: Đêm 1 – Đảo Bến, đảo tròn, 5 Đèn Lồng Lớn. Đi lại, nhảy, camera 3D. Nhặt đom đóm, nạp vào đèn để thắp. Bóng Mực đuổi, chạm thì mất máu. Tỏa sáng xua Bóng Mực, tốn ánh sáng. Bóng Mực sợ đèn. Thắp hết đèn thì thắng, hết máu thì thua. Có điểm, HUD, chơi lại được. Phải có headless theo Test Contract v1.0 và `game.contract.json`.

## 2. Giả định cho chỗ mơ hồ

| # | Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|---|
| A1 | Kiến trúc | Logic thuần trong `src/sim/`, dùng chung cho web và headless; tick cố định 60 Hz | Contract yêu cầu tất định, không cần cửa sổ |
| A2 | Kích thước đảo | Bán kính 40 m. Đèn L1..L5 nằm trên vòng 25 m, L1 ở (0,0,25) rồi cách nhau 72° | Khớp ví dụ scenario (L1 ở [0,0,25]) |
| A3 | "Máu" | = `flames`, có 3 ngọn | Contract dùng tên `flames` |
| A4 | "Ánh sáng" để tỏa sáng | Trả bằng đom đóm đang mang (`pulse_cost` = 1). Không đủ thì không có tác dụng và không phát sự kiện | PRD: "tốn ánh sáng" |
| A5 | Nạp đèn | Nhấn interact (cạnh lên) để nạp vào đèn **chưa thắp gần nhất** trong `interact_radius`; được nạp từng phần; mỗi đèn cần `lantern_cost` = 5 | Ví dụ output có trường `deposited` |
| A6 | "Bóng Mực sợ đèn" | Không vào được `safe_radius` = 5 m quanh **đèn đã thắp**. Đèn chưa thắp không xua được | Thắp đèn trở thành phần thưởng chiến thuật |
| A7 | Mép đảo | Tường vô hình, `fall_enabled` = false, không có sự kiện `fall` | Đơn giản, đúng phạm vi |
| A8 | Thua | Có thêm điều kiện thua khi hết thời gian (`night1_duration_s` = 300) với lý do `dawn` | Contract liệt kê reason `dawn` |
| A9 | Bị đánh | Mỗi tick bị đánh tối đa 1 lần; sau đó bất tử `invuln_s` = 1.5 s; rơi `floor(carried × 0.5)` đom đóm, số này **biến mất** (không rơi xuống đất) | Tránh nhặt lại ngay lập tức |
| A10 | Tỏa sáng | Mọi Bóng Mực trong 6 m bị choáng đúng 2 s (120 tick, đứng yên, không gây sát thương) và bị đẩy ra xa 4 m; hồi chiêu 1 s | |
| A11 | Sinh quái/đom đóm | Mặc định: 30 đom đóm ngẫu nhiên, mỗi 4 s hồi lại 1 con nếu còn dưới 30; 2 Bóng Mực lúc đầu (không phát sự kiện), mỗi 30 s thêm 1 con (có `shade_spawned`), tối đa 6 con. Nếu `random_* = false` thì không sinh thêm gì | |
| A12 | Điểm | Đom đóm +10, đèn +100, mỗi lần choáng một Bóng Mực +20. Khi thắng: +2 × số giây còn lại (làm tròn xuống) và +50 × số lửa còn lại | Thưởng cho người chơi nhanh và an toàn |
| A13 | Thứ tự trong 1 tick | timers → nút (cạnh lên) → di chuyển/nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển → va chạm → sinh thêm → đồng hồ và kiểm tra kết thúc (thắng ưu tiên trước thua) | Phải cố định thì mới tất định |
| A14 | Nhảy | Chỉ ảnh hưởng trục Y (hiển thị); va chạm đo trên XZ nên nhảy không né được Bóng Mực | Contract: khoảng cách đo trên XZ |
| A15 | Scenario đặt `deposited` ≥ cost | Đèn được tính là đã thắp, không cộng điểm | "Dựng scenario không cộng điểm" |
| A16 | Biên số thực | Vị trí được làm tròn về lưới 1e-9 sau mỗi bước; so sánh bán kính có ε = 1e-9; Bóng Mực bị đẩy ra ngoài `safe_radius` + 0.002 | Để "≤ r" vẫn đúng khi đúng biên và sau khi làm tròn 3 chữ số |

## 3. Tiêu chí nghiệm thu → test

Xem bảng truy vết ở [docs/proof/phase-1/README.md](../proof/phase-1/README.md). Mỗi tiêu chí là một test `AC-xx` hoặc `C-xx` trong `tests/`.

## 4. Kế hoạch kiểm chứng (lập trước khi code)

1. Test đơn vị/hành vi chạy trực tiếp trên sim (`tests/gameplay.test.js`), với số tick tính tay trước (ví dụ: nhặt đom đóm ở tick 35, bị đánh ở tick 18/108/198).
2. Test contract qua **CLI thật** (`tests/contract.test.js`): mã thoát, định dạng JSONL, làm tròn, tất định.
3. Kịch bản headless đầu-cuối (`npm run proof`): thắng, thua vì hết lửa, thua vì bình minh, thắp đèn, ví dụ của contract. Mỗi kịch bản chạy 2 lần và so từng byte.
4. Bot tự lái (`scripts/bot.js`) chơi thắng trên bản đồ mặc định → chứng minh màn chơi thắng được.
5. Ảnh chụp headless Chrome cho phần hình ảnh/HUD.

## 5. Nhật ký dùng AI

- Công cụ: Claude Code (VS Code), model Claude Opus 5.5, làm việc trong một phiên.
- Quy trình: AI đọc lab board → tóm tắt contract → chốt giả định → viết sim + test → chạy → sửa → viết client 3D → harness → bằng chứng.
- Lời nhắc chính: "clone repo và giải thích", "làm phase 1".
- **Token/chi phí ước tính:** khoảng 150–200k token input (phần lớn là đọc lại ngữ cảnh) và 40–50k token output. _Thay bằng số thật từ `/cost` hoặc trang usage trước khi nộp._
- Cách tiết kiệm token: đọc file HTML của lab board một lần, lưu bản text vào scratchpad; dồn nhiều file vào một lần gọi; chạy test với `grep` để chỉ xem dòng lỗi; không dùng subagent.

### Lỗi của AI và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa / phòng ngừa |
|---|---|---|
| Thời gian choáng lệch 1 tick (119 thay vì 120): bộ đếm bị trừ ngay trong tick phát pulse | Test AC-14 đỏ (x = 6.942, cần 7) | Chuyển việc trừ bộ đếm lên đầu tick, cùng chỗ với các bộ đếm khác |
| `node --test tests/` không chạy trên Windows | Lệnh `npm test` báo lỗi | Đổi sang glob `"tests/*.test.js"` |
| Script hook bị hỏng ký tự `\` khi ghi qua heredoc (SyntaxError) | Chạy thử hook bằng tay | Viết lại không dùng regex có `\`; **luôn chạy thử hook** trước khi commit |
| Nguy cơ trôi số thực (0.1 × 35 ≠ 3.5) làm trượt test biên | AI tự nhận ra trước khi test chạy | Làm tròn vị trí về lưới 1e-9 và dùng ε (A16); có AC-06 kiểm tra đúng biên |

## 6. Đánh giá Phase 1

- **Đạt** (có bằng chứng): toàn bộ phạm vi PRD-0 về logic và contract, gồm 26/26 test và 5/5 kịch bản headless tất định.
- **Chưa kiểm chứng đủ:** cảm giác chơi thật bằng bàn phím/chuột. Agent không gõ phím được, ảnh headless chỉ là cảnh tĩnh (đồng hồ không chạy trong Chrome headless). **Cần người chơi thử** và ghi kết quả vào bảng bằng chứng.
- **Cân bằng game:** bot thắng ở giây 44–56 trên tổng 300 s, nên game có thể hơi dễ. Ghi lại để chỉnh ở phase sau nếu ticket yêu cầu.
- **Harness:** AGENTS.md (ngắn), hook PostToolUse chạy test sau khi sửa `src/` hoặc `tests/`, hook Stop chặn kết thúc khi test đỏ (đã thử: exit 2 khi đỏ, 0 khi xanh), skill `verify-game`, CI.
- **Cần chỉnh:** việc đánh giá nên do người khác hoặc một agent reviewer riêng làm (rubric B). Phase 1 mới chỉ có tác giả tự kiểm tra.
