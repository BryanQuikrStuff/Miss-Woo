# Missive API Code Review

## 🔍 Analysis Against Official API Documentation
**Reference**: https://learn.missiveapp.com/api-documentation/iframe-integrations-api

---

## ❌ **CRITICAL ERRORS FOUND**

### 1. **Unsupported Event: `email:focus`**

**Location**: `src/app.js:152`

**Issue**: The code uses `Missive.on('email:focus', ...)` but this event is **NOT** listed in the official Missive API documentation.

**Official Events** (from documentation):
- `main_action`
- `message_sent`
- `change:conversations` ✅ (used correctly)
- `change:users`

**Code**:
```javascript
Missive.on('email:focus', (data) => {
  console.log("📧 Email focused:", data);
  this.handleEmailFocus(data);
});
```

**Impact**: This event listener will never fire, making the `handleEmailFocus()` method unreachable through this path.

**Recommendation**: Remove or replace with supported event. Consider using `change:conversations` to detect when a conversation is selected.

---

### 2. **Potentially Unsupported Methods: `getCurrentConversation()` and `getCurrentEmail()`**

**Locations**: 
- `src/app.js:170-171` (getCurrentConversation)
- `src/app.js:179-180` (getCurrentEmail)
- `src/app.js:2187-2188` (getCurrentEmail)
- `src/app.js:2446-2448` (getCurrentConversation)

**Issue**: These methods are **NOT** explicitly listed in the official API documentation under:
- App methods
- Fetch methods
- Conversation methods
- Composer methods
- Helper methods

**Code**:
```javascript
if (Missive.getCurrentConversation) {
  const conversation = await Missive.getCurrentConversation();
  // ...
}

if (Missive.getCurrentEmail) {
  const email = await Missive.getCurrentEmail();
  // ...
}
```

**Impact**: 
- If these methods don't exist, the code will silently fail (checks for existence first)
- May be undocumented but working methods, or may be deprecated

**Recommendation**: 
1. Verify these methods exist in the actual Missive API
2. If they don't exist, use `fetchConversations()` with current conversation ID from `change:conversations` event
3. Document the source if these are working but undocumented methods

---

## ⚠️ **PERFORMANCE ISSUES**

### 3. **Inconsistent `fetchConversations()` API Usage**

**Location**: `src/app.js:2308-2485`

**Issue**: The code tries multiple parameter formats for `fetchConversations()`, suggesting uncertainty about the correct API signature:

```javascript
// Format 1: Array of conversation IDs
await Missive.fetchConversations(idsToFetch);

// Format 2: Object with limit and sort
await Missive.fetchConversations({
  limit: this.maxPreloadedConversations,
  sort: 'oldest'
});

// Format 3: Array with limit and sort string
await Missive.fetchConversations([this.maxPreloadedConversations, 'oldest']);

// Format 4: Just a number
await Missive.fetchConversations(this.maxPreloadedConversations);

// Format 5: Array with single ID
await Missive.fetchConversations([convId]);
```

**Impact**: 
- Multiple API calls with wrong parameters waste time
- Error handling overhead
- Unclear which format actually works
- Potential rate limiting issues

**Recommendation**: 
1. Check official documentation for exact `fetchConversations()` signature
2. According to the docs, it should accept conversation IDs (array format)
3. Remove fallback attempts and use the correct format consistently
4. The documentation shows it's under "Fetch methods" but doesn't show exact signature in the snippet provided

---

### 4. **Inefficient Fallback: Fetching Conversations One-by-One**

**Location**: `src/app.js:2401-2438`

**Issue**: When batch fetch fails, the code falls back to fetching conversations one-by-one in batches of 5:

```javascript
async fetchConversationsOneByOne(conversationIds) {
  // Fetches 5 at a time with 100ms delay between batches
  const batchSize = 5;
  for (let i = 0; i < maxToFetch; i += batchSize) {
    // ... fetch 5 conversations
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

**Impact**: 
- Very slow for large inboxes (50 conversations = 10 batches = 1+ second just in delays)
- Unnecessary if the correct API format is used
- May hit rate limits with many sequential calls

**Recommendation**: 
1. Fix the primary `fetchConversations()` call to use correct format
2. Remove or significantly optimize this fallback
3. If fallback is needed, increase batch size and reduce delays

---

### 5. **Excessive Debouncing Layers**

**Location**: Multiple locations

**Issue**: There are multiple debouncing mechanisms that may conflict:

1. `conversationChangeDebounceTimer` - 500ms debounce (line 210)
2. `preloadingDebounceTimer` - 2000ms debounce (line 2936)
3. `triggerDynamicPreloading()` - 2000ms debounce

**Impact**: 
- Delays in preloading data
- User may click email before preload completes
- Unclear which debounce is actually being used

**Recommendation**: Consolidate to a single, well-defined debounce strategy.

---

## ✅ **CORRECT USAGE**

### 6. **Correct: `change:conversations` Event**

**Location**: `src/app.js:142`

**Status**: ✅ **CORRECT** - This event is officially documented and used properly.

```javascript
Missive.on('change:conversations', (data) => {
  console.log("📧 Conversation changed:", data);
  this.handleConversationChange(data);
});
```

---

## 📋 **RECOMMENDATIONS SUMMARY**

### **High Priority Fixes:**

1. **Remove `email:focus` event listener** - It doesn't exist in the API
   - Replace with `change:conversations` event handling
   - Or remove `handleEmailFocus()` if not needed

2. **Verify `getCurrentConversation()` and `getCurrentEmail()` methods**
   - Test if they actually work
   - If not, refactor to use `fetchConversations()` with conversation IDs
   - Document if they're working but undocumented

3. **Standardize `fetchConversations()` usage**
   - Determine correct API signature from official docs
   - Remove multiple fallback attempts
   - Use consistent parameter format

### **Medium Priority Optimizations:**

4. **Optimize fallback fetching**
   - Increase batch size from 5 to 10-20
   - Reduce or remove delays between batches
   - Only use fallback if absolutely necessary

5. **Consolidate debouncing**
   - Use single debounce strategy
   - Reduce delay times where possible
   - Document debounce rationale

### **Low Priority Enhancements:**

6. **Add error handling for unsupported methods**
   - Log warnings when methods don't exist
   - Provide fallback behavior
   - Document expected vs. actual API capabilities

---

## 🔗 **Official API Reference**

**Documentation**: https://learn.missiveapp.com/api-documentation/iframe-integrations-api

**Key Methods to Verify:**
- `fetchConversations()` - Exact signature needed
- `getCurrentConversation()` - Not in docs, verify existence
- `getCurrentEmail()` - Not in docs, verify existence

**Events to Use:**
- ✅ `change:conversations` - Confirmed in docs
- ❌ `email:focus` - NOT in docs, remove

---

## 📝 **Next Steps**

1. Test the code in Missive to verify which methods actually work
2. Remove or replace unsupported `email:focus` event
3. Standardize `fetchConversations()` API calls
4. Document any working but undocumented methods
5. Optimize fallback fetching strategy

---

**Review Date**: January 2025  
**Code Version**: vJS4.11  
**API Documentation Version**: https://learn.missiveapp.com/api-documentation/iframe-integrations-api

