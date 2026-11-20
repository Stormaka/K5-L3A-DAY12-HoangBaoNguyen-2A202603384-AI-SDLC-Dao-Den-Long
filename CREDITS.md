# Credits

## Nội dung game
- **Bối cảnh, nhân vật, tên gọi** (Đảo Đèn Lồng, Mây, Ông Đăng, Bóng Mực, Gió Lạc, Bùa Gió), luật chơi và số liệu chuẩn: đề bài lab Day 12 AI SDLC (VinUni AI20k), PRD-0 và Ticket-02/03/04.
- **Hình 3D:** toàn bộ dựng bằng primitive của three.js trong code (`web/main.js`). **Không có** model, texture, font hay ảnh bên ngoài.
- **Âm thanh và nhạc:** tổng hợp lúc chạy bằng Web Audio API (`web/audio.js`, oscillator + noise). **Không có** file âm thanh bên ngoài.
- **Lời thoại của Ông Đăng** và mọi chữ trong game: viết cùng trợ lý AI (xem bên dưới).

## Thư viện
| Thư viện | Phiên bản | Giấy phép | Dùng cho |
|---|---|---|---|
| [three.js](https://threejs.org) | r160 (0.160.0) | MIT | Dựng hình WebGL |
| [Node.js](https://nodejs.org) (runtime) | ≥ 18 | MIT | Server tĩnh, headless, test (`node:test`), soak |

Benchmark điều khiển Google Chrome/Edge qua Chrome DevTools Protocol, dùng `WebSocket` và `fetch` có sẵn của Node. Không có dependency nào khác.

## Công cụ AI đã dùng để tạo nội dung
| Công cụ | Model | Dùng cho |
|---|---|---|
| Claude Code (Anthropic), extension VS Code | Claude Opus 5.5 | Toàn bộ code (sim, client 3D, headless, bot, bench, soak), test, chữ trong game, tài liệu, ảnh chụp bằng Chrome headless |

Không dùng công cụ AI tạo ảnh hay âm thanh. Nhật ký dùng AI cho từng phase: [docs/notes/](docs/notes/). Tổng kết: [docs/retro.md](docs/retro.md).

## Tác giả
Hoàng Bảo Nguyên (2A202603384), VinUni AI20k K5, lớp L3A.
