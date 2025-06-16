// This script runs in PAGE CONTEXT (same as manual console script)
// This allows direct access to window.socket and other page variables

class OptimizedPixelEmbedder {
  constructor() {
    this.queue = [];
    this.isPlacing = false;
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.currentCredits = null;
    this.sessionId = null;
    this.originalPixels = [];
    
    // Conservative settings for safety
    this.baseDelay = 400;
    this.universalDelay = 400;
    this.currentTier = 'Standard';
    this.tierLogged = false;
    
    // Burst management
    this.burstTracker = [];
    this.burstLimit = 15;
    this.burstWindow = 10000;
    this.burstSafetyBuffer = 2000;
    
    // Request tracking
    this.requestTimes = [];
    this.lastRequestTime = null;
    
    // CRITICAL: Get socket from page context (same as manual script)
    this.socket = window.socket || null;
    this.checkConnection();
    
    // Wait for socket if not immediately available
    this.waitForSocket();
    
    // Check for existing session on startup - ENHANCED
    this.checkForExistingSession();
    
    // Set up message listener for content script communication
    this.setupMessageListener();
    
    console.log('🚀 Solana Pixel Embedder injected in PAGE CONTEXT');
    console.log('🔌 Socket available:', !!this.socket);
    console.log('🌐 Window object:', !!window);
    console.log('📡 All window keys:', Object.keys(window).filter(k => k.includes('socket') || k.includes('Socket')));
  }

