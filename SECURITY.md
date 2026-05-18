# Security Documentation

## Security Review Findings (April 2026)

### 🚨 Critical Vulnerabilities (Must Fix)

#### 1. Regex Injection / Mass Deletion (A03 - Injection)
**Location:** `src/routes/api/code.js` -> `DELETE /delete`
**Vulnerability:** The route uses `new RegExp('^' + folderFullPath + '(/|$)')` where `folderFullPath` includes the user-provided `req.body.filename` and `parentPath`. If an attacker passes regex metacharacters (e.g., `.*`), they can delete unintended files within their account or trigger a Regular Expression Denial of Service (ReDoS).
**Fix:** Escape regex characters in `folderFullPath` before passing it to `new RegExp()`.

#### 2. NoSQL Query Injection (A03 - Injection)
**Location:** `src/routes/api/code.js` -> `POST /save`, `GET /load`
**Vulnerability:** While `filename` is validated against a regex, `parentPath` is utilized in MongoDB queries directly (e.g., `parentPath = req.body.parentPath || '/'`). By passing an object like `{"$ne": "random"}` instead of a string, an attacker can manipulate the query.
**Fix:** Validate `parentPath` explicitly ensuring it is a string and adheres to valid path formats.

### 🔴 High Risk Issues

#### 3. Room Ownership Squatting (A01 - Broken Access Control)
**Location:** `src/socket/index.js`
**Vulnerability:** Room ownership is automatically assigned to the first socket connection. A malicious script can establish connections to hundreds of predictable or randomized room IDs, become the owner, and toggle them to "Read-Only," effectively executing a denial of service (DoS) for legitimate room participants.
**Fix:** Zero Trust Implementation – Rooms should require authentication to create, or ownership should be bound to the creator's persistent user ID.

#### 4. Unbounded Fetch / Socket DoS (Reliability limit)
**Location:** `src/routes/api/code.js` -> `POST /run`
**Vulnerability:** The route fetches an external execution engine (Judge0) with `wait=true` without establishing any timeout. If Judge0 experiences latency, Node.js connection sockets will remain open, potentially starving the node connection pool and taking the server down.
**Fix:** Add `AbortSignal.timeout(10000)` to the `node-fetch` call.

### 🟡 AI / LLM Integration Risks

#### 5. Sensitive Data Exposure (LLM06) & Prompt Injection (LLM01)
**Location:** `src/routes/api/ai.js`
**Vulnerability:** The assistant injects the raw `prefix` code and `messages` directly into the Prompt. 
- **LLM06:** Users routinely hardcode API keys or internal enterprise logic into editors; this exposes proprietary data to external cloud models without prior scrubbing.
- **LLM01:** The assistant lacks strict output constraints if users input contradictory "system" instructions in chat or code execution contexts.
**Fix:** Document a policy informing users that editor contexts are transmitted to external LLMs. Enforce guardrails on inputs and sanitize known secrets/PII before transmission.

---

## Fixed Vulnerabilities (February 2026)

### Authentication Security Improvements

#### 1. ✅ Removed Hardcoded Admin Email
**Issue:** Admin email was hardcoded in `src/middleware/auth.js`
**Risk:** Email exposure, account impersonation
**Fix:** Changed to role-based access control only (`req.user.role === 'admin'`)

#### 2. ✅ Added Rate Limiting
**Issue:** No protection against brute force attacks
**Risk:** Unlimited authentication attempts, API abuse
**Fix:** 
- Auth routes: 10 requests per 15 minutes per IP
- API routes: 100 requests per minute per IP

#### 3. ✅ Improved Session Security
**Issue:** Inconsistent session regeneration on login
**Risk:** Session fixation attacks
**Fix:** 
- Always regenerate session on OAuth login
- Added validation for user objects
- Enhanced error logging

#### 4. ✅ Added Security Headers (Helmet)
**Issue:** Missing HTTP security headers
**Risk:** XSS, clickjacking, MIME sniffing attacks
**Fix:** Helmet middleware with CSP disabled for Monaco Editor

#### 5. ✅ Enhanced OAuth Validation
**Issue:** Weak validation of OAuth profile data
**Risk:** Invalid accounts, data injection
**Fix:**
- Email format validation
- Profile ID validation
- Error logging for audit trail

#### 6. ✅ Session Secret Enforcement
**Issue:** Weak default secret could leak to production
**Risk:** Session hijacking
**Fix:** Warning messages in development, enforced requirement

## Security Best Practices Implemented

### ✅ Implemented
- Session regeneration on login
- HTTP security headers (Helmet)
- Rate limiting (authentication & API)
- Role-based access control
- OAuth email validation
- Secure session cookies (httpOnly, sameSite: lax)
- MongoDB session store
- Environment variable validation
- Security audit logging

### ⚠️ Recommended Additional Measures

#### CSRF Protection
Currently not implemented. Consider adding `csurf` package:
```bash
npm install csurf
```

#### Input Sanitization
Add validation library like `express-validator`:
```bash
npm install express-validator
```

#### Database Query Protection
Current Mongoose queries are safe, but monitor for:
- NoSQL injection attempts
- Unvalidated user input in queries

#### File Upload Security
If adding file uploads, implement:
- File type validation
- Size limits
- Virus scanning
- Secure storage

## Environment Variables Required

### Critical Security Variables
```env
# Required in production
SESSION_SECRET=<64-char-random-hex>  # Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
MONGODB_URI=<your-mongodb-connection-string>

# OAuth Credentials
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>

# Optional
TRUST_PROXY=1  # Set to 1 if behind reverse proxy (Nginx, Render, etc.)
NODE_ENV=production  # Enables secure cookies
```

## Security Checklist

### Before Deployment
- [ ] Set strong SESSION_SECRET (64+ random characters)
- [ ] Enable HTTPS in production
- [ ] Set TRUST_PROXY=1 if behind proxy
- [ ] Set NODE_ENV=production
- [ ] Verify OAuth callback URLs are correct
- [ ] Review admin role assignments in database
- [ ] Test rate limiting with production traffic
- [ ] Enable MongoDB authentication
- [ ] Review CORS settings for production domains
- [ ] Set up security monitoring/logging

### Regular Maintenance
- [ ] Run `npm audit` monthly
- [ ] Update dependencies quarterly
- [ ] Review authentication logs for suspicious activity
- [ ] Test OAuth flows after provider updates
- [ ] Rotate SESSION_SECRET annually
- [ ] Review user roles and permissions

## Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** open a public GitHub issue
2. Email security concerns privately
3. Provide detailed description and reproduction steps
4. Allow time for fix before public disclosure

## Security Contact

For security concerns, contact: [Your Security Email]

---

**Last Updated:** February 5, 2026
**Security Audit:** Passed
**Known Vulnerabilities:** 0 (after npm audit fix)
