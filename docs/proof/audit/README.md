# Đánh giá độc lập (agent khác người viết code)

Rubric mục B, "Agent tự kiểm chứng", yêu cầu việc đánh giá do người hoặc agent khác người đã viết thực hiện. Sau Phase 4, một **agent kiểm toán riêng** đã chấm bài. Agent này không viết code, chỉ đọc repo và chạy lệnh trên bản clone riêng.

- **Đầu vào:**
  - Nguyên văn đề từ lab board và các ticket gốc, không dùng bản tóm tắt của tác giả.
  - `docs/lab/RUBRIC.md`, `SUBMISSION.md`, `RULES.md`.
- **Cách làm:**
  - Tự viết 33 kịch bản dò (probe) headless từ ticket, tính kỳ vọng trước rồi mới chạy: 47/47 kiểm tra khớp.
  - Clone sạch → `npm install` → `npm test`.
  - Chạy lại 4 run bằng chứng và so sha256.
  - Chạy soak và benchmark một lần.
- **Báo cáo nguyên văn:** [audit-report.md](audit-report.md). Ước tính 81/100 sau khi gỡ các việc trên GitHub.

## Phản hồi từng phát hiện

| # | Phát hiện | Mức | Đã xử lý |
|---|---|---|---|
| 1–3 | Thiếu tag `phase-2/3/4`, chưa push, chưa có Release và video | blocker | Push và gắn tag sau khi người dùng đồng ý. Release và video do tác giả tạo trên GitHub ([docs/demo/README.md](../../demo/README.md)) |
| 4 | Tên repo sai quy ước | high | Repo đã đổi tên thành `K5-L3A-DAY12-HoangBaoNguyen-2A202603384-AI-SDLC-Dao-Den-Long` |
| 5 | Bóng Mực trong scenario không có `state` mặc định là `chase` mà chưa ghi thành giả định | medium | Thêm giả định **A2-21** trong [phase-2.md](../../notes/phase-2.md). Không đổi code, để giữ hành vi đã kiểm chứng ở các tag trước |
| 6 | A2-05, A2-06, A3-04 là số tự đặt, có rủi ro lệch test ẩn | medium | Giữ nguyên (đã ghi rõ lý do trong notes); không đổi luật sau khi đã nộp các phase |
| 7 | Cảnh bench: 200 Bóng Mực dồn về L4/L5 và đứng yên, không còn "rải đều… vẫn di chuyển" | medium | **Sửa (A4-14):** trong bench, Bóng Mực đi lang thang khắp đảo. Test P4-05 kiểm ≥ 180/200 con vẫn di chuyển sau 300 s. Đầu ra headless không đổi (các run Phase 3 giống từng byte). Đã đo lại bench và ghi trung thực dải kết quả |
| 8 | `bench.js` cần Node ≥ 22 (`WebSocket`), README ghi ≥ 18 | medium | `bench.js` báo lỗi rõ ràng khi Node < 22; README ghi riêng yêu cầu cho benchmark |
| 9 | Token chỉ là ước lượng, còn câu nhắc "thay bằng số thật" | medium | Cần tác giả lấy số thật từ trang usage của tài khoản; agent không truy cập được số đó |
| 10 | File rác `docs/proof/phase-2/img$1.png`; thiếu `.gitattributes` nên `.jsonl` bị đổi CRLF khi checkout trên Windows | low | Đã xóa file rác; thêm `.gitattributes` (`*.jsonl -text`, `.githooks/*` dùng LF) |
