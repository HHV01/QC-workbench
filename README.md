# QC Workbench — triển khai Render

Source tải từ QC Workbench, commit gốc 7b070e3582719d1b89cb4383dc6aacb329848030. Giữ giao diện và cách ghép dữ liệu gốc; chuyển Cloudflare Worker/R2 sang Node.js và file cache. Source Worker và script gốc nằm ở original-worker và original-scripts để tham khảo, không chạy trên Render. Không thay đổi website ChatGPT đang hoạt động.

## Đưa lên Render

1. Đưa toàn bộ nội dung thư mục này lên một Git repository riêng, bỏ qua node_modules và data.
2. Render → New → Blueprint → chọn repository. render.yaml tạo Web Service Free, không có persistent disk, build `npm ci`, start `npm start`.
3. Tạo Google Cloud service account, bật Google Sheets API, tạo JSON key. Chia sẻ Google Sheet quyền Viewer cho email client_email trong key.
4. Render → Environment → GOOGLE_SERVICE_ACCOUNT_JSON: dán toàn bộ nội dung JSON key. Không commit key lên Git. Redeploy sau khi thêm biến.
5. Mở /healthz: configured phải là true; syncedAt xuất hiện sau lần đồng bộ thành công; lastError phải là null. Kiểm tra log có `Sheet sync successful`.

Không cần làm Google Sheet công khai. Phiên kết nối Google trong Codex không chuyển sang Render; bạn cần tự cung cấp service account. Chưa thể kiểm thử kết nối Google từ Render trước khi có key và quyền chia sẻ.

## Quy tắc cập nhật 12 giờ

- Lần đầu chạy đọc Sheet ngay. Sau đó đọc lại khi đủ 12 giờ tính từ lần thành công gần nhất (kiểm tra mỗi phút); không cố định 00:00/12:00.
- Cache nằm ở /tmp/qc-data/snapshot.json trên bộ nhớ tạm. Restart hoặc redeploy có thể mất cache và quay về bản seed. Nếu dữ liệu đã quá hạn, cập nhật ngay khi khởi động.
- Lỗi truy cập, schema sai hoặc dữ liệu rỗng: giữ bản thành công trước đó, thử lại sau 5 phút. /healthz báo lỗi đồng bộ riêng với tình trạng server.
- Trình duyệt tải snapshot mỗi phút và khi quay lại tab; local import vẫn theo hành vi của giao diện gốc.
- Đọc Tong_hop_du_an!B6:I1001, K6:AG1001 và Ma_tran_Automation!A3:U1002. Không đọc cột J chứa tài khoản. Giữ phạm vi hàng như bản gốc; nếu thêm vượt 1001/1002, sửa ranges trong sync.mjs.
- Giữ bộ lọc dữ liệu công khai của website gốc: chỉ tên dự án và cột chỉ số được trả cho trình duyệt; không xuất thông tin truy cập hay liên kết nội bộ. File seed cũng đã lọc giống website đang chạy.
- Không cần Codex automation cho bản Render. Lịch của website ChatGPT hiện tại được giữ nguyên.

Render Free có thể ngủ khi không có truy cập, nên không bảo đảm cập nhật 12 giờ trong lúc ngủ; Blueprint hiện chọn Free để triển khai miễn phí, không có persistent disk. Tài liệu: https://render.com/docs/free và https://render.com/docs/disks.

## Chạy thử trên máy

Node.js 22 trở lên:

```sh
npm ci
npm test
npm start
```

Mở http://localhost:3000. Khi chưa cấu hình service account, vẫn xem được bản chụp đã tải về; /healthz báo chưa cấu hình. Thiết lập GOOGLE_SERVICE_ACCOUNT_JSON trong môi trường chạy để bật đồng bộ thật. Có thể dùng GOOGLE_APPLICATION_CREDENTIALS trỏ đến file key ngoài repository khi chạy local.

Google API: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet
