// Content script - runs on web pages and communicates between popup and injected script
class ContentScriptHandler {
  constructor() {
    this.embedder = null;
    this.isInjected = false;
    this.messageQueue = [];
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });
    
    // Listen for messages from injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data.source === 'solana-pixel-embedder') {
        this.handleInjectedMessage(event.data);
      }
    });
    
    // Inject the embedder script
    this.injectEmbedder();
  }

  async injectEmbedder() {
    try {
      // CRITICAL: Inject into PAGE CONTEXT, not content script context
      // This method ensures the script runs in the same context as manual console scripts
      
      // Method 1: Try loading as external script (most reliable)
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = () => {
        this.isInjected = true;
        console.log('✅ Solana Pixel Embedder injected into PAGE CONTEXT');
        this.processMessageQueue();
      };
      script.onerror = (error) => {
        console.error('❌ Failed to inject embedder script:', error);
        // Fallback to inline injection if external fails
        this.injectInline();
      };
      
      // Inject into page context (same as manual script)
      (document.head || document.documentElement).appendChild(script);
      
    } catch (error) {
      console.error('❌ Failed to inject embedder script:', error);
      this.injectInline();
    }
  }

  async injectInline() {
    try {
      console.log('🔄 Trying inline injection as fallback...');
      
      // Fetch the script content and inject it inline
      const response = await fetch(chrome.runtime.getURL('injected.js'));
      const scriptContent = await response.text();
      
      const script = document.createElement('script');
      script.textContent = scriptContent;
      script.onload = () => {
        this.isInjected = true;
        console.log('✅ Embedder injected inline into PAGE CONTEXT');
        this.processMessageQueue();
      };
      
      (document.head || document.documentElement).appendChild(script);
      
    } catch (error) {
      console.error('❌ Inline injection also failed:', error);
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const { request, sendResponse } = this.messageQueue.shift();
      this.handleMessage(request, null, sendResponse);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    if (!this.isInjected) {
      // Queue the message until injection is complete
      this.messageQueue.push({ request, sendResponse });
      return;
    }

    try {
      switch (request.action) {
        case 'checkConnection':
          this.checkConnection(sendResponse);
          break;
          
        case 'startEmbedding':
          await this.startEmbedding(request.pixels, request.checkExisting, sendResponse);
          break;
          
        case 'getStatus':
          this.getStatus(sendResponse);
          break;
          
        case 'stopEmbedding':
          this.stopEmbedding(sendResponse);
          break;
          
        case 'checkSession':
          this.checkSession(sendResponse);
          break;
          
        case 'resumeEmbedding':
          this.resumeEmbedding(request.validateMode, sendResponse);
          break;
          
        case 'clearSession':
          this.clearSession(sendResponse);
          break;
          
        case 'validateImage':
          this.validateImage(sendResponse);
          break;
          
        default:
          sendResponse({success: false, error: 'Unknown action'});
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({success: false, error: error.message});
    }
  }

  // Store response callbacks for async operations
  responseCallbacks = new Map();
  
  generateCallbackId() {
    return 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  sendMessageToPage(action, data = {}, sendResponse = null) {
    const callbackId = this.generateCallbackId();
    
    if (sendResponse) {
      this.responseCallbacks.set(callbackId, sendResponse);
      
      // Clean up callback after timeout
      setTimeout(() => {
        if (this.responseCallbacks.has(callbackId)) {
          this.responseCallbacks.delete(callbackId);
          sendResponse({success: false, error: 'Timeout'});
        }
      }, 10000);
    }
    
    window.postMessage({
      source: 'solana-pixel-embedder-content',
      action,
      data,
      callbackId
    }, '*');
  }

  handleInjectedMessage(message) {
    if (message.callbackId && this.responseCallbacks.has(message.callbackId)) {
      const callback = this.responseCallbacks.get(message.callbackId);
      this.responseCallbacks.delete(message.callbackId);
      callback(message.response);
    }
  }

  checkConnection(sendResponse) {
    this.sendMessageToPage('checkConnection', {}, sendResponse);
  }

  async startEmbedding(pixels, checkExisting, sendResponse) {
    if (!pixels || pixels.length === 0) {
      sendResponse({success: false, error: 'No pixels provided'});
      return;
    }

    // Send success immediately since embedding is async
    sendResponse({success: true, message: 'Embedding started'});
    
    // Start the actual embedding process
    this.sendMessageToPage('startEmbedding', {
      pixels: pixels,
      checkExisting: checkExisting
    }, (result) => {
      // Log the result but don't send response (already sent)
      if (result.success) {
        console.log('✅ Embedding process initiated successfully');
      } else {
        console.error('❌ Embedding process failed:', result.error);
      }
    });
  }

  getStatus(sendResponse) {
    this.sendMessageToPage('getStatus', {}, sendResponse);
  }

  stopEmbedding(sendResponse) {
    this.sendMessageToPage('stopEmbedding', {}, sendResponse);
  }

  checkSession(sendResponse) {
    this.sendMessageToPage('checkSession', {}, sendResponse);
  }

  resumeEmbedding(validateMode, sendResponse) {
    this.sendMessageToPage('resumeEmbedding', { validateMode }, sendResponse);
  }

  clearSession(sendResponse) {
    this.sendMessageToPage('clearSession', {}, sendResponse);
  }

  validateImage(sendResponse) {
    this.sendMessageToPage('validateImage', {}, sendResponse);
  }
}

// Initialize the content script handler
new ContentScriptHandler();