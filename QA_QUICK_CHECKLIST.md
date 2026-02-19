# Kyradi SaaS - Quick Test Checklist
**For Manual Test Execution**

---

## 🔴 CRITICAL - Execute First (Smoke Tests)

### Authentication
- [ ] **AUTH-001:** Partner login (`admin@demo.com` / `Akifemir123456789`)
- [ ] **AUTH-002:** Admin login (`admin@kyradi.com` / `Akifemir12345`)
- [ ] **AUTH-003:** Invalid credentials → Error message in Turkish
- [ ] **AUTH-007:** Partner user cannot access `/admin` routes

### Partner Panel Core
- [ ] **PARTNER-001:** Dashboard loads without errors
- [ ] **PARTNER-002:** Create location (QA_ prefix)
- [ ] **PARTNER-004:** Create storage/locker
- [ ] **PARTNER-005:** Create reservation via demo-flow
- [ ] **PARTNER-006:** Update reservation status

### Admin Panel Core
- [ ] **ADMIN-001:** Admin dashboard loads
- [ ] **ADMIN-002:** View tenant details (demo-hotel)
- [ ] **ADMIN-003:** Create tenant (QA_ prefix) - Verify dedicated page
- [ ] **ADMIN-004:** Edit tenant - Verify dedicated page (not modal)

---

## 🟡 HIGH PRIORITY - Verify Known Fixes

### User-Reported Issues
- [ ] **BUG-001:** Commission NaN → Verify no NaN in admin overview
- [ ] **BUG-003:** Tenant edit opens dedicated page (not modal)
- [ ] **BUG-006:** Reservation status in Turkish (not "completed")
- [ ] **BUG-007:** Ticket detail shows recipient information
- [ ] **BUG-005:** Reservations page - No "kaynak" filter

### Core Flows
- [ ] **PARTNER-007:** QR code verification works
- [ ] **PARTNER-008:** Create user - Dedicated page (not modal)
- [ ] **PARTNER-012:** Commission payments - No NaN values
- [ ] **ADMIN-005:** Tenant quota modal - UI/UX professional

---

## 🟢 MEDIUM PRIORITY - Functional Tests

### Partner Panel
- [ ] **PARTNER-003:** Edit location
- [ ] **PARTNER-009:** Staff management
- [ ] **PARTNER-010:** Reports & Analytics
- [ ] **PARTNER-011:** Revenue dashboard
- [ ] **PARTNER-013:** Tickets/Communication
- [ ] **PARTNER-014:** Settings page

### Admin Panel
- [ ] **ADMIN-006:** Global user management
- [ ] **ADMIN-007:** Create admin user
- [ ] **ADMIN-008:** Reports & Analytics
- [ ] **ADMIN-009:** Global revenue
- [ ] **ADMIN-010:** Settlements
- [ ] **ADMIN-011:** Transfers (MagicPay)
- [ ] **ADMIN-013:** Audit logs

### Negative Tests
- [ ] **NEG-001:** Empty form submissions → Validation errors
- [ ] **NEG-002:** Invalid email format → Error message
- [ ] **NEG-005:** Duplicate creation → Error handled
- [ ] **NEG-009:** Unauthorized access → Redirect

---

## 🔵 LOW PRIORITY - Polish & Edge Cases

### Responsive Design
- [ ] **RESP-001:** Mobile (360x800) - No horizontal scroll
- [ ] **RESP-002:** Tablet (768x1024) - Layout adapts
- [ ] **RESP-004:** Sidebar collapse - Scrollbar hidden

### Non-Functional
- [ ] **NF-001:** Page load < 3s for key pages
- [ ] **NF-003:** Keyboard navigation works
- [ ] **NF-004:** No console errors
- [ ] **NF-005:** Token stored securely

---

## 📋 Test Execution Log Template

```
Date: ___________
Tester: ___________
Environment: ___________

Test Case ID | Status | Notes | Screenshot
-------------|--------|-------|-----------
AUTH-001     | PASS   |       |
AUTH-002     | PASS   |       |
AUTH-003     | FAIL   | Error message in English | screenshot.png
...
```

---

## 🚨 Blockers Found

| Test Case | Issue | Severity | Status |
|-----------|-------|----------|--------|
|           |       |          |        |

---

## ✅ Pass/Fail Summary

- **Total Tests:** ___
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___
- **Pass Rate:** ___%

---

**Last Updated:** December 19, 2025
