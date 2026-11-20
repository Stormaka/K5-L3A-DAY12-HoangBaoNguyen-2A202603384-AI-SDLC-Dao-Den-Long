# Trạng thái CI và phương án thay thế

**Vấn đề (20/11/2026):** workflow `.github/workflows/ci.yml` đã có trong repo nhưng GitHub không chạy job nào. Lỗi trả về trên run `44685033443` (commit `b9789f2`):

> The job was not started because your account is locked due to a billing issue.

Đây không phải lỗi code. Tài khoản là GitHub Free, không nợ, nhưng bị khóa do một lần xác thực phương thức thanh toán thất bại. Đã gửi ticket cho GitHub Support (20/11/2026). Khi được gỡ khóa, CI sẽ tự chạy ở lần push tiếp theo mà không cần sửa gì.

**Phương án thay thế (kiểm chứng không phụ thuộc trí nhớ):**

| Cơ chế | Khi nào chạy | Chặn gì |
|---|---|---|
| `.githooks/pre-push` (tự bật khi chạy `npm install` qua script `prepare`) | Mỗi lần `git push` | Chặn push khi `npm test` đỏ |
| Hook Stop của Claude Code (`scripts/hooks/stop-gate.js`) | Khi agent định kết thúc | Agent không được kết thúc khi test đỏ |
| Hook PostToolUse (`scripts/hooks/post-edit.js`) | Sau mỗi lần agent sửa `src/`, `tests/` | Báo ngay cho agent khi test hỏng |

Đã thử cả hai trường hợp: thêm một test luôn sai thì pre-push thoát với mã 1 (chặn); xóa test đó thì thoát với mã 0.

**Cập nhật (20/11/2026, 6:39 UTC):** GitHub Support xác nhận nguyên nhân là một mã giảm giá GitHub Education đã hết hạn, và đã gỡ khóa billing. Actions chạy lại được trên gói Free. CI sẽ được kiểm chứng lại ở lần push tiếp theo. Vẫn giữ pre-push hook làm lớp chặn thứ hai.

**Cập nhật 2:** Sau khi gỡ khóa, CI chạy được nhưng đỏ ở bước `npm test` (run 44690214800, Node 20). Nguyên nhân là lỗi của bài, không phải của GitHub: script test dùng `node --test "tests/*.test.js"`, mà Node 20 không tự mở rộng dấu `*` (Node 21 trở lên mới hỗ trợ). Máy dev chạy Node 24 nên không thấy lỗi. Đã sửa bằng `scripts/run-tests.js` (tự liệt kê file test), và CI giờ chạy trên Node 20, 22 và 24.

**Cập nhật 3:** CI xanh trên cả Node 20, 22 và 24 (run 44691280170, commit `9a31de2`: `npm ci`, `npm test`, `npm run proof`).
