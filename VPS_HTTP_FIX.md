# Fix lỗi login không redirect trên VPS HTTP

## Nguyên nhân

Khi deploy trên VPS với HTTP (không có SSL/HTTPS), cookie authentication bị browser từ chối vì:
- Production mode đặt `secure: true` cho cookies
- Browser yêu cầu HTTPS khi có flag `secure`
- Kết quả: Login API trả về 200 OK nhưng cookie không được lưu → không redirect

## Cách fix (3 bước)

### 1. SSH vào VPS

```bash
ssh user@192.168.70.28
cd /path/to/ai-news
```

### 2. Thêm FORCE_HTTP vào .env

```bash
# Mở file .env
nano .env

# hoặc
vi .env
```

**Thêm dòng này:**
```env
FORCE_HTTP="true"
```

**Kết quả file .env:**
```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="http://192.168.70.28:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="MySecurePassword2026!"
FORCE_HTTP="true"   # ← THÊM DÒNG NÀY
ENCRYPTION_KEY="g4yTuD3rmAmSAS2Ofwur2e44RC3f1IP0YZzDix2XJdc="
```

Lưu file (Ctrl+X → Y → Enter nếu dùng nano)

### 3. Rebuild và restart Docker

```bash
# Stop container hiện tại
docker-compose down

# Rebuild với code mới và restart
docker-compose up -d --build
```

**Hoặc nếu dùng PM2:**
```bash
npm run build
pm2 restart ai-news
```

### 4. Kiểm tra

Đợi 1-2 phút để container khởi động xong, sau đó:

1. Mở browser: `http://192.168.70.28:3000/admin/login`
2. Nhập username: `admin`
3. Nhập password: `MySecurePassword2026!`
4. Click "Đăng nhập"
5. **Kết quả:** Redirect thành công đến `http://192.168.70.28:3000/admin`

## Verify logs

```bash
# Xem logs để đảm bảo app đã start
docker-compose logs -f --tail=20

# Hoặc test API
curl http://192.168.70.28:3000/api/articles
```

## Lưu ý bảo mật

⚠️ **FORCE_HTTP="true" chỉ dùng tạm thời!**

Khi có tên miền và SSL certificate:
1. Đổi về `FORCE_HTTP="false"` trong .env
2. Cập nhật `APP_BASE_URL="https://domain.com"`
3. Rebuild lại

Cookies qua HTTP không mã hóa → dễ bị đánh cắp. Chỉ dùng cho testing hoặc internal network.

## Troubleshooting

**Nếu vẫn lỗi:**

1. **Kiểm tra container đang chạy:**
   ```bash
   docker ps | grep ai-news
   ```

2. **Xem logs chi tiết:**
   ```bash
   docker-compose logs --tail=50
   ```

3. **Test login API trực tiếp:**
   ```bash
   curl -X POST http://192.168.70.28:3000/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"MySecurePassword2026!"}'
   ```
   
   **Kết quả mong đợi:** 
   ```json
   {"data":{"username":"admin"}}
   ```

4. **Kiểm tra .env đã load chưa:**
   ```bash
   docker exec ai-news env | grep FORCE_HTTP
   ```
   
   **Kết quả mong đợi:** `FORCE_HTTP=true`

5. **Nếu không thấy FORCE_HTTP trong env:**
   - File .env chưa được rebuild vào image
   - Cần chạy lại: `docker-compose down && docker-compose up -d --build`
