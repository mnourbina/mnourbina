# KHALABA Auth Testing Playbook

## MongoDB Verification
```
mongosh
use khalaba
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), login_attempts.identifier, password_reset_tokens.expires_at (TTL).

## API Testing (curl)
```
# 1. Login (returns temp_token + demo_otp_code)
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@khalaba.health","password":"khalaba2026"}'

# 2. Verify OTP (sets cookies) - use temp_token and otp_code from previous response
curl -c cookies.txt -X POST http://localhost:8001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"temp_token":"...","otp_code":"123456"}'

# 3. Get current user
curl -b cookies.txt http://localhost:8001/api/auth/me
```

## Roles
- `admin` — Full access, analytics, configuration
- `soignant` — Healthcare professional (midwife/gynecologist), patient management in their zone
- `patient` — Mother/family, view own records

## Default Seeded Accounts
See `/app/memory/test_credentials.md`
