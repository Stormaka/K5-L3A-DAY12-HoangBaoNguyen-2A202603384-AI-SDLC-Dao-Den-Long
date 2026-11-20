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
