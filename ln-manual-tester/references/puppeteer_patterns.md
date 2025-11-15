# Puppeteer Testing Patterns

This document provides reusable patterns for UI testing with puppeteer MCP.

## Overview

**puppeteer MCP** provides browser automation tools accessible via MCP (Model Context Protocol):
- `puppeteer_launch()` - Launch browser
- `puppeteer_navigate()` - Navigate to URL
- `puppeteer_click()` - Click element
- `puppeteer_type()` - Type text into input
- `puppeteer_get_text()` - Extract text from element
- `puppeteer_screenshot()` - Capture screenshot
- `puppeteer_evaluate()` - Execute JavaScript in page context
- `puppeteer_wait_for_selector()` - Wait for element to appear

## Common Patterns

### Pattern 1: Form Submission

**Use case:** Test login, registration, profile update forms

**Steps:**
1. Navigate to page
2. Fill form fields
3. Submit form
4. Verify redirect or success message

**Example (Login):**
```javascript
// Phase 1: Navigate
await page.goto('http://localhost:3000/login');

// Phase 2: Fill form
await page.fill('[name="email"]', 'user@example.com');
await page.fill('[name="password"]', 'test123');

// Phase 3: Submit
await page.click('button[type="submit"]');

// Phase 4: Verify
await page.waitForURL('**/dashboard');
const heading = await page.textContent('h1');
expect(heading).toBe('Dashboard');
```

**Selectors:**
- Prefer `[name="fieldname"]` for inputs
- Prefer `[type="submit"]` for buttons
- Prefer `[data-testid="component"]` if available

---

### Pattern 2: Navigation and Assertion

**Use case:** Verify page renders correctly, content displayed

**Steps:**
1. Navigate to page
2. Wait for key element
3. Assert content

**Example (User List):**
```javascript
// Navigate
await page.goto('http://localhost:3000/users');

// Wait for content
await page.waitForSelector('table[data-testid="user-table"]');

// Assert
const heading = await page.textContent('h1');
expect(heading).toBe('User List');

const rowCount = await page.evaluate(() => {
  return document.querySelectorAll('table tbody tr').length;
});
expect(rowCount).toBeGreaterThan(0);
```

---

### Pattern 3: Element Interaction

**Use case:** Click buttons, toggle switches, open modals

**Steps:**
1. Click trigger element
2. Wait for result element
3. Verify state change

**Example (Add User Modal):**
```javascript
// Click button
await page.click('button[data-testid="add-user"]');

// Wait for modal
await page.waitForSelector('form[data-testid="user-form"]');

// Verify modal visible
const modalVisible = await page.isVisible('form[data-testid="user-form"]');
expect(modalVisible).toBe(true);
```

---

### Pattern 4: Error Message Verification

**Use case:** Test validation errors, API error messages

**Steps:**
1. Perform action that triggers error
2. Wait for error message element
3. Verify error text

**Example (Invalid Login):**
```javascript
// Fill with invalid credentials
await page.fill('[name="email"]', 'wrong@example.com');
await page.fill('[name="password"]', 'wrong');

// Submit
await page.click('button[type="submit"]');

// Wait for error
await page.waitForSelector('[data-testid="error-message"]');

// Verify error text
const errorText = await page.textContent('[data-testid="error-message"]');
expect(errorText).toBe('Invalid email or password');
```

**Important:** Verify user-friendly message (no stack traces, technical jargon)

---

### Pattern 5: Screenshot on Failure

**Use case:** Capture visual evidence when test fails

**Steps:**
1. Wrap test in try-catch
2. On error: take screenshot before throwing

**Example:**
```javascript
try {
  await page.click('button.non-existent');
} catch (error) {
  // Capture screenshot
  await page.screenshot({
    path: `screenshots/failure_${Date.now()}.png`,
    fullPage: true
  });

  // Re-throw error
  throw new Error(`Test failed: ${error.message}. Screenshot saved.`);
}
```

---

### Pattern 6: Async Wait Patterns

**Use case:** Wait for elements, network requests, animations

**Wait for selector:**
```javascript
await page.waitForSelector('[data-testid="user-profile"]', {
  timeout: 5000
});
```

**Wait for URL change:**
```javascript
await page.waitForURL('**/dashboard', {
  timeout: 5000
});
```

**Wait for network idle:**
```javascript
await page.waitForLoadState('networkidle');
```

