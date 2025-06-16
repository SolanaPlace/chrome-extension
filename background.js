// Background service worker for the Chrome extension
class BackgroundService {
  constructor() {
    this.initializeListeners();
  }

  initializeListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle messages from content scripts or popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Handle tab updates to check if we need to reinject scripts
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  handleInstallation(details) {
    if (details.reason === 'install') {
      console.log('Solana Pixel Embedder installed successfully');
      
      // Set default settings
      chrome.storage.sync.set({
        settings: {
          autoDetectSolanaPlace: true,
          showNotifications: true,
          defaultMaxWidth: 100,
          defaultMode: 'fast' // Changed to fast mode as default
        }
      });
      
      // Open options page or show welcome message
      this.showWelcomeNotification();
    } else if (details.reason === 'update') {
      console.log('Solana Pixel Embedder updated to version', chrome.runtime.getManifest().version);
    }
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'getSettings':
        this.getSettings(sendResponse);
        break;
        
      case 'saveSettings':
        this.saveSettings(request.settings, sendResponse);
        break;
        
      case 'showNotification':
        this.showNotification(request.title, request.message, request.type);
        sendResponse({success: true});
        break;
        
      case 'checkPermissions':
        this.checkPermissions(sendResponse);
        break;
        
      default:
        sendResponse({success: false, error: 'Unknown action'});
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Check if this is a Solana Place-related page
    if (changeInfo.status === 'complete' && tab.url) {
      const isSolanaPlace = this.isSolanaPlaceURL(tab.url);
      
      if (isSolanaPlace) {
        // Update extension icon to indicate compatibility
        this.updateExtensionIcon(tabId, true);
        
        // Send notification if auto-detect is enabled
        this.checkAutoDetectSettings().then(autoDetect => {
          if (autoDetect) {
            this.showNotification(
              'Solana Place Detected',
              'Pixel Embedder is ready to use on this page!',
              'info'
            );
          }
        });
      } else {
        this.updateExtensionIcon(tabId, false);
      }
    }
  }

  isSolanaPlaceURL(url) {
    // Only match solanaplace.fun specifically
    return url.includes('solanaplace.fun');
  }

  updateExtensionIcon(tabId, isCompatible) {
    const iconPath = isCompatible ? {
      "16": "icons/icon16-active.png",
      "48": "icons/icon48-active.png",
      "128": "icons/icon128-active.png"
    } : {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    };
    
    chrome.action.setIcon({
      tabId: tabId,
      path: iconPath
    });
  }

  async getSettings(sendResponse) {
    try {
      const result = await chrome.storage.sync.get('settings');
      const defaultSettings = {
        autoDetectSolanaPlace: true,
        showNotifications: true,
        defaultMaxWidth: 100,
        defaultMode: 'fast', // Changed to fast mode as default
        safetyDelay: 400,
        burstLimit: 15
      };
      
      const settings = { ...defaultSettings, ...result.settings };
      sendResponse({success: true, settings});
    } catch (error) {
      sendResponse({success: false, error: error.message});
    }
  }

  async saveSettings(settings, sendResponse) {
    try {
      await chrome.storage.sync.set({settings});
      sendResponse({success: true});
    } catch (error) {
      sendResponse({success: false, error: error.message});
    }
  }

  async checkAutoDetectSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      return result.settings?.autoDetectSolanaPlace ?? true;
    } catch (error) {
      return true; // Default to true
    }
  }

  showNotification(title, message, type = 'info') {
    // Check if notifications are enabled and available
    this.checkNotificationSettings().then(enabled => {
      if (enabled && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: title,
          message: message
        }).catch(error => {
          console.log('Notification failed:', error);
        });
      }
    }).catch(error => {
      console.log('Notification settings check failed:', error);
    });
  }

  async checkNotificationSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      return result.settings?.showNotifications ?? true;
    } catch (error) {
      return true; // Default to true
    }
  }

  showWelcomeNotification() {
    // Check if notifications API is available
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Solana Pixel Embedder Installed!',
        message: 'Navigate to solanaplace.fun and click the extension icon to start embedding pixel art.'
      }).catch(error => {
        console.log('Welcome notification failed:', error);
      });
    } else {
      console.log('Notifications API not available');
    }
  }

  async checkPermissions(sendResponse) {
    try {
      const permissions = await chrome.permissions.getAll();
      sendResponse({
        success: true,
        permissions: permissions.permissions,
        origins: permissions.origins
      });
    } catch (error) {
      sendResponse({success: false, error: error.message});
    }
  }
}

// Initialize the background service
new BackgroundService();