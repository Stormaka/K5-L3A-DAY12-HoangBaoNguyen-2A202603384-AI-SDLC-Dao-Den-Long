# Retro — Đảo Đèn Lồng (Day 12 AI SDLC, 4 phase)

Hoàng Bảo Nguyên · 2A202603384 · làm cùng Claude Code (Claude Opus 5.5)

## 1. Tổng hợp Evaluation của 4 phase

| Phase | Yêu cầu chính | Kết quả có bằng chứng | Chưa kiểm chứng / còn yếu |
|---|---|---|---|
| 1. PRD-0, Contract v1.0 | Đêm 1 chơi được, headless tất định | 26 test, 5 kịch bản headless, bot thắng | Cảm giác chơi tay; game hơi dễ (bot thắng ở giây 44–56) |
| 2. Ticket-02 "Ba hòn đảo", v1.1 | Số liệu chuẩn, 3 bản đồ, Gió Lạc, Bùa Gió, tạm dừng, cài đặt, âm thanh, HUD | 53 test, 19 kịch bản, bot thắng cả 3 Đêm, FPS trung bình 130–149 | Âm thanh, luồng menu bằng tay; Đêm 3 rất sát giờ |
| 3. Ticket-03 "Đèn cạn dầu", v1.2 | Dầu đèn, `drain`, thắng ở bình minh, sức chứa, mù màu | 65 test, 28 kịch bản, ADR, 7 test cũ cập nhật có ghi lý do | Cân bằng: bot thắng Đêm 2 3/7, Đêm 3 2/7 |
| 4. Ticket-04 "v1.0.0", v1.3 | Bench, soak, bảng xếp hạng, dễ tiếp cận, đóng gói | 73 test, bench 315.1 / 34.5 FPS (1% thấp nhạy với điều kiện máy), soak 0 crash ×1.02, gói chạy không cần npm | Video demo, thao tác phím thật, máy chấm thật |

Điểm chung cả 4 phase:
- Mọi yêu cầu kiểm được bằng logic đều có test hoặc kịch bản headless chạy qua **CLI thật**.
- Những gì chỉ kiểm được bằng mắt hoặc tai thì được ghi trung thực là "chưa kiểm chứng", không ghi "đạt".

## 2. Điều gì hiệu quả khi làm với AI

- **Viết test trước, kỳ vọng tính tay trong comment.** Ví dụ: "nhặt ở tick 40", "đèn tắt ở tick 6000", "Gió Lạc cướp ở tick 76". Khi test đỏ, mình hỏi ngay được: AI sai phép tính, hay code sai? Ít nhất 3 lần là phép tính sai và 2 lần là code sai thật.
- **Sim thuần (`src/sim/`) dùng chung cho web, headless, bot và bench.** Mỗi luật chỉ có một chỗ định nghĩa. Ticket-03 đổi luật cốt lõi mà client web chỉ phải sửa phần hiển thị.
- **Bot tìm đường chơi trên sim thật.** Bot vừa là bằng chứng "Đêm thắng được", vừa là công cụ đo cân bằng (tỉ lệ thắng theo seed). Nhờ vậy phát hiện được Đêm 3 quá sát giờ và luật Ticket-03 làm game khó hơn nhiều.
- **Dự đoán test đỏ trước khi đổi luật.** Ở Phase 3, AI liệt kê các luật bị THAY THẾ, đoán đúng 7 test sẽ đỏ, rồi sửa từng test có ghi lý do (`T3:`).
- **Đo trước khi tối ưu.** Ở Phase 4, gắn đo đạc theo từng khung giúp tìm ra thủ phạm thật (công cụ đo bộ nhớ) thay vì đoán (draw call, GPU).

## 3. Điều gì không hiệu quả