  waitForSocket() {
    // If socket isn't immediately available, wait for it
    if (!this.socket) {
      console.log('🔍 Socket not found, waiting...');
      
      let attempts = 0;
      const checkSocket = () => {
        attempts++;
        this.socket = window.socket || null;
        
        if (this.socket) {
          console.log(`✅ Socket found after ${attempts} attempts`);
          this.checkConnection();
        } else if (attempts < 50) { // Try for 5 seconds
          setTimeout(checkSocket, 100);
        } else {
          console.log('❌ Socket not found after 5 seconds');
        }
      };
      
      setTimeout(checkSocket, 100);
    }
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data.source === 'solana-pixel-embedder-content') {
        this.handleContentMessage(event.data);
      }
    });
  }

  async handleContentMessage(message) {
    const { action, data, callbackId } = message;
    let response = { success: false, error: 'Unknown action' };

    try {
      switch (action) {
        case 'checkConnection':
          response = await this.handleCheckConnection();
          break;
        case 'startEmbedding':
          response = await this.handleStartEmbedding(data.pixels, data.checkExisting);
          break;
        case 'getStatus':
          response = this.handleGetStatus();
          break;
        case 'stopEmbedding':
          response = this.handleStopEmbedding();
          break;
        case 'checkSession':
          response = this.handleCheckSession();
          break;
        case 'resumeEmbedding':
          response = await this.handleResumeEmbedding(data.validateMode);
          break;
        case 'clearSession':
          response = this.handleClearSession();
          break;
        case 'validateImage':
          response = await this.handleValidateImage();
          break;
      }
    } catch (error) {
      response = { success: false, error: error.message };
    }

    // Send response back to content script
    window.postMessage({
      source: 'solana-pixel-embedder',
      callbackId: callbackId,
      response: response
    }, '*');
  }

  async handleCheckConnection() {
    try {
      // Re-check for socket in case it was created after initialization
      if (!this.socket) {
        this.socket = window.socket || null;
      }
      
      const hasSocket = this.socket && this.socket.connected;
      let credits = this.getCurrentCredits();
      
      console.log('🔍 Connection check:');
      console.log('  Socket exists:', !!this.socket);
      console.log('  Socket connected:', hasSocket);
      console.log('  Credits:', credits);
      
      return {
        success: true,
        connected: hasSocket,
        credits: credits
      };
    } catch (error) {
      console.error('❌ Connection check error:', error);
      return {
        success: false,
        connected: false,
        credits: null,
        error: error.message
      };
    }
  }

  // Connection management - EXACTLY like manual script
  checkConnection() {
    if (!this.socket) {
      console.log('❌ No socket connection found. Make sure you\'re connected to Solana Place.');
      return false;
    }
    
    console.log('✅ Found existing socket connection');
    console.log('🔌 Socket state:', this.socket.connected ? 'connected' : 'disconnected');
    
    this.socket.on('rate_limit_info', (info) => {
      this.handleRateLimitInfo(info);
    });
    
    this.socket.emit('get_rate_limit_status');
    return true;
  }

  handleRateLimitInfo(info) {
    if (info && info.tier) {
      this.currentTier = info.tier;
      if (!this.tierLogged) {
        console.log(`🎯 Detected ${info.tier} tier - using ${this.universalDelay}ms delays (150/min)`);
        this.tierLogged = true;
      }
    }
  }

  // Credit detection - EXACTLY like manual script
  getCurrentCredits() {
    try {
      const creditElements = document.querySelectorAll('span.text-sm.font-medium');
      
      for (let element of creditElements) {
        const text = element.textContent.trim();
        if (text.includes('Credits') || text.includes('Credit')) {
          const match = text.match(/(\d+)\s*Credits?/i);
          if (match) {
            this.currentCredits = parseInt(match[1]);
            return this.currentCredits;
          }
        }
      }
      
      const allElements = document.querySelectorAll('*');
      for (let element of allElements) {
        const text = element.textContent.trim();
        if (text.match(/^\d+\s+Credits?$/i)) {
          const match = text.match(/(\d+)/);
          if (match) {
            this.currentCredits = parseInt(match[1]);
            return this.currentCredits;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  async handleStartEmbedding(pixels, checkExisting) {
    try {
      if (!pixels || pixels.length === 0) {
        return { success: false, error: 'No pixels provided' };
      }

      await this.embedImage(pixels, checkExisting);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  handleGetStatus() {
    try {
      const burstUsed = this.burstTracker.filter(time => Date.now() - time < this.burstWindow).length;
      const currentCredits = this.getCurrentCredits();
      
      const status = {
        success: true,
        isPlacing: this.isPlacing,
        queueLength: this.queue.length,
        originalPixelsCount: this.originalPixels.length,
        pixelsPlaced: this.pixelsPlaced,
        errors: this.errors,
        skipped: this.skipped,
        currentRate: this.requestTimes.length,
        tier: this.currentTier,
        burstUsed: burstUsed,
        burstLimit: 15,
        credits: currentCredits,
        delay: this.universalDelay,
        sessionId: this.sessionId,
        hasResumableSession: this.loadProgress() !== null
      };
      
      console.log('📊 Status requested:', {
        isPlacing: status.isPlacing,
        pixelsPlaced: status.pixelsPlaced,
        queueLength: status.queueLength,
        credits: status.credits
      });
      
      return status;
    } catch (error) {
      console.error('❌ Error getting status:', error);
      return { success: false, error: error.message };
    }
  }

  handleStopEmbedding() {
    try {
      this.stop();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  handleCheckSession() {
    try {
      const sessionData = this.loadProgress();
      
      if (sessionData && sessionData.queue && sessionData.queue.length > 0) {
        return {
          success: true,
          hasSession: true,
          sessionData: sessionData
        };
      } else {
        return {
          success: true,
          hasSession: false
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleResumeEmbedding(validateMode) {
    try {
      const success = await this.resumeEmbedding();
      return { success: success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  handleClearSession() {
    try {
      this.clearSession();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleValidateImage() {
    try {
      // Check if we have a session with original pixels
      const saved = this.loadProgress();
      if (!saved || !saved.originalPixels || saved.originalPixels.length === 0) {
        throw new Error('No original pixels found. Can only validate if you have a saved session with original image data.');
      }
      
      // Run validation
      const missingPixels = await this.validateCompletedPixels(saved.originalPixels);
      
      if (missingPixels.length === 0) {
        return {
          success: true,
          missingPixels: 0,
          message: 'Validation complete - no missing pixels found!'
        };
      } else {
        // Start placing missing pixels
        this.sessionId = this.generateSessionId();
        this.originalPixels = saved.originalPixels;
        this.queue = missingPixels;
        this.pixelsPlaced = saved.pixelsPlaced;
        this.errors = saved.errors;
        this.skipped = saved.skipped;
        this.isPlacing = true;
        
        this.processQueue();
        
        return {
          success: true,
          missingPixels: missingPixels.length,
          message: `Found ${missingPixels.length} missing pixels. Starting recovery...`
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Session management - ENHANCED
  generateSessionId() {
    return 'embed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  saveProgress() {
    if (!this.sessionId) return;
    
    const progressData = {
      sessionId: this.sessionId,
      queue: this.queue,
      originalPixels: this.originalPixels,
      pixelsPlaced: this.pixelsPlaced,
      errors: this.errors,
      skipped: this.skipped,
      timestamp: Date.now(),
      isActive: this.isPlacing
    };
    
    try {
      localStorage.setItem('pixelEmbedder_progress', JSON.stringify(progressData));
      console.log('💾 Progress saved:', {
        pixelsPlaced: this.pixelsPlaced,
        queueLength: this.queue.length,
        sessionId: this.sessionId
      });
    } catch (error) {
      console.log('⚠️ Could not save progress:', error.message);
    }
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('pixelEmbedder_progress');
      if (!saved) {
        console.log('📂 No saved progress found');
        return null;
      }
      
      const data = JSON.parse(saved);
      
      // Check if session is recent (within 24 hours)
      const hoursSinceLastSave = (Date.now() - data.timestamp) / (1000 * 60 * 60);
      if (hoursSinceLastSave > 24) {
        console.log('🗑️ Saved session too old (>24h), clearing');
        this.clearProgress();
        return null;
      }
      
      console.log('📂 Loaded saved progress:', {
        pixelsPlaced: data.pixelsPlaced,
        queueLength: data.queue ? data.queue.length : 0,
        timestamp: new Date(data.timestamp).toLocaleString()
      });
      
      return data;
    } catch (error) {
      console.log('⚠️ Could not load progress:', error.message);
      return null;
    }
  }

  clearProgress() {
    try {
      localStorage.removeItem('pixelEmbedder_progress');
      console.log('🗑️ Progress cleared from localStorage');
    } catch (error) {
      console.log('⚠️ Could not clear progress:', error.message);
    }
  }

  checkForExistingSession() {
    const saved = this.loadProgress();
    if (saved && saved.queue && saved.queue.length > 0) {
      console.log('🔄 Found incomplete session from', new Date(saved.timestamp).toLocaleString());
      console.log(`📊 Progress: ${saved.pixelsPlaced} placed, ${saved.queue.length} remaining`);
      
      // Optionally restore session automatically (for debugging)
      if (saved.isActive && saved.sessionId) {
        console.log('🔄 Previous session was active, available for resume');
      }
      
      return true;
    }
    return false;
  }

  // Rate limiting and safety
  async safeDelay() {
    const now = Date.now();
    
    // Clean old request times
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    this.burstTracker = this.burstTracker.filter(time => now - time < this.burstWindow);
    
    // Burst protection
    if (this.burstTracker.length >= this.burstLimit) {
      const oldestBurst = Math.min(...this.burstTracker);
      const timeToWait = this.burstWindow - (now - oldestBurst) + this.burstSafetyBuffer;
      
      if (timeToWait > 0) {
        console.log(`🛡️ Burst protection: waiting ${Math.ceil(timeToWait/1000)}s`);
        await this.sleep(timeToWait);
        this.burstTracker = this.burstTracker.filter(time => Date.now() - time < this.burstWindow);
      }
    }
    
    // Minimum spacing
    if (this.lastRequestTime) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.universalDelay) {
        const waitTime = this.universalDelay - timeSinceLastRequest;
        await this.sleep(waitTime);
      }
    }
    
    // Extra safety delay
    const extraSafety = Math.random() * 100 + 50;
    await this.sleep(extraSafety);
    
    this.lastRequestTime = Date.now();
  }

  recordRequest() {
    const now = Date.now();
    this.requestTimes.push(now);
    this.burstTracker.push(now);
    
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    this.burstTracker = this.burstTracker.filter(time => now - time < this.burstWindow);
  }

  // Pixel placement - EXACTLY like manual script
  async placePixel(x, y, color) {
    return new Promise((resolve, reject) => {
      const event = new CustomEvent('placePixelFromScript', {
        detail: { x, y, color }
      });
      
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Pixel placement timeout'));
        }
      }, 8000);
      
      const successHandler = (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.removeEventListener('pixelPlacedSuccess', successHandler);
          document.removeEventListener('pixelPlacedError', errorHandler);
          this.recordRequest();
          resolve();
        }
      };
      
      const errorHandler = (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.removeEventListener('pixelPlacedSuccess', successHandler);
          document.removeEventListener('pixelPlacedError', errorHandler);
          reject(new Error(e.detail?.message || 'Pixel placement failed'));
        }
      };
      
      document.addEventListener('pixelPlacedSuccess', successHandler);
      document.addEventListener('pixelPlacedError', errorHandler);
      
      document.dispatchEvent(event);
      
      // Fallback socket approach - SAME AS MANUAL SCRIPT
      setTimeout(() => {
        if (!resolved && this.socket) {
          const onSuccess = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.socket.off('pixel_placed_success', onSuccess);
              this.socket.off('pixel_placement_failed', onError);
              this.recordRequest();
              resolve();
            }
          };
          
          const onError = (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.socket.off('pixel_placed_success', onSuccess);
              this.socket.off('pixel_placement_failed', onError);
              reject(new Error(error.error || error.message || 'Pixel placement failed'));
            }
          };
          
          this.socket.once('pixel_placed_success', onSuccess);
          this.socket.once('pixel_placement_failed', onError);
          this.socket.emit('place_pixel', { x, y, color });
        }
      }, 200);
    });
  }

  // Image processing
  async loadImage(file, startX, startY, maxWidth = 100) {
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

  // Pixel checking and validation
  async checkPixelsInRegion(pixels) {
    if (pixels.length === 0) return [];

    const regions = this.groupPixelsIntoRegions(pixels, 50);
    const pixelsToPlace = [];
    
    console.log(`🔍 Checking ${regions.length} regions instead of ${pixels.length} individual pixels...`);

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      console.log(`📊 Checking region ${i + 1}/${regions.length}...`);
      
      try {
        const response = await fetch(`/api/pixels/region/${region.x1}/${region.y1}/${region.x2}/${region.y2}`);
        
        if (response.ok) {
          const data = await response.json();
          const existingPixels = data.pixels || [];
          
          const existingMap = new Map();
          existingPixels.forEach(pixel => {
            existingMap.set(`${pixel.x},${pixel.y}`, pixel.color);
          });
          
          region.pixels.forEach(pixel => {
            const existing = existingMap.get(`${pixel.x},${pixel.y}`);
            if (!existing || existing !== pixel.color) {
              pixelsToPlace.push(pixel);
            } else {
              this.skipped++;
            }
          });
          
        } else if (response.status === 429) {
          console.log(`⚠️ Rate limited on region check, adding all pixels from region`);
          pixelsToPlace.push(...region.pixels);
          await this.sleep(2000);
        } else {
          console.log(`⚠️ Could not check region, adding all pixels from region`);
          pixelsToPlace.push(...region.pixels);
        }
        
        if (i < regions.length - 1) {
          await this.sleep(200);
        }
        
      } catch (error) {
        console.log(`⚠️ Error checking region, adding all pixels from region:`, error.message);
        pixelsToPlace.push(...region.pixels);
      }
    }

    console.log(`✅ Check complete: ${pixelsToPlace.length} pixels need placement, ${this.skipped} already correct`);
    return pixelsToPlace;
  }

  groupPixelsIntoRegions(pixels, regionSize = 50) {
    const regions = [];
    const regionMap = new Map();
    
    pixels.forEach(pixel => {
      const regionX = Math.floor(pixel.x / regionSize) * regionSize;
      const regionY = Math.floor(pixel.y / regionSize) * regionSize;
      const regionKey = `${regionX},${regionY}`;
      
      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, {
          x1: regionX,
          y1: regionY,
          x2: Math.min(regionX + regionSize - 1, 2999),
          y2: Math.min(regionY + regionSize - 1, 1999),
          pixels: []
        });
      }
      
      regionMap.get(regionKey).pixels.push(pixel);
    });
    
    return Array.from(regionMap.values());
  }

  async validateCompletedPixels(originalPixels) {
    console.log('🔍 Validating completed pixels to find any that were missed...');
    
    const missingPixels = await this.checkPixelsInRegion(originalPixels);
    
    if (missingPixels.length === 0) {
      console.log('✅ Image validation complete - no missing pixels found!');
      return [];
    } else {
      console.log(`🔧 Found ${missingPixels.length} missing pixels that need to be placed`);
      return missingPixels;
    }
  }

  // Main embedding functions
  async embedImage(pixels, checkExisting = true) {
    console.log(`🚀 Starting image embedding...`);
    console.log(`🔍 Check existing pixels: ${checkExisting}`);
    console.log(`⚡ Using universal ${this.universalDelay}ms delays for maximum safety`);

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return;
    }

    if (this.socket) {
      this.socket.emit('get_rate_limit_status');
      await this.sleep(300);
    }

    // Create new session and store original pixels
    this.sessionId = this.generateSessionId();
    this.originalPixels = [...pixels];
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.burstTracker = [];
    this.lastRequestTime = null;
    let finalPixels = pixels;

    if (checkExisting && pixels.length > 10) {
      try {
        finalPixels = await this.checkPixelsInRegion(pixels);
        console.log(`💰 Final pixels needed: ${finalPixels.length} (after filtering existing)`);
      } catch (error) {
        console.log('⚠️ Error during region check, proceeding with all pixels:', error.message);
        finalPixels = pixels;
      }
    }

    if (finalPixels.length === 0) {
      console.log('🎉 All pixels already correct! Nothing to do.');
      return;
    }

    this.queue = [...finalPixels];
    this.isPlacing = true;
    
    const pixelsPerMinute = Math.floor(60000 / this.universalDelay);
    const estimatedTime = Math.ceil(this.queue.length / pixelsPerMinute);
    
    console.log(`🎯 Starting placement of ${this.queue.length} pixels...`);
    console.log(`⏱️ Estimated time: ${estimatedTime} minutes at 150 pixels/min`);
    console.log(`💾 Progress will be saved automatically`);

    this.saveProgress();
    await this.processQueue();
  }

  async processQueue() {
    const startTime = Date.now();
    
    while (this.queue.length > 0 && this.isPlacing) {
      const pixel = this.queue.shift();
      
      try {
        await this.safeDelay();
        await this.placePixel(pixel.x, pixel.y, pixel.color);
        this.pixelsPlaced++;
        
        if (this.pixelsPlaced % 10 === 0) {
          this.saveProgress();
        }
        
        if (this.pixelsPlaced % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = this.pixelsPlaced / (elapsed / 60);
          const creditsRemaining = this.getCurrentCredits();
          console.log(`🎨 ${this.pixelsPlaced} placed | ${this.queue.length} remaining | ${Math.round(rate)}/min | Credits: ${creditsRemaining || '?'}`);
        }

      } catch (error) {
        this.errors++;
        console.error(`❌ Failed pixel at (${pixel.x}, ${pixel.y}):`, error.message);
        
        this.saveProgress();
        
        if (error.message.toLowerCase().includes('burst limit')) {
          console.log('🛑 Burst limit hit - extended cooldown');
          this.burstTracker = [];
          await this.sleep(15000);
        } else if (error.message.toLowerCase().includes('rate') || error.message.toLowerCase().includes('limit')) {
          console.log('⚠️ Rate limit - waiting');
          await this.sleep(10000);
        } else if (error.message.toLowerCase().includes('credit')) {
          console.log('💰 Out of credits - stopping');
          this.isPlacing = false;
          break;
        } else {
          await this.sleep(1000);
        }
      }
    }

    this.isPlacing = false;
    
    if (this.queue.length === 0) {
      this.clearProgress();
    } else {
      this.saveProgress();
    }
    
    this.showSummary();
  }

  async resumeEmbedding() {
    const saved = this.loadProgress();
    if (!saved || !saved.queue || saved.queue.length === 0) {
      console.log('❌ No session to resume');
      return false;
    }

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return false;
    }

    // Restore state
    this.sessionId = saved.sessionId;
    this.queue = saved.queue;
    this.originalPixels = saved.originalPixels || [];
    this.pixelsPlaced = saved.pixelsPlaced;
    this.errors = saved.errors;
    this.skipped = saved.skipped;

    console.log(`🔄 Resuming session: ${saved.pixelsPlaced} completed, ${this.queue.length} remaining`);
    
    // Check for missing pixels if we have original data
    const hasOriginalPixels = this.originalPixels && this.originalPixels.length > 0;
    
    if (hasOriginalPixels) {
      console.log('🔍 Validating for missing pixels...');
      try {
        const missingPixels = await this.validateCompletedPixels(this.originalPixels);
        if (missingPixels.length > 0) {
          this.queue = [...missingPixels, ...this.queue];
          console.log(`🔧 Added ${missingPixels.length} missing pixels to queue`);
        }
      } catch (error) {
        console.log('⚠️ Validation failed, continuing with existing queue:', error.message);
      }
    }
    
    this.isPlacing = true;
    this.processQueue();
    return true;
  }

  clearSession() {
    this.clearProgress();
    this.queue = [];
    this.originalPixels = [];
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.sessionId = null;
    this.isPlacing = false;
    console.log('🗑️ Session cleared');
  }

  stop() {
    console.log('🛑 Stopping pixel placement...');
    this.isPlacing = false;
  }

  showSummary() {
    const finalCredits = this.getCurrentCredits();
    console.log('\n🎉 ===== COMPLETE =====');
    console.log(`✅ Pixels placed: ${this.pixelsPlaced}`);
    console.log(`⏭️ Pixels skipped: ${this.skipped}`);
    console.log(`❌ Errors: ${this.errors}`);
    console.log(`💰 Credits remaining: ${finalCredits || 'Unknown'}`);
    
    if (this.queue.length > 0) {
      console.log(`🔄 Pixels remaining: ${this.queue.length}`);
    }
    
    console.log('======================\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize embedder when script loads
function initEmbedder() {
  if (!window.embedder) {
    window.embedder = new OptimizedPixelEmbedder();
    console.log('✅ Solana Pixel Embedder initialized for extension use');
  }
  return window.embedder;
}

// Export to global scope
window.initEmbedder = initEmbedder;
window.OptimizedPixelEmbedder = OptimizedPixelEmbedder;

// Auto-initialize
initEmbedder();