**Wait for custom condition:**
```javascript
await page.waitForFunction(() => {
  return document.querySelectorAll('table tbody tr').length > 0;
}, { timeout: 5000 });
```

---

### Pattern 7: Extract Dynamic Data

**Use case:** Verify API data rendered correctly

**Example (User Profile):**
```javascript
// Navigate to profile
await page.goto('http://localhost:3000/users/123');

// Wait for profile data
await page.waitForSelector('[data-testid="user-name"]');

// Extract data
const name = await page.textContent('[data-testid="user-name"]');
const email = await page.textContent('[data-testid="user-email"]');
const role = await page.textContent('[data-testid="user-role"]');

// Verify
expect(name).toBe('John Doe');
expect(email).toBe('john@example.com');
expect(role).toBe('Admin');
```

---

### Pattern 8: Multi-Step Flow

**Use case:** Complex user journeys (e.g., checkout flow)

**Example (User Registration → Email Verification → Login):**
```javascript
// Step 1: Register
await page.goto('http://localhost:3000/register');
await page.fill('[name="email"]', 'newuser@example.com');
await page.fill('[name="password"]', 'password123');
await page.fill('[name="name"]', 'New User');
await page.click('button[type="submit"]');

// Step 2: Verify redirect to verification page
await page.waitForURL('**/verify-email');
const message = await page.textContent('[data-testid="message"]');
expect(message).toContain('Check your email');

// Step 3: (Simulate email verification - in real test, would check email)
// For manual testing, verify verification email sent via integration test

// Step 4: Login with new account
await page.goto('http://localhost:3000/login');
await page.fill('[name="email"]', 'newuser@example.com');
await page.fill('[name="password"]', 'password123');
await page.click('button[type="submit"]');

// Step 5: Verify logged in
await page.waitForURL('**/dashboard');
const welcomeText = await page.textContent('[data-testid="welcome"]');
expect(welcomeText).toContain('Welcome, New User');
```

---

## Selector Best Practices

**Priority order:**
1. **data-testid** attributes (best - stable, semantic)
2. **name** attributes (good for forms)
3. **type** attributes (good for buttons)
4. **role** attributes (accessibility, semantic)
5. **class/id** (avoid - brittle, implementation detail)

**Examples:**
```javascript
// ✅ GOOD: Semantic, stable
await page.click('[data-testid="submit-button"]');
await page.fill('[name="email"]', 'test@example.com');
await page.click('button[type="submit"]');
await page.click('[role="button"]');

// ❌ BAD: Brittle, coupled to implementation
await page.click('.btn-primary.submit-btn');
await page.fill('#emailInput', 'test@example.com');
```

---

## Error Handling

### Pattern: Graceful Degradation

If puppeteer unavailable (e.g., server doesn't support browser automation):

```javascript
try {
  await page.goto('http://localhost:3000');
} catch (error) {
  if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
    return {
      verdict: "ERROR",
      message: "Application not running. Start server first."
    };
  }
  throw error;
}
```

### Pattern: Timeout Handling

```javascript
try {
  await page.waitForSelector('[data-testid="profile"]', {
    timeout: 5000
  });
} catch (error) {
  if (error.message.includes('Timeout')) {
    return {
      verdict: "FAIL",
      details: "Profile component did not render within 5 seconds"
    };
  }
  throw error;
}
```

---

## Integration with x-manual-tester

**When to use puppeteer (Phase 1 detection):**
- Story type: UI
- Story description contains: "UI", "frontend", "page", "component"
- Story labels: "ui", "frontend", "react", "vue"

**Workflow integration:**
- **Phase 3 (Test AC):** Use puppeteer patterns for each AC
- **Phase 4 (Edge Cases):** Test invalid UI interactions
- **Phase 5 (Error Handling):** Verify error messages displayed
- **Phase 7 (Document):** Include puppeteer commands in temp script

**Temp script format (UI tests):**
```bash
#!/bin/bash
# Temporary manual testing script for Story US001 (UI)
# Created: 2025-11-13

# Note: UI tests require manual verification
# Puppeteer commands below for reference

echo "AC1: User can login"
echo "Steps:"
echo "1. Navigate to http://localhost:3000/login"
echo "2. Fill email: user@example.com"
echo "3. Fill password: test123"
echo "4. Click Submit"
echo "5. Verify redirect to /dashboard"
echo ""

echo "Run automated UI test:"
echo "npm run test:ui -- --grep 'User login'"
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