- **Vá file qua shell** (heredoc, `node -e`) làm hỏng ký tự `\`, `\n` và dấu backtick ít nhất 5 lần, trong đó một lần làm hỏng cả CHANGELOG. AGENTS.md đã thêm luật dùng công cụ Edit/Write, nhưng AI vẫn tái phạm khi muốn sửa nhanh.
- **Tin vào vài lần đo.** Soak "phẳng" qua 3 lần chạy hóa ra là may mắn; lần chính thức ra ×1.18. Phải chạy lặp và chạy dài (60 Đêm) mới thấy được dao động thật.
- **Ảnh chụp bằng Chrome headless** dễ sai theo nhiều cách khó đoán: nhân vật đã chết, camera kẹt trong tháp, phụ đề chưa kịp hiện vì thời gian ảo. Chỉ phát hiện được khi **mở ảnh ra xem**.
- **Agent không đọc được tab phase mới** trên lab board (dữ liệu nằm trong DB của artifact khác tổ chức). Người dùng phải dán ticket vào.

## 4. Những lần AI sai và cách phát hiện

| Phase | Sai lầm | Phát hiện bằng |
|---|---|---|
| 1 | Thời gian choáng lệch 1 tick (119/120) | Test AC-14 đỏ |
| 1 | `node --test tests/` không chạy trên Windows; sau đó glob lại không chạy trên Node 20 | `npm test` và CI ma trận Node 20/22/24 |
| 1 | **Push lên GitHub khi người dùng chưa đồng ý** | Người dùng hỏi lại; đã xóa và lưu luật "luôn hỏi trước khi push" |
| 2 | Tính sai đỉnh bay của bục nhảy (4.9 m chứ không phải > 5 m) | Test P2-17 đỏ |
| 2 | Bot đầu tiên thua cả 9 ván | Chạy bot 3 Đêm × 3 seed |
| 3 | Trôi sai số trên lưới 1e-9 làm "≤ 2 m" trễ 1 tick | Test P3-06 đỏ |
| 3 | Kỳ vọng sai vì quên rằng bóng `drain` hút ngay tick 0 | Test P3-08 đỏ |
| 4 | Đổ lỗi cho GPU trong khi khung giật do chính công cụ đo | Đo theo từng khung (sim / sync / HUD / render / late) |
| 2–4 | Ảnh bằng chứng sai (Bình Minh vẫn tối, vết rách không thấy, nhân vật đã chết, phụ đề chưa hiện) | Mở ảnh ra xem trước khi dùng |

## 5. Harness nào giúp nhiều nhất

1. **Test + `npm run proof` qua CLI thật, mỗi kịch bản chạy 2 lần so từng byte.** Bắt được mọi hồi quy về tính tất định khi tối ưu sim ở Phase 4: các file runs của Phase 3 phải giống từng byte.
2. **Hook Stop** (`scripts/hooks/stop-gate.js`): agent không được kết thúc khi test đỏ. **Hook PostToolUse** chạy test ngay sau khi sửa `src/` hoặc `tests/`, nên lỗi hiện ra ở đúng bước gây ra nó.
3. **AGENTS.md ngắn, chỉ có luật cứng:**
   - Số liệu chỉ nằm ở `config.js`.
   - Dầu là số nguyên đơn vị 1/60.
   - Thứ tự xử lý trong tick.
   - Không push khi chưa hỏi.
4. **Skill `verify-game`:** gom các bước bằng chứng (test, proof, bot, ảnh, FPS) để mỗi phase làm giống nhau. Skill cũng ghi lại các mẹo khó nhớ, ví dụ "Chrome trên Windows phải chụp ảnh qua PowerShell với đường dẫn tuyệt đối".
5. **CI ma trận Node 20/22/24 + pre-push hook:** bắt lỗi chỉ xảy ra trên Node 20 mà máy dev (Node 24) không thấy.

## 6. Token / chi phí AI

Ước tính từ các phiên (xem nhật ký trong từng `docs/notes/phase-*.md`):

| Phase | Input (ước tính) | Output (ước tính) |
|---|---|---|
| 1 | 150–200k | 40–50k |
| 2 | 250–350k | 60–80k |
| 3 | 200–300k | 50–70k |
| 4 | 300–400k | 60–80k |
| **Tổng** | **~0.9–1.25 triệu** | **~210–280k** |

_Đây là ước tính; thay bằng số thật từ `/cost` hoặc trang usage của tài khoản trước khi nộp._

Cách đã tiết kiệm token:
- Đọc lab board một lần rồi lưu bản text.
- Chạy test và proof chỉ lấy dòng tổng kết hoặc dòng lỗi (`grep`).
- Viết lại cả file một lần thay vì sửa vụn khi thay đổi lớn.
- Dùng bot và proof để kiểm tra thay vì đọc log JSONL dài.
- Không dùng subagent.
- Gom nhiều thay đổi vào một script vá có kiểm chuỗi khớp.

Chỗ còn lãng phí:
- Vòng lặp ảnh chụp (chụp, xem, chụp lại).
- Nhiều lần đo benchmark 30 s lúc tìm nguyên nhân giật khung.

## 7. Nếu làm lại

- **Bot, bench và đo đạc theo khung từ Phase 1**, không đợi tới Phase 4. Khi đó cân bằng và hiệu năng đã được theo dõi suốt quá trình.
- **Luật vá file dứt khoát:** chỉ dùng công cụ Edit/Write, có thể thêm hook chặn `node -e` có backtick.
- **Instancing ngay từ đầu** cho mọi thực thể có thể nhiều (Bóng Mực, đom đóm).
- **Hỏi người dùng sớm hơn về cân bằng** khi bot cho thấy Đêm 3 quá khó, thay vì chỉ ghi lại.
- **Tự động hóa ảnh bằng chứng** (ví dụ tự kiểm điểm ảnh, hoặc so ảnh với bản chuẩn) để không phải xem tay từng ảnh.
- **Xác nhận quyền push từ đầu phiên**, ghi rõ trong AGENTS.md, để tránh lần push nhầm ở Phase 1.
