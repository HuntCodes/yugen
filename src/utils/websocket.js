// React Native compatible WebSocket implementation
// Use this instead of 'ws' package when you need WebSocket functionality

class WebSocketClient {
  constructor(url, protocols = []) {
    this.url = url;
    this.protocols = protocols;
    this.ws = null;
    this.isConnected = false;
    this.listeners = {
      open: [],
      message: [],
      close: [],
      error: []
    };
  }

  connect() {
    // Use the native WebSocket implementation
    this.ws = new WebSocket(this.url, this.protocols);
    
    this.ws.onopen = (event) => {
      this.isConnected = true;
      this.listeners.open.forEach(listener => listener(event));
    };
    
    this.ws.onmessage = (event) => {
      this.listeners.message.forEach(listener => listener(event));
    };
    
    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.listeners.close.forEach(listener => listener(event));
    };
    
    this.ws.onerror = (error) => {
      this.listeners.error.forEach(listener => listener(error));
    };
    
    return this;
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  send(data) {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }
    
    if (typeof data === 'object' && !ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer)) {
      data = JSON.stringify(data);
    }
    
    this.ws.send(data);
    return this;
  }

  close(code, reason) {
    if (this.ws) {
      this.ws.close(code, reason);
    }
    return this;
  }
}

export default WebSocketClient; 