import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Track a product view event
 */
export const trackProductView = async (
  productId: string, 
  userId: string,
  productName: string
): Promise<void> => {
  try {
    // Save to local storage for analytics
    await logEvent('product_view', {
      product_id: productId,
      user_id: userId,
      product_name: productName,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error tracking product view:', error);
  }
};

/**
 * Track a product purchase event
 */
export const trackPurchase = async (
  productId: string,
  userId: string,
  productName: string,
  price: string
): Promise<void> => {
  try {
    // Save to local storage for analytics
    await logEvent('purchase', {
      product_id: productId,
      user_id: userId,
      product_name: productName,
      price,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error tracking purchase:', error);
  }
};

/**
 * Log an event to local storage
 */
const logEvent = async (eventName: string, eventData: any): Promise<void> => {
  try {
    // Get existing events
    const eventsJson = await AsyncStorage.getItem('analytics_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];
    
    // Add new event with common data
    events.push({
      event_name: eventName,
      event_data: eventData,
      device: Platform.OS,
      app_version: '1.0.0', // Replace with actual version
    });
    
    // Save back to storage
    await AsyncStorage.setItem('analytics_events', JSON.stringify(events));
    
    // If we had a server endpoint, we could also send it there
    // sendEventToServer(eventName, eventData);
  } catch (error) {
    console.error('Error logging event:', error);
  }
};

/**
 * Placeholder for sending events to a server
 */
const sendEventToServer = async (eventName: string, eventData: any): Promise<void> => {
  // In a real app, you would implement this to send the data to your analytics server
  // This is just a placeholder
  try {
    // Example implementation
    /* 
    await fetch('https://analytics.example.com/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        event_data: eventData,
        api_key: 'YOUR_API_KEY',
      }),
    });
    */
  } catch (error) {
    console.error('Error sending event to server:', error);
  }
}; 