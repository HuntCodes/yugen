// React Native compatible WebSocket implementation
// Use this instead of 'ws' package when you need WebSocket functionality

interface WebSocketClientListeners {
  open: ((event: WebSocketEventMap['open']) => void)[];
  message: ((event: WebSocketEventMap['message']) => void)[];
  close: ((event: WebSocketEventMap['close']) => void)[];
  error: ((event: WebSocketEventMap['error']) => void)[];
}

/**
 * WebSocket client implementation compatible with React Native
 */
class WebSocketClient {
  private url: string;
  private protocols: string[];
  private ws: WebSocket | null;
  private isConnected: boolean;
  private listeners: WebSocketClientListeners;

  constructor(url: string, protocols: string[] = []) {
    this.url = url;
    this.protocols = protocols;
    this.ws = null;
    this.isConnected = false;
    this.listeners = {
      open: [],
      message: [],
      close: [],
      error: [],
    };
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): WebSocketClient {
    // Use the native WebSocket implementation
    this.ws = new WebSocket(this.url, this.protocols);

    this.ws.onopen = (event) => {
      this.isConnected = true;
      this.listeners.open.forEach((listener) => listener(event));
    };

    this.ws.onmessage = (event) => {
      this.listeners.message.forEach((listener) => listener(event));
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.listeners.close.forEach((listener) => listener(event));
    };

    this.ws.onerror = (error) => {
      this.listeners.error.forEach((listener) => listener(error));
    };

    return this;
  }

  /**
   * Add an event listener for WebSocket events
   */
  on(event: keyof WebSocketClientListeners, callback: any): WebSocketClient {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  /**
   * Send data through the WebSocket connection
   */
  send(data: string | ArrayBufferLike | ArrayBufferView): WebSocketClient {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected');
    }

    if (typeof data === 'object' && !ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer)) {
      data = JSON.stringify(data);
    }

    this.ws.send(data);
    return this;
  }

  /**
   * Close the WebSocket connection
   */
  close(code?: number, reason?: string): WebSocketClient {
    if (this.ws) {
      this.ws.close(code, reason);
    }
    return this;
  }
}

export default WebSocketClient;
