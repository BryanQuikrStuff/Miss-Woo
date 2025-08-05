class TrackingUtility {
  // Extract tracking information from order notes
  static extractTrackingInfo(order, orderNotes = null) {
    const trackingInfo = {
      tracking_number: null,
      carrier: null,
      tracking_url: null,
      shipped_date: null,
      status: 'No tracking info found',
      note_content: null,
      woo_commerce_url: null
    };

    // Generate WooCommerce order URL
    if (order.id) {
      const config = require('../config/api');
      trackingInfo.woo_commerce_url = `${config.siteUrl}/wp-admin/post.php?post=${order.id}&action=edit`;
    }

    // Look for tracking in order notes (if provided)
    if (orderNotes && orderNotes.length > 0) {
      // Find the most recent note that contains tracking information
      const trackingNote = orderNotes.find(note => 
        note.note && note.note.toLowerCase().includes('tracking number')
      );
      
      if (trackingNote) {
        const noteContent = trackingNote.note;
        trackingInfo.note_content = noteContent;
        
        // Look for tracking number pattern (10-12 digits)
        const trackingNumberMatch = noteContent.match(/\b(\d{10,12})\b/);
        if (trackingNumberMatch) {
          trackingInfo.tracking_number = trackingNumberMatch[1];
        }
        
        // Look for carrier information
        if (noteContent.toLowerCase().includes('fedex')) {
          trackingInfo.carrier = 'FedEx';
        } else if (noteContent.toLowerCase().includes('ups')) {
          trackingInfo.carrier = 'UPS';
        } else if (noteContent.toLowerCase().includes('usps')) {
          trackingInfo.carrier = 'USPS';
        } else if (noteContent.toLowerCase().includes('dhl')) {
          trackingInfo.carrier = 'DHL';
        }
        
        // Look for shipped date
        const dateMatch = noteContent.match(/(?:shipped|on)\s+(?:August|September|October|November|December|January|February|March|April|May|June|July)\s+\d{1,2},?\s+\d{4}/i);
        if (dateMatch) {
          trackingInfo.shipped_date = dateMatch[0];
        }
        
        // Update status if we found tracking info
        if (trackingInfo.tracking_number) {
          trackingInfo.status = 'Tracking found in order notes';
        }
      }
    }

    // Look for tracking in order.note as fallback
    if (!trackingInfo.tracking_number && order.note && order.note !== '') {
      const noteContent = order.note;
      trackingInfo.note_content = noteContent;
      
      // Look for tracking number pattern (10-12 digits)
      const trackingNumberMatch = noteContent.match(/\b(\d{10,12})\b/);
      if (trackingNumberMatch) {
        trackingInfo.tracking_number = trackingNumberMatch[1];
      }
      
      // Look for carrier information
      if (noteContent.toLowerCase().includes('fedex')) {
        trackingInfo.carrier = 'FedEx';
      } else if (noteContent.toLowerCase().includes('ups')) {
        trackingInfo.carrier = 'UPS';
      } else if (noteContent.toLowerCase().includes('usps')) {
        trackingInfo.carrier = 'USPS';
      } else if (noteContent.toLowerCase().includes('dhl')) {
        trackingInfo.carrier = 'DHL';
      }
      
      // Look for shipped date
      const dateMatch = noteContent.match(/(?:shipped|on)\s+(?:August|September|October|November|December|January|February|March|April|May|June|July)\s+\d{1,2},?\s+\d{4}/i);
      if (dateMatch) {
        trackingInfo.shipped_date = dateMatch[0];
      }
      
      // Update status if we found tracking info
      if (trackingInfo.tracking_number) {
        trackingInfo.status = 'Tracking found in order notes';
      }
    }

    // Also check meta_data as fallback
    if (order.meta_data && !trackingInfo.tracking_number) {
      order.meta_data.forEach(meta => {
        const key = meta.key.toLowerCase();
        const value = meta.value;

        if (key.includes('tracking') && key.includes('number')) {
          trackingInfo.tracking_number = value;
        } else if (key.includes('tracking') && key.includes('carrier')) {
          trackingInfo.carrier = value;
        } else if (key.includes('tracking') && key.includes('url')) {
          trackingInfo.tracking_url = value;
        } else if (key.includes('shipped') || key.includes('shipment')) {
          trackingInfo.shipped_date = value;
        }
      });
    }

    // Generate tracking URL if we have tracking number and carrier
    if (trackingInfo.tracking_number && trackingInfo.carrier) {
      trackingInfo.tracking_url = this.generateTrackingUrl(trackingInfo.tracking_number, trackingInfo.carrier);
      trackingInfo.status = 'Tracking available';
    }

    return trackingInfo;
  }
  
    // Generate tracking URLs for major carriers
    static generateTrackingUrl(trackingNumber, carrier) {
      const carrierLower = carrier.toLowerCase();
      
      if (carrierLower.includes('fedex')) {
        return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
      } else if (carrierLower.includes('ups')) {
        return `https://www.ups.com/track?tracknum=${trackingNumber}`;
      } else if (carrierLower.includes('usps')) {
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      } else if (carrierLower.includes('dhl')) {
        return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
      } else {
        // Generic tracking URL
        return `https://www.google.com/search?q=${carrier}+tracking+${trackingNumber}`;
      }
    }
  }
  
  module.exports = TrackingUtility;