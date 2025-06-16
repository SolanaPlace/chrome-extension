class PixelEmbedderUI {
  constructor() {
    this.currentImage = null;
    this.currentPixels = [];
    this.isEmbedding = false;
    this.progressInterval = null;
    this.currentCredits = null;
    this.connectedTabId = null; // NEW: Store the connected tab ID
    
    this.initializeUI();
    
    // Check connection and active sessions when popup opens
    setTimeout(() => {
      this.checkConnectionStatus();
      this.loadResumeData();
      this.loadHistory();
    }, 500);
  }

  initializeUI() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Image upload
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    
    uploadArea.addEventListener('click', () => imageInput.click());
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#9945FF';
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = 'rgba(153, 69, 255, 0.5)';
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = 'rgba(153, 69, 255, 0.5)';
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleImageUpload(files[0]);
      }
    });
    
    imageInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImageUpload(e.target.files[0]);
      }
    });

    // Remove image button
    document.getElementById('removeImage').addEventListener('click', () => {
      this.removeImage();
    });

    // Center button
    document.getElementById('centerBtn').addEventListener('click', () => {
      const maxWidth = parseInt(document.getElementById('maxWidth').value);
      const centerX = Math.floor((1000 - maxWidth) / 2);
      const centerY = Math.floor((1000 - maxWidth) / 2);
      document.getElementById('startX').value = centerX;
      document.getElementById('startY').value = centerY;
      this.updateEstimation();
    });

    // Input changes
    ['startX', 'startY', 'maxWidth'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        this.updateEstimation();
      });
    });

    // Start embedding button
    document.getElementById('startEmbedding').addEventListener('click', () => {
      this.startEmbedding();
    });

    // Resume functionality
    document.getElementById('resumeBtn').addEventListener('click', () => {
      this.resumeEmbedding();
    });

    document.getElementById('clearSessionBtn').addEventListener('click', () => {
      this.clearSession();
    });

    // Validate functionality
    document.getElementById('validateBtn').addEventListener('click', () => {
      this.validateImage();
    });

    // Stop button
    document.getElementById('stopBtn').addEventListener('click', () => {
      this.stopEmbedding();
    });

    // History functionality
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
      this.clearHistory();
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Refresh data when switching tabs
    if (tabName === 'resume') {
      this.loadResumeData();
    } else if (tabName === 'history') {
      this.loadHistory();
    }
  }

  // IMPROVED: Check ALL solanaplace.fun tabs, not just the active one
  async checkConnectionStatus() {
    try {
      // Check ALL solanaplace.fun tabs, not just the active one
      const solanaPlaceTabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
      
      if (solanaPlaceTabs.length === 0) {
        this.updateConnectionStatus(false, 'No Solana Place tabs');
        return;
      }

      console.log(`🔍 Found ${solanaPlaceTabs.length} Solana Place tab(s), checking connection...`);

      // Try each tab until we find one that's connected
      let bestConnection = null;
      let checkedTabs = 0;

      for (const tab of solanaPlaceTabs) {
        try {
          // Skip chrome:// or extension pages
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            continue;
          }

          checkedTabs++;
          console.log(`🔍 Checking tab ${checkedTabs}: ${tab.url}`);

          // Check connection on this specific tab
          const response = await this.checkTabConnection(tab.id);
          
          if (response && response.connected) {
            console.log(`✅ Found connected tab: ${tab.url}`);
            bestConnection = response;
            this.connectedTabId = tab.id; // Store for future use
            break; // Found a good connection, stop searching
          } else {
            console.log(`❌ Tab not connected: ${tab.url}`);
          }
        } catch (error) {
          console.log(`⚠️ Error checking tab ${tab.id}:`, error.message);
          continue; // Try next tab
        }
      }

      if (bestConnection) {
        this.updateConnectionStatus(true, 'Connected');
        this.updateCredits(bestConnection.credits);
        
        // ALSO check if there's an active embedding session
        this.checkForActiveEmbedding();
      } else {
        this.updateConnectionStatus(false, `No connection (${checkedTabs} tabs checked)`);
      }

    } catch (error) {
      console.error('❌ Error in connection check:', error);
      this.updateConnectionStatus(false, 'Check failed');
    }
  }

  // Helper method to check a specific tab's connection
  checkTabConnection(tabId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null); // Timeout means no connection
      }, 3000); // 3 second timeout per tab

      chrome.tabs.sendMessage(tabId, {action: 'checkConnection'}, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          console.log(`Tab ${tabId} error:`, chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  // NEW: Check for active embedding across all tabs
  async checkForActiveEmbedding() {
    if (!this.connectedTabId) return;

    try {
      const response = await this.getTabStatus(this.connectedTabId);
      
      if (response && response.success && response.isPlacing) {
        console.log('🔄 Found active embedding session');
        this.isEmbedding = true;
        this.showProgressSection();
        this.startProgressTracking();
        
        // Update the start button state
        const btn = document.getElementById('startEmbedding');
        if (btn) {
          btn.querySelector('.btn-text').textContent = 'Embedding in Progress';
          btn.disabled = true;
        }
      }
    } catch (error) {
      console.log('⚠️ Error checking for active embedding:', error);
    }
  }

  // Helper method to get status from a specific tab
  getTabStatus(tabId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 3000);

      chrome.tabs.sendMessage(tabId, {action: 'getStatus'}, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  updateConnectionStatus(connected, message) {
    const statusEl = document.getElementById('connectionStatus');
    const dot = statusEl.querySelector('.status-dot');
    const span = statusEl.querySelector('span');
    
    if (connected) {
      dot.classList.add('connected');
      span.textContent = message;
    } else {
      dot.classList.remove('connected');
      span.textContent = message;
    }
  }

  updateCredits(credits) {
    const creditsDisplay = document.getElementById('creditsDisplay');
    this.currentCredits = credits;
    
    if (credits !== null && credits !== undefined) {
      creditsDisplay.textContent = credits.toLocaleString();
      creditsDisplay.style.color = credits > 0 ? '#14F195' : '#ff4444';
    } else {
      creditsDisplay.textContent = '-';
      creditsDisplay.style.color = '#666';
    }
    
    // Update estimation when credits change
    this.updateEstimation();
  }

  async handleImageUpload(file) {
    if (!file.type.match(/^image\/(png|jpe?g)$/)) {
      alert('Please select a PNG or JPEG image file.');
      return;
    }

    try {
      this.currentImage = file;
      
      // Show preview
      const preview = document.getElementById('imagePreview');
      const previewImg = document.getElementById('previewImg');
      const imageSize = document.getElementById('imageSize');
      
      const url = URL.createObjectURL(file);
      previewImg.src = url;
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        imageSize.textContent = `${img.width}×${img.height}`;
        URL.revokeObjectURL(url);
        this.updateEstimation();
      };
      img.src = url;
      
      preview.style.display = 'block';
      document.getElementById('uploadArea').style.display = 'none';
      
      // Enable start button (will be disabled again in updateEstimation if insufficient credits)
      document.getElementById('startEmbedding').disabled = false;
      
    } catch (error) {
      console.error('Error handling image upload:', error);
      alert('Error processing image. Please try again.');
    }
  }

  removeImage() {
    this.currentImage = null;
    this.currentPixels = [];
    
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('estimation').style.display = 'none';
    document.getElementById('startEmbedding').disabled = true;
  }

  async updateEstimation() {
    if (!this.currentImage) return;

    try {
      const startX = parseInt(document.getElementById('startX').value);
      const startY = parseInt(document.getElementById('startY').value);
      const maxWidth = parseInt(document.getElementById('maxWidth').value);
      
      // Process image to get pixel count
      const pixels = await this.processImage(this.currentImage, startX, startY, maxWidth);
      this.currentPixels = pixels;
      
      const pixelCount = pixels.length;
      const timeInMinutes = Math.ceil(pixelCount / 150); // 150 pixels per minute
      
      document.getElementById('pixelCount').textContent = pixelCount.toLocaleString();
      document.getElementById('timeEstimate').textContent = `${timeInMinutes} min`;
      document.getElementById('estimation').style.display = 'block';
      
      // Check credit sufficiency and update UI accordingly
      this.checkCreditSufficiency(pixelCount);
      
    } catch (error) {
      console.error('Error updating estimation:', error);
    }
  }

  checkCreditSufficiency(pixelCount) {
    const startBtn = document.getElementById('startEmbedding');
    const estimation = document.getElementById('estimation');
    
    // Remove any existing warning
    const existingWarning = estimation.querySelector('.credit-warning');
    if (existingWarning) {
      existingWarning.remove();
    }
    
    if (this.currentCredits !== null && this.currentCredits !== undefined) {
      if (this.currentCredits < pixelCount) {
        // Insufficient credits - show warning and disable button
        const shortage = pixelCount - this.currentCredits;
        const warningDiv = document.createElement('div');
        warningDiv.className = 'credit-warning';
        warningDiv.innerHTML = `
          <div class="est-item" style="color: #ff4444; font-weight: 600;">
            <span>⚠️ Insufficient Credits</span>
            <span></span>
          </div>
          <div class="est-item" style="color: #ff4444; font-size: 10px;">
            <span>Need ${shortage.toLocaleString()} more credits</span>
            <span>Will be incomplete</span>
          </div>
        `;
        estimation.appendChild(warningDiv);
        
        // Update button text and style
        startBtn.querySelector('.btn-text').textContent = 'Start Incomplete Embedding';
        startBtn.style.background = 'linear-gradient(135deg, #ff6b35 0%, #ff4444 100%)';
        startBtn.disabled = false; // Allow user to proceed if they want
        
      } else {
        // Sufficient credits - normal state
        startBtn.querySelector('.btn-text').textContent = 'Start Embedding';
        startBtn.style.background = 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
        startBtn.disabled = false;
      }
    } else {
      // Credits unknown - allow but warn
      const warningDiv = document.createElement('div');
      warningDiv.className = 'credit-warning';
      warningDiv.innerHTML = `
        <div class="est-item" style="color: #ffa500; font-size: 10px;">
          <span>⚠️ Credits unknown - check manually</span>
          <span></span>
        </div>
      `;
      estimation.appendChild(warningDiv);
      
      startBtn.querySelector('.btn-text').textContent = 'Start Embedding';
      startBtn.style.background = 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
      startBtn.disabled = false;
    }
  }

  async processImage(file, startX, startY, maxWidth) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const scale = Math.min(maxWidth / img.width, maxWidth / img.height);
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = [];
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const a = imageData.data[i + 3];
            
            if (a < 128) continue;
            
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
            
            pixels.push({
              x: startX + x,
              y: startY + y,
              color: color
            });
          }
        }
        
        resolve(pixels);
      };
      
      img.onerror = () => resolve([]);
      img.src = URL.createObjectURL(file);
    });
  }

  // IMPROVED: Use connected tab instead of active tab
  async startEmbedding() {
    if (!this.currentImage || this.currentPixels.length === 0) {
      alert('Please select an image first.');
      return;
    }

    // Use the connected tab we found, not necessarily the active one
    let targetTab = null;
    
    if (this.connectedTabId) {
      try {
        targetTab = await chrome.tabs.get(this.connectedTabId);
      } catch (error) {
        console.log('⚠️ Stored tab no longer exists, finding new one...');
        this.connectedTabId = null;
      }
    }
    
    // If no stored tab or it's gone, find a solanaplace.fun tab
    if (!targetTab) {
      const solanaPlaceTabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
      if (solanaPlaceTabs.length === 0) {
        alert('Please navigate to solanaplace.fun first.');
        return;
      }
      targetTab = solanaPlaceTabs[0];
      this.connectedTabId = targetTab.id;
    }

    // Check credits one more time and confirm if insufficient
    if (this.currentCredits !== null && this.currentCredits < this.currentPixels.length) {
      const shortage = this.currentPixels.length - this.currentCredits;
      const willComplete = this.currentCredits;
      const willMiss = shortage;
      
      const confirmed = confirm(
        `⚠️ INSUFFICIENT CREDITS WARNING\n\n` +
        `Your image needs ${this.currentPixels.length.toLocaleString()} pixels but you only have ${this.currentCredits.toLocaleString()} credits.\n\n` +
        `This means:\n` +
        `✅ ${willComplete.toLocaleString()} pixels will be placed\n` +
        `❌ ${willMiss.toLocaleString()} pixels will be missing\n\n` +
        `Do you want to proceed with an incomplete embedding?`
      );
      
      if (!confirmed) {
        return; // User cancelled
      }
    }

    // Create history entry for the start of embedding
    const historyEntry = this.createHistoryEntry();

    // Always use fast embed (checkExisting = false)
    const checkExisting = false;
    
    try {
      // Show loading state
      const btn = document.getElementById('startEmbedding');
      btn.querySelector('.btn-text').style.display = 'none';
      btn.querySelector('.btn-loading').style.display = 'flex';
      btn.disabled = true;
      
      console.log(`🚀 Starting embedding on tab ${targetTab.id}: ${targetTab.url}`);
      
      // Give the message more time to complete since embedding is async
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 30000); // 30 second timeout
      });
      
      const messagePromise = new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(targetTab.id, {
          action: 'startEmbedding',
          pixels: this.currentPixels,
          checkExisting: checkExisting
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        });
      });
      
      // Race between message and timeout
      const response = await Promise.race([messagePromise, timeoutPromise]);
      
      console.log('✅ Embedding started successfully');
      
      // Save the history entry
      await this.saveHistoryEntry(historyEntry);
      
      this.isEmbedding = true;
      this.showProgressSection();
      this.startProgressTracking();
      
    } catch (error) {
      console.error('❌ Error starting embedding:', error);
      
      // Update history entry with failure
      historyEntry.status = 'failed';
      historyEntry.endTime = Date.now();
      historyEntry.error = error.message;
      await this.saveHistoryEntry(historyEntry);
      
      // Check if embedding might have started anyway (common with async operations)
      setTimeout(async () => {
        try {
          const statusResponse = await this.getTabStatus(targetTab.id);
          if (statusResponse && statusResponse.isPlacing) {
            console.log('🔄 Embedding actually started despite error message');
            this.isEmbedding = true;
            this.showProgressSection();
            this.startProgressTracking();
          } else {
            // Only show error if embedding really didn't start
            if (error.message !== 'Timeout') {
              alert('Failed to start embedding. Make sure you\'re on the Solana Place website and try again.');
            } else {
              // For timeout, check if it's actually working
              alert('Embedding may have started. Check the console and progress section.');
              this.showProgressSection();
              this.startProgressTracking();
            }
          }
        } catch (checkError) {
          console.error('Error checking status after failed start:', checkError);
        }
      }, 2000);
      
      this.resetStartButton();
    }
  }

  createHistoryEntry() {
    const startX = parseInt(document.getElementById('startX').value);
    const startY = parseInt(document.getElementById('startY').value);
    const maxWidth = parseInt(document.getElementById('maxWidth').value);
    
    return {
      id: 'embed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      imageName: this.currentImage ? this.currentImage.name : 'Unknown Image',
      startTime: Date.now(),
      endTime: null,
      coordinates: {
        x: startX,
        y: startY,
        maxWidth: maxWidth
      },
      pixelCount: this.currentPixels.length,
      pixelsPlaced: 0,
      errors: 0,
      status: 'in_progress',
      creditsUsed: null,
      creditsAtStart: this.currentCredits,
      error: null
    };
  }

  async saveHistoryEntry(entry) {
    try {
      const result = await chrome.storage.local.get('embeddingHistory');
      const history = result.embeddingHistory || [];
      
      // Find existing entry or add new one
      const existingIndex = history.findIndex(h => h.id === entry.id);
      if (existingIndex >= 0) {
        history[existingIndex] = entry;
      } else {
        history.unshift(entry); // Add to beginning
      }
      
      // Keep only last 50 entries
      if (history.length > 50) {
        history.splice(50);
      }
      
      await chrome.storage.local.set({ embeddingHistory: history });
      console.log('💾 History entry saved:', entry);
    } catch (error) {
      console.error('❌ Error saving history entry:', error);
    }
  }

  async loadHistory() {
    try {
      const result = await chrome.storage.local.get('embeddingHistory');
      const history = result.embeddingHistory || [];
      
      this.displayHistory(history);
    } catch (error) {
      console.error('❌ Error loading history:', error);
      this.displayHistory([]);
    }
  }

  displayHistory(history) {
    const historyList = document.getElementById('historyList');
    const noHistory = document.getElementById('noHistory');
    
    if (history.length === 0) {
      noHistory.style.display = 'block';
      // Clear any existing history items
      const existingItems = historyList.querySelectorAll('.history-item');
      existingItems.forEach(item => item.remove());
      return;
    }
    
    noHistory.style.display = 'none';
    
    // Clear existing items
    const existingItems = historyList.querySelectorAll('.history-item');
    existingItems.forEach(item => item.remove());
    
    // Add history items
    history.forEach(entry => {
      const historyItem = this.createHistoryItemElement(entry);
      historyList.appendChild(historyItem);
    });
  }

  createHistoryItemElement(entry) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.entryId = entry.id;
    
    const statusClass = entry.status === 'completed' ? 'completed' : 
                       entry.status === 'failed' ? 'failed' : 'incomplete';
    
    const duration = entry.endTime ? 
      Math.round((entry.endTime - entry.startTime) / 1000 / 60) : 
      '---';
    
    const completionRate = entry.pixelCount > 0 ? 
      Math.round((entry.pixelsPlaced / entry.pixelCount) * 100) : 0;

    item.innerHTML = `
      <div class="history-item-header">
        <h4 class="history-item-title" title="${entry.imageName}">${entry.imageName}</h4>
        <span class="history-item-date">${new Date(entry.startTime).toLocaleDateString()}</span>
      </div>
      
      <div class="history-item-details">
        <div class="history-detail">
          <span class="history-detail-label">Position:</span>
          <span class="history-detail-value">(${entry.coordinates.x}, ${entry.coordinates.y})</span>
        </div>
        <div class="history-detail">
          <span class="history-detail-label">Max Width:</span>
          <span class="history-detail-value">${entry.coordinates.maxWidth}px</span>
        </div>
        <div class="history-detail">
          <span class="history-detail-label">Total Pixels:</span>
          <span class="history-detail-value">${entry.pixelCount.toLocaleString()}</span>
        </div>
        <div class="history-detail">
          <span class="history-detail-label">Completion:</span>
          <span class="history-detail-value">${completionRate}%</span>
        </div>
      </div>
      
      <div class="history-item-stats">
        <div class="history-stats-left">
          <div class="history-stat">
            <span class="history-stat-icon">✅</span>
            <span class="history-stat-value">${entry.pixelsPlaced.toLocaleString()}</span>
          </div>
          ${entry.errors > 0 ? `
            <div class="history-stat">
              <span class="history-stat-icon">❌</span>
              <span class="history-stat-value">${entry.errors}</span>
            </div>
          ` : ''}
          <div class="history-stat">
            <span class="history-stat-icon">⏱️</span>
            <span class="history-stat-value">${duration}m</span>
          </div>
          <div class="history-status ${statusClass}">
            ${entry.status.replace('_', ' ')}
          </div>
        </div>
        
        <div class="history-item-actions">
          <button class="history-action-btn primary" onclick="pixelEmbedderUI.useHistoryCoordinates('${entry.id}')">
            Use Coords
          </button>
          <button class="history-action-btn" onclick="pixelEmbedderUI.deleteHistoryEntry('${entry.id}')">
            Delete
          </button>
        </div>
      </div>
    `;
    
    return item;
  }

  async useHistoryCoordinates(entryId) {
    try {
      const result = await chrome.storage.local.get('embeddingHistory');
      const history = result.embeddingHistory || [];
      const entry = history.find(h => h.id === entryId);
      
      if (entry) {
        // Switch to embed tab
        this.switchTab('embed');
        
        // Set coordinates
        document.getElementById('startX').value = entry.coordinates.x;
        document.getElementById('startY').value = entry.coordinates.y;
        document.getElementById('maxWidth').value = entry.coordinates.maxWidth;
        
        // Update estimation if image is loaded
        this.updateEstimation();
        
        console.log('📍 Applied coordinates from history:', entry.coordinates);
      }
    } catch (error) {
      console.error('❌ Error using history coordinates:', error);
    }
  }

  async deleteHistoryEntry(entryId) {
    if (!confirm('Are you sure you want to delete this history entry?')) {
      return;
    }
    
    try {
      const result = await chrome.storage.local.get('embeddingHistory');
      const history = result.embeddingHistory || [];
      const filteredHistory = history.filter(h => h.id !== entryId);
      
      await chrome.storage.local.set({ embeddingHistory: filteredHistory });
      this.loadHistory(); // Refresh display
      
      console.log('🗑️ History entry deleted:', entryId);
    } catch (error) {
      console.error('❌ Error deleting history entry:', error);
    }
  }

  async clearHistory() {
    if (!confirm('Are you sure you want to clear all embedding history? This cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.local.set({ embeddingHistory: [] });
      this.loadHistory(); // Refresh display
      console.log('🗑️ All history cleared');
    } catch (error) {
      console.error('❌ Error clearing history:', error);
    }
  }

  resetStartButton() {
    const btn = document.getElementById('startEmbedding');
    if (btn) {
      btn.querySelector('.btn-text').style.display = 'block';
      btn.querySelector('.btn-text').textContent = 'Start Embedding';
      btn.querySelector('.btn-loading').style.display = 'none';
      btn.style.background = 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
      btn.disabled = false;
    }
  }

  showProgressSection() {
    document.getElementById('progressSection').style.display = 'block';
  }

  hideProgressSection() {
    document.getElementById('progressSection').style.display = 'none';
  }

  // IMPROVED: Progress tracking that works with any solanaplace.fun tab
  startProgressTracking() {
    // Clear any existing interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    
    console.log('🔄 Starting progress tracking...');
    
    this.progressInterval = setInterval(async () => {
      try {
        let targetTabId = this.connectedTabId;
        
        // If we don't have a stored tab, find any solanaplace.fun tab
        if (!targetTabId) {
          const tabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
          if (tabs.length === 0) {
            console.log('❌ No solanaplace.fun tab found for progress tracking');
            return;
          }
          targetTabId = tabs[0].id;
          this.connectedTabId = targetTabId;
        }
        
        const response = await this.getTabStatus(targetTabId);
        
        if (response) {
          this.updateProgress(response);
          
          // Check if embedding is no longer active
          if (!response.isPlacing && response.queueLength === 0) {
            console.log('✅ Embedding completed, stopping progress tracking');
            this.stopProgressTracking();
            this.isEmbedding = false;
            this.resetStartButton();
            
            // Update history entry with completion
            this.updateHistoryOnCompletion(response);
          }
        } else {
          console.log('❌ No status response received');
        }
      } catch (error) {
        console.error('❌ Error in progress tracking:', error);
      }
    }, 2000); // Check every 2 seconds
    
    console.log('✅ Progress tracking started');
  }

  async updateHistoryOnCompletion(finalStatus) {
    try {
      const result = await chrome.storage.local.get('embeddingHistory');
      const history = result.embeddingHistory || [];
      
      // Find the most recent in_progress entry
      const activeEntry = history.find(h => h.status === 'in_progress');
      if (activeEntry) {
        activeEntry.status = 'completed';
        activeEntry.endTime = Date.now();
        activeEntry.pixelsPlaced = finalStatus.pixelsPlaced || 0;
        activeEntry.errors = finalStatus.errors || 0;
        activeEntry.creditsUsed = activeEntry.creditsAtStart - (finalStatus.credits || 0);
        
        await chrome.storage.local.set({ embeddingHistory: history });
        console.log('📝 History entry updated on completion:', activeEntry);
      }
    } catch (error) {
      console.error('❌ Error updating history on completion:', error);
    }
  }

  stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateProgress(status) {
    if (!status || !status.success) {
      console.log('❌ Invalid status response:', status);
      return;
    }

    const totalPixels = status.pixelsPlaced + status.queueLength;
    const progress = totalPixels > 0 ? (status.pixelsPlaced / totalPixels) * 100 : 0;
    
    console.log(`📊 Progress update: ${status.pixelsPlaced} placed, ${status.queueLength} remaining, ${progress.toFixed(1)}% complete`);
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    
    // Update stats
    const placedElement = document.getElementById('placedCount');
    if (placedElement) {
      placedElement.textContent = status.pixelsPlaced.toLocaleString();
    }
    
    const errorElement = document.getElementById('errorCountProgress');
    if (errorElement) {
      errorElement.textContent = status.errors || 0;
    }
    
    const creditsElement = document.getElementById('creditsRemaining');
    if (creditsElement) {
      creditsElement.textContent = status.credits ? status.credits.toLocaleString() : '-';
      // Update stored credits for future calculations
      if (status.credits !== null && status.credits !== undefined) {
        this.currentCredits = status.credits;
      }
    }
    
    // Calculate and update rate (pixels per minute)
    const rate = status.currentRate ? Math.round(status.currentRate * 60 / 60) : 0;
    const rateElement = document.getElementById('placementRate');
    if (rateElement) {
      rateElement.textContent = `${rate}/min`;
    }
    
    // Check if embedding completed
    if (status.queueLength === 0 && status.isPlacing === false) {
      console.log('✅ Embedding completed!');
      this.stopProgressTracking();
      this.isEmbedding = false;
      this.resetStartButton();
      this.hideProgressSection();
      
      // Show completion message
      setTimeout(() => {
        alert(`🎉 Embedding Complete!\n\nPixels placed: ${status.pixelsPlaced}\nErrors: ${status.errors || 0}`);
      }, 1000);
    }
  }

  // IMPROVED: Stop embedding using connected tab
  async stopEmbedding() {
    try {
      let targetTabId = this.connectedTabId;
      
      // If we don't have a stored tab, find any solanaplace.fun tab
      if (!targetTabId) {
        const tabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
        if (tabs.length === 0) {
          console.log('❌ No solanaplace.fun tab found to stop embedding');
          return;
        }
        targetTabId = tabs[0].id;
      }
      
      chrome.tabs.sendMessage(targetTabId, {action: 'stopEmbedding'});
      
      this.stopProgressTracking();
      this.isEmbedding = false;
      this.resetStartButton();
      this.hideProgressSection();
      
      // Update history entry to incomplete
      this.updateHistoryOnStop();
      
    } catch (error) {
      console.error('Error stopping embedding:', error);
    }
  }

  async updateHistoryOnStop() {
    try {
      const result = await chrome.storage.local.get('embeddingHistory');
      const history = result.embeddingHistory || [];
      
      // Find the most recent in_progress entry
      const activeEntry = history.find(h => h.status === 'in_progress');
      if (activeEntry) {
        activeEntry.status = 'incomplete';
        activeEntry.endTime = Date.now();
        
        await chrome.storage.local.set({ embeddingHistory: history });
        console.log('📝 History entry marked as incomplete:', activeEntry);
      }
    } catch (error) {
      console.error('❌ Error updating history on stop:', error);
    }
  }

  // IMPROVED: Resume data loading using connected tab
  async loadResumeData() {
    try {
      let targetTabId = this.connectedTabId;
      
      // If we don't have a stored tab, find any solanaplace.fun tab
      if (!targetTabId) {
        const tabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
        if (tabs.length === 0) {
          this.showNoSession();
          return;
        }
        targetTabId = tabs[0].id;
      }
      
      chrome.tabs.sendMessage(targetTabId, {action: 'checkSession'}, (response) => {
        if (response && response.hasSession) {
          this.showSessionInfo(response.sessionData);
        } else {
          this.showNoSession();
        }
      });
    } catch (error) {
      this.showNoSession();
    }
  }

  showSessionInfo(sessionData) {
    document.getElementById('noSession').style.display = 'none';
    document.getElementById('sessionInfo').style.display = 'block';
    
    document.getElementById('completedPixels').textContent = sessionData.pixelsPlaced.toLocaleString();
    document.getElementById('remainingPixels').textContent = sessionData.queue.length.toLocaleString();
    document.getElementById('errorCount').textContent = sessionData.errors;
    document.getElementById('lastActive').textContent = new Date(sessionData.timestamp).toLocaleString();
  }

  showNoSession() {
    document.getElementById('noSession').style.display = 'block';
    document.getElementById('sessionInfo').style.display = 'none';
  }

  // IMPROVED: Resume embedding using connected tab
  async resumeEmbedding() {
    const resumeMode = document.querySelector('input[name="resumeMode"]:checked').value;
    const validateMode = resumeMode === 'validate';
    
    try {
      let targetTabId = this.connectedTabId;
      
      // If we don't have a stored tab, find any solanaplace.fun tab
      if (!targetTabId) {
        const tabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
        if (tabs.length === 0) {
          alert('Please navigate to solanaplace.fun first.');
          return;
        }
        targetTabId = tabs[0].id;
      }
      
      chrome.tabs.sendMessage(targetTabId, {
        action: 'resumeEmbedding',
        validateMode: validateMode
      }, (response) => {
        if (response && response.success) {
          this.isEmbedding = true;
          this.switchTab('embed');
          this.showProgressSection();
          this.startProgressTracking();
        } else {
          alert('Failed to resume embedding. ' + (response?.error || 'Unknown error'));
        }
      });
    } catch (error) {
      console.error('Error resuming embedding:', error);
      alert('Error resuming embedding. Please try again.');
    }
  }

  // IMPROVED: Clear session using connected tab
  async clearSession() {
    if (!confirm('Are you sure you want to clear the saved session? This cannot be undone.')) {
      return;
    }
    
    try {
      let targetTabId = this.connectedTabId;
      
      // If we don't have a stored tab, find any solanaplace.fun tab
      if (!targetTabId) {
        const tabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
        if (tabs.length === 0) {
          this.loadResumeData(); // Refresh the display
          return;
        }
        targetTabId = tabs[0].id;
      }
      
      chrome.tabs.sendMessage(targetTabId, {action: 'clearSession'}, (response) => {
        if (response && response.success) {
          this.loadResumeData(); // Refresh the display
        }
      });
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  // IMPROVED: Validate image using connected tab
  async validateImage() {
    try {
      let targetTabId = this.connectedTabId;
      
      // If we don't have a stored tab, find any solanaplace.fun tab
      if (!targetTabId) {
        const tabs = await chrome.tabs.query({url: '*://solanaplace.fun/*'});
        if (tabs.length === 0) {
          document.getElementById('validateMessage').textContent = 'Please navigate to solanaplace.fun first';
          return;
        }
        targetTabId = tabs[0].id;
      }
      
      document.getElementById('validateMessage').textContent = 'Validating image...';
      document.getElementById('validateBtn').disabled = true;
      
      chrome.tabs.sendMessage(targetTabId, {action: 'validateImage'}, (response) => {
        document.getElementById('validateBtn').disabled = false;
        
        if (response && response.success) {
          if (response.missingPixels > 0) {
            document.getElementById('validateMessage').textContent = 
              `Found ${response.missingPixels} missing pixels. Starting recovery...`;
            
            // Switch to embed tab and show progress
            this.switchTab('embed');
            this.showProgressSection();
            this.startProgressTracking();
            this.isEmbedding = true;
          } else {
            document.getElementById('validateMessage').textContent = 
              'Validation complete - no missing pixels found!';
          }
        } else {
          document.getElementById('validateMessage').textContent = 
            'Validation failed: ' + (response?.error || 'Unknown error');
        }
      });
    } catch (error) {
      console.error('Error validating image:', error);
      document.getElementById('validateMessage').textContent = 'Error during validation';
      document.getElementById('validateBtn').disabled = false;
    }
  }
}

// Initialize the UI when popup opens
let pixelEmbedderUI;
document.addEventListener('DOMContentLoaded', () => {
  pixelEmbedderUI = new PixelEmbedderUI();
});