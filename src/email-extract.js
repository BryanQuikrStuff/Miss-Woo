/**
 * Email-extraction helpers for the Miss-Woo Missive integration.
 *
 * These functions are pure (no DOM, no `this`, no module-level state) so
 * they can be unit-tested directly under jest in node, while still being
 * loaded as a plain `<script>` tag in the browser via the UMD wrapper at
 * the bottom of this file.
 *
 * Public API (mirrored on `window.EmailExtract` in the browser):
 *   - isValidEmailForSearch(email)
 *   - extractAllEmailsFromString(text)
 *   - extractEmailFromString(text)
 *   - searchForEmailsRecursively(obj, path?, maxDepth?)
 *   - extractEmailFromParticipants(participants)
 *   - extractEmailFromData(data)
 *   - getCustomerEmailFromAPI(conversations, missive)
 *
 * `MissWooApp` in `src/app.js` delegates to these via thin wrapper
 * methods. Keeping the wrappers means existing call sites
 * (`this.extractEmailFromData(...)` etc.) and the `MissWooDebug`
 * surface continue to work unchanged.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EmailExtract = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  // Domains we never want to surface as a "customer" address. Anything in
  // this list is treated as internal Quikr Stuff staff/automation.
  var INTERNAL_DOMAINS = ['@quikrstuff.com'];

  // Strict check: the entire string must look like a single email.
  var STRICT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Loose check: pull email-shaped substrings out of free-form text.
  var EMAIL_SCAN_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  /**
   * True when `email` is a non-empty string, well-formed, and not in any
   * configured internal domain.
   */
  function isValidEmailForSearch(email) {
    if (!email || typeof email !== 'string') return false;
    var lower = email.toLowerCase();
    for (var i = 0; i < INTERNAL_DOMAINS.length; i++) {
      if (lower.indexOf(INTERNAL_DOMAINS[i]) !== -1) return false;
    }
    return STRICT_EMAIL_REGEX.test(email);
  }

  /** Returns every email-shaped substring in `text` (no filtering). */
  function extractAllEmailsFromString(text) {
    if (!text || typeof text !== 'string') return [];
    var matches = text.match(EMAIL_SCAN_REGEX);
    return matches || [];
  }

  /** First customer-eligible email-shaped substring in `text`, or null. */
  function extractEmailFromString(text) {
    var matches = extractAllEmailsFromString(text);
    for (var i = 0; i < matches.length; i++) {
      if (isValidEmailForSearch(matches[i])) return matches[i];
    }
    return null;
  }

  /**
   * Walk `obj` collecting every email-shaped substring found in any
   * string value, up to `maxDepth` levels deep. Order of returned
   * emails matches `Object.entries(...)` traversal order. No filtering;
   * callers decide what to keep.
   */
  function searchForEmailsRecursively(obj, path, maxDepth, currentDepth) {
    if (path === undefined) path = 'root';
    if (maxDepth === undefined) maxDepth = 5;
    if (currentDepth === undefined) currentDepth = 0;

    var emails = [];
    if (currentDepth >= maxDepth) return emails;
    if (!obj || typeof obj !== 'object') return emails;

    try {
      var entries = Object.entries(obj);
      for (var i = 0; i < entries.length; i++) {
        var key = entries[i][0];
        var value = entries[i][1];
        var currentPath = path + '.' + key;

        if (typeof value === 'string') {
          if (value.indexOf('@') !== -1) {
            var found = extractAllEmailsFromString(value);
            for (var j = 0; j < found.length; j++) emails.push(found[j]);
          }
        } else if (Array.isArray(value)) {
          for (var k = 0; k < value.length; k++) {
            var arr = searchForEmailsRecursively(value[k], currentPath + '[' + k + ']', maxDepth, currentDepth + 1);
            for (var m = 0; m < arr.length; m++) emails.push(arr[m]);
          }
        } else if (value && typeof value === 'object') {
          var nested = searchForEmailsRecursively(value, currentPath, maxDepth, currentDepth + 1);
          for (var n = 0; n < nested.length; n++) emails.push(nested[n]);
        }
      }
    } catch (_err) {
      // Swallow traversal errors — caller already gets whatever we
      // collected before the throw. Pure module: no console here.
    }
    return emails;
  }

  /**
   * Pick the first customer-eligible email from a participants array,
   * preferring TO recipients, then FROM, then any other role.
   *
   * Iterates ALL participants in each tier before falling through —
   * fixing the regression where `.find()` would return only the first
   * match per role and skip later participants whose email passed the
   * customer filter.
   */
  function extractEmailFromParticipants(participants) {
    if (!Array.isArray(participants) || participants.length === 0) return null;

    function pickFromParticipant(p) {
      if (!p) return null;
      var direct = p.email || p.handle || p.address || (p.contact && p.contact.email);
      if (direct && isValidEmailForSearch(direct)) return direct;

      var contactEmails = p.contact && p.contact.emails;
      if (Array.isArray(contactEmails)) {
        for (var i = 0; i < contactEmails.length; i++) {
          var entry = contactEmails[i];
          var candidate = typeof entry === 'string' ? entry : (entry && entry.email);
          if (candidate && isValidEmailForSearch(candidate)) return candidate;
        }
      }
      return null;
    }

    var tiers = [
      participants.filter(function (p) { return p && p.role === 'to'; }),
      participants.filter(function (p) { return p && p.role === 'from'; }),
      participants.filter(function (p) { return !p || (p.role !== 'to' && p.role !== 'from'); }),
    ];

    for (var t = 0; t < tiers.length; t++) {
      var tier = tiers[t];
      for (var p = 0; p < tier.length; p++) {
        var found = pickFromParticipant(tier[p]);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Best-effort customer-email resolver for a Missive Conversation-like
   * payload. Tries shapes in this order:
   *   1. Documented latest_message fields: from_field, to_fields,
   *      cc_fields, bcc_fields.
   *   2. Contact-centric shapes (data.contact.{email,emails}).
   *   3. Top-level data.email / data.recipient.
   *   4. Thread/conversation participants.
   *   5. data.email_addresses[] (Missive conversation summary).
   *   6. Documented Conversation.messages[] (legacy short keys + long
   *      *_field keys, including CC/BCC).
   *   7. Free-text body fields (text/content/body/html/subject) and
   *      any string-valued top-level prop.
   *   8. Recursive scan as a last-ditch fallback.
   *
   * Use the documented `Missive.getEmailAddresses` (via
   * `getCustomerEmailFromAPI`) instead when possible — this function is
   * the offline / cache / older-client fallback.
   */
  function extractEmailFromData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    if (data.from_field && data.from_field.address && isValidEmailForSearch(data.from_field.address)) {
      return data.from_field.address;
    }

    var topRecipientFields = ['to_fields', 'cc_fields', 'bcc_fields'];
    for (var i = 0; i < topRecipientFields.length; i++) {
      var list = data[topRecipientFields[i]];
      if (!Array.isArray(list)) continue;
      for (var j = 0; j < list.length; j++) {
        var rec = list[j];
        if (rec && rec.address && isValidEmailForSearch(rec.address)) return rec.address;
      }
    }

    if (data.contact) {
      var c = data.contact;
      if (Array.isArray(c.emails) && c.emails.length > 0) {
        for (var ci = 0; ci < c.emails.length; ci++) {
          var entry = c.emails[ci];
          var candidate = typeof entry === 'string' ? entry : (entry && entry.email);
          if (candidate && isValidEmailForSearch(candidate)) return candidate;
        }
      }
      if (c.email && isValidEmailForSearch(c.email)) return c.email;
    }

    if (data.email && isValidEmailForSearch(data.email)) return data.email;

    if (data.recipient) {
      var r = data.recipient;
      var rcand = r.email || r.handle || r.address;
      if (rcand && isValidEmailForSearch(rcand)) return rcand;
    }

    if (data.thread && data.thread.participants) {
      var fromThread = extractEmailFromParticipants(data.thread.participants);
      if (fromThread) return fromThread;
    }
    if (data.participants) {
      var fromParts = extractEmailFromParticipants(data.participants);
      if (fromParts) return fromParts;
    }

    if (Array.isArray(data.email_addresses) && data.email_addresses.length > 0) {
      for (var ei = 0; ei < data.email_addresses.length; ei++) {
        var obj = data.email_addresses[ei];
        var addr = obj && (obj.address || obj.email);
        if (addr && isValidEmailForSearch(addr)) return addr;
      }
    }

    function pickFromMsgShortKeys(msg) {
      if (!msg) return null;
      var fromCandidate = msg.from && (msg.from.email || msg.from.handle || msg.from.address);
      if (fromCandidate && isValidEmailForSearch(fromCandidate)) return fromCandidate;
      var lists = [msg.to, msg.cc, msg.bcc];
      for (var li = 0; li < lists.length; li++) {
        var l = lists[li];
        if (!Array.isArray(l)) continue;
        for (var lj = 0; lj < l.length; lj++) {
          var entry2 = l[lj];
          var a = entry2 && (entry2.email || entry2.handle || entry2.address);
          if (a && isValidEmailForSearch(a)) return a;
        }
      }
      return null;
    }

    if (Array.isArray(data.messages)) {
      for (var mi = 0; mi < data.messages.length; mi++) {
        var hit = pickFromMsgShortKeys(data.messages[mi]);
        if (hit) return hit;
      }
    }
    if (data.message) {
      var hit2 = pickFromMsgShortKeys(data.message);
      if (hit2) return hit2;
    }

    var bodyFieldNames = ['text', 'content', 'body', 'html', 'subject'];
    for (var bi = 0; bi < bodyFieldNames.length; bi++) {
      var name = bodyFieldNames[bi];
      if (typeof data[name] === 'string') {
        var fromBody = extractEmailFromString(data[name]);
        if (fromBody) return fromBody;
      }
    }

    var dataEntries = Object.entries(data);
    for (var di = 0; di < dataEntries.length; di++) {
      var v = dataEntries[di][1];
      if (typeof v === 'string' && v.indexOf('@') !== -1) {
        var fromString = extractEmailFromString(v);
        if (fromString) return fromString;
      }
    }

    if (Array.isArray(data.messages)) {
      for (var mi2 = 0; mi2 < data.messages.length; mi2++) {
        var msg = data.messages[mi2];
        if (!msg) continue;

        if (msg.from_field && msg.from_field.address && isValidEmailForSearch(msg.from_field.address)) {
          return msg.from_field.address;
        }

        var msgRecipientFields = ['to_fields', 'cc_fields', 'bcc_fields'];
        for (var fi = 0; fi < msgRecipientFields.length; fi++) {
          var fieldList = msg[msgRecipientFields[fi]];
          if (!Array.isArray(fieldList)) continue;
          for (var fj = 0; fj < fieldList.length; fj++) {
            var recipient = fieldList[fj];
            if (recipient && recipient.address && isValidEmailForSearch(recipient.address)) {
              return recipient.address;
            }
          }
        }

        var msgBodyFieldNames = ['text', 'content', 'body', 'html'];
        for (var mbi = 0; mbi < msgBodyFieldNames.length; mbi++) {
          var msgFieldName = msgBodyFieldNames[mbi];
          if (typeof msg[msgFieldName] === 'string') {
            var fromMsgBody = extractEmailFromString(msg[msgFieldName]);
            if (fromMsgBody) return fromMsgBody;
          }
        }
      }
    }

    var foundEmails = searchForEmailsRecursively(data, 'data');
    for (var fei = 0; fei < foundEmails.length; fei++) {
      if (isValidEmailForSearch(foundEmails[fei])) return foundEmails[fei];
    }
    return null;
  }

  /**
   * Resolve the customer's email via the documented Missive JS API.
   *
   * `Missive.getEmailAddresses(conversations)` is synchronous, takes an
   * array of Conversation objects, and returns Array<AddressField>. The
   * API already flattens FROM / TO / CC / BCC / reply_to across every
   * message in the given conversations, so the first AddressField that
   * passes `isValidEmailForSearch` is the customer.
   *
   * `missive` is injected (not pulled from `window`) so this function
   * stays pure and testable. `MissWooApp` passes `window.Missive`.
   */
  function getCustomerEmailFromAPI(conversations, missive) {
    if (!Array.isArray(conversations) || conversations.length === 0) return null;
    if (!missive || typeof missive.getEmailAddresses !== 'function') return null;

    var addresses;
    try {
      addresses = missive.getEmailAddresses(conversations);
    } catch (_err) {
      return null;
    }
    if (!Array.isArray(addresses) || addresses.length === 0) return null;

    for (var i = 0; i < addresses.length; i++) {
      var a = addresses[i];
      if (a && isValidEmailForSearch(a.address)) return a.address;
    }
    return null;
  }

  return {
    isValidEmailForSearch: isValidEmailForSearch,
    extractAllEmailsFromString: extractAllEmailsFromString,
    extractEmailFromString: extractEmailFromString,
    searchForEmailsRecursively: searchForEmailsRecursively,
    extractEmailFromParticipants: extractEmailFromParticipants,
    extractEmailFromData: extractEmailFromData,
    getCustomerEmailFromAPI: getCustomerEmailFromAPI,
  };
}));
