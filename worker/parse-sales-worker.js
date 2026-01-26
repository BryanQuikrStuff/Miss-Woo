// Worker: parse-sales-worker.js
// Parses large sales export JSON in background thread to avoid blocking UI

self.onmessage = async (e) => {
  const { action, url } = e.data;
  if (action !== 'parse') {
    self.postMessage({ success: false, error: 'Unknown action' });
    return;
  }

  try {
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const text = await res.text();

    // Parse large JSON in worker (doesn't block main thread)
    const data = JSON.parse(text);

    // Build lookup map: orderNo -> record
    const idMap = Object.create(null);

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const orderNo = String(record.SalesOrderNo || record.id || record.order_number || '');
      
      // Only process valid numeric order numbers
      if (orderNo && !isNaN(parseInt(orderNo))) {
        idMap[orderNo] = record;
      }
    }

    self.postMessage({ 
      success: true, 
      stats: { total: data.length, indexed: Object.keys(idMap).length },
      idMap 
    });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};

